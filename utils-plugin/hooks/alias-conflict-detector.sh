#!/usr/bin/env bash
# Alias Conflict Detector Hook
# 检测 Bash 命令中的 alias 冲突

set -eo pipefail  # 移除 -u 避免 unbound variable 错误

# 读取输入
input=$(cat)
tool=$(echo "$input" | jq -r '.tool_name // empty')

# 只处理 Bash 工具
if [[ "$tool" != "Bash" ]]; then
  echo '{"result":"continue"}'
  exit 0
fi

# 提取命令
command=$(echo "$input" | jq -r '.tool_input.command // ""')

# 检测冲突（不使用关联数组，兼容旧版 bash）
conflicts=()

# 检测 find -> fd
if [[ "$command" =~ ^[[:space:]]*find[[:space:]] ]] && [[ ! "$command" =~ ^[[:space:]]*/.*find ]]; then
  if [[ "$command" =~ -type[[:space:]] ]] || [[ "$command" =~ -name[[:space:]] ]]; then
    conflicts+=("⚠️  使用了 \`find\` (实为 \`fd\` alias)，但使用了不兼容参数 \`-type\`/\`-name\`")
    conflicts+=("   建议: 使用 \`/usr/bin/find\` 或 \`fd -t f --glob\` 或 Glob 工具")
  fi
fi

# 检测 ls -> eza
if [[ "$command" =~ ^[[:space:]]*ls[[:space:]] ]] && [[ ! "$command" =~ ^[[:space:]]*/.*ls ]]; then
  conflicts+=("💡 使用了 \`ls\` (实为 \`eza\` alias)，建议使用 Glob 工具")
fi

# 检测 cat -> bat
if [[ "$command" =~ ^[[:space:]]*cat[[:space:]] ]] && [[ ! "$command" =~ ^[[:space:]]*/.*cat ]]; then
  conflicts+=("💡 使用了 \`cat\` (实为 \`bat\` alias)，建议使用 Read 工具")
fi

# 检测错误重定向隐藏
if [[ "$command" =~ 2\>/dev/null ]]; then
  conflicts+=("⚠️  使用了 \`2>/dev/null\` 隐藏错误输出")
  conflicts+=("   建议: 首次尝试不要隐藏错误，确认命令正确后再使用")
fi

# 输出结果
if [[ ${#conflicts[@]} -gt 0 ]]; then
  message="## Alias 冲突检测\n\n"
  for conflict in "${conflicts[@]}"; do
    message+="$conflict\n"
  done

  # Use jq for proper JSON escaping of newlines and special characters
  echo "{\"result\":\"continue\",\"message\":$(echo -e "$message" | jq -Rs .)}"
else
  echo '{"result":"continue"}'
fi
