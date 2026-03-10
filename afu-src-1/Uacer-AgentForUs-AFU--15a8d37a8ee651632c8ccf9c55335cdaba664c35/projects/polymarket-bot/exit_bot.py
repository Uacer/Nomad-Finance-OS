#!/usr/bin/env python3
"""
exit_bot.py - Polymarket Position Exit Manager
Handles ONLY stop-loss and take-profit (independent of circuit breaker)
"""
import json
import os
import time
import math
import requests
import datetime
import socket

# Force IPv4
_orig_getaddrinfo = socket.getaddrinfo
def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _patched_getaddrinfo

# Proxy configuration
PROXY = "socks5h://127.0.0.1:1081"

import httpx
_orig_httpx_request = httpx.Client.request
def _patched_httpx_request(self, method, url, *args, **kwargs):
    headers = kwargs.get("headers", {})
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    headers["Origin"] = "https://polymarket.com"
    headers["Referer"] = "https://polymarket.com/"
    kwargs["headers"] = headers
    return _orig_httpx_request(self, method, url, *args, **kwargs)
httpx.Client.request = _patched_httpx_request

import py_clob_client.http_helpers.helpers as clob_helpers
clob_helpers._http_client = httpx.Client(http2=True, proxy=PROXY)

_orig_request = requests.Session.request
def _patched_request(self, method, url, *args, **kwargs):
    headers = kwargs.get("headers", {})
    if "User-Agent" not in headers:
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    headers["Origin"] = "https://polymarket.com"
    headers["Referer"] = "https://polymarket.com/"
    kwargs["headers"] = headers
    if "polymarket.com" in url:
        kwargs["proxies"] = {"http": PROXY, "https": PROXY}
    return _orig_request(self, method, url, *args, **kwargs)
requests.Session.request = _patched_request

from py_clob_client.client import ClobClient
from py_clob_client.clob_types import ApiCreds
from web3 import Web3

# Configuration
POLYGON_RPC = os.environ.get("POLYGON_RPC", "https://polygon-rpc.com")
USDC_POS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"
CTF_CONTRACT = "0x4D97dcd97eC945f40cf65F87097ace5ea0476045"
GAMMA = "https://gamma-api.polymarket.com"
DATA = "https://data-api.polymarket.com"
CLOB_HOST = "https://clob.polymarket.com"

CFG_PATH = os.environ.get("PM_TAIL_CONFIG", "tail_config.json")
STOP_FILE = "STOP_EXIT"  # Separate stop file
EVENTS_JSONL = "tail_events.jsonl"  # Shared event log
MARKET_COOLDOWN_FILE = "market_cooldown.json"

# Redeem attempts tracking (conditionId -> {count,last_ts,last_success})
REDEEM_ATTEMPTS_FILE = "redeem_attempts.json"
REDEEM_MAX_ATTEMPTS = 5
REDEEM_COOLDOWN_SECONDS = 3600  # 1 hour per conditionId


def _load_clob_creds_from_env() -> ApiCreds | None:
    api_key = os.environ.get("PM_CLOB_API_KEY", "").strip()
    api_secret = os.environ.get("PM_CLOB_API_SECRET", "").strip()
    api_passphrase = os.environ.get("PM_CLOB_API_PASSPHRASE", "").strip()
    if not api_key or not api_secret or not api_passphrase:
        return None
    return ApiCreds(api_key=api_key, api_secret=api_secret, api_passphrase=api_passphrase)


def _load_clob_creds_from_file(path: str) -> ApiCreds | None:
    try:
        if not path or not os.path.exists(path):
            return None
        with open(path, "r", encoding="utf-8") as f:
            d = json.load(f)
        if not isinstance(d, dict):
            return None
        api_key = str(d.get("api_key") or "").strip()
        api_secret = str(d.get("api_secret") or "").strip()
        api_passphrase = str(d.get("api_passphrase") or "").strip()
        if not api_key or not api_secret or not api_passphrase:
            return None
        return ApiCreds(api_key=api_key, api_secret=api_secret, api_passphrase=api_passphrase)
    except Exception:
        return None


