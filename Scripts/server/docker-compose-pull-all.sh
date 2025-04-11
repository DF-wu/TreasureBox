#!/bin/bash
# Docker Compose 鏡像更新工具
# 修訂版本: 4.0 | 最後檢查: 2025-4-11
# AI generate.
#!/bin/bash

# =============================================================================
# 腳本名稱：docker_pull.sh
# 功能描述：自動遍歷指定資料夾下的Docker Compose服務，執行docker-compose pull，
#           支援多線程、色彩高亮，適用於crontab執行。
# 使用方法：
#   ./docker_pull.sh -d /path/to/myservices -t 4 -l /path/to/logfile.log
# 參數：
#   -d, --directory    指定包含Docker Compose服務的主目錄 (預設為當前目錄)
#   -t, --threads      指定同時執行的線程數量 (預設為4)
#   -l, --log           指定日誌檔案路徑 (預設為./docker_pull.log)
# =============================================================================

# =============================================================================
# 變數定義
# =============================================================================

# 默認值
DIRECTORY="."
THREADS=4
LOGFILE="./docker_pull.log"

# 色彩定義 (僅在終端支援時顯示顏色)
if [ -t 1 ]; then
    RED='\033[0;31m'
    GREEN='\033[0;32m'
    YELLOW='\033[1;33m'
    NC='\033[0m' # 無色
else
    RED=''
    GREEN=''
    YELLOW=''
    NC=''
fi

# =============================================================================
# 函數定義
# =============================================================================

# 顯示幫助訊息
usage() {
    echo "Usage: $0 [-d directory] [-t threads] [-l logfile]"
    echo "  -d, --directory    指定包含Docker Compose服務的主目錄 (預設為當前目錄)"
    echo "  -t, --threads      指定同時執行的線程數量 (預設為4)"
    echo "  -l, --log          指定日誌檔案路徑 (預設為./docker_pull.log)"
    exit 1
}

# 解析參數
parse_args() {
    while [[ "$#" -gt 0 ]]; do
        case $1 in
            -d|--directory)
                DIRECTORY="$2"
                shift
                ;;
            -t|--threads)
                THREADS="$2"
                shift
                ;;
            -l|--log)
                LOGFILE="$2"
                shift
                ;;
            -h|--help)
                usage
                ;;
            *)
                echo -e "${RED}Unknown parameter passed: $1${NC}"
                usage
                ;;
        esac
        shift
    done
}

# 日誌輸出函數
log() {
    local message="$1"
    echo -e "$message" | tee -a "$LOGFILE"
}

# 執行docker-compose pull的函數
pull_images() {
    local dir="$1"
    local service_name
    service_name=$(basename "$dir")
    
    log "${YELLOW}開始更新服務：$service_name${NC}"
    
    # 進入服務目錄
    cd "$dir" || { log "${RED}無法進入目錄：$dir${NC}"; return; }
    
    # 檢查docker-compose檔案
    if [ -f "docker-compose.yml" ] || [ -f "docker-compose.yaml" ]; then
        docker-compose pull >> "$LOGFILE" 2>&1
        if [ $? -eq 0 ]; then
            log "${GREEN}成功更新服務：$service_name${NC}"
        else
            log "${RED}更新服務失敗：$service_name${NC}"
        fi
    else
        log "${RED}在 $dir 中未找到 docker-compose.yml 或 docker-compose.yaml${NC}"
    fi
}

# 控制並發數量的函數
wait_for_threads() {
    while [ "$(jobs -r | wc -l)" -ge "$THREADS" ]; do
        sleep 0.5
    done
}

# =============================================================================
# 主程序
# =============================================================================

# 解析命令列參數
parse_args "$@"

# 初始化日誌文件
echo "======== Docker Pull運行於 $(date) ========" >> "$LOGFILE"

# 檢查目錄是否存在
if [ ! -d "$DIRECTORY" ]; then
    log "${RED}錯誤：目錄 $DIRECTORY 不存在。${NC}"
    exit 1
fi

# 獲取所有第一層子目錄
SERVICE_DIRS=()
while IFS= read -r -d $'\0'; do
    SERVICE_DIRS+=("$REPLY")
done < <(find "$DIRECTORY" -mindepth 1 -maxdepth 1 -type d -print0)

TOTAL=${#SERVICE_DIRS[@]}
log "${YELLOW}發現 $TOTAL 個服務需要更新。${NC}"

# 如果沒有服務，退出
if [ "$TOTAL" -eq 0 ]; then
    log "${GREEN}沒有發現需要更新的服務。${NC}"
    exit 0
fi

# 對每個服務目錄執行pull
for dir in "${SERVICE_DIRS[@]}"; do
    # 等待直到有可用的線程
    wait_for_threads
    
    # 執行pull_images函數為背景任務
    pull_images "$dir" &
done

# 等待所有背景任務完成
wait

log "${GREEN}所有鏡像更新完成。${NC}"