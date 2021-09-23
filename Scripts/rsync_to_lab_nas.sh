#!/bin/bash
#sshpass -p "密碼" but not work
time rsync -avh --delete --stats --info=progress2 -e "ssh -p 2222" --exclu
de H@H --exclude .conda --exclude .cache --exclude .vscode-server ./ df@14
0.121.196.20:~/home_bk | lolcat