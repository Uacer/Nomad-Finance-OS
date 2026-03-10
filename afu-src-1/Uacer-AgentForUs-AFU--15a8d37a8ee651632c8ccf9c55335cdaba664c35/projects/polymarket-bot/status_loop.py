import os
import json
import requests

from pm_http import request_json
import datetime
import time
import html

# Config
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
USDC_POS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
RPC = "https://polygon-rpc.com"

def get_usdc_balance(address):
    data = "0x70a08231" + address[2:].rjust(64, "0")
    try:
        r = requests.post(RPC, json={"jsonrpc": "2.0", "id": 1, "method": "eth_call", "params": [{"to": USDC_POS, "data": data}, "latest"]}, timeout=10)
        bal = int(r.json().get("result", "0x0"), 16)
        return bal / 1e6
    except: return 0.0

def send_tg(msg):
    if not TELEGRAM_TOKEN or not CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        # Use HTML parse mode for better stability, escape all content
        request_json(
            "POST",
            url,
            json_body={
                "chat_id": CHAT_ID,
                "text": msg,
                "parse_mode": "HTML",
                "disable_web_page_preview": True,
            },
            timeout=15,
            retries=3,
            backoff_base=1.6,
            respect_retry_after=True,
        )
    except Exception as e:
        print(f"Failed to send TG: {e}")

def get_status():
    addr = os.environ.get("PM_FUNDER") or os.environ.get("PM_SIGNER_ADDR")
    if not addr: return "Error: No address found."

    # 1. Get cash
    cash = get_usdc_balance(addr)

    # 2. Get positions
    try:
        pos = request_json(
            "GET",
            "https://data-api.polymarket.com/positions",
            params={"user": addr},
            timeout=20,
            retries=2,
            backoff_base=1.6,
        )
        pos_data = [p for p in pos if float(p.get("size", 0)) > 0.01]
    except: pos_data = []

    # 3. Get market details
    market_map = {}
    if pos_data:
        try:
            slugs = list(set(p.get("slug") for p in pos_data if p.get("slug")))
            for slug in slugs:
                markets = request_json(
                    "GET",
                    "https://gamma-api.polymarket.com/markets",
                    params={"slug": slug, "active": "true"},
                    timeout=10,
                    retries=2,
                    backoff_base=1.6,
                )
                if markets:
                    m = markets[0]
                    market_map[m.get("conditionId")] = m
        except: pass

    # Build Message
    total_val = 0
    pos_lines = []
    pos_data.sort(key=lambda x: x.get("endDate", "9999-12-31"))
    
    for i, p in enumerate(pos_data, 1):
        slug = p.get("slug")
        outcome = html.escape(str(p.get("outcome")))
        size = float(p.get("size", 0))
        avg_px = float(p.get("avgPrice", 0))
        cur_px = float(p.get("curPrice", 0))
        val = float(p.get("currentValue", 0))
        total_val += val
        
        m_info = market_map.get(p.get("conditionId"), {})
        end_time_raw = m_info.get("endDate") or p.get("endDate") or "Unknown"
        start_time_raw = m_info.get("startDate", "Unknown")
        display_title = html.escape(m_info.get("question") or p.get("title") or slug)
        market_url = f"https://polymarket.com/market/{slug}"
        
        end_time = end_time_raw
        if end_time != "Unknown":
            try:
                if "T" not in end_time: end_time += "T23:59:59Z"
                dt = datetime.datetime.strptime(end_time.split(".")[0].replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
                dt_8 = dt + datetime.timedelta(hours=8)
                end_time = dt_8.strftime("%m-%d %H:%M") + " (东八区)"
            except: pass
            
        start_time = start_time_raw
        if start_time != "Unknown":
            try:
                dt = datetime.datetime.strptime(start_time.split(".")[0].replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
                dt_8 = dt + datetime.timedelta(hours=8)
                start_time = dt_8.strftime("%m-%d %H:%M") + " (东八区)"
            except: pass

        line = (f"{i}. <b>{display_title}</b>\n"
                f" • 链接：{market_url}\n"
                f" • 预测项：{outcome}\n"
                f" • 买入价格：{avg_px:.4f}\n"
                f" • 当前价格：{cur_px:.4f}\n"
                f" • 持有数量：{size:.2f} 份 (价值 ${val:.2f})\n"
                f" • 开始：<code>{start_time}</code>\n"
                f" • 结束：<code>{end_time}</code>")
        pos_lines.append(line)

    msg = (f"📊 <b>Polymarket 实时状态报告</b>\n\n"
           f"💰 <b>账户余额</b>\n"
           f" • 可用现金：{cash:.2f} USDC\n"
           f" • 持仓估值：{total_val:.2f} USDC\n"
           f" • 账户总资产：<b>{cash + total_val:.2f} USDC</b>\n\n"
           f"🛡 <b>当前持仓详情</b>\n" + "\n".join(pos_lines))
    
    if not pos_lines:
        msg += "目前暂无持仓。"

    return msg

TRIGGER_FILE = "/tmp/pm_status_trigger"

def check_trigger():
    if os.path.exists(TRIGGER_FILE):
        try:
            os.remove(TRIGGER_FILE)
            return True
        except: pass
    return False

def main():
    print("Status Loop started (30-minute interval + manual trigger)")
    if not TELEGRAM_TOKEN or not CHAT_ID:
        print("WARNING: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set; status messages disabled.")
    last_sent_minute = -1  # 记录上次发送的分钟数
    
    while True:
        try:
            now = datetime.datetime.now()
            
            # 手动触发
            if check_trigger():
                print(f"[{now.isoformat()}] Manual trigger detected!")
                msg = get_status()
                send_tg(msg)
            
            # 每 30 分钟自动发送 (00, 30)
            # 允许在 00-02 分钟或 30-32 分钟内触发（容错窗口）
            current_minute = now.minute
            
            # 判断是否在发送窗口内（00-02 或 30-32）
            in_send_window = (0 <= current_minute <= 2) or (30 <= current_minute <= 32)
            
            # 判断是否需要发送（在窗口内，且上次发送不是这个时段）
            current_half_hour = 0 if current_minute < 30 else 30
            
            if in_send_window and last_sent_minute != current_half_hour:
                print(f"[{now.isoformat()}] 30-minute window reached (minute: {current_minute}). Sending status...")
                msg = get_status()
                send_tg(msg)
                last_sent_minute = current_half_hour  # 记录这个时段已发送
                print(f"[{now.isoformat()}] Status sent successfully!")
            
            # 心跳日志（每分钟输出一次）
            if now.second < 5:
                next_mark = 0 if current_minute >= 30 else 30
                if current_minute >= 30:
                    next_mark = 0  # 下一个小时的 00 分
                print(f"[{now.isoformat()}] Loop alive. Next auto-send at :{next_mark:02d}")
                time.sleep(5)
                
            time.sleep(2)
            
        except Exception as e:
            print(f"Error in loop: {e}")
            import traceback
            traceback.print_exc()
            time.sleep(60)

if __name__ == "__main__":
    main()
