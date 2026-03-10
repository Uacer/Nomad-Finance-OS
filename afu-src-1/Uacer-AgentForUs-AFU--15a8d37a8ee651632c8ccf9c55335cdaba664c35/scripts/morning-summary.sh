#!/usr/bin/env bash
set -euo pipefail

# Morning summary generator for Sain / Firefly ops
# Output: plain text (Markdown-ish) to stdout

WORKDIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CFG="$WORKDIR/scripts/morning-config.json"
MEMORY="$WORKDIR/MEMORY.md"
XSECRETS="/root/.openclaw/secrets/x.json"

BIRD_AUTH_ARGS=""
if [[ -f "$XSECRETS" ]]; then
  at=$(jq -r '.auth_token // empty' "$XSECRETS")
  ct=$(jq -r '.ct0 // empty' "$XSECRETS")
  if [[ -n "$at" && -n "$ct" ]]; then
    BIRD_AUTH_ARGS=(--auth-token "$at" --ct0 "$ct")
  fi
fi

birdc() {
  # shellcheck disable=SC2068
  bird ${BIRD_AUTH_ARGS[@]:-} "$@"
}

if [[ ! -f "$CFG" ]]; then
  echo "Missing config: $CFG" >&2
  exit 1
fi

LOCATION=$(jq -r '.location' "$CFG")
Q_PRED=$(jq -r '.queries.prediction' "$CFG")
Q_FARCASTER=$(jq -r '.queries.farcaster' "$CFG")
Q_LENS=$(jq -r '.queries.lens' "$CFG")
Q_MENTIONS=$(jq -r '.queries.fireflyMentions' "$CFG")

# Auth for bird: prefer ~/.config/bird/config.json5 cookies.
# (We avoid requiring AUTH_TOKEN/CT0 env vars so cron runs reliably.)

now_cn=$(TZ=Asia/Shanghai date '+%m月%d日 %a %H:%M')
date_cn=$(TZ=Asia/Shanghai date '+%m月%d日')
weekday_cn=$(TZ=Asia/Shanghai date '+%a')

tmpdir=$(mktemp -d)
trap 'rm -rf "$tmpdir"' EXIT

run() {
  local name="$1"; shift
  ("$@") >"$tmpdir/$name.txt" 2>/dev/null || true
}

# Weather (best-effort). wttr.in supports CN locations.
WEATHER=""
if command -v curl >/dev/null 2>&1; then
  WEATHER=$(curl -fsSL "https://wttr.in/${LOCATION}?format=1" 2>/dev/null || true)
fi

run trending birdc trending --count 10
# Keyword searches: fetch more + JSON so we can rank by engagement
run pred birdc search "$Q_PRED min_faves:50 -filter:replies" --count 30 --json
run farcaster birdc search "$Q_FARCASTER min_faves:50 -filter:replies" --count 30 --json
run lens birdc search "$Q_LENS min_faves:50 -filter:replies" --count 30 --json
run mentions birdc search "$Q_MENTIONS" --count 30

# Important accounts
acc_count=$(jq '.importantAccounts | length' "$CFG")
for ((i=0;i<acc_count;i++)); do
  h=$(jq -r ".importantAccounts[$i].handle" "$CFG")
  run "acc_${h}" birdc user-tweets "$h" --count 10 --json
done

# Pull TODOs from MEMORY.md (best-effort)
TODOS=""
if [[ -f "$MEMORY" ]]; then
  TODOS=$(awk 'BEGIN{inTodo=0} /^## TODO/{inTodo=1; next} /^## /{if(inTodo){exit}} {if(inTodo) print}' "$MEMORY" | sed '/^\s*$/d' | head -n 10)
fi

# Helpers
urlencode() {
  python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$1"
}

extract_https_urls() {
  grep -Eo 'https://x\.com/[^ ]+' "$1" | sed 's/[)\]>,.]*$//'
}

