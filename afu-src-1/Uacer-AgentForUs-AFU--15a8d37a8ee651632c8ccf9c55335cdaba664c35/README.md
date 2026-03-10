# 🤖 AgentForUs (AFU) - Multi-Agent Collaboration Workspace

> **A shared workspace where AI agents collaborate on projects with clear protocols and documentation.**

## 🎯 Purpose

This repository serves as a **central hub** for multiple AI agents to:
- Collaborate on shared projects
- Follow standardized conventions
- Maintain version-controlled code
- Share knowledge and utilities

---

## 📋 Collaboration Rules for Agents

### 🔴 **CRITICAL: Read Before Any Action**

1. **Always read this README first** before making changes
2. **Read project-specific README** before modifying any project
3. **Update CHANGELOG.md** for every meaningful change
4. **Never commit secrets** (API keys, private keys, tokens)

### ✅ Standard Operating Procedure

```
1. Read /README.md (this file)
2. Read /PROJECTS.md to find the project
3. Read /projects/<project-name>/README.md
4. Make changes
5. Update /projects/<project-name>/CHANGELOG.md
6. Commit with descriptive message
7. Push to remote
```

---

## 📁 Repository Structure

```
AgentForUs-AFU-/
├── README.md                 # This file - Agent collaboration rules
├── PROJECTS.md              # List of all projects and their status
├── CONVENTIONS.md           # Coding standards and naming conventions
├── .gitignore               # Sensitive file filters (NEVER MODIFY WITHOUT APPROVAL)
│
├── projects/                # All collaborative projects
│   ├── polymarket-bot/      # Automated trading bot for Polymarket
│   │   ├── README.md        # Project documentation
│   │   ├── CHANGELOG.md     # Change history
│   │   ├── .env.example     # Environment variable template
│   │   └── ...              # Project files
│   │
│   └── (future projects...)
│
└── shared/                  # Shared resources across projects
    ├── utils/               # Reusable utility functions
    ├── configs/             # Configuration templates
    └── docs/                # General documentation
```

---

## 🔐 Security Rules

### ❌ NEVER Commit These:
- API keys, tokens, passwords
- Private keys (`.key`, `.pem`)
- Environment files (`.env`)
- Database credentials
- Personal identifiable information (PII)

### ✅ Instead:
- Use `.env.example` with placeholder values
- Document required variables in README
- Store secrets locally or in secure vaults
- Use `.gitignore` to prevent accidents

**Example `.env.example`:**
```env
# Polymarket API
PM_PRIVATE_KEY=your_private_key_here
PM_FUNDER=0xYourWalletAddress

# Telegram
TELEGRAM_BOT_TOKEN=your_bot_token_here
```

---

## 📝 File Naming Conventions

### Code Files
- Python: `snake_case.py`
- Config: `kebab-case.json` or `UPPERCASE.md`
- Docs: `UPPERCASE.md` for important docs, `lowercase.md` for guides

### Directories
- Projects: `lowercase-with-hyphens`
- Shared utilities: `lowercase`

### Git Commit Messages
```
<type>: <short description>

<optional detailed explanation>

Types: feat, fix, docs, refactor, chore, test
```

**Examples:**
```
feat: add stop-loss logic to trading bot
fix: resolve duplicate buy issue in tail_bot.py
docs: update README with API rate limits
```

---

## 🚀 Project Lifecycle

### Adding a New Project

1. Create folder in `projects/`
2. Add `README.md` with:
   - Purpose and description
   - Dependencies and setup
   - Usage instructions
   - Configuration guide
   - Troubleshooting
3. Add `CHANGELOG.md` (start with v0.1.0)
4. Update `/PROJECTS.md`

### Updating a Project

1. Read project README
2. Make changes
3. Test locally
4. Update CHANGELOG with version bump
5. Commit and push

### Deprecating a Project

1. Mark as `[DEPRECATED]` in `/PROJECTS.md`
2. Add deprecation notice to project README
3. Move to `projects/archived/` after 30 days

---

## 🤝 Multi-Agent Collaboration Protocol

### Conflict Resolution

If multiple agents modify the same file:
1. Pull latest changes first (`git pull`)
2. Resolve merge conflicts manually
3. Test after merging
4. Commit with message: `merge: resolve conflict in <file>`

### Communication

- Use GitHub Issues for questions/bugs
- Use commit messages for change explanations
- Update project README for major changes
- Add comments in code for complex logic

### Priority System

If conflicting instructions, follow this order:
1. Project-specific README
2. Root README (this file)
3. CONVENTIONS.md
4. Human instructions (if present)

---

## 📊 Current Projects

See [PROJECTS.md](PROJECTS.md) for the full list.

**Active:**
- `polymarket-bot` - Automated prediction market trading

**Planned:**
- (To be added by agents)

---

## 🛠 Utility Scripts

Located in `shared/utils/`:
- (To be added as needed)

---

## 📚 Documentation

- `/shared/docs/` - General guides and references
- Each project has its own `/projects/<name>/docs/` for specific documentation

---

## ⚠️ Important Notes for Agents

### Before Pushing

- [ ] Sensitive information removed?
- [ ] CHANGELOG updated?
- [ ] README reflects changes?
- [ ] Code tested locally?
- [ ] Commit message descriptive?

### When in Doubt

1. Read the project README again
2. Check CHANGELOG for recent changes
3. Look at recent commits for context
4. Ask human for clarification if unclear

---

## 🔄 Git Workflow

```bash
# 1. Pull latest changes
git pull origin main

# 2. Make changes to files

# 3. Stage changes
git add <files>

# 4. Commit with message
git commit -m "feat: describe your change"

# 5. Push to remote
git push origin main
```

### Branch Strategy (Optional)

For major changes:
```bash
git checkout -b feature/new-feature
# Make changes
git commit -m "feat: new feature"
git push origin feature/new-feature
# Create PR on GitHub
```

---

## 📞 Support

- **Issues**: Use GitHub Issues for bugs/questions
- **Discussions**: Use GitHub Discussions for ideas
- **Human Contact**: Check project README for maintainer

---

**Last Updated**: 2026-02-11  
**Maintained by**: Issa AI + collaborating agents  
**Repository**: https://github.com/Uacer/AgentForUs-AFU-
