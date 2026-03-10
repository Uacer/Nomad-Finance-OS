#!/usr/bin/env python3
"""
entry_bot.py - Polymarket Entry Scanner
Handles ONLY market scanning and buy orders (controlled by circuit breaker)
"""
import json
import os
import time
import math
import requests
import datetime
import calendar
import socket
import random

# Force IPv4
_orig_getaddrinfo = socket.getaddrinfo
def _patched_getaddrinfo(host, port, family=0, type=0, proto=0, flags=0):
    return _orig_getaddrinfo(host, port, socket.AF_INET, type, proto, flags)
socket.getaddrinfo = _patched_getaddrinfo

# Proxy configuration
PROXY = "socks5h://127.0.0.1:1081"

import httpx
# Patch httpx to use proxy and browser-like headers
_orig_httpx_request = httpx.Client.request
def _patched_httpx_request(self, method, url, *args, **kwargs):
    headers = kwargs.get("headers", {})
    headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    headers["Origin"] = "https://polymarket.com"
    headers["Referer"] = "https://polymarket.com/"
    kwargs["headers"] = headers
    
    # We can't easily change the client's proxy settings here, 
    # but we can check if it's already using a proxy or try to force it.
    # Actually, the best way for httpx is to replace the global client if possible, 
    # or just use environment variables HTTP_PROXY/HTTPS_PROXY.
    return _orig_httpx_request(self, method, url, *args, **kwargs)
httpx.Client.request = _patched_httpx_request

import py_clob_client.http_helpers.helpers as clob_helpers
# Force the clob helper client to use our proxy
clob_helpers._http_client = httpx.Client(http2=True, proxy=PROXY)

# Patch requests to use a browser-like User-Agent and common headers globally
_orig_request = requests.Session.request
def _patched_request(self, method, url, *args, **kwargs):
    headers = kwargs.get("headers", {})
    if "User-Agent" not in headers:
        headers["User-Agent"] = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    headers["Origin"] = "https://polymarket.com"
    headers["Referer"] = "https://polymarket.com/"
    headers["Accept"] = "*/*"
    headers["Accept-Language"] = "en-US,en;q=0.9"
    kwargs["headers"] = headers
    
    # Use proxy for clob and data APIs
    if "polymarket.com" in url:
        kwargs["proxies"] = {"http": PROXY, "https": PROXY}
        
    return _orig_request(self, method, url, *args, **kwargs)
requests.Session.request = _patched_request

from py_clob_client.client import ClobClient
from py_clob_client.clob_types import OrderArgs, PartialCreateOrderOptions, ApiCreds
from web3 import Web3

POLYGON_RPC = os.environ.get("POLYGON_RPC", "https://polygon-rpc.com")
# Additional RPCs for failover or better limits
ALT_RPCS = [
    "https://rpc.ankr.com/polygon",
    "https://polygon-bor-rpc.publicnode.com",
    "https://1rpc.io/matic"
]
USDC_POS = "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174"  # USDC.e / PoS USDC
CTF_CONTRACT = "0x4D97dcd97eC945f40cf65F87097ace5ea0476045" # Conditional Tokens Contract

GAMMA = "https://gamma-api.polymarket.com"
DATA = "https://data-api.polymarket.com"
CLOB_HOST = "https://clob.polymarket.com"
CHAIN_ID = 137

CFG_PATH = os.environ.get("PM_TAIL_CONFIG", "tail_config.json")
STOP_FILE = os.environ.get("PM_STOP_FILE", "STOP_ENTRY")  # Separate stop file for entry bot
EVENTS_JSONL = os.environ.get("PM_TAIL_EVENTS", "tail_events.jsonl")
REDEEM_ATTEMPTS_FILE = "redeem_attempts.json"
MARKET_COOLDOWN_FILE = "market_cooldown.json"


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

    # Fallback: derive creds using the wallet key (requires network access).
    try:
        derived = client.create_or_derive_api_creds()
        _save_clob_creds_to_file(cache_path, derived)
        return derived
    except Exception as e:
        raise RuntimeError(
            "Missing CLOB API credentials and failed to derive them. "
            "Set PM_CLOB_API_KEY/PM_CLOB_API_SECRET/PM_CLOB_API_PASSPHRASE or ensure derive works."
        ) from e

def load_json(path: str):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except:
            return {}

def save_json(path: str, data: dict):
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

def add_market_cooldown(slug: str, cooldown_hours: int = 1):
    """Add a market to cooldown after stop-loss"""
    cooldowns = load_json(MARKET_COOLDOWN_FILE)
    cooldowns[slug] = {
        "cooldown_until": now_ts() + (cooldown_hours * 3600),
        "reason": "stop_loss"
    }
    save_json(MARKET_COOLDOWN_FILE, cooldowns)
    print(f"COOLDOWN: Market {slug} is now in cooldown for {cooldown_hours} hour(s)")

def is_market_in_cooldown(slug: str) -> bool:
    """Check if a market is in cooldown period"""
    cooldowns = load_json(MARKET_COOLDOWN_FILE)
    if slug not in cooldowns:
        return False
    
    cooldown_until = cooldowns[slug].get("cooldown_until", 0)
    if now_ts() < cooldown_until:
        remaining_mins = (cooldown_until - now_ts()) // 60
        # print(f"DEBUG: Market {slug} is in cooldown for {remaining_mins} more minutes")
        return True
    else:
        # Cooldown expired, remove it
        del cooldowns[slug]
        save_json(MARKET_COOLDOWN_FILE, cooldowns)
        return False

