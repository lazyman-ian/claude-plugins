# Marketplace 安装指南

## 前置要求

在开始安装前，请确保环境满足要求：

```bash
# 检查 Claude Code 版本（需要 v2.1.0+）
claude --version

# 检查 Node.js 版本（某些插件需要）
node --version   # v16+ 推荐

# 检查 npm
npm --version
```

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

### 问题 1: 插件未加载

**症状**: 安装后 /dev, /ios-swift-plugin 等命令不可用

**解决步骤**:
```bash
# 1. 检查已安装的插件列表
/plugin list

# 2. 检查 marketplace 状态
/plugin marketplace list

# 3. 重新安装插件
/plugin install dev-flow@lazyman-ian

# 4. 如果仍未加载，清除缓存重试
/plugin uninstall dev-flow@lazyman-ian
/plugin marketplace remove lazyman-ian
/plugin marketplace add lazyman-ian/claude-plugins
/plugin install dev-flow@lazyman-ian
```

### 问题 2: MCP 服务器错误

**症状**: "MCP server connection failed" 或 "Tool unavailable"

**解决步骤**:
```bash
# 1. 进入 dev-flow 目录
cd /path/to/claude-plugins/dev-flow/mcp-server

# 2. 重新安装依赖
npm install

# 3. 构建 MCP 服务器
npm run bundle

# 4. 在 Claude Code 中重启会话或重装插件
```

### 问题 3: 本地路径变更

**症状**: 移动仓库后插件失效

**解决**:
```
# 1. 移除旧的 marketplace
/plugin marketplace remove lazyman-ian

# 2. 使用新路径重新添加
/plugin marketplace add /new/path/to/claude-plugins

# 3. 重新安装插件
/plugin install dev-flow@lazyman-ian
```

### 问题 4: Hook 未触发

**症状**: 代码检查、格式化 hook 未执行

**可能原因与解决**:
```bash
# 1. 检查 hooks.json 存在和语法
ls -l /path/to/plugin/hooks/hooks.json
jq . /path/to/plugin/hooks/hooks.json

# 2. 检查 hook 脚本权限
ls -l /path/to/plugin/hooks/scripts/
chmod +x /path/to/plugin/hooks/scripts/*.sh

# 3. 检查 hook 脚本依赖
# 例如：ios-swift-plugin 的 concurrency-guard.sh 需要 swiftlint
which swiftlint
```

### 问题 5: 版本不同步

**症状**: marketplace.json 显示版本与插件实际版本不符

**解决**:
```bash
git pull
```

## 验证安装

安装完成后验证一切正常：

```bash
# 1. 检查 marketplace 和插件列表（在 Claude Code 中）
/plugin marketplace list
/plugin list

# 2. 测试 dev-flow 插件
/dev status                  # 应显示开发状态表

# 3. 测试 iOS 插件
/ios-swift-plugin:swiftui-expert   # 应显示命令或触发技能

# 4. 测试 Android 插件
/android-kotlin-plugin:compose-expert  # 应显示命令或触发技能
```

## 本地开发

### 测试本地改动

```bash
# 使用本地路径启动 Claude Code（无需安装到 marketplace）
claude --plugin-dir /path/to/dev-flow
claude --plugin-dir /path/to/ios-swift-plugin
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
