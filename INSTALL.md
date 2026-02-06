# Marketplace 安装指南

## 快速安装

在 Claude Code 会话内执行：

```
# 1. 添加 marketplace（从 GitHub）
/plugin marketplace add lazyman-ian/claude-plugins

# 2. 安装插件
/plugin install dev-flow@lazyman-ian
/plugin install ios-swift-plugin@lazyman-ian
/plugin install utils@lazyman-ian
/plugin install research@lazyman-ian
```

## 本地安装

如果你需要本地开发或网络受限：

```bash
# 1. 克隆仓库
git clone https://github.com/lazyman-ian/claude-plugins.git

# 2. 在 Claude Code 内添加本地 marketplace
/plugin marketplace add /path/to/claude-plugins

# 3. 安装插件
/plugin install dev-flow@lazyman-ian
```

## 常见问题

### 问题 1: 本地路径变更

**症状**: 移动仓库后插件失效

**解决**:
```
# 1. 移除旧的 marketplace
/plugin marketplace remove lazyman-ian

# 2. 使用新路径重新添加
/plugin marketplace add /new/path/to/claude-plugins
```

### 问题 2: 版本不同步

**症状**: marketplace.json 显示版本与插件实际版本不符

**解决**:
```bash
git pull
```

## 本地开发

### 测试本地改动

```bash
# 使用本地路径启动 Claude Code（无需安装到 marketplace）
claude --plugin-dir /path/to/dev-flow
claude --plugin-dir /path/to/ios-swift-plugin
```

## 验证安装

```
# 查看已安装的 marketplace
/plugin marketplace list

# 查看已安装的插件
/plugin list

# 测试插件
/dev-flow:dev       # 应显示 workflow 状态
/ios-swift-plugin:ios-build-test  # 应显示构建选项
```

## 卸载

```
# 移除插件
/plugin uninstall dev-flow@lazyman-ian
/plugin uninstall ios-swift-plugin@lazyman-ian

# 移除 marketplace
/plugin marketplace remove lazyman-ian
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `/plugin marketplace add owner/repo` | 从 GitHub 添加 marketplace |
| `/plugin marketplace add /path/to/dir` | 从本地路径添加 marketplace |
| `/plugin marketplace list` | 列出已添加的 marketplaces |
| `/plugin marketplace remove <name>` | 移除 marketplace |
| `/plugin install plugin@marketplace` | 安装插件 |
| `/plugin uninstall plugin@marketplace` | 卸载插件 |
| `/plugin list` | 列出已安装插件 |
| `claude --plugin-dir /path` | 命令行直接加载插件（开发用） |
