#!/bin/bash
# Docker Compose 鏡像更新工具
# 修訂版本: 4.1 | 最後檢查: 2025-7-15
# AI generate and improved

# =============================================================================
# 腳本名稱：docker_pull.sh
# 功能描述：自動遍歷指定資料夾下的Docker Compose服務，執行docker-compose pull，
#           支援多線程、色彩高亮、條件更新，適用於crontab執行。
#
# 使用方法與範例：
#
# 1. 基本用法 (在當前目錄尋找服務，使用預設4個線程):
#    ./docker_pull.sh
#
# 2. 指定服務目錄與線程數:
#    ./docker_pull.sh -d /path/to/all/services -t 8
#
# 3. 只更新正在運行的服務:
#    ./docker_pull.sh --running-only
#
# 4. 指定日誌檔案，並只更新指定目錄下正在運行的服務:
#    ./docker_pull.sh -d /opt/docker-services --running-only -l /var/log/docker_pull.log
#
# 5. 顯示幫助訊息:
#    ./docker_pull.sh -h
#
# 參數說明：
#   -d, --directory    指定包含Docker Compose服務的主目錄 (預設: ".")
#   -t, --threads      指定同時執行的線程數量 (預設: 4)
#   -l, --log          指定日誌檔案路徑 (預設: "./docker_pull.log")
#       --running-only 如果設置此旗標，則只更新有正在運行容器的服務。
#   -h, --help         顯示此幫助訊息。
# =============================================================================

# =============================================================================
# 變數定義
# =============================================================================

# 默認值
DIRECTORY="."
THREADS=4
LOGFILE="./docker_pull.log"
RUNNING_ONLY=false

# 統計變數
TOTAL_SERVICES=0
SUCCESSFUL_UPDATES=0
FAILED_UPDATES=0
SKIPPED_SERVICES=0

# 臨時文件用於統計（跨進程）
STATS_DIR="/tmp/docker_pull_$$"
mkdir -p "$STATS_DIR"
STATS_SUCCESS="$STATS_DIR/success"
STATS_FAILED="$STATS_DIR/failed"
STATS_SKIPPED="$STATS_DIR/skipped"

# 初始化統計文件
echo "0" >"$STATS_SUCCESS"
echo "0" >"$STATS_FAILED"
echo "0" >"$STATS_SKIPPED"

# 色彩定義 (僅在終端支援時顯示顏色)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    BLUE='\033[0;34m'
    CYAN='\033[0;36m'
    NC='\033[0m' # 無色
else
    RED=''
    GREEN=''
    YELLOW=''
    BLUE=''
    CYAN=''
    NC=''
fi

# =============================================================================
# 函數定義
# =============================================================================

# 統計函數
increment_stat() {
    local stat_file="$1"
    local current_value
    current_value=$(cat "$stat_file")
    echo $((current_value + 1)) >"$stat_file"
}

get_stat() {
    local stat_file="$1"
    cat "$stat_file"
}

# 顯示幫助訊息
usage() {
    echo "${CYAN}Docker Compose 鏡像更新工具${NC}"
    echo ""
    echo "Usage: $0 [-d directory] [-t threads] [-l logfile] [--running-only]"
    echo ""
    echo "參數說明："
    echo "  -d, --directory    指定包含Docker Compose服務的主目錄 (預設為當前目錄)"
    echo "  -t, --threads      指定同時執行的線程數量 (預設為4，範圍1-20)"
    echo "  -l, --log          指定日誌檔案路徑 (預設為./docker_pull.log)"
    echo "      --running-only 只更新有正在運行容器的服務"
    echo "  -h, --help         顯示此幫助訊息"
    echo ""
    echo "使用範例："
    echo "  $0                                    # 基本用法"
    echo "  $0 -d /opt/services -t 8             # 指定目錄和線程數"
    echo "  $0 --running-only                    # 只更新運行中的服務"
    echo ""
    exit 1
}

# 驗證數字參數
validate_number() {
    local value="$1"
    local param_name="$2"

    if ! [[ "$value" =~ ^[0-9]+$ ]]; then
        echo -e "${RED}錯誤：$param_name 必須是正整數${NC}"
        exit 1
    fi

    if [ "$param_name" = "threads" ] && ([ "$value" -lt 1 ] || [ "$value" -gt 20 ]); then
        echo -e "${RED}錯誤：線程數量必須在 1-20 之間${NC}"
        exit 1
    fi
}

