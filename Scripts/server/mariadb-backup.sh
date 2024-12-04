# docker version
# used for crontab
# !!! 記得針對系統環境修改!!!

docker exec mariadb sh -c "mysqldump -uroot -p 密碼密碼密碼 --all-databases" | gzip -c > ~/mariadb-backup-`date +%Y-\%m-\%d`.gz