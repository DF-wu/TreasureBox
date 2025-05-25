#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Portainer Stack Updater Script

This script automates updating Portainer stacks by re-pulling images and
redeploying them via the Portainer API.
It supports configuration via command-line arguments, environment variables,
or interactive prompts.
"""

import argparse
import getpass
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests
except ImportError:
    print(
        "錯誤：必要的 'requests' 庫未安裝。請使用 'pip install requests' 安裝它。",
        file=sys.stderr,
    )
    sys.exit(1)

# --- Style Definitions (ANSI Escape Codes for Colors) ---
class Colors:
    RESET = "\033[0m"
    BOLD = "\033[1m"
    RED = "\033[0;31m"
    GREEN = "\033[0;32m"
    YELLOW = "\033[0;33m"
    BLUE = "\033[0;34m"
    MAGENTA = "\033[0;35m"
    CYAN = "\033[0;36m"

# --- Configuration Defaults ---
DEFAULT_PORTAINER_URL = ""
DEFAULT_PORTAINER_USERNAME = ""
DEFAULT_ENDPOINT_ID = 1
DEFAULT_TARGET_STACK_NAME_OR_ID = ""

# --- Global Configuration (will be populated) ---
CONFIG = {
    "portainer_url": DEFAULT_PORTAINER_URL,
    "portainer_username": DEFAULT_PORTAINER_USERNAME,
    "portainer_password": "", # Will be prompted if not set
    "portainer_endpoint_id": DEFAULT_ENDPOINT_ID,
    "target_stack": DEFAULT_TARGET_STACK_NAME_OR_ID,
    "verbose": False,
    "token": None,
}

# --- Helper Functions ---

def print_message(level: str, message: str) -> None:
    """Prints a formatted message to the console."""
    level_map = {
        "INFO": f"{Colors.BLUE}[INFO]    {Colors.RESET}",
        "SUCCESS": f"{Colors.GREEN}[SUCCESS] {Colors.RESET}",
        "WARNING": f"{Colors.YELLOW}[WARNING] {Colors.RESET}",
        "ERROR": f"{Colors.RED}[ERROR]   {Colors.RESET}",
        "DEBUG": f"{Colors.MAGENTA}[DEBUG]   {Colors.RESET}",
        "HEADER": f"{Colors.CYAN}{Colors.BOLD}=== ",
        "STEP": f"{Colors.YELLOW}{Colors.BOLD}--- ",
    }
    prefix = level_map.get(level.upper(), "")
    
    if level.upper() == "DEBUG" and not CONFIG["verbose"]:
        return

    output_stream = sys.stderr if level.upper() == "ERROR" else sys.stdout
    
    if level.upper() in ["HEADER", "STEP"]:
        print(f"{prefix}{message}{Colors.RESET}", file=output_stream)
    else:
        print(f"{prefix}{message}", file=output_stream)


def show_progress_bar(
    current: int, total: int, action_message: str = "Processing"
) -> None:
    """Displays or updates a simple text progress bar."""
    if total == 0:
        print(f"{Colors.GREEN}{action_message}: 0/0 (100%){Colors.RESET}")
        return

    bar_width = 40
    percentage = (current / total) * 100
    filled_length = int(bar_width * current // total)
    
    bar = "=" * filled_length
    if filled_length < bar_width and current != total :
        bar += ">"
    bar += " " * (bar_width - filled_length - (1 if filled_length < bar_width and current != total else 0) )

    sys.stdout.write(
        f"\r{Colors.GREEN}{action_message}: [{bar}] {percentage:.1f}% ({current}/{total}){Colors.RESET}"
    )
    sys.stdout.flush()
    if current == total:
        sys.stdout.write("\n")
        sys.stdout.flush()

def ask_for_input(prompt_message: str, var_desc: str, is_secret: bool = False) -> str:
    """Prompts the user for input."""
    prompt = f"{Colors.YELLOW}{prompt_message}:{Colors.RESET} "
    if is_secret:
        value = getpass.getpass(prompt)
    else:
        value = input(prompt)
    
    if not value:
        print_message("WARNING", f"{var_desc} 未提供。腳本可能無法正常運作。")
    return value

def validate_and_normalize_url(url: str) -> Optional[str]:
    """Validates URL format and removes trailing slash."""
    if not url.startswith(("http://", "https://")):
        print_message("ERROR", f"Portainer URL '{Colors.BOLD}{url}{Colors.RESET}' 格式無效。應以 http:// 或 https:// 開頭。")
        return None
    return url.rstrip("/")

# --- Portainer API Functions ---

def get_portainer_token() -> bool:
    """Authenticates with Portainer and retrieves a JWT token."""
    print_message("STEP", "正在從 Portainer 獲取認證 Token...")
    api_url = f"{CONFIG['portainer_url']}/api/auth"
    payload = {
        "username": CONFIG["portainer_username"],
        "password": CONFIG["portainer_password"],
    }
    headers = {"Content-Type": "application/json"}

    try:
        response = requests.post(api_url, json=payload, headers=headers, timeout=10)
        response.raise_for_status()  # Raises HTTPError for bad responses (4XX or 5XX)
        
        token_data = response.json()
        CONFIG["token"] = token_data.get("jwt")

        if not CONFIG["token"]:
            print_message("ERROR", "從 Portainer API 回應中提取 Token 失敗。")
            print_message("DEBUG", f"Portainer 回應: {response.text}")
            return False
        
        print_message("SUCCESS", "成功獲取 Portainer Token！")
        # Securely clear password from memory after use
        CONFIG["portainer_password"] = "" 
        return True

    except requests.exceptions.HTTPError as e:
        print_message("ERROR", f"獲取 Portainer Token 失敗！HTTP 狀態碼: {Colors.BOLD}{e.response.status_code}{Colors.RESET}")
        if e.response.status_code == 401:
            print_message("ERROR", "請檢查你的 Portainer 使用者名稱和密碼是否正確。")
        try:
            error_details = e.response.json()
            print_message("DEBUG", f"Portainer 錯誤詳情: {error_details}")
        except json.JSONDecodeError:
            print_message("DEBUG", f"Portainer 回應 (非 JSON): {e.response.text}")
        return False
    except requests.exceptions.RequestException as e:
        print_message("ERROR", f"無法連接到 Portainer URL: {Colors.BOLD}{CONFIG['portainer_url']}{Colors.RESET}。錯誤: {e}")
        return False

def get_stacks() -> Optional[List[Dict[str, Any]]]:
    """Fetches stacks from Portainer."""
    endpoint_id = CONFIG["portainer_endpoint_id"]
    target_stack = CONFIG["target_stack"]
    
    if target_stack:
        print_message("INFO", f"正在從 Endpoint ID: {endpoint_id} 獲取 Stack: {Colors.BOLD}{target_stack}{Colors.RESET}...")
    else:
        print_message("INFO", f"正在從 Endpoint ID: {endpoint_id} 獲取所有 Stacks...")

    api_url = f"{CONFIG['portainer_url']}/api/endpoints/{endpoint_id}/stacks"
    headers = {"Authorization": f"Bearer {CONFIG['token']}"}

    try:
        response = requests.get(api_url, headers=headers, timeout=15)
        response.raise_for_status()
        all_stacks = response.json()

        if not isinstance(all_stacks, list):
            print_message("ERROR", "從 Portainer API 獲取的 Stacks 格式不正確 (非列表)。")
            print_message("DEBUG", f"Portainer 回應: {all_stacks}")
            return None

        if target_stack:
            found_stacks = []
            for stack in all_stacks:
                if str(stack.get("Id", "")) == target_stack or stack.get("Name", "") == target_stack:
                    found_stacks.append(stack)
            
            if not found_stacks:
                print_message("WARNING", f"在 Endpoint ID {endpoint_id} 中找不到名為或 ID 為 '{Colors.BOLD}{target_stack}{Colors.RESET}' 的 Stack。")
                return [] # Return empty list if specific stack not found
            return found_stacks
        return all_stacks

    except requests.exceptions.HTTPError as e:
        print_message("ERROR", f"獲取 Stacks 列表失敗！HTTP 狀態碼: {Colors.BOLD}{e.response.status_code}{Colors.RESET}")
        try:
            print_message("DEBUG", f"Portainer 錯誤詳情: {e.response.json()}")
        except json.JSONDecodeError:
            print_message("DEBUG", f"Portainer 回應 (非 JSON): {e.response.text}")
        return None
    except requests.exceptions.RequestException as e:
        print_message("ERROR", f"請求 Stacks 列表時網路錯誤或無法連接到 Portainer。錯誤: {e}")
        return None

def get_stack_details(stack_id: int) -> Optional[Dict[str, Any]]:
    """Fetches detailed information for a specific stack."""
    print_message("DEBUG", f"正在獲取 Stack ID: {stack_id} 的詳細資訊...")
    api_url = f"{CONFIG['portainer_url']}/api/stacks/{stack_id}"
    headers = {"Authorization": f"Bearer {CONFIG['token']}"}

    try:
        response = requests.get(api_url, headers=headers, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.exceptions.HTTPError as e:
        print_message("ERROR", f"獲取 Stack ID: {stack_id} 的詳細資訊失敗！HTTP 狀態碼: {Colors.BOLD}{e.response.status_code}{Colors.RESET}")
        try:
            print_message("DEBUG", f"Portainer 錯誤詳情: {e.response.json()}")
        except json.JSONDecodeError:
            print_message("DEBUG", f"Portainer 回應 (非 JSON): {e.response.text}")
        return None
    except requests.exceptions.RequestException as e:
        print_message("ERROR", f"請求 Stack ID {stack_id} 詳細資訊時網路錯誤。錯誤: {e}")
        return None

def update_stack_and_pull_image(stack_id: int, endpoint_id: int, stack_details: Dict[str, Any]) -> bool:
    """Updates a stack in Portainer, instructing it to re-pull images."""
    stack_name = stack_details.get("Name", f"ID {stack_id}")
    stack_type = stack_details.get("Type") # 1: Compose, 2: Swarm, 3: Kubernetes

    print_message("INFO", f"準備更新 Stack: {Colors.BOLD}{stack_name}{Colors.RESET} (ID: {stack_id}, Type: {stack_type})...")

    api_url = f"{CONFIG['portainer_url']}/api/stacks/{stack_id}?endpointId={endpoint_id}"
    headers = {
        "Authorization": f"Bearer {CONFIG['token']}",
        "Content-Type": "application/json",
    }

    # Construct payload - This is critical and might need adjustments based on Portainer version/stack type
    payload: Dict[str, Any] = {}
    prune_services = False # Default

    if stack_type in [1, 2]: # Docker Compose (1) or Swarm (2)
        stack_file_content = stack_details.get("StackFileContent", "")
        env_vars = stack_details.get("Env", []) # Ensure Env is a list

        if not stack_file_content and stack_type == 1: # For Type 1, StackFileContent is usually expected
             print_message("WARNING", f"Stack {stack_name} (ID: {stack_id}) 的 StackFileContent 為空。這可能是一個從 Git 部署的 Stack，或者存在問題。")
        
        payload = {
            "StackFileContent": stack_file_content,
            "Env": env_vars if isinstance(env_vars, list) else [], # Ensure it's a list
            "PullImage": True,
            "PruneServices": prune_services,
        }
        if stack_type == 2 : # Swarm specific, if any. Often the same payload as compose works.
            print_message("INFO", "為 Swarm Stack (Type 2) 準備 Payload。此更新方式主要針對 Compose 最佳化。")

    else: # Fallback for Kubernetes or unknown types
        print_message("WARNING", f"Stack {stack_name} (ID: {stack_id}) 是未知或目前不支持精細控制的類型 (Type: {stack_type})。將嘗試通用更新請求 (僅 PullImage: true)...")
        payload = {"PullImage": True} # Minimal payload

    print_message("DEBUG", f"將使用以下 Payload 更新 Stack ID {stack_id}:\n{json.dumps(payload, indent=2)}")

    try:
        response = requests.put(api_url, json=payload, headers=headers, timeout=180) # Longer timeout for redeploy
        # Portainer API for stack update (PUT) typically returns 200 OK or 204 No Content
        if response.status_code == 200 or response.status_code == 204:
            print_message("SUCCESS", f"Stack {Colors.BOLD}{stack_name}{Colors.RESET} (ID: {stack_id}) 已成功觸發更新 (重新拉取映像並重新部署)！")
            return True
        else:
            response.raise_for_status() # Will raise HTTPError for other non-200/204 codes
            return False # Should not be reached if raise_for_status works
            
    except requests.exceptions.HTTPError as e:
        print_message("ERROR", f"更新 Stack {Colors.BOLD}{stack_name}{Colors.RESET} (ID: {stack_id}) 失敗！HTTP 狀態碼: {Colors.BOLD}{e.response.status_code}{Colors.RESET}")
        try:
            error_details = e.response.json()
            err_msg = error_details.get("message", error_details.get("details", str(error_details)))
            print_message("ERROR", f"Portainer 錯誤訊息: {err_msg}")
            print_message("DEBUG", f"Portainer 完整錯誤詳情: {error_details}")
        except json.JSONDecodeError:
            print_message("DEBUG", f"Portainer 回應 (非 JSON): {e.response.text}")
        return False
    except requests.exceptions.RequestException as e:
        print_message("ERROR", f"更新 Stack {Colors.BOLD}{stack_name}{Colors.RESET} (ID: {stack_id}) 時網路錯誤。錯誤: {e}")
        return False

# --- Main Logic ---

def main():
    """Main execution flow of the script."""
    parser = argparse.ArgumentParser(
        description="Portainer Stack Updater: Re-pulls images and redeploys stacks.",
        formatter_class=argparse.RawTextHelpFormatter,
        epilog=f"""
