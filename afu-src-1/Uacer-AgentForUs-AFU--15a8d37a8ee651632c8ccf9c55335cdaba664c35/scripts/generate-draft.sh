#!/usr/bin/env bash
# Generate reply draft via OpenClaw agent
# Usage: generate-draft.sh "tweet content"

content="$1"

if [[ -z "$content" ]]; then
  echo "Real-time markets > hot takes. Signal over noise. 💜"
  exit 0
fi

# Use openclaw to generate draft via current session
# This assumes openclaw CLI can send messages to the agent
echo "$content" | openclaw agent reply --prompt "你是 Firefly 社交媒体团队成员。根据推文内容，写一条简短的英文回复（1-2句话），要求：
1. 自然、有见地，不要像营销号
2. 必须以 💜 结尾
3. 与 Firefly 的产品理念相关：预测市场、社交聚合、开放协议
4. 避免直接推销产品

只返回回复文本，不要解释。" 2>/dev/null || echo "Markets don't lie. Real-time odds capture truth. 💜"
