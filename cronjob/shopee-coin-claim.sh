#!/bin/bash
docker pull ghcr.io/wdzeng/shopee-coins-bot
time docker run --rm -v /mnt/user/appdata/shopee-sign-bot/cookie:/cookie  ghcr.io/wdzeng/shopee-coins-bot  -c /cookie