def check_gas_circuit_breaker(w3, addr):
    """
    Returns True if gas is too low to proceed with on-chain actions.
    Uses dynamic gas estimation based on current gas price.
    """
    try:
        pol_bal = w3.eth.get_balance(addr) / 1e18
        
        # Dynamic gas threshold calculation
        # Estimate: 1 redemption needs ~110,000 gas units
        # Safety factor: 3x (to handle price spikes and allow multiple operations)
        current_gas_price = w3.eth.gas_price  # in wei
        estimated_gas_units = 110000
        safety_factor = 3
        
        # Minimum POL needed = (gas_price * gas_units * safety_factor) / 1e18
        min_pol_needed = (current_gas_price * estimated_gas_units * safety_factor) / 1e18
        
        # Absolute minimum: never go below 0.3 POL even if gas is cheap
        # Absolute maximum threshold: 2.0 POL (don't be too conservative)
        min_pol_needed = max(0.3, min(2.0, min_pol_needed))
        
        if pol_bal < min_pol_needed:
            print(f"DEBUG: Gas threshold check - Balance: {pol_bal:.4f} POL, Threshold: {min_pol_needed:.4f} POL (Gas price: {current_gas_price/1e9:.2f} Gwei)")
            return True, pol_bal
        
        return False, pol_bal
    except Exception as e:
        print(f"Gas check error: {e}")
        # Conservative fallback: if we can't check, assume we have enough
        return False, 0

def can_attempt_redeem(condition_id: str):
    """Checks if we should attempt redemption based on past attempts."""
    attempts = load_json(REDEEM_ATTEMPTS_FILE)
    entry = attempts.get(condition_id, {"count": 0, "last_ts": 0})
    
    now = now_ts()
    # Cooldown logic:
    # 1. Max 5 total attempts per conditionId
    # 2. At least 1 hour between attempts
    if entry["count"] >= 5:
        return False, "Max attempts reached (5/5)"
    
    if now - entry["last_ts"] < 3600:
        return False, f"Cooldown active ({3600 - (now - entry['last_ts'])}s left)"
        
    return True, ""

def record_redeem_attempt(condition_id: str, success: bool):
    attempts = load_json(REDEEM_ATTEMPTS_FILE)
    entry = attempts.get(condition_id, {"count": 0, "last_ts": 0})
    
    entry["count"] += 1
    entry["last_ts"] = now_ts()
    entry["last_success"] = success
    
    attempts[condition_id] = entry
    save_json(REDEEM_ATTEMPTS_FILE, attempts)


def clamp_price(price: float, tick: float) -> float:
    price = max(tick, min(1.0 - tick, price))
    return round(math.floor(price / tick) * tick, 6)


def now_ts() -> int:
    return int(time.time())


def ok_market(m: dict, cfg: dict) -> bool:
    try:
        slug = (m.get("slug") or "").lower()
        question = (m.get("question") or "").lower()
        
        # EXCLUDE CRYPTO UP/DOWN AND NFL PLAYER PERFORMANCE MARKETS
        # These are high-volatility/gambling markets that don't suit tail-scanning well.
        exclude_keywords = [
            "updown", "up-or-down", "up or down", "price-of-bitcoin", 
            "price-of-ethereum", "price-of-solana",
            "touchdown", "first-td", "first touchdown", "player-", "yards", "passing", "rushing", "receptions"
        ]
        if any(kw in slug for kw in exclude_keywords) or any(kw in question for kw in exclude_keywords):
            # print(f"DEBUG: Skipping excluded crypto-updown market: {slug}")
            return False

        # EXCLUDE NEGATIVE RISK MARKETS
        # These have complex on-chain redemption logic (WrappedCollateral).
        if bool(m.get("negRisk", False)):
            # print(f"DEBUG: Skipping Negative Risk market: {slug}")
            return False

        # FILTER: Check market age (avoid newly created markets)
        created_at = m.get("createdAt")
        if created_at:
            try:
                # Parse ISO timestamp
                created_dt = datetime.datetime.strptime(created_at.split(".")[0].replace("Z", ""), "%Y-%m-%dT%H:%M:%S")
                created_ts = calendar.timegm(created_dt.utctimetuple())
                age_seconds = now_ts() - created_ts
                min_age = cfg.get("min_market_age_seconds", 3600)  # Default: 1 hour
                if age_seconds < min_age:
                    print(f"DEBUG: Skipping newly created market {slug} (age: {age_seconds}s)")
                    return False
            except Exception as e:
                print(f"DEBUG: Failed to parse createdAt for {slug}: {e}")

        v24 = float(m.get("volume24hrClob") or 0)
        liq = float(m.get("liquidityClob") or m.get("liquidity") or 0)
    except Exception:
        return False
    if not bool(m.get("acceptingOrders", True)):
        return False
    if v24 < cfg["min_volume24h"]:
        return False
    if liq < cfg["min_liquidity"]:
        return False
    return True


