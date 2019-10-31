

echo "start to mount WD2T"

rclone mount -vv WD2T: /WD2T --allow-other --allow-non-empty --vfs-cache-mode writes

echo "closed"