pick_tweet_blocks() {
  # Print first N tweet blocks from bird (plain text) output, summarized.
  local file="$1"; local n="$2"
  awk -v N="$n" '
    BEGIN{blk=0; inblk=0; lines=0}
    /^@/ { if (blk>=N) exit; inblk=1; lines=0; print; next }
    /^────────────────/ { if (inblk){ blk++; inblk=0; print "" } ; next }
    {
      if (!inblk) next;
      if ($0 ~ /^🔗 https:\/\/x\.com\//) { print; next }
      if ($0 ~ /^📅 /) { next }
      if ($0 ~ /^🖼️ / || $0 ~ /^🎬 / || $0 ~ /^┌─/ || $0 ~ /^│/ || $0 ~ /^└─/) { next }
      if (lines < 2 && $0 !~ /^\s*$/) { print; lines++ }
    }
  ' "$file" | sed 's/[[:space:]]\+$//'
}

pick_top_from_search_json() {
  # Input: bird search --json output (list of tweets)
  # Output: top N tweet URLs selected by (priority + fill) thresholds using likes/replies.
  # Optional: exclude keywords (case-insensitive) to filter out promo/campaign spam.
  local file="$1"; local n="$2"; local exclude_csv="${3:-}"
  python3 - "$file" "$n" "$exclude_csv" <<'PY'
import json, math, sys, re
from pathlib import Path

path=sys.argv[1]
N=int(sys.argv[2])
exclude_csv=(sys.argv[3] or '').strip()
ex=['campaign','claim','claimable','rewards','points','airdrop','spin','task','drop your','follow each other','follow','ca','0x','contract','bags','cooking','cook','opn','whitepaper','presale','listing','giveaway']
if exclude_csv:
  ex += [w.strip().lower() for w in exclude_csv.split(',') if w.strip()]

try:
  raw=Path(path).read_text().strip()
  if not raw:
    sys.exit(0)
  items=json.loads(raw)
except Exception:
  sys.exit(0)

def url(t):
    tid=t.get('id')
    user=(t.get('author') or {}).get('username')
    if tid and user:
        return f"https://x.com/{user}/status/{tid}"
    if tid:
        return f"https://x.com/i/status/{tid}"
    return None

def met(t):
    return {
        'likes': int(t.get('likeCount') or 0),
        'replies': int(t.get('replyCount') or 0),
        'reposts': int(t.get('retweetCount') or 0),
    }

def is_spam(text: str) -> bool:
    t=text.lower()
    # Removed length filter per user request (2026-02-10)
    if ex and any(w in t for w in ex):
        return True
    # If it contains more than 3 '$' followed by words (ticker spam)
    if len(re.findall(r'\$[A-Z]+', text)) > 3:
        return True
    return False

rows=[]
seen_authors=set()
for t in items:
    text=(t.get('text') or '').strip()
    if not text or text.startswith('RT @'):
        continue
    author=(t.get('author') or {}).get('username')
    if not author or author in seen_authors:
        continue
    if is_spam(text):
        continue
    m=met(t)
    score=math.log10(m['likes']+1)*2 + math.log10(m['replies']+1)*1.5 + math.log10(m['reposts']+1)*1
    rows.append((score,t,m))

pri=[]; fill=[]
for score,t,m in rows:
    if m['likes']>=500 or m['replies']>=80:
        pri.append((score,t,m))
    elif m['likes']>=100 or m['replies']>=20:
        fill.append((score,t,m))

pri.sort(reverse=True, key=lambda x:x[0])
fill.sort(reverse=True, key=lambda x:x[0])

picked=pri[:N]
if len(picked)<N:
    picked += fill[:(N-len(picked))]

for score,t,m in picked[:N]:
    u=url(t)
    if not u:
        continue
    likes=m['likes']; replies=m['replies']; reposts=m['reposts']
    # star rating (1-5) without exposing raw metrics
    stars=1
    if likes>=5000 or replies>=1000: stars=5
    elif likes>=2000 or replies>=300: stars=4
    elif likes>=500 or replies>=80: stars=3
    elif likes>=100 or replies>=20: stars=2
    print(f"{u}\tstars={stars}")
PY
}

render_selected_urls() {
  # Given lines: "url\tstars=N" -> fetch each via bird read and print a compact block.
  local lines="$1"
  while IFS=$'\t' read -r u meta; do
    [[ -n "$u" ]] || continue
    s=$(printf "%s" "$meta" | sed -n 's/^stars=\([0-9]\+\)$/\1/p')
    [[ -z "$s" ]] && s=3
    stars=""
    for ((i=0;i<s;i++)); do stars+="🌟"; done
    echo "$stars"
    birdc read "$u" | awk '
      /^@/ {print; next}
      /^🔗 / {print; next}
      /^📅 / {next}
      /^🖼️ / || /^🎬 / || /^┌─/ || /^│/ || /^└─/ {next}
      /^❤️ / || /^🔁 / || /^💬 / {next}
      /❤️/ && /🔁/ {next}
      { if (printed<2 && $0 !~ /^\s*$/) {print; printed++} }
      END{print ""}
    '
  done <<< "$lines"
}

pick_trends() {
  # Convert bird trending output into clickable x.com search URLs.
  # Filter out generic crypto unless (a) matches keywords OR (b) posts >= minPosts.
  local file="$1"; local n="$2"

  local minPosts
  minPosts=$(jq -r '.trendingFilter.minPosts // 50000' "$CFG")
  local kwre
  kwre=$(jq -r '.trendingFilter.keywords // [] | map(gsub("\\\\s+";"\\\\s+")) | join("|")' "$CFG")
  if [[ -z "$kwre" ]]; then
    kwre='polymarket|prediction\\s+market|opinion|farcaster|socialfi|decentralized\\s+social|firefly|vitalik|suji'
  fi

  # Parse blocks: title + optional posts count
  awk -v MIN="$minPosts" -v KWRE="$kwre" -v WANT="$n" '
    function lcase(s){ for(i=1;i<=length(s);i++){c=substr(s,i,1); if(c>="A"&&c<="Z") c=tolower(c); out=out c} r=out; out=""; return r }
    BEGIN{t=""; p=0; keep=0; printed=0}
    /^\[/ {
      t=$0; sub(/^\[[^\]]+\] /, "", t);
      p=0;
      keep=0;
      next;
    }
    /^[0-9]+\.[0-9]+K posts|^[0-9]+ posts/ {
      line=$0;
      gsub(/[^0-9.K]/, "", line);
      if (index(line,"K")>0) { gsub(/K/,"",line); p=int(line*1000) } else { p=int(line) }
      next;
    }
    /twitter:\/\/trending\// {
      if (t=="") next;
      tl=lcase(t);
      keep=0;
      # If posts >= threshold, always keep
      if (p>=MIN) keep=1;
      # If keyword filter exists and matches, keep
      if (KWRE != "" && tl ~ KWRE) keep=1;
      # If no keyword filter (empty string), keep
      if (KWRE == "") keep=1;
      if (keep && printed < WANT) {
        print t;
        printed++;
      }
      t=""; p=0; keep=0;
      next;
    }
  ' "$file" | while IFS= read -r t; do
    q=$(urlencode "$t")
    echo "$t"
    echo "https://x.com/search?q=${q}&src=trend_click"
    echo ""
  done
}

