#!/bin/bash
# Docker Compose 鏡像更新工具
# 修訂版本: 3.0 | 最後檢查: 2024-05-25
# AI generate.

# ==================================================
# 設定區 (需手動配置)
# ==================================================
TARGET_PATHS=(
  "/home/df/workspace/myService"  # 應用容器目錄
)

# ==================================================
# 初始化設定
# ==================================================
init() {
  set -eo pipefail          # 錯誤立即退出
  IFS=$'\n\t'               # 安全分隔符設定
  declare -g total=0        # 全域計數器
  declare -g success=0
  declare -g failures=0
}

# ==================================================
# 路徑驗證函式
# ==================================================
validate_path() {
  local path=$1
  if [[ ! -d "$path" ]]; then
    echo "[錯誤] 路徑不存在或不可訪問: $path" >&2
    return 1
  fi
}

# ==================================================
# 執行鏡像更新
# ==================================================
update_image() {
  local dir=$1
  ((total++))
  
  (
    echo "▪ 處理目錄: $dir"
    cd "$dir" || { echo "[錯誤] 目錄切換失敗" >&2; exit 1; }
    
    # 執行核心操作
    if docker compose pull --quiet; then
      echo "✔ 更新成功"
      exit 0
    else
      echo "✖ 更新失敗" >&2
      exit 1
    fi
  ) && ((success++)) || ((failures++))
}

# ==================================================
# 主程序邏輯
# ==================================================
main() {
  init
  
  echo "====== 鏡像更新程序啟動 ======"
  for base_path in "${TARGET_PATHS[@]}"; do
    validate_path "$base_path" || continue
    
    while IFS= read -r -d $'\0' dir; do
      update_image "$dir"
    done < <(find "$base_path" \
      -type f \( \
        -name 'docker-compose.yml' \
        -o \
        -name 'docker-compose.*.yml' \
      \) \
      -print0 | xargs -0 dirname | sort -zu)
  done
  
  # 結果報告
  echo "=============================="
  echo "總處理目錄: $total"
  echo "成功次數: $success"
  ((failures > 0)) && echo "失敗次數: \033[31m$failures\033[0m"
}

# ==================================================
# 程式入口
# ==================================================
main
exit $?