def get_market_category(slug: str) -> str:
    """
    识别市场类别，用于风险分散
    
    常见类别：
    - crypto: 加密货币价格/涨跌
    - sports-soccer: 足球
    - sports-basketball: 篮球
    - sports-esports: 电竞
    - politics: 政治选举
    - weather: 天气
    - entertainment: 娱乐/奖项
    - other: 其他
    """
    slug = slug.lower()
    
    # 加密货币（最容易集中的类别）
    crypto_keywords = ["btc", "eth", "sol", "xrp", "doge", "crypto", "bitcoin", "ethereum", "solana"]
    if any(kw in slug for kw in crypto_keywords):
        return "crypto"
    
    # 足球
    soccer_keywords = [
        "epl-", "laliga-", "bundesliga-", "seriea-", "ligue1-", "ucl-", "fifa", "worldcup", "premierleague",
        "arg-", "por-", "tur-", "ita-", "spa-", "ger-", "fra-", "eng-", "lal-", "sea-", "bun-", "lig-"
    ]
    if any(kw in slug for kw in soccer_keywords):
        return "sports-soccer"
    
    # 篮球
    basketball_keywords = ["nba-", "cbb-", "cwbb-", "basketball"]
    if any(kw in slug for kw in basketball_keywords):
        return "sports-basketball"
    
    # 电竞
    esports_keywords = ["lol-", "cs2-", "cs-", "dota2-", "val-", "valorant", "leagueoflegends", "counterstrike"]
    if any(kw in slug for kw in esports_keywords):
        return "sports-esports"
    
    # 其他体育
    sports_keywords = ["nfl-", "nhl-", "mlb-", "hok-", "tennis-", "mma-", "ufc-", "boxing-"]
    if any(kw in slug for kw in sports_keywords):
        return "sports-other"
    
    # 政治
    politics_keywords = ["election-", "trump", "biden", "president", "senate", "congress", "political"]
    if any(kw in slug for kw in politics_keywords):
        return "politics"
    
    # 天气
    weather_keywords = ["weather-", "temperature-", "rain-", "snow-", "hurricane-"]
    if any(kw in slug for kw in weather_keywords):
        return "weather"
    
    # 娱乐
    entertainment_keywords = ["oscars-", "grammys-", "emmys-", "movie-", "taylor-swift", "beyonce"]
    if any(kw in slug for kw in entertainment_keywords):
        return "entertainment"
    
    return "other"


def check_category_diversity(positions: dict, new_market_slug: str, max_same_category: int) -> bool:
    """
    检查是否可以添加新市场（避免过度集中在同一类别）
    
    Args:
        positions: 当前持仓字典 {cid: [position_data_list]}
        new_market_slug: 拟买入市场的 slug
        max_same_category: 同一类别最多持有几个市场
        
    Returns:
        True: 可以买入
        False: 已超过同类别限制，不应买入
    """
    new_category = get_market_category(new_market_slug)
    
    # 统计当前各类别的持仓数量（按 condition ID 去重）
    category_counts = {}
    seen_categories_per_cid = set()  # 避免同一个 condition ID 重复计数
    
    for cid, pos_list in positions.items():
        if not pos_list:
            continue
        # 取第一个 position 的 slug（同一个 cid 的 positions 应该是同一个市场）
        slug = pos_list[0].get("slug", "")
        if slug:
            cat = get_market_category(slug)
            # 使用 (cat, cid) 确保每个市场只计数一次
            cat_cid_key = f"{cat}_{cid}"
            if cat_cid_key not in seen_categories_per_cid:
                category_counts[cat] = category_counts.get(cat, 0) + 1
                seen_categories_per_cid.add(cat_cid_key)
    
    # 检查新市场类别是否已经过多
    # 规则：Crypto 类别严格限制，其他类别（体育等）独立性强，不限制
    if new_category != "crypto":
        return True
        
    current_count = category_counts.get(new_category, 0)
    if current_count >= max_same_category:
        return False  # 该类别已达上限
    
    return True  # 可以买入


def extract_event_key(title: str, slug: str) -> str:
    """
    从市场标题或 slug 提取核心事件标识，用于去重
    
    目标：识别同一场比赛/事件，避免买入多个相关市场
    
    示例：
    - "Spread: FC Südtirol (-1.5)" → "fc-sudtirol-vs-ac-monza"
    - "Spread: AC Monza (-2.5)" → "fc-sudtirol-vs-ac-monza"
    - "FC Bayern München vs. RB Leipzig: O/U 1.5" → "fc-bayern-munchen-vs-rb-leipzig"
    
    策略：
    1. 优先从 slug 提取（slug 更规范）
    2. 移除后缀修饰词（spread, o/u, total, etc.）
    3. 统一球队顺序（字母排序）确保双向匹配
    """
    slug = slug.lower().strip()
    
    # 移除常见的市场类型前缀/后缀
    # 例如：spread-, ou-, total-, moneyline-, -spread, -ou, -total
    remove_patterns = [
        "spread-", "spread:", "ou-", "o/u-", "total-", "moneyline-",
        "-spread", "-ou", "-total", "-moneyline",
        "will-", "to-win", "-to-win", "-winner"
    ]
    
    event_slug = slug
    for pattern in remove_patterns:
        event_slug = event_slug.replace(pattern, "")
    
    # 提取核心部分（去除参数，如 (-1.5), (o/u 2.5) 等）
    # 分割方式：找到 vs, v, @ 等分隔符
    if " vs " in event_slug or " vs. " in event_slug:
        # 标准格式：team-a vs team-b
        parts = event_slug.replace(" vs. ", " vs ").split(" vs ")
        if len(parts) == 2:
            team_a, team_b = parts[0].strip(), parts[1].strip()
            # 移除后缀数字/括号（如 (-1.5)）
            import re
            team_a = re.sub(r'\s*\(.*?\)', '', team_a).strip()
            team_b = re.sub(r'\s*\(.*?\)', '', team_b).strip()
            # 字母排序确保顺序一致
            teams = sorted([team_a, team_b])
            return f"{teams[0]}-vs-{teams[1]}"
    
    # 如果没有 vs 分隔符，尝试从 slug 直接提取（某些市场格式）
    # 例如 "ger-bun-fc-bayern-munchen-rb-leipzig-ou-15"
    # 这种情况较复杂，简单处理：移除尾部的数字/ou/spread 等
    import re
    event_slug = re.sub(r'[-_](ou|spread|total|moneyline).*$', '', event_slug)
    event_slug = re.sub(r'[-_]\d+$', '', event_slug)  # 移除尾部数字
    
    return event_slug



