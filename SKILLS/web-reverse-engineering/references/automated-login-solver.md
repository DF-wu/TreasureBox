# Automated Login Solver

Automated login solving for sites with complex authentication flows: multi-tab login UI, modal dialogs, popup dismissal, WAF challenges, session validation, and credential injection patterns.

## Core Problem

Modern SPAs (Single Page Applications) present multiple challenges:
- Multi-step authentication flows (OAuth, email/password tabs, social login)
- Modal dialogs and announcement popups that block interaction
- WAF/bot detection (Cloudflare, Akamai) requiring real browser navigation
- Invisible CAPTCHA challenges triggered by automation signatures
- Session cookies that expire unpredictably
- SPA routing where `/login` ≠ login form rendered

## Architecture Pattern

```text
┌─────────────────────────────────────────────────────────────┐
│ 1. Navigate & WAF Pass                                      │
│    - Real browser navigation triggers CF JS execution       │
│    - Wait for WAF ready (no "verify you are human" text)    │
│    - Dismiss announcement popups automatically              │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 2. Login Shell Detection                                    │
│    - Wait for SPA render (React hydration complete)         │
│    - Detect login UI elements (buttons, cards, forms)       │
│    - Distinguish between logged-in state and login page     │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 3. Form Discovery & Interaction                             │
│    - Find email/password login entry (tabs, buttons, icons) │
│    - Click to reveal hidden form (modals, slide-in panels)  │
│    - Handle overlays blocking the form                      │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 4. Credential Injection                                     │
│    - Multiple fill strategies (Playwright fill, JS setter)  │
│    - Trigger framework events (React onChange, Vue v-model) │
│    - Wait for submit button to be enabled                   │
└────────────────┬────────────────────────────────────────────┘
                 │
┌────────────────▼────────────────────────────────────────────┐
│ 5. Session Validation                                       │
│    - Navigate to /console or dashboard                      │
│    - Intercept /api/user/self or equivalent endpoint        │
│    - Verify user profile returned (not 401/404)             │
│    - Extract user ID for API headers if needed              │
└─────────────────────────────────────────────────────────────┘
```

## Implementation Strategy

### Phase 1: WAF & Site Ready Detection

**Challenge**: Modern WAF (Cloudflare, Akamai) requires real browser execution of challenge JS. Headless automation often gets blocked unless properly configured.

```python
async def wait_for_site_ready(page, timeout_ms=30000):
    """Wait for WAF challenge to pass and SPA to render."""
    await page.wait_for_load_state('domcontentloaded', timeout=timeout_ms)
    
    # Custom JS function that checks:
    # - No "verify you are human" text
    # - No visible CAPTCHA iframe
    # - Minimum interactive elements (buttons, links)
    site_ready_js = """() => {
        const text = document.body?.innerText || '';
        const blocked = /请进行验证|为了更好的访问体验|访问受限|Access denied|verify you are human/i.test(text);
        if (blocked) return false;
        
        const captcha = document.querySelector('iframe[src*="captcha"], .nc-container');
        if (captcha && captcha.getBoundingClientRect().width > 0) return false;
        
        // Check for minimum interactive elements
        const buttons = [...document.querySelectorAll('button')].filter(isVisible);
        return buttons.length >= 2;
    }"""
    
    await page.wait_for_function(site_ready_js, timeout=timeout_ms)
```

**Key insight**: WAF cookies (e.g., `acw_tc`, `acw_sc__v2`, `cdn_sec_tc`) are set ONLY after CF JS runs. You cannot inject them from a previous session — they're bound to the challenge solution.

### Phase 2: Popup & Modal Dismissal

**Challenge**: Announcement modals, cookie consent banners, and promotional popups block login form interaction.

**Strategy 1: Proactive MutationObserver (Recommended)**

Inject a script on page load that auto-dismisses popups as they appear:

```javascript
// Injected as page.add_init_script()
const dismissLoop = () => {
    const modals = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
    for (const modal of modals) {
        // Skip if modal contains login form
        if (modal.querySelector('form.semi-form, #username, input[type="password"]')) {
            continue;
        }
        
        // Try various close button patterns
        const closeBtn = modal.querySelector(
            'button.semi-modal-close, button[aria-label="close"], ' +
            '.semi-modal-header button, .semi-modal-footer button'
        );
        if (closeBtn && isVisible(closeBtn)) {
            closeBtn.click();
        }
    }
};

// Auto-dismiss on DOM mutations
const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(dismissLoop, 300);
});
observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['class', 'style', 'aria-modal']
});
```

**Strategy 2: Playwright Reactive Dismissal**

