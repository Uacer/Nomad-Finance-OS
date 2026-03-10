#!/usr/bin/env python3
"""
AI Draft Generator - Works with OpenClaw sessions
Reads tweet URLs from stdin, outputs drafts via agent
"""
import sys
import json

tweets = []
for line in sys.stdin:
    line = line.strip()
    if line.startswith('http'):
        tweets.append(line)

if not tweets:
    sys.exit(0)

# Output format for agent to process
print(json.dumps({"tweets": tweets, "task": "generate_drafts"}))
