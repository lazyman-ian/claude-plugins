# Session-Team Mapping 实现

## 问题背景

StatusLine 的 `get_team_line()` 遍历所有 team，多个 session 开启 agent team 时会显示所有 team，导致混淆。

**症状**: 在 session A 中看到 session B 的 team 信息。

## 解决方案（双重策略）

### 方案1：时间过滤（已实现）

```bash
# statusline.sh:312-314
local cutoff=$(($(date +%s) - 300))  # 5分钟
local mtime=$(stat -f%m "$config" 2>/dev/null || echo 0)
[ "$mtime" -lt "$cutoff" ] && continue
```

**优点**: 零侵入，不需要修改 TeamCreate/TeamDelete
**缺点**: 如果两个 session 同时活跃，还是会显示多个 team

## 方案2：Session 映射文件（已实现 ✅）

### 架构

```
TeamCreate/Delete
       ↓
PostToolUse Hook
       ↓
track-team.sh (create/delete/cleanup)
       ↓
session_teams.json (映射表)
       ↓
StatusLine 读取 (get_team_line)
       ↓
显示当前 session 的 team
```

### 数据结构

```json
// ~/.claude/state/dev-flow/session_teams.json
{
  "session-abc-123": "feature-auth",
  "session-def-456": "feature-payment"
}
```

### 实现文件

#### 1. Hook 脚本：`scripts/track-team.sh` ✅

**功能**:
- `create`: 记录 session→team 映射
- `delete`: 清除映射
- `cleanup`: 清理不存在的 team

**输入**: PostToolUse hook 提供的 JSON（包含 `session_id` 和 `team_name`）

**输出**: 更新 `~/.claude/state/dev-flow/session_teams.json`

#### 2. Hook 配置：`hooks/hooks.json` ✅

```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "TeamCreate",
        "hooks": [{
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/scripts/track-team.sh create",
          "timeout": 5
        }]
      },
      {
        "matcher": "TeamDelete",
        "hooks": [{
          "type": "command",
          "command": "${CLAUDE_PLUGIN_ROOT}/scripts/track-team.sh delete",
          "timeout": 5
        }]
      }
    ]
  }
}
```

#### 3. StatusLine 读取逻辑：`scripts/statusline.sh` ✅

**双重策略**:

1. **优先**: 读取 `session_teams.json`，根据 `SESSION_ID` 精确匹配
2. **fallback**: 如果映射文件不存在或无匹配，使用时间过滤（5分钟窗口）

**优势**: 即使映射文件损坏或丢失，StatusLine 仍能工作（降级到时间过滤）。

## 使用说明

### 自动工作

无需手动配置，TeamCreate/TeamDelete 时自动维护映射：

```bash
# 用户执行
TeamCreate({ team_name: "feature-auth" })

# Hook 自动执行
→ track-team.sh create
→ 写入 session_teams.json: {"current-session-id": "feature-auth"}

# StatusLine 自动读取
→ 只显示当前 session 的 "feature-auth" team
```

### 测试验证

验证映射机制工作正常：

```bash
# 1. 测试映射写入
echo '{"session_id":"test","tool_input":{"team_name":"test-team"}}' | \
  ~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/track-team.sh create

# 2. 验证映射内容
cat ~/.claude/state/dev-flow/session_teams.json
# 预期输出: {"test":"test-team"}

# 3. 测试清理功能
~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/track-team.sh cleanup

# 4. 测试删除映射
echo '{"session_id":"test"}' | \
  ~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/track-team.sh delete

# 验证删除
cat ~/.claude/state/dev-flow/session_teams.json
# 预期输出: {}
```

**StatusLine 验证**: 需要在活跃 session 中观察，StatusLine 会自动使用映射。

### 手动操作（故障排查）

#### 查看映射

```bash
cat ~/.claude/state/dev-flow/session_teams.json
```

#### 清理孤立映射

```bash
~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/track-team.sh cleanup
```

#### 手动删除映射

```bash
# 方法1: 删除整个文件
rm ~/.claude/state/dev-flow/session_teams.json

# 方法2: 删除特定 session
jq 'del(.["session-id-here"])' ~/.claude/state/dev-flow/session_teams.json > tmp && mv tmp session_teams.json
```

#### 回滚到时间过滤

如果需要完全禁用 session 映射，回到时间过滤策略：

```bash
# 移除映射文件
rm ~/.claude/state/dev-flow/session_teams.json

# StatusLine 自动降级到时间过滤（5分钟窗口）
```

**注意**: 不需要修改任何配置，StatusLine 会自动检测映射文件不存在并使用 fallback 策略。

## 故障排查

### 问题1: StatusLine 仍显示多个 team

**原因**: 映射文件未生效，使用了 fallback 策略（时间过滤）

**排查**:
```bash
# 1. 检查映射文件是否存在
ls -la ~/.claude/state/dev-flow/session_teams.json

# 2. 检查映射内容
cat ~/.claude/state/dev-flow/session_teams.json

# 3. 检查当前 session_id（从 StatusLine 输入获取）
# 无法直接获取，需要在 hook 脚本中添加日志
```

**解决**: 手动清理映射文件，让 StatusLine 重新回到时间过滤策略。

### 问题2: TeamCreate 后映射未写入

**原因**: Hook 脚本执行失败或权限问题

**排查**:
```bash
# 检查脚本权限
ls -l ~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/track-team.sh
# 应显示 -rwxr-xr-x

# 手动测试脚本
echo '{"session_id":"test","tool_input":{"team_name":"test-team"}}' | \
  ~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/track-team.sh create

# 检查结果
cat ~/.claude/state/dev-flow/session_teams.json
```

**解决**:
```bash
# 添加执行权限
chmod +x ~/.claude/plugins/marketplaces/lazyman-ian/dev-flow/scripts/track-team.sh

# 确保目录存在
mkdir -p ~/.claude/state/dev-flow
```

### 问题3: 映射文件损坏

**症状**: StatusLine 不显示任何 team，或显示错误

**解决**:
```bash
# 重置映射文件
echo '{}' > ~/.claude/state/dev-flow/session_teams.json
```

## 调试模式

在 `track-team.sh` 中添加日志：

```bash
# 在脚本开头添加
LOG_FILE="${HOME}/.claude/state/dev-flow/track-team.log"

# 在关键位置添加
echo "[$(date)] $action | session=$session_id | team=$team_name" >> "$LOG_FILE"
```

查看日志：
```bash
tail -f ~/.claude/state/dev-flow/track-team.log
```

## 对比

| 维度 | 时间过滤 | Session 映射 | 双重策略（实现） |
|------|---------|-------------|-----------------|
| 隔离效果 | 弱（5分钟内冲突） | 强（精确） | 强（映射优先） |
| 侵入性 | 零 | 中（hook） | 中（hook） |
| 维护成本 | 零 | 低（自动） | 低（自动） |
| 容错性 | N/A | 差（依赖映射） | **强（自动降级）** |

## 实现状态

✅ **已实现双重策略**（v3.15.0+）:
- 优先使用精确 session 映射
- 自动降级到时间过滤（fallback）
- 无需用户配置，开箱即用

## 版本历史

| 版本 | 实现 | 说明 |
|------|------|------|
| v3.14.0 | 时间过滤 | 初始方案，5分钟窗口 |
| v3.15.0 | **双重策略** | Session 映射 + 时间 fallback |