```python
async def dismiss_popups(page):
    """Manually trigger popup dismissal via Playwright."""
    closed = 0
    for _ in range(5):
        modals = page.locator('[role="dialog"][aria-modal="true"]')
        count = await modals.count()
        
        for i in reversed(range(count)):
            modal = modals.nth(i)
            
            # Skip login forms
            if await modal.locator('form.semi-form, input[type="password"]').count() > 0:
                continue
            
            # Try text-based button matching first
            for pattern in [r'关闭公告|Close', r'今日关闭|Dismiss']:
                btn = modal.get_by_role('button', name=re.compile(pattern, re.I))
                try:
                    if await btn.first.is_visible():
                        await btn.first.click(timeout=3000)
                        closed += 1
                        break
                except:
                    continue
            else:
                # Fallback to generic close button
                close_btn = modal.locator('button.semi-modal-close, button[aria-label="close"]')
                if await close_btn.first.is_visible():
                    await close_btn.first.click(timeout=3000)
                    closed += 1
        
        if closed == 0:
            break
        await asyncio.sleep(0.4)
    
    return closed
```

**Trade-off**: MutationObserver is fire-and-forget (no need to poll), but Playwright dismissal gives explicit control and error handling.

### Phase 3: Login Form Discovery

**Challenge**: Email/password form may be hidden behind:
- Tab selection (OAuth, Email, Phone tabs)
- Icon buttons ("Sign in with Email" card)
- Collapsed sections

**Multi-strategy approach**:

```python
async def open_email_login_form(page, timeout_ms=60000):
    """Progressive form discovery with fallback strategies."""
    
    # Strategy 1: Direct selector match
    username_selectors = ['#username', 'input[name="username"]', 'input[type="email"]']
    for selector in username_selectors:
        input_field = page.locator(selector).first
        try:
            if await input_field.is_visible():
                return  # Form already visible
        except:
            continue
    
    # Strategy 2: Click icon-based entry buttons
    entry_selectors = [
        '.semi-card button:has(.semi-icon-mail)',
        '.semi-card button:has([aria-label="mail"])',
        'button:has(.semi-icon-mail):not(form button)'  # Exclude submit buttons
    ]
    for selector in entry_selectors:
        buttons = page.locator(selector)
        for i in range(await buttons.count()):
            btn = buttons.nth(i)
            if await btn.is_visible():
                await btn.click(timeout=5000)
                await asyncio.sleep(1)
                if await is_form_visible(page):
                    return
    
    # Strategy 3: Tab switching
    tabs = page.locator('.semi-card .semi-tabs-tab')
    for i in range(await tabs.count()):
        tab = tabs.nth(i)
        if await tab.is_visible():
            await tab.click(timeout=3000)
            await asyncio.sleep(0.5)
            if await is_form_visible(page):
                return
    
    # Strategy 4: JS-based greedy search
    # Clicks all potential entry points and checks DOM after each
    result = await page.evaluate("""() => {
        const entrySelectors = [
            '.semi-card button:has(.semi-icon-mail)',
            'button:has([aria-label="mail"])'
        ];
        for (const selector of entrySelectors) {
            for (const btn of document.querySelectorAll(selector)) {
                if (isVisible(btn) && !btn.closest('form')) {
                    btn.click();
                    if (document.querySelector('#username, input[name="username"]')) {
                        return true;
                    }
                }
            }
        }
        return false;
    }""")
    
    if not result:
        raise TimeoutError("Cannot open email login form")
```

**Debugging tip**: When form discovery fails, log the page state:

```python
state = await page.evaluate("""() => ({
    title: document.title,
    bodySnippet: document.body?.innerText.slice(0, 300),
    hasSemiCard: !!document.querySelector('.semi-card'),
    mailEntryCount: document.querySelectorAll('button:has(.semi-icon-mail)').length,
    usernameVisible: !!document.querySelector('#username'),
    modalVisible: !!document.querySelector('[role="dialog"][aria-modal="true"]'),
    buttons: [...document.querySelectorAll('button')]
        .filter(isVisible)
        .map(b => b.innerText.slice(0, 40))
})""")
print(f"[DEBUG] Page state: {state}")
```

### Phase 4: Credential Injection & Framework Event Handling

**Challenge**: React/Vue forms validate on `onChange`/`onInput` events. Playwright's `fill()` may not trigger these, leaving submit button disabled.

**Multi-layer fill strategy**:

