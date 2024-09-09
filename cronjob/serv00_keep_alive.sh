#!/bin/bash
# 运行此脚本青龙面板要安装Linux下的sshpass和jq依赖
# source: https://linux.do/t/topic/173430
# edit by df 2024.09.10
# dependency: sshpass, jq

echo "开始执行任务..."

# 设置 SSH 超时（单位：秒）
SSH_TIMEOUT=15

Serv00_username_1="你的账户"
Serv00_password_1="你的密码"
Serv00_host_1="你的主机地址"

# Bark 通知相关配置
BARK_URL="你的bark通知url"
BARK_GROUP="Alive"
BARK_TITLE="Serv00"
BARK_ICON="https://kechang.uk/pic/kechang_icon_round.png"

# 定义账号、密码和主机信息数组，每个元素包含 "账号:密码:主机"，主机就是s*.serv00.com，一行一组(不需要,号)
CREDENTIALS=(
"$Serv00_username_1:$Serv00_password_1:$Serv00_host_1"
)

# 函数: 发送 Bark 推送通知
send_bark_notification() {
    local title="$1"
    local message="$2"
    local encoded_title=$(echo -n "$title" | jq -sRr @uri)
    local encoded_message=$(echo -e "$message" | jq -sRr @uri)
    local notification_url="$BARK_URL/$encoded_title/$encoded_message?group=$BARK_GROUP&icon=$(echo -n "$BARK_ICON" | jq -sRr @uri)"

    curl -s -X GET "$notification_url" > /dev/null
}
# 定义一个数组来存储输出和错误信息
declare -A OUTPUTS
# 用于标记是否有命令失败
has_error=false
# 用于存储成功的命令
successful_commands=()
# 用于存储失败的命令
failed_commands=()

# 循环遍历每行并执行命令
for cred in "${CREDENTIALS[@]}"; do
    IFS=':' read -r user pass host <<< "$cred"
    
    if [ -z "$user" ]; then
        continue
    fi
    
    # 在远程服务器上执行指定的命令
    # OUTPUTS["$user"]=$(sshpass -p "$pass" ssh -q -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=$SSH_TIMEOUT -t $user@$host "bash /home/dfder/start.sh" 2>&1)
    OUTPUTS["$user"]=$(sshpass -p "$pass" ssh -q -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o ConnectTimeout=$SSH_TIMEOUT -t $user@$host "echo 'hello world!'" 2>&1)
    if [ $? -ne 0 ];then
        echo "执行命令失败: $user: ${OUTPUTS["$user"]}"
        has_error=true
        failed_commands+=("$user")
    else
        successful_commands+=("$user")
    fi
done

# 构建消息内容
MESSAGE=""

# 添加成功的命令到消息
if [ ${#successful_commands[@]} -gt 0 ]; then
    MESSAGE+="保号成功:\\n"
    for user in "${successful_commands[@]}"; do
        MESSAGE+="$user\\n"
    done
fi

# 添加失败的命令到消息
if [ ${#failed_commands[@]} -gt 0 ]; then
    MESSAGE+="以下出错了😭:\\n"
    for user in "${failed_commands[@]}"; do
        MESSAGE+="$user\\n"
    done
fi

# 输出最终结果
if [ "$has_error" = true ]; then
    echo "请检查输入是否正确，或是否在 https://www.serv00.com/ip_unban/ 解锁了IP"
else
    echo "任务执行完成"
fi
MESSAGE+="All done."
echo $MESSAGE
# send_bark_notification "$BARK_TITLE" "$MESSAGE"
# 这里我设置的cron是 0 0/30 * * * ? 执行太频繁了, 所以把bark通知注释掉了