#!/bin/bash
# Get cloudflare ddns client first
# https://github.com/LINKIWI/cloudflare-ddns-client

savedIp=/tmp/wanip
curWanip=$(dig +short myip.opendns.com @resolver4.opendns.com)
curTime=$(date +"%Y-%m-%d %r")

if [ -f "$savedIp" ] && [ $curWanip != $(cat $savedIp) ] || [ ! -f "$savedIp" ]; then
    su df -c 'cloudflare-ddns --update-now'
    echo "$curWanip" > $savedIp
    echo Updated: $curTime
else
    echo Checked: $curTime
fi
echo CurIP: $curWanip