```python
async def set_input_value(locator, value, timeout_ms=5000):
    """Fill input with framework event triggering."""
    
    # Step 1: Focus the input
    try:
        await locator.click(timeout=min(timeout_ms, 5000))
    except:
        await locator.click(force=True, timeout=min(timeout_ms, 5000))
    
    # Step 2: Try native Playwright fill
    try:
        await locator.fill(value, timeout=timeout_ms)
        # Verify value was set
        if await locator.input_value(timeout=2000) == value:
            return
    except:
        pass
    
    # Step 3: JS property setter + manual event dispatch (React/Vue compatible)
    await locator.evaluate("""(el, v) => {
        // Use native property setter to bypass framework getters
        const setter = Object.getOwnPropertyDescriptor(
            window.HTMLInputElement.prototype, 'value'
        )?.set;
        setter?.call(el, v);
        
        // Dispatch events that frameworks listen to
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        el.dispatchEvent(new Event('blur', { bubbles: true }));
    }""", value)
```

**Why this works**:
- React tracks input via `Object.defineProperty` on `HTMLInputElement.prototype.value`
- Direct `el.value = x` may not trigger framework's onChange
- Calling the native setter + dispatching `input`/`change` events ensures framework state update

### Phase 5: Session Validation via API Interception

**Challenge**: After form submission, you need to verify login succeeded. Checking URL (`/console`) is insufficient — user might be redirected but not authenticated.

**Gold standard: Intercept /api/user/self**

```python
async def verify_browser_login(page, console_url, timeout_ms=45000):
    """Navigate to console and intercept user profile API."""
    captured_profile = None
    verified = asyncio.Event()
    
    async def on_response(response):
        nonlocal captured_profile
        if '/api/user/self' not in response.url or response.status != 200:
            return
        
        try:
            payload = await response.json()
            # Handle different response formats
            data = payload.get('data') if payload.get('success') else payload
            if data and data.get('id'):
                captured_profile = data
                verified.set()
        except:
            pass
    
    page.on('response', on_response)
    
    try:
        # Navigate to console (triggers user/self request)
        await page.goto(console_url, wait_until='load', timeout=min(timeout_ms, 60000))
        await page.wait_for_load_state('networkidle', timeout=20000)
        
        # Wait for API response
        try:
            await asyncio.wait_for(verified.wait(), timeout=timeout_ms / 1000)
        except TimeoutError:
            pass
    finally:
        page.remove_listener('response', on_response)
    
    if captured_profile:
        user_id = captured_profile.get('id')
        print(f"[SUCCESS] Login verified, user_id={user_id}")
        return captured_profile
    else:
        print(f"[FAILED] /api/user/self returned no user profile")
        return None
```

**Alternative validation methods** (less reliable):

1. **Session cookie presence**: `await page.context.cookies()` → check for `session` cookie
   - ⚠️ Problem: Stale cookies can exist even when logged out
   
2. **URL pattern matching**: Check if redirected to `/console` or `/dashboard`
   - ⚠️ Problem: Some sites redirect to console even when not authenticated, showing login modal
   
3. **DOM element presence**: Check for username display, profile avatar, or logout button
   - ⚠️ Problem: SPA may render skeleton UI before auth check completes

**Best practice**: Always use API interception for definitive validation.

## Session Cookie Management

### Problem: Stale Credentials vs Code Bugs

**Common failure mode**: You inject a session cookie, hit `/api/user/self`, get 401, assume your code is broken — but the cookie was just expired.

**Isolation strategy**:

```python
async def check_session_validity(page, api_user_endpoint):
    """Verify session BEFORE attempting any authed operations."""
    try:
        response = await page.goto(api_user_endpoint, wait_until='domcontentloaded', timeout=15000)
        if response.status == 200:
            data = await response.json()
            if data.get('id'):
                return True
        return False
    except:
        return False

async def login_with_fallback(page, account_config):
    """Try session cookie first, fall back to credentials."""
    if account_config.session_cookie:
        await page.context.add_cookies([account_config.session_cookie])
        await page.goto(account_config.dashboard_url, wait_until='load')
        
        if await check_session_validity(page, account_config.api_user_endpoint):
            print("[INFO] Session cookie still valid")
            return True
        else:
            print("[WARN] Session cookie expired, falling back to login")
    
    # Fall back to email/password login
    return await login_with_email_form(page, account_config.email, account_config.password)
```

**Production pattern**: Prioritize email/password login over stale cookie injection.

```python
if account.has_login_credentials():
    print("[INFO] Attempting email/password login (priority)")
    result = await login_with_credentials(account.email, account.password)
    if result:
        return result
    else:
        print("[FAILED] Email/password login failed, will not use stale session cookies")
        return None
else:
    # Only use session cookies if no credentials provided
    return await login_with_session_cookies(account.cookies)
```

## Browser Profile Persistence

**Trade-off**: Ephemeral vs persistent browser profile.

### Ephemeral Profile (Recommended for CI/CD)

