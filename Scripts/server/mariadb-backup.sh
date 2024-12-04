# docker version
# used for crontab
# !!! 記得針對系統環境修改!!!

docker exec mariadb sh -c "mysqldump -uroot -p --all-databases" | gzip -c > ~/tmp/`date +%Y-\%m-\%d`.gz