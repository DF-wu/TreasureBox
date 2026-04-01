#!/usr/bin/env python3
"""
curl_cffi template for TLS-fingerprint-protected sites.
Handles retries, proxy rotation, and cookie persistence.
"""
from curl_cffi import requests
import random
import time


def scrape(url: str, proxy_list: list[str] | None = None, max_retries: int = 3) -> str | None:
    """Scrape a URL with TLS fingerprint spoofing.
    
    Args:
        url: Target URL
        proxy_list: Optional list of proxy URLs for rotation
        max_retries: Max retry attempts
    
    Returns:
        Response text or None if all retries fail
    """
    session = requests.Session(impersonate="chrome")
    
    for attempt in range(max_retries):
        try:
            kwargs = {}
            if proxy_list:
                proxy = random.choice(proxy_list)
                kwargs["proxies"] = {"https": proxy, "http": proxy}
            
            r = session.get(url, timeout=30, **kwargs)
            
            if r.status_code == 200:
                return r.text
            elif r.status_code == 403:
                print(f"[Attempt {attempt+1}] 403 Forbidden - may need browser fallback")
                time.sleep(random.uniform(2, 5))
            else:
                print(f"[Attempt {attempt+1}] Status {r.status_code}")
                time.sleep(random.uniform(1, 3))
                
        except Exception as e:
            print(f"[Attempt {attempt+1}] Error: {e}")
            time.sleep(random.uniform(2, 5))
    
    return None


if __name__ == "__main__":
    # Example usage
    result = scrape("https://tls.browserleaks.com/json")
    if result:
        import json
        data = json.loads(result)
        print(f"JA3 Hash: {data.get('ja3_hash', 'N/A')}")
        print(f"JA4: {data.get('ja4', 'N/A')}")
        print(f"User-Agent: {data.get('user_agent', 'N/A')}")
