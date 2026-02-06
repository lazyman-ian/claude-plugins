---
description: Create release tag with auto-version and changelog
---

# /dev-flow:release - 发布版本

自动生成版本号、创建 tag、生成 Release Notes。

## 自动执行流程

### Step 1: 前置检查

```bash
git branch --show-current    # 必须在 master
git status --short           # 必须干净
```

| 状态 | 处理 |
|------|------|
| 不在 master | 错误：请先切换到 master |
| 有未提交更改 | 错误：请先提交或 stash |

### Step 2: 获取版本建议

```
dev_version(format="compact")
```

输出：
```
Current: 1.2.3
Suggested:
  patch: 1.2.4 (bug fixes)
  minor: 1.3.0 (new features)
  major: 2.0.0 (breaking changes)
```

### Step 3: 分析提交确定版本

```
dev_commits(from="<last-tag>", format="full")
```

| 提交类型 | 版本升级 |
|---------|---------|
| feat | minor |
| fix, perf, refactor | patch |
| BREAKING CHANGE | major |

### Step 4: 确认版本

```
建议版本: 1.3.0 (包含 2 个 feat, 3 个 fix)

确认发布 1.3.0? [Y/n]
```

### Step 5: 生成 Release Notes

```
dev_commits(from="<last-tag>", format="full")
```

```markdown
# v1.3.0

## ✨ New Features
- feat(auth): add reCAPTCHA validation (#123)
- feat(home): improve loading performance (#124)

## 🐛 Bug Fixes
- fix(image): resolve viewer crash (#125)
- fix(network): handle timeout properly (#126)

## 🔧 Improvements
- perf(home): optimize data fetching (#127)
```

### Step 6: 创建 Tag

```bash
git tag -a v1.3.0 -m "Release v1.3.0"
git push origin v1.3.0
```

### Step 7: 创建 GitHub Release (可选)

```bash
gh release create v1.3.0 \
  --title "v1.3.0" \
  --notes-file /tmp/release-notes.md
```

## 输出

```
✅ 版本发布成功

| 项目 | 值 |
|------|---|
| Version | v1.3.0 |
| Tag | v1.3.0 |
| Commits | 5 |
| Release | https://github.com/org/repo/releases/tag/v1.3.0 |

📋 Release Notes 已生成
🚀 CI/CD 将自动构建 Production 版本
```

## 选项

| 选项 | 说明 |
|------|------|
| `/dev-flow:release` | 自动建议版本 |
| `/dev-flow:release 1.3.0` | 指定版本 |
| `/dev-flow:release --patch` | 强制 patch |
| `/dev-flow:release --minor` | 强制 minor |
| `/dev-flow:release --dry-run` | 预览不执行 |
