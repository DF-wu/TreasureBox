# docker version
# used for crontab
# !!! 記得針對系統環境修改!!!
# doc: https://mariadb.com/kb/en/container-backup-and-restoration/
# 幹他的flag要黏再一起好噁心
docker exec mariadb sh -c "mysqldump -uroot -p密碼密碼密碼 --all-databases" | gzip -c > ~/mariadb-backup-`date +%Y-\%m-\%d`.gz