#!/bin/bash
#sshpass -p "密碼" but not work
time rsync -avh --delete --stats --info=progress2 -e "ssh -p 2222" --exclude H@H --exclude .conda --exclude .cache --exclude .vscode-server ./ df@140.121.196.20:~/bk/homeDir/df-c | lolcat