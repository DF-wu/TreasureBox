

echo "Start to mountHomes data"

rclone mount -vv newhome_homes: /newhome_homes --allow-other --allow-non-empty --vfs-cache-mode writes

echo "close Successfully"
