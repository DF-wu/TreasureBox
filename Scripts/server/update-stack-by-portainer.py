#!/usr/bin/env python3
# -*- coding: utf-8 -*-

# ==============================================================================
# Script Name: portainer_stack_updater.py
# Description: Updates Portainer stacks by re-pulling images and redeploying
#              via Portainer API. Supports interactive mode and CLI arguments.
# Author:      Assistant (for df)
# Version:     1.0.0
# Depends:     requests
# ==============================================================================

import argparse
import getpass
import json
import os
import sys
import time
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests
    from requests.exceptions import RequestException
except ImportError:
    print(
        "錯誤：必要的 'requests' 函式庫未安裝。請執行 'pip install requests' 來安裝它。",
        file=sys.stderr,
    )
    sys.exit(1)

# --- Style Definitions (ANSI Escape Codes for Colors) ---
# For cross-platform color, consider using the 'colorama' library:
# from colorama import init, Fore, Style
# init(autoreset=True) # Initialize colorama
# Then use Fore.GREEN, Style.RESET_ALL etc.
# For simplicity, using direct ANSI codes here. They work on most modern terminals.
C_RESET = "\033[0m"
C_BOLD = "\033[1m"
C_RED = "\033[0;31m"
C_GREEN = "\033[0;32m"
C_YELLOW = "\033[0;33m"
C_BLUE = "\033[0;34m"
C_MAGENTA = "\033[0;35m"
C_CYAN = "\033[0;36m"

# --- Configuration Defaults ---
DEFAULT_ENDPOINT_ID = 1
SCRIPT_VERBOSE = False # Global verbose flag

# --- Helper Functions ---

def print_message(
    level: str, message: str, verbose_only: bool = False
) -> None:
    """
    Prints a formatted message to the console.
    """
    if verbose_only and not SCRIPT_VERBOSE:
        return

    prefix = ""
    color = C_RESET
    stream = sys.stdout

    if level.upper() == "INFO":
        color = C_BLUE
        prefix = "[INFO]    "
    elif level.upper() == "SUCCESS":
        color = C_GREEN
        prefix = "[SUCCESS] "
    elif level.upper() == "WARNING":
        color = C_YELLOW
        prefix = "[WARNING] "
    elif level.upper() == "ERROR":
        color = C_RED
        prefix = "[ERROR]   "
        stream = sys.stderr
    elif level.upper() == "DEBUG":
        color = C_MAGENTA
        prefix = "[DEBUG]   "
        if not SCRIPT_VERBOSE: # Only print DEBUG if verbose is enabled
            return
    elif level.upper() == "HEADER":
        color = C_CYAN + C_BOLD
        prefix = "=== "
    elif level.upper() == "STEP":
        color = C_YELLOW + C_BOLD
        prefix = "--- "
    else: # Fallback
        prefix = f"[{level.upper()}] "


    print(f"{color}{prefix}{message}{C_RESET}", file=stream)


def ask_for_input(
    prompt_message: str, description: str, is_secret: bool = False
) -> str:
    """
    Prompts the user for input.
    """
    full_prompt = f"{C_YELLOW}{prompt_message}:{C_RESET} "
    value = ""
    if is_secret:
        value = getpass.getpass(full_prompt)
    else:
        value = input(full_prompt)

    if not value:
        print_message(
            "WARNING", f"{description} 未提供。腳本可能無法正常運作。"
        )
    return value


def validate_and_normalize_url(url: Optional[str]) -> Optional[str]:
    """
    Validates the URL format and removes a trailing slash.
    Returns normalized URL or None if invalid.
    """
    if not url:
        return None
    if not (url.startswith("http://") or url.startswith("https://")):
        print_message(
            "ERROR",
            f"Portainer URL '{C_BOLD}{url}{C_RESET}' 格式無效。應以 http:// 或 https:// 開頭。",
        )
        return None
    return url.rstrip("/")


