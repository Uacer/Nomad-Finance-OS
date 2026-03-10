import os
import json
import time
from typing import Dict, Any, List

from pm_http import request_json
import datetime
import html

# Config
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
FILES_TO_WATCH = [
    "/root/.openclaw/workspace/polymarket-bot/events.jsonl",
    "/root/.openclaw/workspace/polymarket-bot/tail_events.jsonl"
]
STATE_FILE = "/root/.openclaw/workspace/polymarket-bot/notifier_state.json"

def normalize_event_type(event_type: str) -> str:
    if event_type in {"takeprofit_sell", "take_profit", "early_exit_sell", "early_exit"}:
        return "takeprofit_sell"
    return event_type

def send_tg(msg):
    if not TELEGRAM_TOKEN or not CHAT_ID:
        return
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage"
    try:
        # Use HTML parse mode for better stability with paths/slugs
        request_json(
            "POST",
            url,
            json_body={"chat_id": CHAT_ID, "text": msg, "parse_mode": "HTML"},
            timeout=10,
            retries=3,
            backoff_base=1.6,
            respect_retry_after=True,
        )
    except Exception as e:
        print(f"Failed to send TG: {e}")

def format_event(evt):
    etype = normalize_event_type(evt.get("type"))
    success = evt.get("success", True)
    
    emoji = "✅" if success else "❌"
    title = ""
    
    if etype == "entry_buy":
        title = f"{emoji} <b>新订单：扫尾盘买入</b>"
    elif etype == "takeprofit_sell":
        title = f"{emoji} <b>新订单：提前结算 (获利退出)</b>"
    elif etype == "stoploss_sell":
        title = f"{emoji} <b>新订单：止损卖出</b>"
    elif etype == "order":
        side = "买入" if evt.get("side") == "BUY" else "卖出"
        title = f"{emoji} <b>新订单：跟随成交 ({side})</b>"
    elif etype == "order_err":
        title = f"❌ <b>下单失败</b>"
    elif etype == "alert":
        return f"⚠️ <b>系统警报</b>\n{evt.get('msg')}"
    else:
        return None

    lines = [title]
    # Escape HTML to prevent broken tags (e.g., Brighton & Hove)
    display_name = html.escape(evt.get("title") or evt.get("slug") or "Unknown")
    lines.append(f"📌 市场：{display_name}")
    
    if "outcome" in evt:
        lines.append(f"🔢 预测项：{html.escape(str(evt.get('outcome')))}")
    elif "side" in evt:
        lines.append(f"↕️ 方向：{evt.get('side')}")
        
    lines.append(f"💰 价格：{evt.get('px') or evt.get('price', 'N/A')}")
    lines.append(f"📊 数量：{evt.get('sz') or evt.get('size', 'N/A')}")
    
    if "notional" in evt:
        lines.append(f"💵 价值：{evt.get('notional', 0):.2f} USDC")
        
    if "end" in evt:
        end_raw = evt.get("end")
        end_pretty = end_raw
        try:
            if "T" in end_raw:
                dt = datetime.datetime.strptime(end_raw.split(".")[0].replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
                # Convert to UTC+8
                dt_8 = dt + datetime.timedelta(hours=8)
                end_pretty = dt_8.strftime("%m-%d %H:%M") + " (东八区)"
        except: pass
        lines.append(f"📅 结束时间：{end_pretty}")
        
    if "cash" in evt:
        lines.append(f"💳 账户余额：{evt.get('cash', 0):.2f} USDC")
    elif "cash_usdc" in evt:
        lines.append(f"💳 账户余额：{evt.get('cash_usdc', 0):.2f} USDC")

    if "percent_pnl" in evt:
        pnl = evt.get("percent_pnl", 0)
        pnl_emoji = "📈" if pnl >= 0 else "📉"
        lines.append(f"{pnl_emoji} 当前 PnL：{pnl:.2f}% (${evt.get('cash_pnl', 0):.2f})")

    if not success and "errorMsg" in evt:
        lines.append(f"\n⚠️ 错误详情：{evt.get('errorMsg')}")
    elif etype == "order_err" and "err" in evt:
        lines.append(f"\n⚠️ 错误详情：{evt.get('err')}")

    return "\n".join(lines)

def main():
    # Initialize state (per-file offset + inode)
    state: Dict[str, Dict[str, Any]] = {}
    if os.path.exists(STATE_FILE):
        try:
            with open(STATE_FILE, "r") as f:
                loaded = json.load(f)
                if isinstance(loaded, dict):
                    state = loaded
        except:
            pass

    # If first run, start from end of files
    for fpath in FILES_TO_WATCH:
        if fpath not in state and os.path.exists(fpath):
            st = os.stat(fpath)
            state[fpath] = {"offset": int(st.st_size), "inode": int(st.st_ino)}

    print(f"Notifier started, watching {len(FILES_TO_WATCH)} files...")
    if not TELEGRAM_TOKEN or not CHAT_ID:
        print("WARNING: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID not set; notifications disabled.")

    while True:
        for fpath in FILES_TO_WATCH:
            if not os.path.exists(fpath):
                continue

            try:
                st = os.stat(fpath)
                info = state.get(fpath) or {"offset": 0, "inode": int(st.st_ino)}
                offset = int(info.get("offset", 0))
                inode = int(info.get("inode", st.st_ino))

                # Handle rotation/truncation
                if inode != int(st.st_ino) or offset > int(st.st_size):
                    offset = 0

                new_lines: List[str] = []
                with open(fpath, "r", encoding="utf-8") as f:
                    f.seek(offset)
                    new_lines = f.readlines()
                    offset = f.tell()

                if new_lines:
                    for nl in new_lines:
                        try:
                            evt = json.loads(nl.strip())
                            msg = format_event(evt)
                            if msg:
                                send_tg(msg)
                        except Exception as e:
                            print(f"Error parsing line: {e}")

                state[fpath] = {"offset": int(offset), "inode": int(st.st_ino)}
                with open(STATE_FILE, "w", encoding="utf-8") as sf:
                    json.dump(state, sf)
            except Exception as e:
                print(f"Error processing {fpath}: {e}")
        
        time.sleep(5)

if __name__ == "__main__":
    main()
