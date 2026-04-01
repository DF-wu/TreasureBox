#!/usr/bin/env python3
"""
Camoufox template for high-protection sites.
Anti-detection Firefox automation with human-like behavior.
"""
import random
import time


def scrape_with_camoufox(
    url: str,
    proxy: dict | None = None,
    humanize: bool = True,
    wait_for: str = "networkidle",
    screenshot: str | None = None,
) -> str:
    """Scrape a URL using Camoufox anti-detection browser.
    
    Args:
        url: Target URL
        proxy: Proxy config dict {"server": "...", "username": "...", "password": "..."}
        humanize: Enable human-like behavior simulation
        wait_for: Playwright wait state ("networkidle", "domcontentloaded", "load")
        screenshot: Optional path to save screenshot
    
    Returns:
        Page HTML content
    """
    from camoufox.sync_api import Camoufox
    
    kwargs = {"humanize": humanize}
    if proxy:
        kwargs["proxy"] = proxy
    
    with Camoufox(**kwargs) as browser:
        page = browser.new_page()
        page.goto(url, wait_until=wait_for)
        
        # Simulate human browsing behavior
        time.sleep(random.uniform(1, 3))
        _simulate_human(page)
        
        if screenshot:
            page.screenshot(path=screenshot, full_page=True)
        
        content = page.content()
        return content


def _simulate_human(page):
    """Add human-like interactions to avoid behavioral detection."""
    try:
        # Random mouse movement
        page.mouse.move(random.randint(100, 500), random.randint(100, 400))
        time.sleep(random.uniform(0.3, 0.8))
        
        # Scroll down a bit
        page.evaluate(f"window.scrollBy(0, {random.randint(100, 400)})")
        time.sleep(random.uniform(0.5, 1.5))
        
        # Another mouse movement
        page.mouse.move(random.randint(200, 600), random.randint(200, 500))
    except Exception:
        pass  # Non-critical, continue


def scrape_with_cf_clearance(
    target_url: str,
    proxy: dict | None = None,
) -> tuple[str, dict]:
    """Get cf_clearance cookie from Cloudflare-protected site, then return both content and cookies.
    
    Use the returned cookies with curl_cffi for subsequent fast HTTP requests.
    
    Returns:
        Tuple of (page_content, cookies_dict)
    """
    from camoufox.sync_api import Camoufox
    
    kwargs = {"humanize": True}
    if proxy:
        kwargs["proxy"] = proxy
    
    with Camoufox(**kwargs) as browser:
        page = browser.new_page()
        page.goto(target_url, wait_until="networkidle")
        
        time.sleep(random.uniform(2, 5))
        _simulate_human(page)
        
        # Extract cookies
        cookies = page.context.cookies()
        cookie_dict = {c["name"]: c["value"] for c in cookies}
        
        content = page.content()
        return content, cookie_dict


if __name__ == "__main__":
    # Example: Basic scrape
    html = scrape_with_camoufox(
        "https://bot.sannysoft.com/",
        screenshot="camoufox_test.png"
    )
    print(f"Page length: {len(html)} chars")
    
    # Example: Get Cloudflare cookies for curl_cffi reuse
    # content, cookies = scrape_with_cf_clearance("https://cf-protected.com")
    # from curl_cffi import requests
    # r = requests.get("https://cf-protected.com/api", impersonate="chrome", cookies=cookies)
