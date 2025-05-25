#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ==============================================================================
# Script Name: update-stack-by-portainer.py
# Description: Updates Portainer stacks by re-pulling images and redeploying
#              via Portainer API. Supports interactive mode and CLI arguments.
# Author:      TreasureBox Scripts
# Version:     2.0.0
# Depends:     requests
# ==============================================================================

import argparse
import getpass
import requests
import urllib3
import time
import os
import sys
from typing import Optional

# --- Style Definitions (ANSI Escape Codes for Colors) ---
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_RED = "\033[0;31m"
C_GREEN = "\033[0;32m"
C_YELLOW = "\033[0;33m"
C_BLUE = "\033[0;34m"
C_CYAN = "\033[0;36m"
C_MAGENTA = "\033[0;35m"

# Suppress only the single InsecureRequestWarning from urllib3
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

def print_message(level: str, message: str) -> None:
    """Print formatted message with color coding."""
    colors = {
        'INFO': C_BLUE,
        'SUCCESS': C_GREEN,
        'WARNING': C_YELLOW,
        'ERROR': C_RED,
        'HEADER': C_CYAN + C_BOLD,
        'STEP': C_MAGENTA
    }
    
    prefix_map = {
        'INFO': '[INFO]    ',
        'SUCCESS': '[SUCCESS] ',
        'WARNING': '[WARNING] ',
        'ERROR': '[ERROR]   ',
        'HEADER': '=== ',
        'STEP': '--- '
    }
    
    color = colors.get(level.upper(), C_RESET)
    prefix = prefix_map.get(level.upper(), f'[{level.upper()}] ')
    
    stream = sys.stderr if level.upper() == 'ERROR' else sys.stdout
    print(f"{color}{prefix}{message}{C_RESET}", file=stream)

def ask_for_input(prompt: str, is_secret: bool = False) -> str:
    """Prompt user for input with optional password masking."""
    full_prompt = f"{C_YELLOW}{prompt}:{C_RESET} "
    
    if is_secret:
        value = getpass.getpass(full_prompt)
    else:
        value = input(full_prompt)
    
    return value.strip()

def validate_url(url: str) -> str:
    """Validate and normalize Portainer URL."""
    if not url:
        return ""
    
    # Remove trailing slash
    url = url.rstrip("/")
    
    # Check if URL starts with http:// or https://
    if not (url.startswith("http://") or url.startswith("https://")):
        print_message("ERROR", f"URL '{url}' 格式無效。應以 http:// 或 https:// 開頭。")
        return ""
    
    # Ensure URL ends with /api for Portainer API
    if not url.endswith("/api"):
        url += "/api"
    
    return url

def get_configuration() -> tuple[str, str]:
    """Get Portainer URL and PAT from command line args or interactive input."""
    parser = argparse.ArgumentParser(
        description="透過 Portainer API 自動重新拉取映像並重新部署 Stacks。",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=f"""
使用範例:
  {C_CYAN}參數模式:{C_RESET}
    python {sys.argv[0]} -u http://localhost:9000 -p your_pat_token
    python {sys.argv[0]} --url https://portainer.example.com --pat your_token
  
  {C_CYAN}互動模式:{C_RESET}
    python {sys.argv[0]}  # 將會提示輸入所有必要資訊
"""
    )
    
    parser.add_argument(
        "-u", "--url",
        help="Portainer 服務的 URL (例如: http://localhost:9000)。",
        metavar="URL"
    )
    parser.add_argument(
        "-p", "--pat",
        help="Portainer 個人存取權杖 (PAT)。",
        metavar="TOKEN"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="啟用詳細輸出。"
    )
    
    args = parser.parse_args()
    
    # Header
    print_message("HEADER", "Portainer Stack Updater v2.0")
    print("--------------------------------------------------")
    
    # Get Portainer URL
    portainer_url = args.url
    if not portainer_url:
        print_message("STEP", "設定 Portainer 連線資訊")
        portainer_url = ask_for_input("請輸入 Portainer URL (例如 http://localhost:9000)")
    
    portainer_url = validate_url(portainer_url)
    if not portainer_url:
        print_message("ERROR", "無效的 Portainer URL。")
        sys.exit(1)
    
    # Get PAT
    pat = args.pat
    if not pat:
        pat = ask_for_input("請輸入 Portainer Personal Access Token (PAT)", is_secret=True)
    
    if not pat:
        print_message("ERROR", "PAT 不能為空。")
        sys.exit(1)
    
    print_message("INFO", f"Portainer URL: {portainer_url}")
    print_message("SUCCESS", "設定完成！")
    
    return portainer_url, pat

