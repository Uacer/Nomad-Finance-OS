#!/usr/bin/env python3
"""
Polymarket Bot Dashboard - 轻量级实时监控看板
"""
import json
import os
import time
import secrets
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, jsonify, request, session
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

# Configuration
DASHBOARD_PASSWORD = os.environ.get("DASHBOARD_PASSWORD", "").strip()
SESSION_COOKIE_NAME = "dashboard_session"
app.config["SESSION_COOKIE_NAME"] = SESSION_COOKIE_NAME
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"
app.config["SESSION_COOKIE_SECURE"] = bool(os.environ.get("DASHBOARD_SECURE_COOKIE", "").strip() == "1")
app.secret_key = os.environ.get("DASHBOARD_SECRET_KEY", "").strip() or secrets.token_hex(32)
DATA_API = "https://data-api.polymarket.com"
USDC_POS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
POLYGON_RPC = os.environ.get("POLYGON_RPC", "https://polygon-rpc.com")

CONFIG_PATH = os.environ.get("PM_TAIL_CONFIG", "tail_config.json")


def normalize_event_type(event_type: str) -> str:
    if event_type in {"takeprofit_sell", "take_profit", "early_exit_sell", "early_exit"}:
        return "takeprofit_sell"
    if event_type in {"stoploss_sell", "stop_loss"}:
        return "stoploss_sell"
    return event_type or "unknown"


def is_authed() -> bool:
    if not DASHBOARD_PASSWORD:
        return True
    return bool(session.get("dashboard_auth") is True)