def _save_clob_creds_to_file(path: str, creds: ApiCreds) -> None:
    try:
        if not path:
            return
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                {
                    "api_key": creds.api_key,
                    "api_secret": creds.api_secret,
                    "api_passphrase": creds.api_passphrase,
                },
                f,
                indent=2,
            )
    except Exception as e:
        print(f"DEBUG: Failed to persist CLOB creds to {path}: {e}")


def ensure_clob_creds(client: ClobClient) -> ApiCreds:
    """
    Prefer explicit env vars.
    Otherwise, try to load cached creds from disk.
    Otherwise, derive creds using the private key via py-clob-client and cache them.
    """
    env_creds = _load_clob_creds_from_env()
    if env_creds:
        return env_creds

    cache_path = os.environ.get("PM_CLOB_CREDS_PATH", "clob_credentials.json").strip()
    file_creds = _load_clob_creds_from_file(cache_path)
    if file_creds:
        return file_creds

    try:
        derived = client.create_or_derive_api_creds()
        _save_clob_creds_to_file(cache_path, derived)
        return derived
    except Exception as e:
        raise RuntimeError(
            "Missing CLOB API credentials and failed to derive them. "
            "Set PM_CLOB_API_KEY/PM_CLOB_API_SECRET/PM_CLOB_API_PASSPHRASE or ensure derive works."
        ) from e

def now_ts():
    return int(time.time())

def load_json(path):
    if not os.path.exists(path):
        return {}
    with open(path, "r") as f:
        try:
            return json.load(f)
        except:
            return {}

def save_json(path, data):
    with open(path, "w") as f:
        json.dump(data, f, indent=2)

def append_event(evt):
    with open(EVENTS_JSONL, "a", encoding="utf-8") as f:
        f.write(json.dumps(evt, ensure_ascii=False) + "\n")

def save_trade_history(trade_data):
    """
    保存完整交易历史到独立文件，用于分析和回测
    """
    TRADES_HISTORY = "trades_history.jsonl"
    with open(TRADES_HISTORY, "a", encoding="utf-8") as f:
        f.write(json.dumps(trade_data, ensure_ascii=False) + "\n")

def get_market_category(slug: str) -> str:
    """识别市场类别"""
    slug = slug.lower()
    if any(kw in slug for kw in ["btc", "eth", "sol", "crypto", "bitcoin", "ethereum"]):
        return "crypto"
    if any(kw in slug for kw in ["epl-", "laliga-", "bundesliga-", "seriea-", "ucl-", "dfb-", "itsb-"]):
        return "sports-soccer"
    if any(kw in slug for kw in ["nba-", "cbb-", "ncaab-"]):
        return "sports-basketball"
    if any(kw in slug for kw in ["cs2-", "lol-", "dota-", "valorant-"]):
        return "sports-esports"
    if any(kw in slug for kw in ["trump", "biden", "election", "president"]):
        return "politics"
    if any(kw in slug for kw in ["oscars", "grammys", "emmys"]):
        return "entertainment"
    return "other"

def add_market_cooldown(slug, cooldown_hours=1):
    cooldowns = load_json(MARKET_COOLDOWN_FILE)
    cooldowns[slug] = {
        "cooldown_until": now_ts() + (cooldown_hours * 3600),
        "reason": "stop_loss",
    }
    save_json(MARKET_COOLDOWN_FILE, cooldowns)
    print(f"COOLDOWN: {slug} for {cooldown_hours}h")


def can_attempt_redeem(condition_id: str) -> bool:
    attempts = load_json(REDEEM_ATTEMPTS_FILE)
    info = attempts.get(condition_id, {})
    count = int(info.get("count", 0))
    last_ts = int(info.get("last_ts", 0))
    if count >= REDEEM_MAX_ATTEMPTS:
        return False
    if last_ts and (now_ts() - last_ts) < REDEEM_COOLDOWN_SECONDS:
        return False
    return True


