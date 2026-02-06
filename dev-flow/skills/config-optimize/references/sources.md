# Documentation Sources

Official sources for Claude Code updates and best practices.

## Primary Sources

### 1. GitHub Releases (最重要)

**URL**: https://github.com/anthropics/claude-code/releases

**检查方式**:
```bash
# 获取最新版本
curl -s https://api.github.com/repos/anthropics/claude-code/releases/latest | jq -r '.tag_name'

# 获取最近 5 个版本的 release notes
curl -s https://api.github.com/repos/anthropics/claude-code/releases | jq -r '.[0:5] | .[] | "## \(.tag_name)\n\(.body)\n"'
```

**WebFetch 用法**:
```
WebFetch("https://github.com/anthropics/claude-code/releases", "Extract new features for versions above 2.1.3")
```

**监控设置**:
1. Star 仓库
2. Watch → Custom → Releases only
3. 或使用 RSS: `https://github.com/anthropics/claude-code/releases.atom`

---

### 2. Official Blog

**URL**: https://claude.ai/blog

**关键文章**:

| 文章 | 主题 | URL |
|------|------|-----|
| Skills Explained | Skill 开发最佳实践 | /blog/skills-explained |
| How to Configure Hooks | Hook 完整指南 | /blog/how-to-configure-hooks |
| Using CLAUDE.md Files | CLAUDE.md 最佳实践 | /blog/using-claude-md-files |
| Building Skills | 构建 Skill 指南 | /blog/building-skills-for-claude-code |
| How to Create Skills | 创建 Skill 步骤 | /blog/how-to-create-skills |

**WebFetch 用法**:
```
WebFetch("https://claude.ai/blog", "Find articles about Claude Code skills, hooks, or configuration")
```

---

### 3. Official Documentation

**URL**: https://docs.anthropic.com/en/docs/claude-code

**包含内容**:
- CLI 使用指南
- 配置选项
- API 集成
- 故障排除

---

## 信息提取模板

### Release Notes 提取

```
WebFetch prompt:
"Extract from Claude Code release notes:
1. New features with configuration changes needed
2. Deprecated patterns to update
3. Breaking changes
4. New hook types or fields
5. New skill capabilities

Format as:
| Version | Feature | Config Change | Files Affected |"
```

### Blog 文章提取

```
WebFetch prompt:
"Extract best practices for [topic]:
1. Required configuration
2. Recommended patterns
3. Anti-patterns to avoid
4. Code examples

Format as actionable checklist."
```

---

## 版本对比查询

### 获取两个版本间的变化

```bash
# GitHub API 比较
curl -s "https://api.github.com/repos/anthropics/claude-code/compare/v2.1.2...v2.1.3" | jq -r '.commits[] | .commit.message'
```

### Release Notes 差异

```
WebFetch("https://github.com/anthropics/claude-code/releases",
         "Compare features between v2.1.2 and v2.1.3, list what's new")
```

---

## 自动更新提醒

### 方式 1: SessionStart Hook

```bash
# ~/.claude/hooks/config-optimize-reminder.sh
CURRENT_VERSION=$(claude --version 2>/dev/null | grep -oE '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
LAST_VERSION=$(jq -r '.last_checked_version // "0.0.0"' ~/.claude/config-optimize-state.json 2>/dev/null)

if [ "$CURRENT_VERSION" != "$LAST_VERSION" ]; then
    echo "Claude Code updated: $LAST_VERSION → $CURRENT_VERSION"
    echo "Run /config-optimize to check for new features"
fi
```

### 方式 2: 定期 Session 提醒

```bash
# 每 20 个 session 提醒一次
SESSION_COUNT=$(jq -r '.session_count // 0' ~/.claude/config-optimize-state.json)
if [ $((SESSION_COUNT % 20)) -eq 0 ]; then
    echo "Consider running /config-optimize"
fi
```

---

## 社区资源 (非官方)

| 资源 | URL | 内容 |
|------|-----|------|
| GitHub Issues | github.com/anthropics/claude-code/issues | 问题讨论 |
| Discord | (if exists) | 社区交流 |
| Stack Overflow | Tag: claude-code | Q&A |

**注意**: 社区资源可能不准确，以官方文档为准。

---

## 更新日志维护

每次运行 `/config-optimize` 后:

1. 更新 `~/.claude/config-optimize-state.json`
2. 记录应用的优化到 `docs/OPTIMIZATION_GUIDE.md`
3. 如果是重要模式，更新 `references/version-history.md`

### State 文件格式

```json
{
  "last_checked_version": "2.1.3",
  "last_check_date": "2026-01-11",
  "session_count": 45,
  "applied_optimizations": [
    "agent_type_check",
    "force_autoupdate_plugins",
    "reference_file_architecture"
  ],
  "sources_checked": [
    "github_releases",
    "blog_skills_explained",
    "blog_hooks_configuration"
  ]
}
```
