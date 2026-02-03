# Marketplace 安装指南

详细的插件市场安装说明，包括带 submodule 的特殊场景。

## 快速安装

```bash
# 1. 添加 marketplace（GitHub 直接添加）
claude marketplace add lazyman-ian https://github.com/lazyman-ian/claude-plugins.git

# 2. 安装插件
claude plugins add dev-flow@lazyman-ian
claude plugins add ios-swift-plugin@lazyman-ian
claude plugins add utils@lazyman-ian
claude plugins add research@lazyman-ian
```

## 带 Submodule 的 Marketplace

本 marketplace 使用 Git submodule 管理部分插件（dev-flow、ios-swift-plugin）。

### 方法 1: 直接安装（推荐）

Claude Code 会自动处理 submodule：

```bash
claude marketplace add lazyman-ian https://github.com/lazyman-ian/claude-plugins.git
```

### 方法 2: 本地安装

如果你需要本地开发或网络受限：

```bash
# 1. 克隆仓库（包含所有 submodules）
git clone --recursive https://github.com/lazyman-ian/claude-plugins.git

# 2. 进入目录并确保 submodule 已初始化
cd claude-plugins
git submodule update --init --recursive

# 3. 添加本地 marketplace
claude marketplace add lazyman-ian /path/to/claude-plugins

# 4. 安装插件
claude plugins add dev-flow@lazyman-ian
```

## 常见问题

### 问题 1: Submodule 未拉取

**症状**: 安装后 dev-flow 或 ios-swift-plugin 功能缺失

**解决**:
```bash
# 更新 submodule
git submodule update --init --recursive

# 重新安装 marketplace
claude marketplace remove lazyman-ian
claude marketplace add lazyman-ian /path/to/claude-plugins
```

### 问题 2: 本地路径变更

**症状**: 移动仓库后插件失效

**解决**:
```bash
# 1. 移除旧的 marketplace
claude marketplace remove lazyman-ian

# 2. 使用新路径重新添加
claude marketplace add lazyman-ian /new/path/to/claude-plugins
```

### 问题 3: 版本不同步

**症状**: marketplace.json 显示版本与插件实际版本不符

**解决**:
```bash
# 更新 submodule 到最新
git submodule update --remote

# 提交更新
git add dev-flow ios-swift-plugin
git commit -m "chore: update submodules"
git push
```

## 本地开发

### 开发 submodule 插件

```bash
# 1. 编辑 submodule
cd dev-flow
# ... 修改代码 ...
git add . && git commit -m "fix: ..." && git push

# 2. 更新主仓库引用
cd ..
git add dev-flow
git commit -m "chore: update dev-flow submodule"
git push
```

### 测试本地改动

```bash
# 使用本地路径启动 Claude Code（无需安装到 marketplace）
claude --plugin-dir /path/to/dev-flow
claude --plugin-dir /path/to/ios-swift-plugin
```

## 验证安装

```bash
# 查看已安装的 marketplace
claude marketplace list

# 查看已安装的插件
claude plugins list

# 测试插件
/dev-flow:dev       # 应显示 workflow 状态
/ios-swift-plugin:ios-build-test  # 应显示构建选项
```

## 卸载

```bash
# 移除插件
claude plugins remove dev-flow@lazyman-ian
claude plugins remove ios-swift-plugin@lazyman-ian

# 移除 marketplace
claude marketplace remove lazyman-ian
```