def record_redeem_attempt(condition_id: str, success: bool):
    attempts = load_json(REDEEM_ATTEMPTS_FILE)
    info = attempts.get(condition_id, {})
    info["count"] = int(info.get("count", 0)) + 1
    info["last_ts"] = now_ts()
    info["last_success"] = bool(success)
    attempts[condition_id] = info
    save_json(REDEEM_ATTEMPTS_FILE, attempts)

def get_usdc_balance(addr):
    try:
        w3 = Web3(Web3.HTTPProvider(POLYGON_RPC))
        abi = [{"constant": True, "inputs": [{"name": "", "type": "address"}], "name": "balanceOf", "outputs": [{"name": "", "type": "uint256"}], "type": "function"}]
        contract = w3.eth.contract(address=Web3.to_checksum_address(USDC_POS), abi=abi)
        bal = contract.functions.balanceOf(Web3.to_checksum_address(addr)).call()
        return bal / 1e6
    except:
        return 0.0

def clamp_price(price, tick):
    return round(price / tick) * tick


def redeem_shares(w3: Web3, pk: str, addr: str, condition_id: str):
    """Redeem shares for a settled conditionId (on-chain)."""
    abi = [
        {
            "name": "redeemPositions",
            "type": "function",
            "inputs": [
                {"name": "collateralToken", "type": "address"},
                {"name": "parentCollectionId", "type": "bytes32"},
                {"name": "conditionId", "type": "bytes32"},
                {"name": "indexSets", "type": "uint256[]"},
            ],
            "outputs": [],
        }
    ]
    contract = w3.eth.contract(address=Web3.to_checksum_address(CTF_CONTRACT), abi=abi)

    hash_zero = "0x" + "0" * 64
    index_sets = [1, 2]

    # Aggressive gas price to reduce stuck txs during congestion.
    nonce = w3.eth.get_transaction_count(addr, "pending")
    gas_price = int(w3.eth.gas_price * 2.0)

    tx = contract.functions.redeemPositions(
        Web3.to_checksum_address(USDC_POS),
        hash_zero,
        condition_id,
        index_sets,
    ).build_transaction(
        {
            "from": addr,
            "nonce": nonce,
            "gas": 250000,
            "gasPrice": gas_price,
            "chainId": 137,
        }
    )

    signed_tx = w3.eth.account.sign_transaction(tx, pk)
    raw = getattr(signed_tx, "raw_transaction", None) or getattr(signed_tx, "rawTransaction", None)
    tx_hash = w3.eth.send_raw_transaction(raw)
    receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
    return tx_hash.hex() if receipt.status == 1 else None

def fetch_positions(addr):
    try:
        r = requests.get(f"{DATA}/positions", params={"user": addr}, timeout=30)
        positions = r.json()
        grouped = {}
        for p in positions:
            if float(p.get("size", 0)) <= 0:
                continue
            cid = p.get("conditionId")
            if cid not in grouped:
                grouped[cid] = []
            grouped[cid].append(p)
        return grouped
    except Exception as e:
        print(f"fetch_positions error: {e}")
        return {}

def place_sell(client, token_id, price_limit, size, tick, neg_risk):
    from py_clob_client.clob_types import OrderArgs, PartialCreateOrderOptions
    px_str = f"{price_limit:.10f}".rstrip("0").rstrip(".")
    sz_str = f"{size:.10f}".rstrip("0").rstrip(".")

    # Keep options minimal; avoid unsupported params.
    opts = PartialCreateOrderOptions(
        neg_risk=neg_risk,
        tick_size=f"{tick:.10f}".rstrip("0").rstrip("."),
    )

    args = OrderArgs(
        token_id=token_id,
        price=float(px_str),
        size=float(sz_str),
        side="SELL",
        fee_rate_bps=0,
    )

    order = client.create_order(args, options=opts)
    # Post as FAK so we don't leave resting leftovers in thin books
    return client.post_order(order, orderType="FAK")

