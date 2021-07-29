#!/usr/bin/expect

# Login into PTT via SSH.
# Combine crontab with this script so you don't forget to login PTT everyday.

# Usage: /bin/bash -c ${FILE_PATH_OF_THIS_SCRIPT} 

# Example in crontab:
# ptt auto login, every day at 12:00 PM                                            
# 0 12 * * * /bin/bash -c ${ABSOLUTE_FILE_PATH_OF_THIS_SCRIPT}

spawn ssh -oBatchMode=no -oStrictHostKeyChecking=no bbsu@ptt.cc

# Usage: /bin/bash -c '${FILE_PATH_OF_THIS_SCRIPT} ${BBS_ID} ${BBS_PW}'
set BBS_ID [lindex $argv 0]
set BBS_PW [lindex $argv 1]

#set BBS_ID "REPLACE_WITH_YOUR_ID"
#set BBS_PW "REPLACE_WITH_YOUR_PASSOWRD"

expect {
      "請輸入代號" { send "$BBS_ID\r" ; exp_continue }
      "請輸入您的密碼" { send "$BBS_PW\r" ; exp_continue }
      "您想刪除其他重複登入的連線嗎" { send "N\r" ; exp_continue }
      "您要刪除以上錯誤嘗試的記錄嗎" { send "N\r" ; exp_continue }
      "密碼不對喔" { exit }
      "裡沒有這個人啦" { exit }
      "請勿頻繁登入以免造成系統過度負荷" { send "\r" ; exp_continue }
      "請按任意鍵繼續" { send "\r" ; exp_continue }
      "oodbye" { exit }
 }
 
exit