def require_auth(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        if not is_authed():
            return jsonify({"error": "Unauthorized"}), 401
        return fn(*args, **kwargs)
    return wrapper


def render_login_page(show_error: bool = False):
    error_block = '<div class="error">Invalid password</div>' if show_error else ""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Dashboard Login</title>
        <style>
            body {{
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
                background: #0a0a0a;
                color: #e5e5e5;
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
            }}
            .login-box {{
                background: #111;
                border: 1px solid #222;
                border-radius: 8px;
                padding: 40px;
                width: 100%;
                max-width: 400px;
            }}
            h1 {{
                font-size: 24px;
                margin-bottom: 24px;
                color: #fff;
            }}
            input {{
                width: 100%;
                padding: 12px;
                background: #0a0a0a;
                border: 1px solid #333;
                border-radius: 6px;
                color: #e5e5e5;
                font-size: 16px;
                margin-bottom: 16px;
            }}
            button {{
                width: 100%;
                padding: 12px;
                background: #3b82f6;
                border: none;
                border-radius: 6px;
                color: white;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
            }}
            button:hover {{
                background: #2563eb;
            }}
            .error {{
                color: #ef4444;
                font-size: 14px;
                margin-top: 12px;
            }}
        </style>
    </head>
    <body>
        <div class="login-box">
            <h1>Dashboard Login</h1>
            <form method="POST" action="/login">
                <input type="password" name="password" placeholder="Enter password" required autofocus>
                <button type="submit">Access Dashboard</button>
            </form>
            {error_block}
        </div>
    </body>
    </html>
    """


def load_config():
    """加载机器人配置"""
    try:
        with open(CONFIG_PATH, "r") as f:
            return json.load(f)
    except:
        return {}


def get_config_source_path():
    """Expose which config file path the dashboard is reading."""
    try:
        return os.path.abspath(CONFIG_PATH)
    except:
        return CONFIG_PATH

def get_account_address():
    """获取账户地址"""
    return os.environ.get("PM_FUNDER") or os.environ.get("PM_SIGNER_ADDR", "")

def get_usdc_balance(address):
    """获取 USDC 余额"""
    try:
        data = "0x70a08231" + address[2:].rjust(64, "0")
        resp = requests.post(POLYGON_RPC, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_call",
            "params": [{"to": USDC_POS, "data": data}, "latest"],
        }, timeout=10)
        bal = int(resp.json().get("result", "0x0"), 16)
        return bal / 1e6
    except:
        return 0

def get_pol_balance(address):
    """获取 POL (Gas) 余额"""
    try:
        resp = requests.post(POLYGON_RPC, json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_getBalance",
            "params": [address, "latest"],
        }, timeout=10)
        bal = int(resp.json().get("result", "0x0"), 16)
        return bal / 1e18
    except:
        return 0

def get_positions(address):
    """获取活跃仓位"""
    try:
        r = requests.get(f"{DATA_API}/positions", params={"user": address, "limit": 200}, timeout=30)
        r.raise_for_status()
        positions = r.json()
        return [p for p in positions if float(p.get("size", 0)) > 0.01]
    except:
        return []

def get_circuit_breaker_state():
    """获取熔断器状态"""
    try:
        with open("circuit_breaker_state.json", "r") as f:
            return json.load(f)
    except:
        return {"date": "", "baseline": 0}

def get_recent_events(limit=50):
    """获取最近的交易事件"""
    events = []
    try:
        with open("tail_events.jsonl", "r") as f:
            lines = f.readlines()
            for line in lines[-limit:]:
                try:
                    events.append(json.loads(line.strip()))
                except:
                    pass
    except:
        pass
    return list(reversed(events))


def get_trade_metrics(trades_path="trades_history.jsonl"):
    """Compute dashboard metrics from trades_history.jsonl.

    Metrics:
      - win rate (by pnl.cash > 0)
      - avg hold time (requires entry_time if present; otherwise None)
      - max drawdown (from cumulative pnl equity curve)

    Returns a dict with nullable numbers.
    """
    try:
        if not os.path.exists(trades_path):
            return {"winRatePct": None, "avgHoldMinutes": None, "maxDrawdownPct": None}

        trades = []
        with open(trades_path, "r") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    trades.append(json.loads(line))
                except:
                    continue

        if not trades:
            return {"winRatePct": None, "avgHoldMinutes": None, "maxDrawdownPct": None}

        # sort by time to build equity curve
        trades.sort(key=lambda t: int(t.get("exit_time") or t.get("t") or 0))

        # Win rate
        pnls = []
        wins = 0
        for t in trades:
            cash = None
            pnl = t.get("pnl") or {}
            if isinstance(pnl, dict):
                cash = pnl.get("cash")
            if cash is None:
                cash = t.get("cash_pnl")
            try:
                cash = float(cash)
            except:
                cash = 0.0
            pnls.append(cash)
            if cash > 0:
                wins += 1
        win_rate_pct = 100.0 * wins / max(1, len(trades))

        # Avg hold time (optional)
        holds = []
        for t in trades:
            et = t.get("entry_time") or t.get("open_time")
            xt = t.get("exit_time") or t.get("close_time")
            try:
                et = int(et)
                xt = int(xt)
                if et > 0 and xt > 0 and xt >= et:
                    holds.append((xt - et) / 60.0)
            except:
                pass
        avg_hold_min = (sum(holds) / len(holds)) if holds else None

        # Max drawdown from cumulative pnl curve
        equity = 0.0
        peak = 0.0
        max_dd = 0.0
        for cash in pnls:
            equity += float(cash)
            if equity > peak:
                peak = equity
            dd = peak - equity
            if dd > max_dd:
                max_dd = dd
        # Normalize drawdown percentage to avoid misleading >100% values when equity curve peak is small.
        denom = peak if peak > 1.0 else 1.0
        max_dd_pct = 100.0 * max_dd / denom

        return {
            "winRatePct": win_rate_pct,
            "avgHoldMinutes": avg_hold_min,
            "maxDrawdownPct": max_dd_pct,
            "maxDrawdownCash": max_dd,
        }
    except Exception:
        return {"winRatePct": None, "avgHoldMinutes": None, "maxDrawdownPct": None}

def check_bot_status():
    """检查机器人运行状态"""
    import subprocess
    try:
        result = subprocess.run(
            ["ps", "aux"], 
            capture_output=True, 
            text=True, 
            timeout=5
        )
        # Split architecture: entry_bot + exit_bot are the canonical services.
        running = {
            "entry_bot": "entry_bot.py" in result.stdout,
            "exit_bot": "exit_bot.py" in result.stdout,
            "notifier": "notifier.py" in result.stdout,
            "status_loop": "status_loop.py" in result.stdout,
        }
        return running
    except:
        return {"tail_bot": False, "notifier": False, "status_loop": False}

@app.route('/')
def index():
    """主页面"""
    if not is_authed():
        return render_login_page(show_error=False), 401
    return render_template('dashboard.html')


@app.route('/login', methods=['POST'])
def login():
    if not DASHBOARD_PASSWORD:
        return ("Dashboard password is not configured.", 400)
    password = (request.form.get('password') or "").strip()
    if password != DASHBOARD_PASSWORD:
        session.clear()
        return render_login_page(show_error=True), 401
    session["dashboard_auth"] = True
    return render_template('dashboard.html')


@app.route('/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"ok": True})

@app.route('/api/status')
@require_auth
def api_status():
    """获取完整状态数据 - 需要验证"""
    addr = get_account_address()
    
    # 资产数据
    usdc_balance = get_usdc_balance(addr)
    pol_balance = get_pol_balance(addr)
    positions = get_positions(addr)
    positions_value = sum(float(p.get("currentValue", 0)) for p in positions)
    total_value = usdc_balance + positions_value
    
    # 熔断器状态
    breaker_state = get_circuit_breaker_state()
    baseline = breaker_state.get("baseline", total_value)
    drawdown = 0 if baseline <= 0 else (baseline - total_value) / baseline
    
    config = load_config()
    # IMPORTANT: Do not invent a default threshold.
    # If missing, show "unknown" (None) and treat breaker as active for display safety.
    breaker_threshold = config.get("circuit_breaker_threshold", None)
    is_breaker_active = True if breaker_threshold is None else (drawdown >= float(breaker_threshold))
    
    # 机器人运行状态
    bot_status = check_bot_status()
    
    # 统计数据
    events = get_recent_events(1000)
    trades_today = len([
        e for e in events
        if normalize_event_type(e.get("type")) in {"entry_buy", "stoploss_sell", "takeprofit_sell"}
    ])
    errors_today = len([e for e in events if e.get("success") == False])

    metrics = get_trade_metrics()
    
    # 获取市场详情（查询完整的 endDate）
    market_end_dates = {}
    slugs = [p.get("slug") for p in positions if p.get("slug")]
    if slugs:
        try:
            # 使用 slugs 批量查询（最多20个）
            params = [("slug", slug) for slug in slugs[:20]]
            r = requests.get(f"https://gamma-api.polymarket.com/markets", 
                           params=params, timeout=10)
            if r.status_code == 200:
                markets = r.json()
                for m in markets:
                    market_end_dates[m.get("slug")] = m.get("endDate", "")
        except Exception as e:
            print(f"Error fetching market end dates: {e}")
    
    # 格式化持仓数据
    formatted_positions = []
    for p in positions:
        slug = p.get("slug", "")
        # 优先使用完整的 endDate，否则使用 positions 中的日期
        end_date = market_end_dates.get(slug) or p.get("endDate", "")
        
        formatted_positions.append({
            "slug": slug,
            "title": p.get("title", ""),
            "outcome": p.get("outcome", ""),
            "size": float(p.get("size", 0)),
            "avgPrice": float(p.get("avgPrice", 0)),
            "curPrice": float(p.get("curPrice", 0)),
            "currentValue": float(p.get("currentValue", 0)),
            "cashPnl": float(p.get("cashPnl", 0)),
            "percentPnl": float(p.get("percentPnl", 0)),
            "endDate": end_date,
            "marketUrl": f"https://polymarket.com/market/{slug}"
        })
    
    return jsonify({
        "timestamp": int(time.time()),
        "account": {
            "address": addr,
            "usdcBalance": round(usdc_balance, 2),
            "polBalance": round(pol_balance, 4),
            "positionsValue": round(positions_value, 2),
            "totalValue": round(total_value, 2),
            "baseline": round(baseline, 2),
            "drawdown": round(drawdown * 100, 2),
        },
        "bot": {
            "running": bot_status,
            "allRunning": all(bot_status.values()),
            "breakerActive": is_breaker_active,
            "breakerThreshold": (round(float(breaker_threshold) * 100, 1) if breaker_threshold is not None else None),
            "breakerThresholdSource": get_config_source_path(),
        },
        "positions": formatted_positions,
        "stats": {
            "tradesToday": trades_today,
            "errorsToday": errors_today,
            "openPositions": len(formatted_positions),
            "metrics": metrics,
        }
    })

@app.route('/api/events')
@require_auth
def api_events():
    """获取事件日志 - 需要验证"""
    limit = int(request.args.get('limit', 100))
    event_type = request.args.get('type', 'all')
    
    events = get_recent_events(limit * 2)  # 获取更多以便过滤
    
    # 过滤
    if event_type == 'error':
        events = [e for e in events if e.get('success') is False]
    elif event_type == 'sell':
        events = [
            e for e in events
            if normalize_event_type(e.get('type')) in {'takeprofit_sell', 'stoploss_sell'}
        ]
    elif event_type != 'all':
        events = [e for e in events if normalize_event_type(e.get('type')) == event_type]
    
    return jsonify({
        "events": events[:limit]
    })

@app.route('/api/closed_positions')
@require_auth
def api_closed_positions():
    """获取已平仓交易 - 需要验证"""
    limit = int(request.args.get('limit', 50))
    
    # 从事件日志中提取所有卖出记录
    events = get_recent_events(1000)
    closed = []
    
    for e in events:
        normalized_type = normalize_event_type(e.get('type'))
        if normalized_type in ['takeprofit_sell', 'stoploss_sell', 'redeem']:
            closed.append({
                'timestamp': e.get('t', 0),
                'type': normalized_type,
                'market': e.get('title') or e.get('slug', ''),
                'outcome': e.get('outcome', ''),
                'size': e.get('sz', 0),
                'entryPrice': e.get('avg_price', 0),  # 买入均价
                'exitPrice': e.get('px', 0),  # 卖出价格
                'success': e.get('success', True),
                'pnl': e.get('cash_pnl', 0),
                'pnlPercent': e.get('percent_pnl', 0)
            })
    
    return jsonify({
        "closedPositions": closed[:limit]
    })

if __name__ == '__main__':
    # 检查密码保护
    if DASHBOARD_PASSWORD:
        print(f"⚠️  Dashboard password protection is enabled")
    else:
        print(f"⚠️  WARNING: No password set. Set DASHBOARD_PASSWORD env var for security.")
    if not os.environ.get("DASHBOARD_SECRET_KEY", "").strip():
        print("⚠️  WARNING: DASHBOARD_SECRET_KEY not set; using ephemeral key for this process.")
    
    # 启动服务器
    print(f"🚀 Dashboard starting on http://0.0.0.0:8080")
    app.run(host='0.0.0.0', port=8080, debug=False)
