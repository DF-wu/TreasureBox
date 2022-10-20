# By d.f.
# 2022.10.20
# This is a scipt banned ip list from my qnap syslog. So I can apply it to my router blacklist.
import csv

contents = []

with open("system-log.csv", "r", newline="", encoding='utf-8') as csvfile:
    reader = csv.reader(csvfile)
    for row in reader:
        contents.append(row[7])
        # row 是 List 的型態，可以用 print(row[0], row[1], row[2]) 分別取得印出
        
ips= []        
for msg in contents:
    if "ban list" in msg:
       ips.append(msg[msg.find('[',10) +1 : msg.find(']', 10)])

ipset = set(ips)       

f = open("ban-ip-list.txt", 'w')
for ip in ipset:
    f.write(ip + "\n")

print(ipset)
        
        
