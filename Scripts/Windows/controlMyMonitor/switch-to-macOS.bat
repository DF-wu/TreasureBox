@REM Monitor Device Name: "\\.\DISPLAY2\Monitor0"
@REM Monitor Name: "P2712V"
@REM Serial Number: "0000000000000"
@REM Adapter Name: "NVIDIA GeForce RTX 3080"
@REM Monitor ID: "MONITOR\LHC90A1\{4d36e96e-e325-11ce-bfc1-08002be10318}\0011"
@REM Short Monitor ID: "LHC90A1"

@REM vcp 60 = display source
@REM value:
@REM 	- 15 = DP     windows
@REM 	- 16 = auto
@REM 	- 17 = HDMI 1   macos
@REM 	- 18 = HDMI 2



@REM ------
@REM Monitor Device Name: "\\.\DISPLAY1\Monitor0"
@REM Monitor Name: "AG275UXM"
@REM Serial Number: "2ONQ9JA008301"
@REM Adapter Name: "NVIDIA GeForce RTX 3080"
@REM Monitor ID: "MONITOR\AOCA524\{4d36e96e-e325-11ce-bfc1-08002be10318}\0008"
@REM Short Monitor ID: "AOCA524"

@REM vcp 60 = display source
@REM value:
@REM 	- 15 = auto
@REM 	- 16 = DP
@REM 	- 17 = HDMI 1 WINDOWS
@REM 	- 18 = HDMI 2 macos
    


@echo off
setlocal EnableExtensions

REM 設定命令提示字元使用 UTF-8 編碼，避免顯示中文亂碼
chcp 65001 > nul

REM 腳本: 切換螢幕輸入至 Windows

REM 定義 ControlMyMonitor.exe 路徑
set "CMM_PATH=E:\file  X\controlmymonitor\ControlMyMonitor.exe"

REM 檢查 CMM_PATH 是否存在
if not exist "%CMM_PATH%" (
    echo [ERROR] 找不到 ControlMyMonitor.exe: %CMM_PATH%
    exit /B 1
)

REM 定義螢幕裝置變數
set "PRIMARY_DISPLAY=AG275UXM"
set "SECONDARY_DISPLAY=P2712V"

echo.
echo [INFO] 正在將螢幕切換至 MacOS 輸入源...
echo.

REM 切換主螢幕 (AG275UXM) 到 HDMI 2 (值: 18)
"%CMM_PATH%" /SetValue "%PRIMARY_DISPLAY%" 60 18
echo [OK] 主螢幕 (AG275UXM) 已設定為 HDMI 2.

REM 切換副螢幕 (P2712V) 到 DP (值: 15)
"%CMM_PATH%" /SetValue "%SECONDARY_DISPLAY%" 60 17
echo [OK] 副螢幕 (P2712V) 已設定為 DP.

echo.
echo [SUCCESS] 所有螢幕已切換完成！
echo.

REM 暫停 3 秒後自動關閉視窗
timeout /t 3 > nul