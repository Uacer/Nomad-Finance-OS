# Changelog

All notable changes to the Polymarket Trading Bot will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned
- WebSocket integration for real-time price updates
- Multi-account support
- Advanced strategy backtesting module
- Mobile app notifications

---

## [2.0.0] - 2026-02-11

### Added
- Separated circuit breaker logic: now continues stop-loss/take-profit during circuit break
- NCAAB market weighting (60% position size due to cancellation risk)
- Horizontal scroll for dashboard tables
- Extended buy cooldown from 120s to 300s (5 minutes)
- Comprehensive agent collaboration documentation

### Changed
- **BREAKING**: Removed automatic daily baseline reset - now manual only
- Reduced polling interval from 15s to 5s for faster response
- Circuit breaker message now mentions stop-loss/take-profit continue running
- Dashboard password protection enabled by default

### Fixed
- Duplicate buy issue due to Polymarket API delay (cooldown extended)
- Dashboard horizontal overflow hiding columns
- Event log pagination (default 10, load more button)

### Security
- Added .gitignore rules for sensitive files
- Environment variable template (.env.example)

---

## [1.9.0] - 2026-02-09

### Added
- Market category diversification (max 2 per category)
- Category-specific position weighting (Crypto 50%, NCAAB 60%)
- Dashboard improvements: better UX, clearer status indicators

### Changed
- Stop-loss lowered from 0.80 to 0.49 based on backtest analysis
- Circuit breaker threshold increased from 10% to 20%

### Fixed
- Status loop push timing bug (expanded window to 00-02min and 30-32min)
- Dashboard $0.00 display bug (missing PM_FUNDER env variable)

---

## [1.8.0] - 2026-02-09

### Added
- Systemd service management
- Stop-loss analysis script (analyze_stoploss.py)
- Market cooldown mechanism (prevent re-buying stopped-out markets)

### Changed
- Migrated from shell scripts to systemd for reliability
- Improved error handling and retry logic

### Deprecated
- run_bot.sh, watchdog.sh (replaced by systemd)

---

## [1.7.0] - 2026-02-08

### Added
- Circuit breaker mechanism (stops trading on 20% daily loss)
- Early exit at 0.99 (take-profit)
- Market age filter (skip markets younger than 10 minutes)

### Fixed
- Duplicate order execution due to API lag
- Precision errors in order placement

---

## [1.6.0] - 2026-02-07

### Added
- Real-time dashboard with Flask
- Position tracking and P&L calculation
- Event logging in JSONL format

### Changed
- Improved order book fetching with retry logic

---

## [1.5.0] - 2026-02-06

### Added
- Telegram notification integration
- Periodic status reports every 30 minutes
- Spread filtering (max 300 bps)

---

## [1.0.0] - 2026-02-05

### Added
- Initial release
- Tail trading strategy implementation
- Stop-loss and take-profit automation
- Basic configuration system
- Command-line interface

---

## Version Numbering

- **Major (X.0.0)**: Breaking changes, major refactors
- **Minor (1.X.0)**: New features, backwards-compatible
- **Patch (1.0.X)**: Bug fixes, minor improvements

---

**Maintained by**: Issa AI  
**Repository**: https://github.com/Uacer/AgentForUs-AFU-
