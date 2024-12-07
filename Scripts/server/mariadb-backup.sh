#!/bin/bash
# author: df
# date: 2024-12-08
# to back up my mariadb


# find the current script uri
SCRIPT_DIR="$(dirname "$(readlink -f "$0")")"

# set a log file uri
LOG_FILE="$SCRIPT_DIR/mariadb-backup.sh.log"

# check if log exist. if not, create one.
if [ ! -f "$LOG_FILE" ]; then
    touch "$LOG_FILE"
fi



# 定義一個函數來打timestamp 
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# 使用 log 函數來輸出日誌
log "Starting MariaDB backup..."

# mariadb is docker version
# used for crontab
# !!! 記得針對系統環境修改!!!
# remember chmod 777 mariadb-backup.sh . Don't waste your life on auth issue.
# doc: https://mariadb.com/kb/en/container-backup-and-restoration/
# 幹他的flag要黏再一起好噁心
docker exec mariadb sh -c "mysqldump -uroot -p密碼密碼密碼 --all-databases" | gzip -c >/home/df/_serverDataAndScript/mariadb-backups/mariadb-backup-$(date +%Y-\%m-\%d).gz

# 檢查備份是否成功
if [ $? -eq 0 ]; then
    log "Backup completed successfully."
else
    log "Backup failed."
fi


# 找最新備份傳到遠端
find /home/df/_serverDataAndScript/mariadb-backups/ -type f -name "mariadb-backup-*.gz" -printf "%T@ %p\n" | sort -n -r | head -1 | cut -d' ' -f2- | xargs -I {} cp {} /mnt/ncdata/df/files/#dataPortal/mariadb-backups/

# 檢查傳輸是否成功
if [ $? -eq 0 ]; then
    log "Latest backup transferred successfully."
else
    log "Transfer of latest backup failed."
fi