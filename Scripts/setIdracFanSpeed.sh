#!/bin/bash
#set fan control to manual
ipmitool -I lanplus  -H 192.168.10.9  -U root -P zxcv6319 raw 0x30 0x30 0x01 0x00
#set fan speed to target duty cycle
ipmitool -I lanplus  -H 192.168.10.9  -U root -P zxcv6319 raw 0x30 0x30 0x02 0xff 0x25