環境變數 (優先於提示輸入，但低於命令行參數):
  {Colors.CYAN}PORTAINER_URL{Colors.RESET}         Portainer 服務的 URL
  {Colors.CYAN}PORTAINER_USERNAME{Colors.RESET}    Portainer 使用者名稱
  {Colors.CYAN}PORTAINER_PASSWORD{Colors.RESET}    Portainer 密碼
  {Colors.CYAN}PORTAINER_ENDPOINT_ID{Colors.RESET} Portainer Endpoint ID (預設: {DEFAULT_ENDPOINT_ID})

範例:
  python {sys.argv[0]} -u http://localhost:9000 -U admin -e 1 my_awesome_stack
  PORTAINER_PASSWORD='mypass' python {sys.argv[0]} --url https://portainer.example.com --username myuser --stack 123
  python {sys.argv[0]} # (將會提示輸入所有必要資訊)
"""
    )
    parser.add_argument(
        "-u", "--url", help="Portainer 服務的 URL。"
    )
    parser.add_argument(
        "-U", "--username", help="Portainer 使用者名稱。"
    )
    parser.add_argument(
        "-P", "--password", help="Portainer 密碼 (建議使用環境變數或提示輸入)。"
    )
    parser.add_argument(
        "-e", "--endpoint-id", type=int, help=f"Portainer Endpoint ID (預設: {DEFAULT_ENDPOINT_ID})。"
    )
    parser.add_argument(
        "-s", "--stack", help="要更新的特定 Stack 的名稱或 ID。如果未提供，則更新所有 Stacks。"
    )
    parser.add_argument(
        "-v", "--verbose", action="store_true", help="啟用詳細輸出 (Debug 訊息)。"
    )
    parser.add_argument(
        "stack_name_or_id_pos", nargs="?", default=None,
        help="要更新的特定 Stack 的名稱或 ID (位置參數，如果 -s 未使用)。"
    )
    args = parser.parse_args()

    # --- Populate Configuration (Priority: Args > Env Vars > Interactive Prompts) ---
    CONFIG["verbose"] = args.verbose

    print_message("HEADER", "Portainer Stack Updater (Python Version)")
    print("--------------------------------------------------")
    print_message("STEP", "正在設定腳本參數...")

    CONFIG["portainer_url"] = args.url or os.getenv("PORTAINER_URL") or \
        ask_for_input("請輸入 Portainer URL (例如 http://localhost:9000)", "Portainer URL")
    
    validated_url = validate_and_normalize_url(CONFIG["portainer_url"])
    if not validated_url:
        sys.exit(1)
    CONFIG["portainer_url"] = validated_url

    CONFIG["portainer_username"] = args.username or os.getenv("PORTAINER_USERNAME") or \
        ask_for_input("請輸入 Portainer 使用者名稱", "Portainer 使用者名稱")

    CONFIG["portainer_password"] = args.password or os.getenv("PORTAINER_PASSWORD") or \
        ask_for_input("請輸入 Portainer 密碼", "Portainer 密碼", is_secret=True)
    
    env_endpoint_id = os.getenv("PORTAINER_ENDPOINT_ID")
    CONFIG["portainer_endpoint_id"] = args.endpoint_id or \
        (int(env_endpoint_id) if env_endpoint_id and env_endpoint_id.isdigit() else None) or \
        DEFAULT_ENDPOINT_ID
    
    CONFIG["target_stack"] = args.stack or args.stack_name_or_id_pos or os.getenv("PORTAINER_TARGET_STACK") or \
        DEFAULT_TARGET_STACK_NAME_OR_ID
    # No interactive prompt for target_stack, default is all.

    print_message("DEBUG", f"最終配置 (密碼已隱藏): URL={CONFIG['portainer_url']}, User={CONFIG['portainer_username']}, EndpointID={CONFIG['portainer_endpoint_id']}, TargetStack='{CONFIG['target_stack']}'")

    # --- Main Script Logic ---
    if not get_portainer_token():
        print_message("ERROR", "無法獲取 Portainer Token。腳本終止。")
        sys.exit(1)

    stacks_to_update = get_stacks()

    if stacks_to_update is None: # API call failed
        print_message("ERROR", "無法獲取 Stacks 列表。腳本終止。")
        sys.exit(1)
    
    if not stacks_to_update:
        print_message("INFO", "沒有找到符合條件的 Stacks 需要更新。")
        sys.exit(0)

    print_message("STEP", f"找到 {len(stacks_to_update)} 個 Stacks 需要處理。")
    
    successful_updates = 0
    failed_updates = 0
    total_stacks = len(stacks_to_update)

    for index, stack_summary in enumerate(stacks_to_update):
        stack_id = stack_summary.get("Id")
        stack_name = stack_summary.get("Name", f"ID {stack_id}")
        
        show_progress_bar(index, total_stacks, f"處理 Stack: {Colors.BOLD}{stack_name}{Colors.RESET}")

        if not stack_id:
            print_message("WARNING", f"Stack '{stack_name}' 缺少 ID，跳過。")
            failed_updates += 1
            continue

        stack_details = get_stack_details(stack_id)
        if not stack_details:
            print_message("WARNING", f"無法獲取 Stack '{stack_name}' (ID: {stack_id}) 的詳細資訊，跳過更新。")
            failed_updates += 1
            continue
        
        # Add a small delay to avoid overwhelming the API, and for progress bar visibility
        time.sleep(0.1) 

        if update_stack_and_pull_image(stack_id, stack_details.get("EndpointId", CONFIG["portainer_endpoint_id"]), stack_details):
            successful_updates += 1
        else:
            failed_updates += 1
        
        # Ensure progress bar for the last item is fully displayed before summary
        if index == total_stacks -1 :
            show_progress_bar(index + 1, total_stacks, f"處理 Stack: {Colors.BOLD}{stack_name}{Colors.RESET}")


    print("\n--------------------------------------------------")
    print_message("HEADER", "更新完成總結")
    print_message("SUCCESS", f"成功更新的 Stacks 數量: {successful_updates}")
    if failed_updates > 0:
        print_message("ERROR", f"更新失敗的 Stacks 數量: {failed_updates}")
    else:
        print_message("INFO", f"更新失敗的 Stacks 數量: {failed_updates}")
    print("--------------------------------------------------")

    if failed_updates > 0:
        sys.exit(1) # Exit with error code if any stack failed

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print_message("\nINFO", "腳本被使用者中斷。")
        sys.exit(130) # Standard exit code for Ctrl+C
    except Exception as e:
        print_message("ERROR", f"發生未預期的錯誤: {e}")
        if CONFIG.get("verbose"):
            import traceback
            traceback.print_exc()
        sys.exit(1)