within_hours() {
  local datestr="$1"; local hours="$2"
  python3 - "$datestr" "$hours" <<'PY'
import sys, datetime
s=sys.argv[1]
h=int(sys.argv[2])
try:
  dt=datetime.datetime.strptime(s, "%a %b %d %H:%M:%S %z %Y")
except Exception:
  sys.exit(1)
now=datetime.datetime.now(datetime.timezone.utc)
sys.exit(0 if (now-dt).total_seconds() <= h*3600 else 1)
PY
}

clean_todos() {
  # Keep only incomplete TODOs (unchecked)
  echo "$1" | sed -E 's/^\s*-\s*/- /' | grep -vE '^\- \[x\]' || true
}

# Compose (less noise, more signal)
{
  echo "☀️ 早安 Sain！${date_cn} ${weekday_cn}（${now_cn}）"
  echo

  echo "🌤️ ${LOCATION} 天气"
  if [[ -n "$WEATHER" ]]; then
    echo "• ${WEATHER}"
  else
    echo "• （天气抓取失败；后续可换数据源）"
  fi
  echo

  todos_clean=$(clean_todos "$TODOS")
  if [[ -n "$todos_clean" ]]; then
    echo "📌 待办事项"
    echo "$todos_clean"
    echo
  fi

  echo "🔥 今日热点（Top 3）"
  tblock=$(pick_trends "$tmpdir/trending.txt" 3)
  if [[ -n "$tblock" ]]; then
    # Format: each trend is 3 lines (title, URL, blank)
    # Add bullet only to title lines (odd lines in pairs)
    echo "$tblock" | awk '
      NR % 3 == 1 { print "• " $0; next }
      NR % 3 == 2 { print "  " $0; next }
      { print "" }
    '
  else
    echo "• （暂无热点达到展示门槛）"
  fi
  echo

  echo "🎰 预测市场动态（关键词流 Top 3｜按热度筛）"
  picked_pred=$(pick_top_from_search_json "$tmpdir/pred.txt" 3 || true)
  if [[ -n "$picked_pred" ]]; then
    render_selected_urls "$picked_pred"
  else
    echo "（今日关键词流未抓到足够高热度内容；可调低阈值或扩大样本数）"
    echo
  fi

  echo "🌐 Social（Farcaster + Lens｜关键词流 Top 3｜按热度筛）"
  picked_far=$(pick_top_from_search_json "$tmpdir/farcaster.txt" 3 "campaign,claim,claimable,rewards,points,airdrop,spin,task,drop your,follow each other,follow,ca,0x,contract,bags,cooking,cook" || true)
  picked_lens=$(pick_top_from_search_json "$tmpdir/lens.txt" 3 "campaign,claim,claimable,rewards,points,airdrop,spin,task,drop your,follow each other,follow,ca,0x,contract,bags,cooking,cook" || true)
  combined_social=$(printf "%s\n%s\n" "$picked_far" "$picked_lens" | sed '/^$/d' | awk -F'\t' '!seen[$1]++')
  # sort by stars desc, then take top 3
  top_social=$(echo "$combined_social" | awk -F'\t' '{gsub(/stars=/, "", $2); print $2"\t"$0}' | sort -rn | cut -f2- | head -n 3)
  if [[ -n "$top_social" ]]; then
    render_selected_urls "$top_social"
  else
    echo "（今日 Farcaster/Lens 关键词流未抓到足够高热度内容）"
    echo
  fi

  echo "👤 重要人物观点（近24h｜跨账号筛选）"
  important_lines=$(python3 - "$CFG" "$tmpdir" <<'PY'
import json, sys, datetime, re
from pathlib import Path

cfg=json.loads(Path(sys.argv[1]).read_text())
tmpdir=Path(sys.argv[2])
accounts=cfg.get('importantAccounts',[])
# Exclude official accounts from the "人物观点" section
exclude_labels=set(['Polymarket','Opinion'])
exclude_handles=set(['Polymarket','ForrestOLAB'])

now=datetime.datetime.now(datetime.timezone.utc)
cut=now-datetime.timedelta(hours=24)

rows=[]
for a in accounts:
  h=a['handle']
  label=a.get('label','')
  if label in exclude_labels or h in exclude_handles:
    continue
  p=tmpdir/f"acc_{h}.txt"
  if not p.exists():
    continue
  try:
    tweets=json.loads(p.read_text())
  except Exception:
    continue
  for t in tweets:
    text=(t.get('text') or '').strip()
    if not text:
      continue
    # drop RTs and ultra-short fluff
    if text.startswith('RT @'):
      continue
    if len(text) < 80:
      continue
    # drop mostly-link tweets
    if re.fullmatch(r'https?://\S+', text):
      continue
    created=t.get('createdAt')
    try:
      dt=datetime.datetime.strptime(created, "%a %b %d %H:%M:%S %z %Y")
    except Exception:
      continue
    if dt < cut:
      continue
    likes=int(t.get('likeCount') or 0)
    replies=int(t.get('replyCount') or 0)
    rts=int(t.get('retweetCount') or 0)
    score=likes*2 + replies*3 + rts*2
    url=f"https://x.com/{(t.get('author') or {}).get('username','i')}/status/{t.get('id')}"
    rows.append((score,h,url,likes,replies,rts,text.replace('\n',' ')))

rows.sort(reverse=True, key=lambda x:x[0])
rows=rows[:3]
for score,h,url,likes,replies,rts,text in rows:
  snippet=text[:240] + ('…' if len(text)>240 else '')
  print(f"• @{h}")
  print(f"  {snippet}")
  print(f"  {url}")
  print("")
PY
)
  if [[ -n "$important_lines" ]]; then
    echo "$important_lines"
  else
    echo "• （近24h未筛到足够‘观点输出’的内容）"
    echo
  fi

  echo "🎯 今日推荐互动 Top2（热帖/话题露出｜含可复制草稿）"
  # Pick from the hot posts we already selected above (prediction/farcaster/lens),
  # and avoid replying to people who directly mention Firefly.
  candidates=""
  [[ -n "${picked_pred:-}" ]] && candidates+="$picked_pred"$'\n'
  [[ -n "${picked_far:-}" ]] && candidates+="$picked_far"$'\n'
  [[ -n "${picked_lens:-}" ]] && candidates+="$picked_lens"$'\n'

  # Extract URLs, de-dup, drop any Firefly-mention threads
  mapfile -t cand_urls < <(printf "%s" "$candidates" | awk -F'\t' '{print $1}' | grep -E '^https://x\.com/' | grep -viE 'thefireflyapp|fireflyappcn' | awk '!seen[$0]++' | head -n 2)

  idx=1
  for u in "${cand_urls[@]:-}"; do
    [[ -n "$u" ]] || continue
    content=$(birdc read "$u" --json 2>/dev/null | jq -r '.text // empty' || true)
    echo "${idx}. ${u}"
    
    # AI-generated draft using Gemini (if configured)
    draft=""
    if [[ -n "$content" ]] && command -v gemini >/dev/null 2>&1; then
      draft=$(gemini --model gemini-2.0-flash-exp "你是 Firefly 社交媒体团队成员。根据以下推文内容，写一条简短的英文回复（1-2句话），要求：
1. 自然、有见地，不要像营销号
2. 必须以 💜 结尾
3. 与 Firefly 的产品理念相关：预测市场、社交聚合、开放协议
4. 避免直接推销产品

推文内容：
\"\"\"
$content
\"\"\"

只返回回复文本，不要解释。" 2>/dev/null | grep -v "^Hook registry" | grep -v "^Please set" | head -n 1 || true)
    fi
    
    # Fallback: smarter template selection if AI fails
    if [[ -z "$draft" ]]; then
      draft=$(python3 - "$content" <<'PY'
import sys, random
c = sys.argv[1].lower()
# Context-aware templates with more variety
if "polymarket" in c or "odds" in c or "prediction" in c or "bet" in c:
    drafts = [
        "Real-time markets capture truth faster than any poll. This is how signal wins. 💜",
        "Watching odds move > reading hot takes. Markets don't lie. 💜",
        "Prediction markets are the ultimate reality check. Love seeing this evolve. 💜"
    ]
elif "farcaster" in c or "warpcast" in c or "lens" in c or "protocol" in c:
    drafts = [
        "Open protocols mean users own their graph. That's the real unlock. 💜",
        "Decentralized social finally hitting its stride. Composability > walled gardens. 💜",
        "The power of portable identity. Take your network anywhere. 💜"
    ]
elif "vitalik" in c or "ethereum" in c or "credible" in c:
    drafts = [
        "Long-term thinking > short-term hype. This is the way forward. 💜",
        "Credible neutrality and public goods infrastructure matter most. 💜"
    ]
elif "data" in c or "feed" in c or "aggregat" in c:
    drafts = [
        "Curation is the new creation. Signal matters more than volume. 💜",
        "Composable feeds change everything. The UI is just one lens on the truth. 💜"
    ]
else:
    # Generic but thoughtful
    drafts = [
        "This is the direction. Open, composable, user-owned. 💜",
        "Signal over noise. Always. 💜",
        "The shift to decentralized social is inevitable. Exciting to watch. 💜"
    ]
print(random.choice(drafts))
PY
)
    fi
    
    echo "   草稿：${draft}"
    echo
    idx=$((idx+1))
  done

  if [[ ${#cand_urls[@]} -eq 0 ]]; then
    echo "（今天没有筛到适合做‘热帖露出’的链接；我会在明早扩大样本数或放宽补位档）"
  fi
} | sed 's/[[:space:]]\+$//'