```python
from cloakbrowser import launch_async

browser = await launch_async(headless=True, humanize=True)
context = await browser.new_context()
page = await context.new_page()
# ... perform login ...
await context.close()
await browser.close()
```

**Pros**: Clean state every run, no stale data  
**Cons**: Must log in every time (hits rate limits)

### Persistent Profile (Recommended for Scheduled Tasks)

```python
from cloakbrowser import launch_persistent_context_async

profile_dir = Path('.browser_profiles') / provider / account_name
profile_dir.mkdir(parents=True, exist_ok=True)

context = await launch_persistent_context_async(
    str(profile_dir),
    headless=True,
    humanize=True
)
page = await context.new_page()
# Login persists across sessions
await context.close()
```

**Pros**: Skip login if session still valid (faster, less detectable)  
**Cons**: Profile can grow large, harder to debug state issues

**Best practice**: Use persistent profile for scheduled tasks (daily checkins), ephemeral for one-off scripts.

## Anti-Detection Checklist

Even with correct logic, automation is detectable without stealth configuration:

- ✅ Use `cloakbrowser` or `playwright-stealth` to patch webdriver signatures
- ✅ Enable `humanize` mode for realistic mouse/keyboard timing
- ✅ Set realistic viewport: `{'width': 1920, 'height': 1080}`
- ✅ Consistent locale/timezone: `locale='en-US', timezone_id='America/New_York'`
- ✅ Proxy with matching geo (US proxy → US locale)
- ✅ Avoid headless mode if CAPTCHA appears frequently
- ✅ Warm up the site: Navigate to homepage first, wait 3-5s, then go to login page

**CloakBrowser configuration**:

```python
launch_kwargs = {
    'headless': True,
    'humanize': True,
    'human_preset': 'careful',  # Adds realistic delays
    'viewport': {'width': 1920, 'height': 1080},
}

# Optional: Use local Chromium binary to avoid shared browser fingerprint
if os.getenv('CLOAKBROWSER_BINARY_PATH'):
    os.environ['CLOAKBROWSER_BINARY_PATH'] = '/path/to/chrome'

context = await launch_persistent_context_async(profile_dir, **launch_kwargs)
```

## Full Reference Implementation

See `anyrouter-check-in` project for production-grade implementation:
- `utils/browser.py`: Complete login flow with all strategies
- `utils/popups.py`: MutationObserver-based popup dismissal
- `utils/proxy.py`: Proxy configuration for Playwright + httpx
- `checkin.py`: Main orchestration with error handling

Key functions:
- `navigate_login_page()`: WAF pass + SPA render detection
- `login_with_email_form()`: Multi-strategy form discovery
- `verify_browser_login()`: API interception validation
- `setup_popup_guard()`: Proactive popup dismissal

## Common Failure Patterns & Fixes

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| Form never appears | Modal popup blocking view | Add `dismiss_popups()` before form discovery |
| Submit button stays disabled | Framework events not triggered | Use JS property setter + event dispatch |
| Login succeeds in UI but 401 on API | Session cookie not set yet | Wait for `has_session_cookie()` before API calls |
| WAF blocks every time | Browser fingerprint too obvious | Enable `humanize`, use residential proxy, add warmup |
| CAPTCHA appears in CI but not locally | Headless detection | Try `headless=False` or `--disable-blink-features=AutomationControlled` |
| "Already logged in" but can't access API | Stale session cookie | Call session validation endpoint first |
| Form found but click fails | Element not in viewport | Add `scroll_into_view_if_needed()` before click |

## Production Runbook

1. **Profile Setup**:
   - Persistent profile per (provider, account) pair
   - Profile directory: `.browser_profiles/{provider}/{account_name}`
   - Clean profiles on credential rotation

2. **Login Flow**:
   ```
   Navigate homepage → wait 3s → navigate /login → 
   dismiss popups → open form → fill credentials → 
   submit → wait for /console → intercept /api/user/self → 
   extract user_id → return cookies + user_id
   ```

3. **Session Reuse**:
   - First run: Full login flow
   - Subsequent runs: Check if `/api/user/self` returns 200
   - If session valid, skip login
   - If session expired, re-login

4. **Error Handling**:
   - Screenshot on failure (if `DEBUG_MODE=true`)
   - Retry with fresh profile if login fails
   - Log page state (title, body snippet, button labels) for debugging
   - Don't retry with same stale cookie — fall back to credentials

5. **Notification**:
   - Only notify on first failure or balance change
   - Attach screenshots in debug mode
   - Hash balance to detect changes (avoid spam)

## Related Playbooks

- `authenticated-session-mapping.md` — Map authed API after login succeeds
- `anti-detection.md` — Browser fingerprinting evasion
- `cloudflare-bypass.md` — WAF-specific techniques