_GAMMA_MARKETS_CACHE = {"ts": 0, "arr": None, "end_date_min": ""}


def fetch_ending_markets(cfg: dict) -> list[dict]:
    """Pull active markets with retry logic, with TTL caching.

    Gamma is for discovery/metadata (slow-moving). We cache to reduce API churn.
    TTL controlled by cfg["gamma_ttl_seconds"], default 30s.
    """
    import datetime, calendar
    now_dt = datetime.datetime.now(datetime.timezone.utc)
    now_s = calendar.timegm(now_dt.utctimetuple())

    ttl_s = int(cfg.get("gamma_ttl_seconds", 30))

    # Cache hit
    if (
        _GAMMA_MARKETS_CACHE.get("arr") is not None
        and (now_ts() - int(_GAMMA_MARKETS_CACHE.get("ts", 0))) < ttl_s
    ):
        arr = _GAMMA_MARKETS_CACHE["arr"]
        out = []
        cutoff = now_s + int(cfg["end_within_seconds"])
        for m in arr:
            try:
                end_iso = m.get("endDate")
                if not end_iso:
                    continue
                end_s = calendar.timegm(time.strptime(end_iso, "%Y-%m-%dT%H:%M:%SZ"))
            except Exception:
                continue
            if end_s < now_s or end_s > cutoff:
                continue
            if not ok_market(m, cfg):
                continue
            out.append(m)

        print(
            f"Tail scan (Gamma cache HIT, age={now_ts()-int(_GAMMA_MARKETS_CACHE.get('ts',0))}s/{ttl_s}s): "
            f"found {len(out)} valid markets ending within {cfg['end_within_seconds']}s (out of {len(arr)} raw)"
        )
        now = now_ts()
        append_event({"type": "scan", "t": now, "valid_markets": len(out), "total_markets": len(arr)})
        append_event({"type": "debug", "t": now, "msg": f"Scan completed (Gamma cache HIT): {len(out)} valid markets found."})
        return out

    # Cache miss: fetch
    for attempt in range(3):
        try:
            r = requests.get(
                f"{GAMMA}/markets",
                params={
                    "closed": "false",
                    "limit": 1000,
                    "order": "endDate",
                    "ascending": "true",
                    "end_date_min": now_dt.isoformat(),
                },
                timeout=30,
            )
            r.raise_for_status()
            arr = r.json()

            _GAMMA_MARKETS_CACHE["ts"] = now_ts()
            _GAMMA_MARKETS_CACHE["arr"] = arr
            _GAMMA_MARKETS_CACHE["end_date_min"] = now_dt.isoformat()

            out = []
            cutoff = now_s + int(cfg["end_within_seconds"])
            for m in arr:
                try:
                    end_iso = m.get("endDate")
                    if not end_iso:
                        continue
                    end_s = calendar.timegm(time.strptime(end_iso, "%Y-%m-%dT%H:%M:%SZ"))
                except Exception:
                    continue
                if end_s < now_s or end_s > cutoff:
                    continue
                if not ok_market(m, cfg):
                    continue
                out.append(m)

            print(
                f"Tail scan (Gamma cache MISS, ttl={ttl_s}s): found {len(out)} valid markets ending within {cfg['end_within_seconds']}s "
                f"(out of {len(arr)} raw)"
            )
            now = now_ts()
            append_event({"type": "scan", "t": now, "valid_markets": len(out), "total_markets": len(arr)})
            append_event({"type": "debug", "t": now, "msg": f"Scan completed (Gamma cache MISS): {len(out)} valid markets found."})
            return out
        except Exception as e:
            if attempt < 2:
                print(f"fetch_ending_markets attempt {attempt+1} failed: {e}, retrying...")
                time.sleep(2 ** attempt)
            else:
                print(f"fetch_ending_markets failed after 3 attempts: {e}")
                return []
    return []


def fetch_positions(addr: str) -> dict:
    """Fetch positions with retry logic"""
    for attempt in range(3):
        try:
            r = requests.get(f"{DATA}/positions", params={"user": addr, "limit": 200}, timeout=30)
            r.raise_for_status()
            pos = r.json()
            by_cid = {}
            for p in pos:
                cid = p.get("conditionId")
                if not cid:
                    continue
                sz = float(p.get("size") or 0)
                if sz <= 0:
                    continue
                by_cid.setdefault(cid, []).append(p)
            return by_cid
        except Exception as e:
            if attempt < 2:
                print(f"fetch_positions attempt {attempt+1} failed: {e}, retrying...")
                time.sleep(2 ** attempt)  # Exponential backoff: 1s, 2s
            else:
                print(f"fetch_positions failed after 3 attempts: {e}")
                return {}
    return {}