def show_progress_bar(
    current: int, total: int, message: str = "處理中", bar_length: int = 40
) -> None:
    """
    Displays or updates a console progress bar.
    """
    if total == 0:
        print(f"{C_GREEN}{message}: 0/0 (100%){C_RESET}")
        return

    fraction = current / total
    filled_length = int(fraction * bar_length)
    
    # Construct the bar string
    if filled_length >= bar_length:
        bar = "=" * bar_length
    elif filled_length < 0: # Should not happen
        bar = " " * bar_length
    else:
        bar = "=" * filled_length + ">" + " " * (bar_length - filled_length -1)


    ending = "\r" if current < total else "\n"
    print(
        f"{C_GREEN}{message}: [{bar}] {int(fraction * 100)}% ({current}/{total}){C_RESET}",
        end=ending,
        flush=True,
    )

# --- Portainer API Client ---

class PortainerAPI:
    """
    A client for interacting with the Portainer API.
    """

    def __init__(
        self,
        base_url: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
        endpoint_id: int = DEFAULT_ENDPOINT_ID,
    ):
        self.base_url = base_url
        self.username = username
        self._password = password # Store privately for authentication
        self.endpoint_id = endpoint_id
        self.token: Optional[str] = None
        self.session = requests.Session() # Use a session for connection pooling

    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict[str, Any]] = None,
        data: Optional[Dict[str, Any]] = None,
        is_json: bool = True,
    ) -> Tuple[Optional[Any], Optional[str]]:
        """
        Makes an HTTP request to the Portainer API.
        Returns (json_response, error_message).
        """
        headers = {"Accept": "application/json"}
        if self.token:
            headers["Authorization"] = f"Bearer {self.token}"
        if is_json and data:
            headers["Content-Type"] = "application/json"

        url = f"{self.base_url}{path}"
        print_message("DEBUG", f"請求: {method} {url}")
        if data and SCRIPT_VERBOSE:
             # Avoid printing sensitive data like passwords in payloads if any
            debug_data = {k:v for k,v in data.items() if 'password' not in k.lower()}
            print_message("DEBUG", f"Payload: {json.dumps(debug_data, indent=2)}")


        try:
            if is_json:
                response = self.session.request(method, url, headers=headers, params=params, json=data, timeout=30)
            else: # For form data or other non-JSON data
                response = self.session.request(method, url, headers=headers, params=params, data=data, timeout=30)

            print_message("DEBUG", f"回應狀態碼: {response.status_code}")
            if SCRIPT_VERBOSE and response.content:
                try:
                    print_message("DEBUG", f"回應 Body: {response.json()}")
                except json.JSONDecodeError:
                    print_message("DEBUG", f"回應 Body (非JSON): {response.text[:200]}...")


            if not response.ok: # Check for 4xx/5xx errors
                err_msg = f"API 請求失敗 (狀態碼: {response.status_code})."
                try:
                    err_details = response.json()
                    err_msg += f" Portainer 訊息: {err_details.get('message') or err_details.get('details') or err_details.get('err','')}"
                except json.JSONDecodeError:
                    err_msg += f" 回應內容: {response.text[:200]}" # Show partial text if not JSON
                return None, err_msg

            if response.status_code == 204: # No Content
                return {}, None # Return empty dict for successful No Content

            return response.json(), None
        except RequestException as e:
            return None, f"網路請求錯誤: {e}"
        except json.JSONDecodeError:
            return None, "無法解析 API 回應為 JSON。"

    def authenticate(self) -> bool:
        """
        Authenticates with Portainer and stores the JWT token.
        """
        if not self.username or not self._password:
            print_message("ERROR", "未提供 Portainer 使用者名稱或密碼。")
            return False

        print_message("STEP", "正在從 Portainer 獲取認證 Token...")
        payload = {"username": self.username, "password": self._password}
        
        # Temporarily remove token for auth request if any previous token existed
        current_token = self.token
        self.token = None
        auth_response, error = self._request("POST", "/api/auth", data=payload)
        self.token = current_token # Restore previous token if auth failed for some reason

        if error:
            print_message("ERROR", f"認證失敗: {error}")
            if "401" in error or "Unauthorized" in error:
                 print_message("ERROR", "請檢查你的 Portainer 使用者名稱和密碼是否正確。")
            return False
        
        if auth_response and "jwt" in auth_response:
            self.token = auth_response["jwt"]
            print_message("SUCCESS", "成功獲取 Portainer Token！")
            self._password = None  # Clear password after successful authentication
            return True
        
        print_message("ERROR", "認證失敗：API 回應中未找到 JWT Token。")
        return False

    def get_stacks(self, stack_name_or_id: Optional[str] = None) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str]]:
        """
        Fetches all stacks or a specific stack by name or ID from the configured endpoint.
        """
        if not self.token:
            return None, "未認證。請先執行 authenticate()。"

        path = f"/api/endpoints/{self.endpoint_id}/stacks"
        
        if stack_name_or_id:
            print_message("INFO", f"正在從 Endpoint ID: {self.endpoint_id} 獲取 Stack: {C_BOLD}{stack_name_or_id}{C_RESET}...")
        else:
            print_message("INFO", f"正在從 Endpoint ID: {self.endpoint_id} 獲取所有 Stacks...")

        stacks_data, error = self._request("GET", path)

        if error:
            return None, f"獲取 Stacks 列表失敗: {error}"
        if not isinstance(stacks_data, list):
            return None, "獲取 Stacks 列表失敗：API 回應格式不正確 (非列表)。"

        if stack_name_or_id:
            filtered_stacks = []
            target_id_int: Optional[int] = None
            try:
                target_id_int = int(stack_name_or_id)
            except ValueError:
                pass # Not an integer, will match by name

            for stack in stacks_data:
                if target_id_int is not None and stack.get("Id") == target_id_int:
                    filtered_stacks.append(stack)
                    break # ID should be unique
                elif stack.get("Name") == stack_name_or_id:
                    filtered_stacks.append(stack)
                    break # Name should ideally be unique per endpoint
            
            if not filtered_stacks:
                print_message("WARNING", f"在 Endpoint ID {self.endpoint_id} 中找不到名為或 ID 為 '{C_BOLD}{stack_name_or_id}{C_RESET}' 的 Stack。")
            return filtered_stacks, None
        
        return stacks_data, None

    def get_stack_details(self, stack_id: int) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
        """
        Fetches detailed information for a specific stack.
        """
        if not self.token:
            return None, "未認證。請先執行 authenticate()。"

        print_message("DEBUG", f"正在獲取 Stack ID: {stack_id} 的詳細資訊...")
        path = f"/api/stacks/{stack_id}"
        details, error = self._request("GET", path)

        if error:
            return None, f"獲取 Stack ID: {stack_id} 的詳細資訊失敗: {error}"
        if not isinstance(details, dict):
             return None, f"獲取 Stack ID: {stack_id} 的詳細資訊失敗：API 回應格式不正確 (非字典)。"
        return details, None

    def update_stack(
        self, stack_id: int, stack_details: Dict[str, Any], pull_image: bool = True
    ) -> Tuple[bool, Optional[str]]:
        """
        Updates a stack, optionally re-pulling the image.
        """
        if not self.token:
            return False, "未認證。請先執行 authenticate()。"

        stack_name = stack_details.get("Name", f"ID {stack_id}")
        stack_type = stack_details.get("Type") # 1: Compose, 2: Swarm, 3: K8s

        print_message("INFO", f"準備更新 Stack: {C_BOLD}{stack_name}{C_RESET} (ID: {stack_id}, Type: {stack_type})...")

        # Construct payload: resend existing config with PullImage flag
        # This is crucial to avoid unintended changes.
        payload: Dict[str, Any] = {
            "PullImage": pull_image,
            "PruneServices": stack_details.get("PruneServices", False), # Keep existing or default to false
        }
        
        # For Compose (Type 1) and Swarm (Type 2) stacks, StackFileContent and Env are usually needed.
        if stack_type in [1, 2]: # Compose or Swarm
            payload["StackFileContent"] = stack_details.get("StackFileContent", "")
            payload["Env"] = stack_details.get("Env", [])
        elif stack_type == 3: # Kubernetes
             print_message("WARNING", f"Stack {stack_name} 是 Kubernetes Stack (Type 3)。更新邏輯可能不同，此腳本主要針對 Compose/Swarm。")
             # For K8s, the payload might be different or this operation might not be standard.
             # A generic PullImage might not be enough. We'll try with a minimal payload.
             # The API might require more specific fields for K8s stack updates.
        else:
            print_message("WARNING", f"Stack {stack_name} 是未知或目前不完全支援的類型 (Type: {stack_type})。將嘗試通用更新...")


        path = f"/api/stacks/{stack_id}"
        params = {"endpointId": self.endpoint_id} # Endpoint ID as query parameter for PUT

        updated_stack_data, error = self._request("PUT", path, params=params, data=payload)

        if error:
            return False, f"更新 Stack {stack_name} 失敗: {error}"
        
        # PUT can return 200 OK with updated stack or 204 No Content
        if updated_stack_data is not None : # Checks for both {} from 204 and actual data from 200
            print_message("SUCCESS", f"Stack {C_BOLD}{stack_name}{C_RESET} (ID: {stack_id}) 已成功觸發更新 (重新拉取映像並重新部署)！")
            return True, None
        
        # This case should ideally be caught by response.ok check in _request
        return False, f"更新 Stack {stack_name} 時發生未知錯誤。"


