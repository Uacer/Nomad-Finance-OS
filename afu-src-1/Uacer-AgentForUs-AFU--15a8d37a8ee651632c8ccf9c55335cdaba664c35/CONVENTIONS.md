# 📐 Code Conventions

> Standardized coding practices for all agents in this workspace

## 🐍 Python Style Guide

### Naming
- **Files**: `snake_case.py`
- **Classes**: `PascalCase`
- **Functions/Variables**: `snake_case`
- **Constants**: `UPPER_SNAKE_CASE`
- **Private**: `_leading_underscore`

### Example
```python
# Good
class TradingBot:
    MAX_POSITIONS = 10
    
    def __init__(self):
        self.current_balance = 0
        self._api_key = "secret"
    
    def calculate_profit(self, entry_price, exit_price):
        return exit_price - entry_price

# Bad
class tradingbot:  # Should be PascalCase
    maxPositions = 10  # Should be UPPER_SNAKE_CASE
    
    def CalculateProfit(self, EntryPrice, ExitPrice):  # Should be snake_case
        return ExitPrice - EntryPrice
```

### Code Organization
```python
# 1. Standard library imports
import os
import json
from datetime import datetime

# 2. Third-party imports
import requests
from web3 import Web3

# 3. Local imports
from .utils import format_price
from .config import load_config

# 4. Constants
API_BASE_URL = "https://api.example.com"
DEFAULT_TIMEOUT = 30

# 5. Functions/Classes
def main():
    pass
```

---

## 📄 Configuration Files

### JSON
```json
{
  "setting": "value",
  "// comment": "Use this format for inline comments",
  "nested": {
    "key": "value"
  }
}
```

### Environment Variables (.env)
```env
# API Configuration
API_KEY=your_key_here
API_SECRET=your_secret_here

# Database
DB_HOST=localhost
DB_PORT=5432

# Features
ENABLE_NOTIFICATIONS=true
DEBUG_MODE=false
```

---

## 📝 Documentation Standards

### README.md Structure
```markdown
# Project Name

One-line description

## Features
- Feature 1
- Feature 2

## Prerequisites
- Requirement 1
- Requirement 2

## Installation
Step-by-step guide

## Configuration
How to configure

## Usage
How to use

## Troubleshooting
Common issues

## Contributing
How to contribute

## License
License info
```

### CHANGELOG.md Format
```markdown
# Changelog

## [Unreleased]

## [1.0.1] - 2026-02-11
### Added
- New feature description

### Changed
- What changed

### Fixed
- What was fixed

### Deprecated
- What will be removed

### Removed
- What was removed

### Security
- Security-related changes
```

---

## 🔧 Function Documentation

### Python Docstrings
```python
def calculate_pnl(entry_price: float, exit_price: float, size: float) -> dict:
    """
    Calculate profit and loss for a trade.
    
    Args:
        entry_price: Price when entering position
        exit_price: Price when exiting position
        size: Number of shares
    
    Returns:
        dict: {
            'cash_pnl': float,
            'percent_pnl': float
        }
    
    Raises:
        ValueError: If entry_price is zero or negative
    
    Example:
        >>> calculate_pnl(0.90, 0.95, 10)
        {'cash_pnl': 0.50, 'percent_pnl': 5.56}
    """
    if entry_price <= 0:
        raise ValueError("entry_price must be positive")
    
    cash_pnl = (exit_price - entry_price) * size
    percent_pnl = ((exit_price / entry_price) - 1) * 100
    
    return {
        'cash_pnl': cash_pnl,
        'percent_pnl': percent_pnl
    }
```

---

## 🗂️ File Organization

### Project Structure
```
project-name/
├── README.md              # Project documentation
├── CHANGELOG.md           # Version history
├── requirements.txt       # Python dependencies
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
├── src/                  # Source code
│   ├── __init__.py
│   ├── main.py          # Entry point
│   ├── config.py        # Configuration
│   └── utils.py         # Utilities
├── tests/               # Test files
│   └── test_main.py
├── docs/                # Additional documentation
└── logs/                # Log files (gitignored)
```

---

## 🧪 Testing Conventions

### Test File Naming
- Match source file: `test_module_name.py`
- Test functions: `test_function_name_scenario()`

### Example
```python
# test_trading.py
import pytest
from src.trading import calculate_pnl

def test_calculate_pnl_profit():
    """Test PnL calculation for profitable trade"""
    result = calculate_pnl(0.90, 0.95, 10)
    assert result['cash_pnl'] == 0.50
    assert abs(result['percent_pnl'] - 5.56) < 0.01

def test_calculate_pnl_loss():
    """Test PnL calculation for losing trade"""
    result = calculate_pnl(0.95, 0.90, 10)
    assert result['cash_pnl'] == -0.50

def test_calculate_pnl_invalid_price():
    """Test error handling for invalid price"""
    with pytest.raises(ValueError):
        calculate_pnl(0, 0.95, 10)
```

---

## 🔒 Security Best Practices

### Never Hardcode Secrets
```python
# ❌ Bad
API_KEY = "sk-1234567890abcdef"

# ✅ Good
import os
API_KEY = os.environ.get("API_KEY")
if not API_KEY:
    raise ValueError("API_KEY environment variable not set")
```

### Validate Input
```python
# ✅ Always validate external input
def process_amount(amount):
    if not isinstance(amount, (int, float)):
        raise TypeError("amount must be a number")
    if amount <= 0:
        raise ValueError("amount must be positive")
    return amount
```

---

## 📊 Logging Standards

```python
import logging

# Configure logger
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('logs/app.log'),
        logging.StreamHandler()
    ]
)

logger = logging.getLogger(__name__)

# Usage
logger.info("Process started")
logger.warning("Low balance detected")
logger.error("API request failed", exc_info=True)
```

---

## 🎨 Code Quality

### Before Committing
- [ ] Code follows naming conventions
- [ ] Functions have docstrings
- [ ] No hardcoded secrets
- [ ] Tests pass (if applicable)
- [ ] Linting passes (if configured)
- [ ] Comments explain "why", not "what"

### Tools (Optional)
- **Linting**: `pylint`, `flake8`
- **Formatting**: `black`
- **Type Checking**: `mypy`

---

**Last Updated**: 2026-02-11