def best_spread_bps(best_bid: float, best_ask: float) -> float:
    mid = (best_bid + best_ask) / 2.0
    if mid <= 0:
        return 10_000
    return (best_ask - best_bid) / mid * 10000.0


def rpc_call(payload: dict):
    r = requests.post(POLYGON_RPC, json=payload, timeout=20)
    r.raise_for_status()
    return r.json()


def get_usdc_balance(address: str) -> float:
    data = "0x70a08231" + address[2:].rjust(64, "0")
    resp = rpc_call({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "eth_call",
        "params": [{"to": USDC_POS, "data": data}, "latest"],
    })
    bal = int(resp.get("result", "0x0"), 16)
    return bal / 1e6


def get_position_snapshot(addr: str, condition_id: str, token_id: str) -> dict:
    # Pull current position for this token/condition from Data API
    r = requests.get(f"{DATA}/positions", params={"user": addr, "limit": 200}, timeout=30)
    r.raise_for_status()
    for p in r.json():
        if str(p.get("conditionId")) == str(condition_id) and str(p.get("asset")) == str(token_id) and float(p.get("size") or 0) > 0:
            return {
                "pos_size": float(p.get("size") or 0),
                "avg_price": float(p.get("avgPrice") or 0),
                "cur_price": float(p.get("curPrice") or 0),
                "current_value": float(p.get("currentValue") or 0),
                "cash_pnl": float(p.get("cashPnl") or 0),
                "percent_pnl": float(p.get("percentPnl") or 0),
            }
    return {"pos_size": 0, "avg_price": 0, "cur_price": 0, "current_value": 0, "cash_pnl": 0, "percent_pnl": 0}


def get_end_date(condition_id: str) -> str:
    r = requests.get(f"{GAMMA}/markets", params={"conditionIds": condition_id, "limit": 1}, timeout=30)
    r.raise_for_status()
    arr = r.json()
    if not arr:
        return ""
    return arr[0].get("endDate") or ""


def place_buy(client: ClobClient, token_id: str, price_limit: float, size: float, tick: float, neg_risk: bool):
    # FAK: try to fill immediately up to price_limit
    # 强制精度：
    # - price: 最多 5 位小数
    # - size: 最多 5 位小数
    # - notional (price × size): 为确保 USDC 金额 ≤ 2 位小数，优先调整 size
    
    price_limit = round(price_limit, 5)
    
    # 计算理论 notional
    notional = price_limit * size
    
    # 如果 notional 超过 2 位小数，调整 size
    if round(notional, 2) != round(notional, 10):
        # 反推 size 以确保 notional 是 2 位小数
        target_notional = round(notional, 2)
        size = round(target_notional / price_limit, 5)
    else:
        size = round(size, 5)
    
    opts = PartialCreateOrderOptions(tick_size=str(tick), neg_risk=neg_risk)
    args = OrderArgs(token_id=token_id, price=price_limit, size=size, side="BUY")
    order = client.create_order(args, opts)
    return client.post_order(order, orderType="FAK")


def place_sell(client: ClobClient, token_id: str, price_limit: float, size: float, tick: float, neg_risk: bool):
    # 强制精度：
    # - price: 最多 5 位小数
    # - size: 最多 5 位小数
    # - notional (price × size): 同样确保 ≤ 2 位小数
    
    price_limit = round(price_limit, 5)
    
    # 计算理论 notional
    notional = price_limit * size
    
    # 如果 notional 超过 2 位小数，调整 size
    if round(notional, 2) != round(notional, 10):
        target_notional = round(notional, 2)
        size = round(target_notional / price_limit, 5)
    else:
        size = round(size, 5)
    
    opts = PartialCreateOrderOptions(tick_size=str(tick), neg_risk=neg_risk)
    args = OrderArgs(token_id=token_id, price=price_limit, size=size, side="SELL")
    order = client.create_order(args, opts)
    return client.post_order(order, orderType="FAK")


def append_event(evt: dict):
    with open(EVENTS_JSONL, "a", encoding="utf-8") as f:
        f.write(json.dumps(evt, ensure_ascii=False) + "\n")


