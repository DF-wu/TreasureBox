# docker version
# used for crontab
docker exec mariadb sh -c "mysqldump -uroot -p --all-databases" | gzip -c > ~/tmp/`date +%Y-\%m-\%d`.gz