def main():
    cfg = load_json(CFG_PATH)
    
    pk = os.environ.get("PM_PRIVATE_KEY")
    if not pk:
        raise RuntimeError("PM_PRIVATE_KEY not set")
    
    addr = os.environ.get("PM_SIGNER_ADDR")
    if not addr:
        raise RuntimeError("PM_SIGNER_ADDR not set")
    
    client = ClobClient(CLOB_HOST, key=pk, chain_id=137)
    creds = ensure_clob_creds(client)
    client.set_api_creds(creds)
    w3 = Web3(Web3.HTTPProvider(POLYGON_RPC))
    
    print("exit_bot_ready", {"addr": addr, **cfg})
    
    skip_sells_until = 0

    while True:
        if os.path.exists(STOP_FILE):
            print("STOP_EXIT file present -> exit bot exiting")
            return

        try:
            # Always refresh positions (used for redeem even if sells are disabled)
            positions = fetch_positions(addr)

            # 0) REDEEM PASS (independent of CLOB auth)
            # If a position is effectively settled (often curPrice=1.0) we try on-chain redeem.
            # Rate-limit ourselves to avoid RPC 429/"Too many requests".
            try:
                # Find ONE best candidate per loop to redeem (max 1 tx per loop)
                candidate = None  # (cid, slug, title)
                for cid, ps in positions.items():
                    if not cid:
                        continue
                    if not can_attempt_redeem(cid):
                        continue

                    slug = None
                    title = None
                    should = False
                    for p in ps:
                        slug = slug or p.get("slug")
                        title = title or p.get("title")
                        try:
                            if float(p.get("curPrice") or 0) >= 0.99:
                                should = True
                        except:
                            pass
                    if not should:
                        continue

                    candidate = (cid, slug, title)
                    break

                if candidate:
                    cid, slug, title = candidate
                    try:
                        usdc_before = get_usdc_balance(addr)
                        txh = redeem_shares(w3, pk, addr, cid)
                        usdc_after = get_usdc_balance(addr)
                        ok = bool(txh)
                        record_redeem_attempt(cid, ok)
                        evt = {
                            "type": "redeem",
                            "t": now_ts(),
                            "cid": cid,
                            "slug": slug,
                            "title": title or slug,
                            "tx": txh,
                            "success": ok,
                            "usdc_before": round(usdc_before, 6),
                            "usdc_after": round(usdc_after, 6),
                            "usdc_delta": round(usdc_after - usdc_before, 6),
                        }
                        append_event(evt)
                        if ok:
                            print(f"✅ REDEEM_SUCCESS: {slug} → {txh}")
                        else:
                            print(f"REDEEM_FAILED: {slug}")
                    except Exception as e:
                        # On rate limit, push next attempt further out by writing last_ts
                        record_redeem_attempt(cid, False)
                        msg = str(e)
                        print(f"REDEEM_ERROR for {cid}: {msg}")
                        if "Too many requests" in msg or "rate limit" in msg.lower():
                            # simple backoff: sleep longer to avoid hammering
                            time.sleep(30)
            except Exception as e:
                print(f"REDEEM_PASS_ERROR: {e}")

            # If CLOB creds are broken, skip sells for a while to avoid thrash
            if now_ts() < skip_sells_until:
                time.sleep(int(cfg.get("poll_seconds", 5)))
                continue

            # 1) STOP-LOSS: DISABLED (liquidity-trap risk). Do NOT sell illiquid positions.
            # Only re-enable when explicit liquidity checks are implemented and user approves.

            stoploss_positions = positions if bool(cfg.get("enable_stop_loss", False)) else {}

            for cid, ps in stoploss_positions.items():
                for p in ps:
                    cur_price = float(p.get("curPrice") or 0)
                    if cur_price <= 0:
                        continue
                    if cur_price >= cfg.get("stop_price", 0.49):
                        continue  # Not below stop-loss yet
                    
                    token_id = p.get("asset")
                    neg_risk = bool(p.get("negativeRisk"))
                    
                    try:
                        book = client.get_order_book(token_id)
                    except:
                        continue
                    
                    if not book.bids:
                        continue
                    
                    tick = float(book.tick_size)
                    best_bid = max(float(b.price) for b in book.bids)
                    px = clamp_price(best_bid * (1 - cfg.get("slippage_bps", 200) / 10000.0), tick)
                    
                    sz = float(p.get("size", 0))
                    try:
                        avg_price = float(p.get("avgPrice", 0))
                        cash_pnl = (px - avg_price) * sz
                        percent_pnl = ((px / avg_price) - 1) * 100 if avg_price > 0 else 0
                        
                        resp = place_sell(client, token_id, px, sz, tick, neg_risk)
                        
                        cash = get_usdc_balance(addr)
                        def _resp_get(obj, key, default=None):
                            if obj is None:
                                return default
                            if isinstance(obj, dict):
                                return obj.get(key, default)
                            # py_clob_client may return objects
                            if hasattr(obj, "get"):
                                try:
                                    return obj.get(key, default)
                                except:
                                    pass
                            if hasattr(obj, key):
                                return getattr(obj, key)
                            return default

                        evt = {
                            "type": "stoploss_sell",
                            "t": now_ts(),
                            "cid": cid,
                            "slug": p.get("slug"),
                            "title": p.get("title") or p.get("slug"),
                            "outcome": p.get("outcome"),
                            "token": token_id,
                            "px": px,
                            "sz": sz,
                            "cash": cash,
                            "avg_price": avg_price,
                            "cash_pnl": round(cash_pnl, 2),
                            "percent_pnl": round(percent_pnl, 2),
                            "orderID": _resp_get(resp, "orderID") or _resp_get(resp, "orderId"),
                            "status": _resp_get(resp, "status"),
                            "success": _resp_get(resp, "success")
                        }
                        append_event(evt)
                        print("STOPLOSS_SELL", evt)
                        
                        # 保存到交易历史
                        slug = p.get("slug", "")
                        trade_history = {
                            "trade_id": f"{cid}_{now_ts()}",
                            "exit_time": now_ts(),
                            "market": {
                                "slug": slug,
                                "title": p.get("title") or slug,
                                "category": get_market_category(slug),
                                "condition_id": cid
                            },
                            "position": {
                                "outcome": p.get("outcome"),
                                "size": sz,
                                "entry_price": avg_price,
                                "exit_price": px,
                                "current_price": cur_price
                            },
                            "pnl": {
                                "cash": round(cash_pnl, 2),
                                "percent": round(percent_pnl, 2)
                            },
                            "exit_reason": "stop_loss",
                            "strategy_version": "v2.0"
                        }
                        save_trade_history(trade_history)
                        
                        market_slug = p.get("slug")
                        if market_slug:
                            add_market_cooldown(market_slug, cooldown_hours=1)
                    except Exception as e:
                        msg = str(e)
                        print(f"SELL_ERROR: {msg}")
                        if "Unauthorized/Invalid api key" in msg or "status_code=401" in msg:
                            # Disable further sells temporarily; redeem can still run.
                            skip_sells_until = now_ts() + 3600
                            print("CRITICAL: CLOB auth invalid (401). Disabling sells for 1h; redeem remains active.")
            
            # 2) TAKE-PROFIT: sell positions >= 0.99
            positions_raw = []
            try:
                r = requests.get(f"{DATA}/positions", params={"user": addr, "limit": 200}, timeout=30)
                r.raise_for_status()
                positions_raw = r.json()
            except:
                pass
            
            for p in positions_raw:
                sz = float(p.get("size", 0))
                if sz <= 0.01:
                    continue
                
                cur_price = float(p.get("curPrice", 0))
                if cur_price < 0.99:
                    continue  # Not at take-profit yet
                
                token_id = p.get("asset")
                neg_risk = bool(p.get("negativeRisk"))
                slug = p.get("slug")
                
                try:
                    book = client.get_order_book(token_id)
                    if not book.bids:
                        continue

                    best_bid = max(float(b.price) for b in book.bids)
                    if best_bid < 0.99:
                        continue  # Actual bid too low

                    tick = float(book.tick_size)

                    # Liquidity check
                    bid_volume = sum(float(b.size) for b in book.bids if float(b.price) >= 0.99)
                    min_liquidity_ratio = cfg.get("min_bid_liquidity_ratio", 0.8)
                    if bid_volume < sz * min_liquidity_ratio:
                        print(f"DEBUG: Insufficient liquidity for {slug}, need {sz * min_liquidity_ratio:.2f}, have {bid_volume:.2f}")
                        continue

                    sz_rounded = math.floor(sz * 100) / 100.0
                    safe_tick = max(tick, 0.01)

                    # If there's no orderbook, market may be settled/closed -> try redeem
                    # (This block is primarily for cases where book exists but best_bid is pathological.)
                    best_bid = min(best_bid, 0.99)
                    px = clamp_price(best_bid, safe_tick)

                    try:
                        resp = place_sell(client, token_id, px, sz_rounded, safe_tick, neg_risk)
                    except Exception as e:
                        msg = str(e)
                        print(f"TAKEPROFIT_ERROR for {slug}: {msg}")
                        if "No orderbook exists" in msg or "orderbook" in msg.lower():
                            cid = p.get("conditionId")
                            if cid and can_attempt_redeem(cid):
                                try:
                                    txh = redeem_shares(w3, pk, addr, cid)
                                    ok = bool(txh)
                                    record_redeem_attempt(cid, ok)
                                    if ok:
                                        evt = {"type": "redeem", "t": now_ts(), "cid": cid, "slug": slug, "tx": txh, "success": True}
                                        append_event(evt)
                                        print(f"✅ REDEEM_SUCCESS: {slug} → {txh}")
                                    else:
                                        append_event({"type": "redeem", "t": now_ts(), "cid": cid, "slug": slug, "success": False})
                                except Exception as e2:
                                    record_redeem_attempt(cid, False)
                                    print(f"REDEEM_ERROR for {cid}: {e2}")
                        continue
                    
                    avg_price = float(p.get("avgPrice", 0))
                    cash_pnl = (best_bid - avg_price) * sz_rounded
                    percent_pnl = ((best_bid / avg_price) - 1) * 100 if avg_price > 0 else 0
                    
                    evt = {
                        "type": "takeprofit_sell",
                        "t": now_ts(),
                        "cid": p.get("conditionId"),
                        "slug": slug,
                        "title": p.get("title") or slug,
                        "outcome": p.get("outcome"),
                        "px": best_bid,
                        "sz": sz_rounded,
                        "avg_price": avg_price,
                        "cash_pnl": round(cash_pnl, 2),
                        "percent_pnl": round(percent_pnl, 2),
                        "success": (resp.get("success") if isinstance(resp, dict) else getattr(resp, "success", True))
                    }
                    append_event(evt)
                    print("TAKEPROFIT_SELL", evt)
                    
                    # 保存到交易历史
                    cid = p.get("conditionId")
                    trade_history = {
                        "trade_id": f"{cid}_{now_ts()}",
                        "exit_time": now_ts(),
                        "market": {
                            "slug": slug,
                            "title": p.get("title") or slug,
                            "category": get_market_category(slug),
                            "condition_id": cid
                        },
                        "position": {
                            "outcome": p.get("outcome"),
                            "size": sz_rounded,
                            "entry_price": avg_price,
                            "exit_price": best_bid,
                            "current_price": best_bid
                        },
                        "pnl": {
                            "cash": round(cash_pnl, 2),
                            "percent": round(percent_pnl, 2)
                        },
                        "exit_reason": "take_profit",
                        "strategy_version": "v2.0"
                    }
                    save_trade_history(trade_history)
                    
                    time.sleep(0.5)
                except Exception as e:
                    if "No orderbook exists" not in str(e):
                        print(f"DEBUG: TAKEPROFIT exception for {slug}: {e}")
                    continue
            
        except Exception as e:
            print(f"EXIT_BOT_LOOP_ERROR: {e}")
        
        time.sleep(int(cfg.get("poll_seconds", 5)))

if __name__ == "__main__":
    main()