# 檢查系統需求
check_requirements() {
    # 檢查 Docker 是否安裝
    if ! command -v docker &>/dev/null; then
        echo -e "${RED}錯誤：Docker 未安裝或不在 PATH 中${NC}"
        exit 1
    fi

    # 檢查 Docker 服務是否運行
    if ! docker info &>/dev/null; then
        echo -e "${RED}錯誤：Docker 服務未運行${NC}"
        exit 1
    fi

    # 檢查 docker-compose 命令（優先使用新版本）
    if command -v docker &>/dev/null && docker compose version &>/dev/null; then
        DOCKER_COMPOSE_CMD="docker compose"
    elif command -v docker-compose &>/dev/null; then
        DOCKER_COMPOSE_CMD="docker-compose"
    else
        echo -e "${RED}錯誤：找不到 docker-compose 或 docker compose 命令${NC}"
        exit 1
    fi
}

# 檢查日誌文件權限
check_log_file() {
    local log_dir
    log_dir=$(dirname "$LOGFILE")

    # 確保日誌目錄存在
    if [ ! -d "$log_dir" ]; then
        mkdir -p "$log_dir" || {
            echo -e "${RED}錯誤：無法創建日誌目錄 $log_dir${NC}"
            exit 1
        }
    fi

    # 測試日誌文件是否可寫
    if ! touch "$LOGFILE" 2>/dev/null; then
        echo -e "${RED}錯誤：無法寫入日誌文件 $LOGFILE${NC}"
        exit 1
    fi
}
# 解析參數
parse_args() {
    while [[ "$#" -gt 0 ]]; do
        case $1 in
        -d | --directory)
            if [ -z "$2" ]; then
                echo -e "${RED}錯誤：-d 參數需要指定目錄${NC}"
                exit 1
            fi
            DIRECTORY="$2"
            shift
            ;;
        -t | --threads)
            if [ -z "$2" ]; then
                echo -e "${RED}錯誤：-t 參數需要指定線程數量${NC}"
                exit 1
            fi
            validate_number "$2" "threads"
            THREADS="$2"
            shift
            ;;
        -l | --log)
            if [ -z "$2" ]; then
                echo -e "${RED}錯誤：-l 參數需要指定日誌文件路徑${NC}"
                exit 1
            fi
            LOGFILE="$2"
            shift
            ;;
        -h | --help)
            usage
            ;;
        --running-only)
            RUNNING_ONLY=true
            ;;
        *)
            echo -e "${RED}錯誤：未知參數 $1${NC}"
            usage
            ;;
        esac
        shift
    done
}

# 日誌輸出函數
log() {
    local message="$1"
    local timestamp
    timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # 終端輸出（帶顏色）
    echo -e "$message"

    # 日誌文件輸出（無顏色，帶時間戳）
    echo "[$timestamp] $(echo -e "$message" | sed 's/\x1b\[[0-9;]*m//g')" >>"$LOGFILE"
}

# 顯示進度
show_progress() {
    local current="$1"
    local total="$2"
    local service_name="$3"
    local percentage=$((current * 100 / total))

    echo -e "${BLUE}[$current/$total] ($percentage%) 處理中: $service_name${NC}"
}