def get_daily_pnl_status(addr: str, cfg: dict):
    """Circuit breaker (manual reset only).

    HARD RULE (user requirement):
    - Breaker reset is MANUAL ONLY.
    - Changing baseline MUST NOT automatically deactivate/reset the breaker.
    - Once breaker is active, it stays active (latched) until manual reset.
    - Any error/uncertainty -> breaker ACTIVE (fail-safe).

    Returns: (is_breaker_active, current_drawdown_pct, details_string)
    """
    try:
        # 1) Total account value (Cash + Positions)
        cash = get_usdc_balance(addr)
        r = requests.get(f"{DATA}/positions", params={"user": addr}, timeout=30)
        positions = r.json()
        pos_val = sum(float(p.get("currentValue", 0)) for p in positions if float(p.get("size", 0)) > 0)
        total_val = cash + pos_val

        # 2) State handling
        state_path = "circuit_breaker_state.json"
        manual_reset_flag = "MANUAL_RESET_BREAKER"  # create this file to reset breaker + baseline
        today = datetime.datetime.now().strftime("%Y-%m-%d")

        state = {}
        if os.path.exists(state_path):
            try:
                with open(state_path, "r") as f:
                    state = json.load(f) or {}
            except:
                state = {}

        # Initialize if missing baseline
        if "baseline" not in state:
            state = {"date": today, "baseline": total_val, "reset_timestamp": now_ts(), "breaker_active": False}

        baseline = float(state.get("baseline") or total_val)
        breaker_latched = bool(state.get("breaker_active", False))

        # Manual reset (ONLY)
        if os.path.exists(manual_reset_flag):
            try:
                os.remove(manual_reset_flag)
            except:
                pass
            state["date"] = today
            state["baseline"] = total_val
            state["reset_timestamp"] = now_ts()
            state["breaker_active"] = False
            baseline = total_val
            breaker_latched = False

        if baseline <= 0:
            print("!!! CRITICAL: Invalid baseline (<=0) - ACTIVATING BREAKER FOR SAFETY !!!")
            state["breaker_active"] = True
            breaker_latched = True
            drawdown_pct = 1.0
        else:
            drawdown_pct = (baseline - total_val) / baseline

        threshold = cfg.get("circuit_breaker_threshold", 0.20)
        triggered = drawdown_pct >= threshold

        # Latch breaker if triggered
        if triggered and not breaker_latched:
            state["breaker_active"] = True
            breaker_latched = True

        # Persist state (baseline does NOT change automatically)
        try:
            with open(state_path, "w") as f:
                json.dump(state, f)
        except:
            pass

        details = f"Total: {total_val:.2f}, Baseline: {baseline:.2f}, Drawdown: {drawdown_pct*100:.2f}%"
        return breaker_latched, drawdown_pct, details

    except Exception as e:
        print(f"!!! CRITICAL: Breaker check error: {e} - ACTIVATING BREAKER FOR SAFETY !!!")
        return True, 1.0, f"ERROR: {str(e)}"


def redeem_shares(w3: Web3, pk: str, addr: str, condition_id: str):
    """
    Redeem shares for a given conditionId on-chain.
    """
    try:
        # Minimal ABI for redeemPositions
        abi = [
            {
                "name": "redeemPositions",
                "type": "function",
                "inputs": [
                    {"name": "collateralToken", "type": "address"},
                    {"name": "parentCollectionId", "type": "bytes32"},
                    {"name": "conditionId", "type": "bytes32"},
                    {"name": "indexSets", "type": "uint256[]"}
                ],
                "outputs": []
            }
        ]
        contract = w3.eth.contract(address=Web3.to_checksum_address(CTF_CONTRACT), abi=abi)
        
        # HASH_ZERO for parentCollectionId (standard binary markets)
        hash_zero = "0x0000000000000000000000000000000000000000000000000000000000000000"
        # Index sets [1, 2] cover both YES and NO outcomes in a binary market
        index_sets = [1, 2]
        
        # Check if we have anything to redeem (balance check)
        # We'll use a try-except block with multiple RPCs if one fails
        
        print(f"DEBUG: Building redeem tx for {condition_id}")
        
        # Ensure we have a fresh nonce
        nonce = w3.eth.get_transaction_count(addr, 'pending')
        
        # Use a very high gas price to overcome "underpriced" errors and clear backlog
        # Current Polygon gas is usually 30-100 gwei. Let's be aggressive.
        gas_price = int(w3.eth.gas_price * 2.0)
        
        tx = contract.functions.redeemPositions(
            Web3.to_checksum_address(USDC_POS),
            hash_zero,
            condition_id,
            index_sets
        ).build_transaction({
            'from': addr,
            'nonce': nonce,
            'gas': 250000,
            'gasPrice': gas_price,
            'chainId': 137
        })
        
        signed_tx = w3.eth.account.sign_transaction(tx, pk)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
        print(f"DEBUG: Sent redeem tx {tx_hash.hex()} with nonce {nonce}. Waiting for receipt...")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        return tx_hash.hex() if receipt.status == 1 else None
    except Exception as e:
        if "rate limit" in str(e).lower():
            time.sleep(10) # Backoff
        print(f"REDEEM_ERROR for {condition_id}: {e}")
        return None


