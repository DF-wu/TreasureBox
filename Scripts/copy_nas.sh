rsync -rltDh -n --delete --stats --info=progress2 --exclude isos --exclude system --exclude domains --exclude appdata root@homenas:/mnt/user/mydata/* /mnt/mydata/
rsync -rltDh -n  --delete  --stats --info=progress2 --exclude photoprism root@homenas:/mnt/user/appdata/* /mnt/appdata
# rsync -rltDh --delete --stats --info=progress2 --exclude MB-12T root@192.168.10.10:/mnt/disks/ /mnt/dfpool/nas/disks