# 執行docker-compose pull的函數
pull_images() {
    local dir="$1"
    local current_index="$2"
    local service_name
    local original_dir

    service_name=$(basename "$dir")
    original_dir=$(pwd)

    show_progress "$current_index" "$TOTAL_SERVICES" "$service_name"
    log "${YELLOW}開始處理服務：$service_name (路徑: $dir)${NC}"

    # 進入服務目錄
    cd "$dir" || {
        log "${RED}無法進入目錄：$dir${NC}"
        increment_stat "$STATS_FAILED"
        return 1
    }

    # 檢查docker-compose檔案
    local compose_file=""
    if [ -f "docker-compose.yml" ]; then
        compose_file="docker-compose.yml"
    elif [ -f "docker-compose.yaml" ]; then
        compose_file="docker-compose.yaml"
    elif [ -f "compose.yml" ]; then
        compose_file="compose.yml"
    elif [ -f "compose.yaml" ]; then
        compose_file="compose.yaml"
    else
        log "${YELLOW}在 $dir 中未找到 Docker Compose 文件，跳過此目錄${NC}"
        increment_stat "$STATS_SKIPPED"
        cd "$original_dir"
        return 0 # 不是失敗，只是跳過
    fi

    log "${CYAN}找到 Compose 文件：$compose_file${NC}"

    if [ "$RUNNING_ONLY" = true ]; then
        # 檢查是否有正在運行的容器
        local running_containers
        running_containers=$($DOCKER_COMPOSE_CMD ps -q 2>/dev/null)

        if [ -n "$running_containers" ]; then
            local container_count
            container_count=$(echo "$running_containers" | wc -l | tr -d ' ')
            log "${YELLOW}服務 $service_name 有 $container_count 個正在運行的容器，開始更新...${NC}"

            # 執行 pull 並捕獲輸出
            local pull_output
            pull_output=$($DOCKER_COMPOSE_CMD pull 2>&1)
            local pull_result=$?

            if [ $pull_result -eq 0 ]; then
                log "${GREEN}✓ 成功更新服務：$service_name${NC}"
                # 記錄詳細的 pull 信息
                echo "$pull_output" | while read -r line; do
                    [ -n "$line" ] && log "  $line"
                done
                increment_stat "$STATS_SUCCESS"
            else
                log "${RED}✗ 更新服務失敗：$service_name${NC}"
                echo "$pull_output" | while read -r line; do
                    [ -n "$line" ] && log "  ERROR: $line"
                done
                increment_stat "$STATS_FAILED"
            fi
        else
            log "${YELLOW}⊘ 服務 $service_name 沒有正在運行的容器，已跳過${NC}"
            increment_stat "$STATS_SKIPPED"
        fi
    else
        # 未啟用 --running-only flag，直接更新
        log "${YELLOW}開始更新服務 $service_name 的所有鏡像...${NC}"

        local pull_output
        pull_output=$($DOCKER_COMPOSE_CMD pull 2>&1)
        local pull_result=$?

        if [ $pull_result -eq 0 ]; then
            log "${GREEN}✓ 成功更新服務：$service_name${NC}"
            # 記錄詳細的 pull 信息
            echo "$pull_output" | while read -r line; do
                [ -n "$line" ] && log "  $line"
            done
            increment_stat "$STATS_SUCCESS"
        else
            log "${RED}✗ 更新服務失敗：$service_name${NC}"
            echo "$pull_output" | while read -r line; do
                [ -n "$line" ] && log "  ERROR: $line"
            done
            increment_stat "$STATS_FAILED"
        fi
    fi

    # 返回原目錄
    cd "$original_dir"
}

# 顯示最終統計結果
show_final_stats() {
    local end_time
    end_time=$(date)
    local duration=$((SECONDS))

    # 從臨時文件讀取統計
    SUCCESSFUL_UPDATES=$(get_stat "$STATS_SUCCESS")
    FAILED_UPDATES=$(get_stat "$STATS_FAILED")
    SKIPPED_SERVICES=$(get_stat "$STATS_SKIPPED")

    echo ""
    log "${CYAN}========================================${NC}"
    log "${CYAN}        執行完成統計報告               ${NC}"
    log "${CYAN}========================================${NC}"
    log "${BLUE}總共處理服務數量：$TOTAL_SERVICES${NC}"
    log "${GREEN}成功更新：$SUCCESSFUL_UPDATES${NC}"
    log "${RED}更新失敗：$FAILED_UPDATES${NC}"
    log "${YELLOW}跳過服務：$SKIPPED_SERVICES${NC}"
    log "${CYAN}執行時間：${duration}秒${NC}"
    log "${CYAN}完成時間：$end_time${NC}"
    log "${CYAN}使用的線程數：$THREADS${NC}"
    log "${CYAN}Docker Compose 命令：$DOCKER_COMPOSE_CMD${NC}"

    if [ "$RUNNING_ONLY" = true ]; then
        log "${YELLOW}模式：僅更新運行中的服務${NC}"
    else
        log "${YELLOW}模式：更新所有服務${NC}"
    fi

    log "${CYAN}日誌文件：$LOGFILE${NC}"
    log "${CYAN}========================================${NC}"

    # 清理臨時文件
    rm -rf "$STATS_DIR"
}
# 控制並發數量的函數
wait_for_threads() {
    while [ "$(jobs -r | wc -l)" -ge "$THREADS" ]; do
        sleep 0.1
    done
}

