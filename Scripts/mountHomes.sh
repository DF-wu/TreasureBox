

    echo ""
	echo " ========================================================= "
	echo " \                 DFmount.sh  Script                    / "
	echo " \      For mount different virtual disk by Rclone       / "
	echo " \                   v0.1. (14 Nov 2019)                 / "
	echo " \                     Created by DF                     / "
	echo " ========================================================= "
	echo ""
	echo " Copyright (C) 2019 DF a2470abc@gmail.com"
	echo -e " ${RED}Happy New Year!${PLAIN}"
	echo "Starting......"
    echo "Start Successfully!"

rclone mount -vv newhome_homes: /newhome_homes --allow-other --allow-non-empty --vfs-cache-mode writes

echo " ========================================================= "
echo " Closing....... "
echo " Close Successfully"
echo " ========================================================= "
