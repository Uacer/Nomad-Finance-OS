# 🎰 Polymarket Trading Bot

> Automated prediction market trading system with risk management

## 📋 Overview

An intelligent trading bot for [Polymarket](https://polymarket.com) that implements a **tail trading strategy** - buying high-confidence outcomes near market close and automatically managing positions with stop-loss and take-profit mechanisms.

**Status**: ✅ Production  
**Version**: 2.0.0  
**Last Updated**: 2026-02-11  
**Maintainer**: Issa AI

---

## ✨ Features

### Core Trading
- **Tail Strategy**: Scan markets ending within 3 days, buy outcomes priced 0.88-0.97
- **Smart Entry**: Filter by liquidity, volume, spread, and market age
- **Position Sizing**: Dynamic allocation based on portfolio (10% per market)
- **Category Weighting**: NCAAB 60%, Crypto 50%, Others 100%

### Risk Management
- **Stop-Loss**: Automatic sell at 0.49 (configurable)
- **Take-Profit**: Early exit at 0.99
- **Circuit Breaker**: Stops new trades if daily loss ≥ 20%
- **Market Cooldown**: Prevents duplicate buys within 5 minutes
- **Diversification**: Max 2 markets per category

### Monitoring
- **Dashboard**: Real-time web interface (Flask)
- **Telegram Notifications**: Trade alerts and status updates
- **Logging**: Comprehensive event tracking in JSONL format
- **Health Checks**: Status loop every 30 minutes

---

## 🏗️ Architecture

```
┌─────────────┐
│  tail_bot   │ ← Main trading engine (5s polling)
└──────┬──────┘
       │
       ├──→ Polymarket CLOB API (orders)
       ├──→ Polymarket Data API (positions)
       └──→ Polymarket Gamma API (markets)

┌─────────────┐
│  notifier   │ ← Telegram notifications
└─────────────┘

┌─────────────┐
│status_loop  │ ← Periodic status reports
└─────────────┘

┌─────────────┐
│  dashboard  │ ← Web UI (port 8080)
└─────────────┘
```

---

## 📦 Prerequisites

- **Python**: 3.11+
- **OS**: Linux (systemd recommended)
- **Network**: Stable internet for API access
- **Wallet**: Ethereum wallet with USDC on Polygon

### Dependencies
```
py-clob-client>=0.30.0
web3>=6.0.0
requests>=2.31.0
flask>=3.0.0
python-telegram-bot>=20.0
```

---

## 🚀 Installation

### 1. Clone Repository
```bash
cd projects/polymarket-bot
```

### 2. Install Dependencies
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure Environment
```bash
cp .env.example .env
nano .env
```

Required variables:
```env
# Wallet
PM_PRIVATE_KEY=0xYourPrivateKey
PM_FUNDER=0xYourWalletAddress

# APIs
POLYGON_RPC=https://polygon-rpc.com
PM_CLOB_API_KEY=your_clob_api_key
PM_CLOB_API_SECRET=your_clob_api_secret
PM_CLOB_API_PASSPHRASE=your_clob_api_passphrase

# Telegram (optional)
TELEGRAM_BOT_TOKEN=bot123456:ABC...
TELEGRAM_CHAT_ID=123456789

# Dashboard
DASHBOARD_PASSWORD=your_secure_password_here
DASHBOARD_SECRET_KEY=64+_char_random_secret
```

### 4. Configure Trading Parameters
Edit `tail_config.json`:
```json
{
  "poll_seconds": 5,
  "entry_price_min": 0.80,
  "entry_price_max": 0.95,
  "stop_price": 0.49,
  "max_open_markets": 10,
  "circuit_breaker_threshold": 0.20
}
```

---

## 💻 Usage

### Manual Run
```bash
# Trading engine
python tail_bot.py

# Dashboard (separate terminal)
python dashboard.py

# Notifications (separate terminal)
python notifier.py
```

### Systemd Service (Recommended)
```bash
# Install services
sudo cp *.service /etc/systemd/system/
sudo systemctl daemon-reload

# Start all services
sudo systemctl start polymarket-tail-bot
sudo systemctl start polymarket-notifier
sudo systemctl start polymarket-status-loop
sudo systemctl start polymarket-dashboard

# Enable auto-start
sudo systemctl enable polymarket-tail-bot
```

### Access Dashboard
```
http://your-server-ip:8080
Password: (from `DASHBOARD_PASSWORD` env var)
```

---

## ⚙️ Configuration Reference

### tail_config.json

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `poll_seconds` | int | 5 | Scanning interval (seconds) |
| `entry_price_min` | float | 0.80 | Minimum entry price |
| `entry_price_max` | float | 0.95 | Maximum entry price (avoid >0.95 due to low liquidity) |
| `stop_price` | float | 0.49 | Stop-loss trigger price |
| `max_open_markets` | int | 10 | Maximum concurrent positions |
| `slippage_bps` | int | 200 | Price slippage tolerance (basis points) |
| `max_spread_bps` | int | 300 | Maximum bid-ask spread |
| `end_within_seconds` | int | 259200 | Market end window (3 days) |
| `min_liquidity` | float | 1000 | Minimum market liquidity |
| `circuit_breaker_threshold` | float | 0.20 | Circuit breaker trigger (20% loss) |
| `min_market_age_seconds` | int | 600 | Skip markets younger than 10 min |
| `max_same_category_markets` | int | 2 | Max markets per category |

### Circuit Breaker

The circuit breaker automatically **stops new trades** when daily loss exceeds the threshold, while continuing to manage existing positions (stop-loss/take-profit).

**Reset**: Manual only (tell agent to reset baseline)

```bash
# Check status
cat circuit_breaker_state.json

# Manual reset (careful!)
echo '{"date": "YYYY-MM-DD", "baseline": 100.0, "reset_timestamp": 1234567890}' > circuit_breaker_state.json
```

---

## 📊 Monitoring

### Dashboard Features
- Real-time balance and P&L
- Active positions with current prices
- Closed positions history
- Event log with filtering
- Bot health status

### Telegram Notifications
- ✅ New trades
- ⚠️ Stop-loss triggers
- 🎯 Take-profit exits
- 🚨 Circuit breaker alerts
- 📊 Periodic status (every 30 min)

### Log Files
- `tail_bot.log` - Main trading log
- `tail_events.jsonl` - Structured event history
- `dashboard.log` - Web interface log
- `notifier.log` - Telegram bot log

---

## 🐛 Troubleshooting

### Bot Not Trading

**Check**:
1. Circuit breaker status: `cat circuit_breaker_state.json`
2. Balance: `curl https://data-api.polymarket.com/balances?user=<address>`
3. Logs: `tail -f tail_bot.log`

**Common Causes**:
- Circuit breaker active (loss ≥ 20%)
- Insufficient USDC balance
- No markets match criteria
- API rate limiting

### Orders Failing

**Error**: `invalid amounts, max accuracy of 2 decimals`  
**Fix**: Bug in place_buy precision handling (report to maintainer)

**Error**: `rate limit exceeded`  
**Fix**: Increase `poll_seconds` or reduce concurrent positions

### Dashboard Not Loading

**Check**:
1. Process running: `ps aux | grep dashboard.py`
2. Port open: `netstat -tulpn | grep 8080`
3. Logs: `tail -f dashboard.log`

---

## 🔐 Security

### Private Key Protection
- **Never** commit `.env` to Git
- Store private key in environment variables or secure vault
- Use minimal permissions wallet
- Consider hardware wallet for large amounts

### API Rate Limits
- Data API `/positions`: 150 req/10s (15 req/s)
- CLOB API `/book`: 1500 req/10s (150 req/s)
- Gamma API `/markets`: 300 req/10s (30 req/s)
- Current usage at 5s polling: ~16% of limit

### Network Security
- Dashboard password-protected
- Run behind firewall or VPN
- Use HTTPS reverse proxy for production

---

## 📈 Strategy Performance

### Tested Scenarios (2026-02-09)
- **Stop-loss analysis**: 100% direction accuracy, 100% volatility false-stops
- **Conclusion**: Stop-loss at 0.49 (was 0.80) reduces false exits
- **Win rate**: Highly dependent on market selection quality
- **Risk/Reward**: Asymmetric (risk 0.11-0.51, reward 0.01-0.12)

### Known Issues
1. **NCAAB markets**: High cancellation risk → 60% position size
2. **Flow events**: Occasional early resolution → improved filters
3. **Precision errors**: Buy orders sometimes fail → pending fix

---

## 🔄 Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

### Recent Updates (v2.0.0)
- ✅ Separated circuit breaker from stop-loss/take-profit
- ✅ Removed automatic daily baseline reset
- ✅ Reduced polling from 15s to 5s
- ✅ Extended buy cooldown to 300s
- ✅ Added NCAAB position weighting (60%)
- ✅ Improved dashboard with horizontal scroll

---

## 🤝 Contributing

### For Other Agents
1. Read this README fully
2. Check [CONVENTIONS.md](/CONVENTIONS.md)
3. Test changes locally
4. Update CHANGELOG.md
5. Commit with descriptive message

### Coding Standards
- Python 3.11+ type hints
- Docstrings for functions
- No hardcoded secrets
- JSON for configs (with comments)

---

## 📝 License

Private - Not for public distribution

---

## 📞 Support

- **Issues**: Create GitHub issue with `[polymarket-bot]` prefix
- **Questions**: Check troubleshooting section first
- **Maintainer**: Issa AI (via human: Sain @RealColdwater)

---

**⚠️ Disclaimer**: This bot trades real money. Use at your own risk. Past performance does not guarantee future results. Always test with small amounts first.
