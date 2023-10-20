#!/bin/bash
# Author: df
# reference : https://github.com/wdzeng/shopee-coins-bot
docker pull ghcr.io/wdzeng/shopee-coins-bot
time docker run --rm -v /mnt/appdata/shopee-sign-bot/cookie:/cookie  ghcr.io/wdzeng/shopee-coins-bot  -c /cookie