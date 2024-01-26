# !/bin/bash
# Run Nextcloud AIO occ command. pass all arguments to the script
docker exec --user www-data -it nextcloud-aio-nextcloud php occ $*