# 信號處理函數
cleanup() {
    echo ""
    log "${YELLOW}接收到中斷信號，正在清理...${NC}"

    # 終止所有子進程
    jobs -p | xargs -r kill 2>/dev/null

    show_final_stats
    exit 130
}

# 設置信號處理
trap cleanup INT TERM

# =============================================================================
# 主程序
# =============================================================================

# 記錄開始時間
SECONDS=0

# 顯示歡迎信息
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}    Docker Compose 鏡像更新工具        ${NC}"
echo -e "${CYAN}========================================${NC}"

# 解析命令列參數
parse_args "$@"

# 檢查系統需求
check_requirements

# 檢查日誌文件
check_log_file

# 顯示配置信息
echo -e "${BLUE}配置信息：${NC}"
echo -e "${BLUE}  - 掃描目錄：$DIRECTORY${NC}"
echo -e "${BLUE}  - 線程數量：$THREADS${NC}"
echo -e "${BLUE}  - 日誌文件：$LOGFILE${NC}"
echo -e "${BLUE}  - Docker Compose 命令：$DOCKER_COMPOSE_CMD${NC}"
if [ "$RUNNING_ONLY" = true ]; then
    echo -e "${BLUE}  - 模式：僅更新運行中的服務${NC}"
else
    echo -e "${BLUE}  - 模式：更新所有服務${NC}"
fi
echo ""

# 初始化日誌文件
{
    echo "========================================"
    echo "Docker Pull 開始執行於 $(date)"
    echo "配置："
    echo "  - 掃描目錄：$DIRECTORY"
    echo "  - 線程數量：$THREADS"
    echo "  - 運行模式：$([ "$RUNNING_ONLY" = true ] && echo "僅運行中的服務" || echo "所有服務")"
    echo "  - Docker Compose 命令：$DOCKER_COMPOSE_CMD"
    echo "========================================"
} >>"$LOGFILE"

# 檢查目錄是否存在
if [ ! -d "$DIRECTORY" ]; then
    log "${RED}錯誤：目錄 $DIRECTORY 不存在${NC}"
    exit 1
fi

# 將目錄轉換為絕對路徑
DIRECTORY=$(cd "$DIRECTORY" && pwd)
log "${BLUE}掃描目錄：$DIRECTORY${NC}"

# 獲取所有第一層子目錄
SERVICE_DIRS=()
while IFS= read -r -d $'\0'; do
    SERVICE_DIRS+=("$REPLY")
done < <(find "$DIRECTORY" -mindepth 1 -maxdepth 1 -type d -print0)

TOTAL_SERVICES=${#SERVICE_DIRS[@]}
log "${YELLOW}發現 $TOTAL_SERVICES 個目錄需要檢查${NC}"

# 如果沒有服務，退出
if [ "$TOTAL_SERVICES" -eq 0 ]; then
    log "${GREEN}沒有發現需要處理的服務目錄${NC}"
    show_final_stats
    exit 0
fi

# 顯示即將處理的服務列表
log "${CYAN}即將處理的服務：${NC}"
for i in "${!SERVICE_DIRS[@]}"; do
    local service_name
    service_name=$(basename "${SERVICE_DIRS[$i]}")
    log "${CYAN}  $((i + 1)). $service_name${NC}"
done
echo ""

# 導出函數和變量，使其在子 shell 中可用
export -f pull_images show_progress log increment_stat get_stat
export DOCKER_COMPOSE_CMD RUNNING_ONLY LOGFILE STATS_DIR STATS_SUCCESS STATS_FAILED STATS_SKIPPED
export RED GREEN YELLOW BLUE CYAN NC TOTAL_SERVICES

# 對每個服務目錄執行pull
current_index=0
for dir in "${SERVICE_DIRS[@]}"; do
    ((current_index++))

    # 等待直到有可用的線程
    wait_for_threads

    # 執行pull_images函數為背景任務
    (pull_images "$dir" "$current_index") &
done

# 等待所有背景任務完成
wait

# 顯示最終統計
show_final_stats

# 根據結果設置退出代碼
FAILED_UPDATES=$(get_stat "$STATS_FAILED")
if [ "$FAILED_UPDATES" -gt 0 ]; then
    exit 1
else
    exit 0
fi