def main():
    """Main function to orchestrate stack updates."""
    # Get configuration
    portainer_url, pat = get_configuration()
    
    # Prepare headers for API authentication
    headers = {
        'X-API-Key': pat
    }

    print_message("STEP", "正在連接到 Portainer 並獲取 Stacks 列表...")
    
    try:
        # Get the list of all stacks from Portainer
        # verify=False disables SSL certificate verification. Use with caution.
        stacks_response = requests.get(f'{portainer_url}/stacks', headers=headers, verify=False, timeout=30)
        stacks_response.raise_for_status()  # Raise an HTTPError for bad responses (4xx or 5xx)
        stacks = stacks_response.json()
        print_message("SUCCESS", f"成功獲取 {len(stacks)} 個 Stacks。")

    except requests.exceptions.RequestException as e:
        print_message("ERROR", f"連接到 Portainer 或獲取 Stacks 失敗: {e}")
        sys.exit(1)

    # Filter only active stacks (Status == 1 typically means running/active)
    # Portainer API: Stack Status: 1 (active/running), 2 (inactive/stopped), ? (other states)
    active_stacks = [stack for stack in stacks if stack.get('Status') == 1]

    if not active_stacks:
        print_message("WARNING", "沒有找到處於活動狀態 (Status == 1) 的 Stacks 需要更新。")
        sys.exit(0)

    print_message("INFO", f"找到 {len(active_stacks)} 個活動 Stacks 需要更新。")

    # Update each active stack
    success_count = 0
    total_count = len(active_stacks)
    
    for i, stack in enumerate(active_stacks, 1):
        stack_id = stack['Id']
        stack_name = stack['Name']
        endpoint_id = stack['EndpointId']  # Get the endpoint ID for the stack

        print(f"\n{C_MAGENTA}----------------------------------------------------{C_RESET}")
        print_message("STEP", f"處理 Stack {i}/{total_count}: {C_CYAN}{stack_name}{C_RESET} (ID: {stack_id}, EndpointID: {endpoint_id})")
        start_time = time.time()  # Record the start time for this stack update

        try:
            # Get the current stack details to preserve its configuration (like Env vars and StackFileContent)
            print_message("INFO", f"正在獲取 Stack '{stack_name}' 的詳細資訊...")
            stack_details_response = requests.get(f'{portainer_url}/stacks/{stack_id}', headers=headers, verify=False, timeout=30)
            stack_details_response.raise_for_status()
            stack_details = stack_details_response.json()
            print_message("SUCCESS", f"成功獲取 Stack '{stack_name}' 的詳細資訊。")

            # Prepare the update payload
            # 'PullImage': True is crucial for forcing Portainer to re-pull the latest images for the services in the stack.
            update_payload = {
                'PullImage': True,
                'PruneServices': stack_details.get('PruneServices', False), # Preserve existing PruneServices setting or default to False
                'Env': stack_details.get('Env', [])  # Preserve existing environment variables
            }

            # Add StackFileContent if it exists in the primary details
            # This is the Docker Compose file content.
            if 'StackFileContent' in stack_details and stack_details['StackFileContent']:
                update_payload['StackFileContent'] = stack_details['StackFileContent']
                print_message("INFO", "使用主要詳細資訊中的 StackFileContent。")
            else:
                # If StackFileContent is not directly available (e.g., for Swarm stacks or if API response is minimal),
                # try to retrieve it from the dedicated '/file' endpoint.
                print_message("WARNING", f"主要詳細資訊中沒有 StackFileContent，嘗試從 /api/stacks/{stack_id}/file 端點獲取...")
                try:
                    stack_file_response = requests.get(f'{portainer_url}/stacks/{stack_id}/file', headers=headers, verify=False, timeout=30)
                    stack_file_response.raise_for_status()
                    stack_file_data = stack_file_response.json()
                    stack_file_content = stack_file_data.get('StackFileContent')
                    if stack_file_content:
                        update_payload['StackFileContent'] = stack_file_content
                        print_message("SUCCESS", "成功從 /file 端點獲取 StackFileContent。")
                    else:
                        print_message("WARNING", f"無法獲取 Stack '{stack_name}' 的 StackFileContent。更新可能無法按預期工作。")
                except requests.exceptions.RequestException as e:
                    print_message("WARNING", f"從 /file 端點獲取 StackFileContent 失敗: {e}")

            # Update the stack: Send a PUT request to the Portainer API
            # The endpointId is passed as a query parameter for the PUT request.
            print_message("INFO", f"正在發送更新請求給 Stack '{stack_name}' (PullImage=True)...")
            update_url = f'{portainer_url}/stacks/{stack_id}?endpointId={endpoint_id}'
            update_response = requests.put(update_url, headers=headers, json=update_payload, verify=False, timeout=120) # Increased timeout for update
            update_response.raise_for_status() # Will raise an exception for 4xx/5xx status codes

            end_time = time.time()  # Record the end time
            duration = end_time - start_time  # Calculate the duration
            success_count += 1
            print_message("SUCCESS", f"Stack {C_CYAN}{stack_name}{C_RESET} 在 {duration:.2f} 秒內成功更新！")

        except requests.exceptions.HTTPError as err:
            print_message("ERROR", f"更新 Stack {C_CYAN}{stack_name}{C_RESET} 時發生 HTTP 錯誤: {err}")
            if err.response is not None:
                try:
                    error_details = err.response.json()
                    print_message("ERROR", f"API 回應: {error_details}")
                except ValueError: # If response body is not JSON
                    print_message("ERROR", f"API 回應 (非JSON): {err.response.text[:300]}...")
        except requests.exceptions.RequestException as e:
            print_message("ERROR", f"更新 Stack {C_CYAN}{stack_name}{C_RESET} 時發生網路錯誤: {e}")
        except Exception as e:
            print_message("ERROR", f"更新 Stack {C_CYAN}{stack_name}{C_RESET} 時發生未預期錯誤: {e}")

    print(f"\n{C_MAGENTA}============================================================{C_RESET}")
    print_message("HEADER", f"Stack 更新完成報告")
    print_message("INFO", f"總計處理: {total_count} 個 Stacks")
    print_message("SUCCESS", f"成功更新: {success_count} 個 Stacks")
    if success_count < total_count:
        print_message("WARNING", f"失敗或跳過: {total_count - success_count} 個 Stacks")
    
    if success_count == total_count:
        print_message("SUCCESS", "所有活動 Stacks 已成功更新！")
    else:
        print_message("WARNING", "部分 Stacks 更新失敗，請檢查上述錯誤訊息。")


if __name__ == "__main__":
    main()