# --- Main Logic ---

def main():
    """
    Main function to parse arguments and orchestrate stack updates.
    """
    global SCRIPT_VERBOSE # Allow main to modify global verbose flag

    parser = argparse.ArgumentParser(
        description="透過 Portainer API 自動重新拉取映像並重新部署 Stacks。",
        formatter_class=argparse.RawTextHelpFormatter, # For better help text formatting
        epilog=f"""
環境變數 (優先於提示輸入，但低於命令行參數):
  {C_CYAN}PORTAINER_URL{C_RESET}         Portainer 服務的 URL
  {C_CYAN}PORTAINER_USERNAME{C_RESET}    Portainer 使用者名稱
  {C_CYAN}PORTAINER_PASSWORD{C_RESET}    Portainer 密碼
  {C_CYAN}PORTAINER_ENDPOINT_ID{C_RESET} Portainer Endpoint ID (預設: {DEFAULT_ENDPOINT_ID})

範例:
  python {sys.argv[0]} -u http://localhost:9000 -U admin -e 1 my_awesome_stack
  PORTAINER_PASSWORD='mypass' python {sys.argv[0]} --url https://portainer.my.domain --username myuser --stack 123
  python {sys.argv[0]} # (將會提示輸入所有必要資訊)
"""
    )
    parser.add_argument(
        "-u", "--url",
        help="Portainer 服務的 URL (例如: http://localhost:9000)。",
        metavar="URL"
    )
    parser.add_argument(
        "-U", "--username",
        help="Portainer 使用者名稱。",
        metavar="USERNAME"
    )
    parser.add_argument(
        "-P", "--password",
        help="Portainer 密碼 (建議使用環境變數或提示輸入)。",
        metavar="PASSWORD"
    )
    parser.add_argument(
        "-e", "--endpoint-id",
        type=int,
        help=f"Portainer Endpoint ID (預設: {DEFAULT_ENDPOINT_ID})。",
        metavar="ID"
    )
    parser.add_argument(
        "-s", "--stack",
        help="要更新的特定 Stack 的名稱或 ID。如果未提供，則更新所有 Stacks。",
        metavar="STACK_NAME_OR_ID"
    )
    parser.add_argument(
        "-v", "--verbose",
        action="store_true",
        help="啟用詳細輸出 (Debug 訊息)。"
    )
    parser.add_argument(
        "stack_positional", # Positional argument for stack name/ID
        nargs="?", # Makes it optional
        help="要更新的特定 Stack 的名稱或 ID (可選的位置參數)。"
    )

    args = parser.parse_args()

    if args.verbose:
        SCRIPT_VERBOSE = True

    print_message("HEADER", "Portainer Stack Updater (Python Version)")
    print("--------------------------------------------------")

    # --- Gather Configuration (Priority: Args > Env Vars > Interactive Prompts) ---
    print_message("STEP", "正在設定腳本參數...")

    portainer_url = args.url or os.environ.get("PORTAINER_URL")
    if not portainer_url:
        portainer_url = ask_for_input(
            "請輸入 Portainer URL (例如 http://localhost:9000)", "Portainer URL"
        )
    portainer_url = validate_and_normalize_url(portainer_url)
    if not portainer_url:
        sys.exit(1)

    portainer_username = args.username or os.environ.get("PORTAINER_USERNAME")
    if not portainer_username:
        portainer_username = ask_for