def main():

    cfg = load_json(CFG_PATH)

    pk = os.environ["PM_PRIVATE_KEY"]
    addr = os.environ.get("PM_FUNDER") or os.environ.get("PM_SIGNER_ADDR")

    client = ClobClient(CLOB_HOST, key=pk, chain_id=CHAIN_ID, signature_type=0)
    creds = ensure_clob_creds(client)
    client.set_api_creds(creds)
    
    # Try multiple RPCs to find a stable one
    w3 = None
    rpcs = [POLYGON_RPC] + ALT_RPCS
    random.shuffle(rpcs)
    for rpc_url in rpcs:
        try:
            temp_w3 = Web3(Web3.HTTPProvider(rpc_url))
            if temp_w3.is_connected():
                w3 = temp_w3
                print(f"DEBUG: Connected to RPC: {rpc_url}")
                break
        except: continue
    
    if not w3:
        w3 = Web3(Web3.HTTPProvider(POLYGON_RPC))

    print("entry_bot_ready", {"addr": addr, **cfg})
    
    # 持久化的已买入集合（跨扫描周期）
    recent_buys = {}  # {cid: timestamp} 记录最近买入的市场，避免 API 延迟导致重复买入
    BUY_COOLDOWN_SECONDS = 300  # 5分钟内不重复买入同一市场（考虑 API 延迟）

    while True:
        if os.path.exists(STOP_FILE):
            print("STOP_ENTRY present -> entry bot exiting")
            return

        # CIRCUIT BREAKER CHECK (控制新买入)
        breaker_check_ts = now_ts()
        is_breaker, dd_pct, dd_info = get_daily_pnl_status(addr, cfg)
        if is_breaker:
            # 每天只输出一次熔断日志和警报（避免刷屏）
            breaker_flag = "breaker_alert_sent_" + datetime.datetime.now().strftime("%Y-%m-%d") + ".flag"
            if not os.path.exists(breaker_flag):
                msg = f"Breaker Active: {dd_info}"
                print(f"!!! CIRCUIT BREAKER ACTIVE !!! {dd_info} - Skip new entries")
                append_event({"type": "debug", "t": now_ts(), "msg": msg})
                append_event({
                    "type": "alert", 
                    "msg": f"🚨 <b>熔断机制触发</b>\n当日亏损已达 {dd_pct*100:.2f}%，停止今日所有新开仓。\n{dd_info}", 
                    "success": False
                })
                with open(breaker_flag, "w") as f: 
                    f.write("1")
            
            # 输出扫描事件（Dashboard 需要显示 Last Scan）
            append_event({"type": "scan", "t": now_ts(), "valid_markets": 0, "total_markets": 0, "breaker_active": True})
            
            time.sleep(int(cfg["poll_seconds"]))
            continue

        # One-shot snapshot per loop (reduce Data/RPC churn)
        positions = fetch_positions(addr)
        open_cids = set(positions.keys())
        markets = fetch_ending_markets(cfg)

        api_counts = {
            "gamma_markets": 1 if (_GAMMA_MARKETS_CACHE.get("ts") == now_ts()) else 0,
            "data_positions": 1,
            "rpc_usdc": 0,
            "clob_books": 0,
        }

        for m in markets:
            # cap number of concurrent markets
            if len(open_cids) >= int(cfg.get("max_open_markets", 3)):
                break
            cid = m.get("conditionId")
            slug = m.get("slug")
            if not cid:
                continue

            # Check cooldown: skip markets that recently triggered stop-loss
            if slug and is_market_in_cooldown(slug):
                # print(f"DEBUG: Skipping {slug} - in cooldown after recent stop-loss")
                continue

            # Check category diversity: avoid over-concentration in same category
            max_same_cat = int(cfg.get("max_same_category_markets", 3))
            if slug and not check_category_diversity(positions, slug, max_same_cat):
                category = get_market_category(slug)
                msg = f"Skipping {slug[:30]}...: too many '{category}' markets (max: {max_same_cat})"
                print(f"DEBUG: {msg}")
                append_event({"type": "debug", "t": now_ts(), "msg": msg, "slug": slug})
                continue
            
            # Check event duplication: avoid buying multiple markets for the same underlying event
            title = m.get("question", "")
            event_key = extract_event_key(title, slug)
            # 检查当前持仓是否已有同一事件
            has_same_event = False
            for cid_key, pos_list in positions.items():
                if not pos_list:
                    continue
                pos_slug = pos_list[0].get("slug", "")
                pos_title = pos_list[0].get("title", "")
                if pos_slug and extract_event_key(pos_title, pos_slug) == event_key:
                    has_same_event = True
                    msg = f"Skipping {slug[:40]}...: same event already held ({pos_slug[:30]}...)"
                    print(f"DEBUG: {msg}")
                    append_event({"type": "debug", "t": now_ts(), "msg": msg, "slug": slug})
                    break
            if has_same_event:
                continue

            # per-market cap by current position value (use Data API)
            cur_val = 0.0
            held_token = None
            if cid in positions:
                # do not enter if already holding any side for this condition
                continue
            
            # 检查是否刚刚买入过（防止 API 延迟导致重复买入）
            now = now_ts()
            if cid in recent_buys:
                if now - recent_buys[cid] < BUY_COOLDOWN_SECONDS:
                    # print(f"DEBUG: Skipping {slug} - bought {now - recent_buys[cid]}s ago")
                    continue
                else:
                    # 超过冷却期，移除记录
                    del recent_buys[cid]

            clob_token_ids = json.loads(m.get("clobTokenIds") or "[]")
            if len(clob_token_ids) != 2:
                continue

            neg_risk = bool(m.get("negRisk"))

            # Evaluate both outcomes, choose the one with highest price (most likely), but only if ask <= 0.95
            best_candidate = None
            for outcome_index, token_id in enumerate(clob_token_ids):
                try:
                    api_counts["clob_books"] += 1
                    book = client.get_order_book(token_id)
                except Exception:
                    continue
                if not book.asks or not book.bids:
                    continue

                tick = float(book.tick_size)
                min_size = float(book.min_order_size)
                
                # Sorting bug fix: get best bid/ask by min/max
                best_ask = min(float(a.price) for a in book.asks)
                best_bid = max(float(b.price) for b in book.bids)

                spread_bps = best_spread_bps(best_bid, best_ask)
                if spread_bps > cfg["max_spread_bps"]:
                    continue

                if best_ask < cfg.get("entry_price_min", 0.0) or best_ask > cfg["entry_price_max"]:
                    continue

                # 不再限制 max_shares，改为动态计算

                cand = {
                    "cid": cid,
                    "slug": m.get("slug"),
                    "title": m.get("question") or m.get("slug"),
                    "token": token_id,
                    "outcome": json.loads(m.get("outcomes") or "[\"Yes\",\"No\"]")[outcome_index],
                    "best_ask": best_ask,
                    "best_bid": best_bid,
                    "tick": tick,
                    "min_size": min_size,
                    "spread_bps": spread_bps,
                    "neg_risk": neg_risk,
                }
                # Outcome bias: prefer NO over YES (configurable bonus)
                bonus = float(cfg.get("prefer_no_score_bonus", 0.05))
                outcome_norm = str(cand.get("outcome") or "").strip().lower()
                score = cand["best_ask"] + (bonus if outcome_norm == "no" else 0.0)
                cand["score"] = score

                # choose highest score among qualifying candidates
                if best_candidate is None or cand["score"] > best_candidate.get("score", best_candidate.get("best_ask", 0)):
                    best_candidate = cand

            if not best_candidate:
                continue

            # 动态计算买入数量（基于总仓位的 10%）
            # Reuse loop snapshot to avoid duplicate Data/RPC calls
            # (positions already from Data API)
            cash = get_usdc_balance(addr)
            pos_value = 0.0
            for cid_key, ps_list in positions.items():
                for p in ps_list:
                    pos_value += float(p.get("currentValue", 0))
            total_value = cash + pos_value
            
            # 10% baseline position size
            target_investment = total_value * 0.10

            # Category weighting (configurable)
            category = get_market_category(best_candidate["slug"])
            slug = best_candidate["slug"].lower()

            # Default weights (can be overridden via config)
            weights = cfg.get(
                "category_weight_multipliers",
                {
                    "finance": 1.5,
                    "politics": 1.2,
                    "sports-soccer": 0.5,
                    "sports-basketball": 0.5,
                    "sports-esports": 0.5,
                    "sports-other": 0.5,
                    "crypto": 0.4,
                    "other": 1.0,
                    "entertainment": 1.0,
                    "weather": 1.0,
                },
            )

            mult = float(weights.get(category, 1.0))

            # Keep the legacy special-case for NCAAB if desired (treated as basketball)
            if slug.startswith("cbb-") or slug.startswith("cwbb-"):
                mult = min(mult, 0.6)

            target_investment *= mult
            
            # 计算目标股数（向下取整）
            px = clamp_price(best_candidate["best_ask"] * (1 + cfg["slippage_bps"] / 10000.0), best_candidate["tick"])
            target_shares = int(target_investment / px)
            
            # 如果计算出的股数低于市场最小要求，使用最小要求
            buy_size = max(target_shares, int(best_candidate["min_size"]))
            
            # 如果资金不足以买 min_size，跳过
            if px * buy_size > cash:
                msg = f"Insufficient funds for {best_candidate['slug'][:30]}... (Need ${px * buy_size:.2f}, Have ${cash:.2f})"
                print(f"DEBUG: {msg}")
                append_event({"type": "debug", "t": now_ts(), "msg": msg, "slug": best_candidate['slug']})
                continue
            
            msg = f"BUY_PLAN: {best_candidate['title'][:40]} | Total: ${total_value:.2f} | Shares: {buy_size}"
            print(msg)
            append_event({"type": "debug", "t": now_ts(), "msg": msg, "slug": best_candidate['slug']})

            # 🔴 双重保险：买入前再次检查熔断器
            # Re-check only if our previous breaker check is stale (>15s)
            if now_ts() - int(breaker_check_ts) > 15:
                is_breaker_recheck, _, _ = get_daily_pnl_status(addr, cfg)
                if is_breaker_recheck:
                    print(f"!!! CIRCUIT BREAKER RE-CHECK FAILED - Skipping buy for {best_candidate['slug']} !!!")
                    append_event({"type": "debug", "t": now_ts(), "msg": "Breaker active on buy attempt - skipped", "slug": best_candidate['slug']})
                    continue

            # Place FAK buy
            try:
                resp = place_buy(
                    client,
                    best_candidate["token"],
                    px,
                    buy_size,  # 使用动态计算的股数
                    best_candidate["tick"],
                    best_candidate["neg_risk"],
                )
                # Success or not, we record this CID as 'active' for this sweep to respect the limit
                open_cids.add(best_candidate["cid"])
                # 记录买入时间，防止短期内重复买入
                recent_buys[best_candidate["cid"]] = now_ts()
            except Exception as e:
                print(f"BUY_ERROR: {e}")
                continue
            # enrich with endDate + cash + pnl snapshot after the order
            cash = get_usdc_balance(addr)
            snap = get_position_snapshot(addr, best_candidate["cid"], best_candidate["token"])
            evt = {**best_candidate, "type": "entry_buy", "t": now_ts(), "px": px,
                   "buy_size": buy_size,  # 记录实际买入股数
                   "end": m.get("endDate") or get_end_date(best_candidate["cid"]),
                   "cash": cash,
                   **snap,
                   "orderID": resp.get("orderID") or resp.get("orderId"), "status": resp.get("status"), "success": resp.get("success"), "errorMsg": resp.get("errorMsg")}
            append_event(evt)
            print("ENTRY_BUY", evt)
            time.sleep(0.5)

        # Emit API call summary for observability
        try:
            # gamma_markets is approximated via cache state; clob_books counted precisely
            api_counts["gamma_cache_age_s"] = now_ts() - int(_GAMMA_MARKETS_CACHE.get("ts", 0))
            api_counts["gamma_ttl_s"] = int(cfg.get("gamma_ttl_seconds", 30))
            append_event({"type": "debug", "t": now_ts(), "msg": f"api_counts={api_counts}"})
            print("API_COUNTS", api_counts)
        except:
            pass

        time.sleep(int(cfg["poll_seconds"]))


if __name__ == "__main__":
    main()
