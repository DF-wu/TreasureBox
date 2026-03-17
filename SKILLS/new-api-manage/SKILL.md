---
name: new-api-manage
description: 操作 QuantumNous/new-api 的管理介面（/api/*）：使用者/渠道/令牌/模型/供應商/系統設定/訂閱/部署/效能/倍率同步 等完整管理流程。
metadata: {"clawdbot":{"requires":{"bins":["curl","jq","python3","git"]}}}
---

# new-api-manage

此 skill 用於**以 HTTP 管理介面（Gin `/api/*`）操作 new-api**。它的目標不是解釋 new-api 的轉發（OpenAI-compatible `/v1/*`）怎麼用，而是讓你能「像後台管理 UI 一樣」做所有日常維運：建立/更新渠道、管理使用者與令牌、同步模型、調整設定、查詢日誌、訂閱方案、IoNet 部署等。

本 skill 內容以 **upstream `QuantumNous/new-api` 最新 `main`** 為準（本環境對照碼：`/data/workspace/new-api-latest`，commit `8ed2ea6e`，2026-03-17）。

若你實際部署的 new-api 版本不同，請以 `GET /api/status` 的 `version` 為準，再對照你當前 checkout 的 `router/api-router.go`；因為 `/api/*` 端點會隨版本增減。

另外，本 skill 內含一份由程式自動產生的路由索引：`ROUTES.generated.md`（由 `scripts/generate_routes.py` 解析 `router/api-router.go` 產生）。當 upstream 更新時，你可以用同一支腳本重新生成，避免人工維護漏掉端點。

---

## 0. 你最常踩的坑（先讀這段）

new-api 的管理 API 有兩個很容易忽略的要求。

第一，**管理 API 的權限不是用 `sk-...`（token key）**，而是用「**Access Token**」（欄位：`users.access_token`），HTTP Header 是 `Authorization: Bearer {access_token}`。

第二，任何需要登入/權限的 `/api/*` 端點，都必須同時帶上 **`New-Api-User: {user_id}`**，且必須與登入的使用者 ID 相同；否則會 401/403。

> 這兩個條件同時滿足，才等價於「已登入」且權限正確。

---

## 1. 前置：環境變數（建議）

以「Access Token 模式」操作（最適合自動化、CI、腳本）。

```bash
export NEW_API_BASE_URL='http://127.0.0.1:3000'   # 依你的部署調整
export NEW_API_USER_ID='1'                        # 登入者 id
export NEW_API_ACCESS_TOKEN='<access_token>'      # /api/user/token 產生的 access_token
```

若你要呼叫 `TokenAuthReadOnly` 類端點（例如：查某個 token key 的用量 / log），需要準備 **token key（sk-...）**：

```bash
export NEW_API_TOKEN_KEY='sk-<token_key>'
```

如需自簽 TLS：

```bash
export NEW_API_INSECURE=true
```

如需「Session/Cookie 模式」（需要走 2FA / Codex OAuth / 安全驗證等 session 流程時）：

```bash
export NEW_API_COOKIE_JAR='/tmp/new-api.cookies'
```

（選用）你也可以把上述設定寫進 JSON 檔，讓 `scripts/newapi` 自動載入：

```bash
export NEW_API_CONFIG='skills/new-api-manage/scripts/examples/config.json.example'
```

---

（選用）若你也想在本機用程式碼反查 router/controller/struct，先設好：

```bash
export NEW_API_CODE_DIR='/data/workspace/new-api-latest'
```

## 1.5 操作安全（避免一鍵炸掉）

此 skill 的定位是「完整管理介面」，因此包含不少**不可逆**或**高風險**操作。實務上建議遵守這個節奏：

先用 `GET`/`search`/`stat` 把範圍縮小並確認 ID、當前狀態。接著要做任何 `DELETE` / 批次刪除 / 大規模同步 / 重設倍率 / 清 cache / terminate deployment 前，先在回覆裡明確寫出「你要動的目標、端點、payload」，確認 DF 允許後再執行。

高風險端點（尤其注意）：

- `POST /api/channel/:id/key`（會回傳敏感 key）
- `POST /api/token/:id/key`（會回傳敏感 token key）
- `DELETE /api/channel/:id`、`POST /api/channel/batch`、`DELETE /api/channel/disabled`
- `DELETE /api/user/:id`、`POST /api/user/manage` action=delete
- `DELETE /api/models/:id`、`DELETE /api/vendors/:id`
- `POST /api/models/sync_upstream`（覆蓋更新有可能改到既有模型 meta）
- `DELETE /api/performance/disk_cache`、`POST /api/performance/gc`
- `DELETE /api/deployments/:id`（Terminate deployment）

---

## 2. 核心工具：scripts/newapi（建議一律用它呼叫）

此 skill 內建一個薄封裝，幫你統一加 header、組 URL、漂亮輸出 JSON。

路徑：`/data/skills/new-api-manage/scripts/newapi`

最常用的呼叫方式（通用 `call`）：

```bash
bash skills/new-api-manage/scripts/newapi call GET /api/status
bash skills/new-api-manage/scripts/newapi call GET /api/channel/  --auth token
bash skills/new-api-manage/scripts/newapi call POST /api/channel/ --auth token --json skills/new-api-manage/scripts/examples/channel.create.single.json
```

另外 `scripts/newapi` 已提供多個「高階子命令」，用起來更像 production CLI（避免每次都手組 path/query/body）：

```bash
# 健康檢查（不需要 auth 就能看基本狀態；若有 token 也會順便驗證 /api/user/self）
bash skills/new-api-manage/scripts/newapi doctor

# 渠道
bash skills/new-api-manage/scripts/newapi channel list --p 1 --page-size 20
bash skills/new-api-manage/scripts/newapi channel search --keyword openai

# Token
bash skills/new-api-manage/scripts/newapi token list --p 1 --page-size 20

# 產生路由索引（從 api-router.go 自動生成）
export NEW_API_CODE_DIR='/data/workspace/new-api-latest'
bash skills/new-api-manage/scripts/newapi routes gen --format md --out /tmp/routes.md
```

`--auth` 可用值：

- `token`：使用 `NEW_API_ACCESS_TOKEN` + `New-Api-User`
- `session`：使用 `NEW_API_COOKIE_JAR`（cookie jar）+ `New-Api-User`
- `sk`：使用 `NEW_API_TOKEN_KEY`（`sk-...` token key；用於 `TokenAuthReadOnly` 類端點，例如 `/api/usage/token/`、`/api/log/token`）
- `auto`（預設）：有 token 就用 token；沒有就嘗試 session
- `none`：強制不帶 Authorization（適合打 public endpoint 做連線測試）

全域參數（放在 command 前面）：

```bash
# 指定 config 檔
bash skills/new-api-manage/scripts/newapi --config ./newapi.json doctor

# self-signed TLS
bash skills/new-api-manage/scripts/newapi --insecure call GET https://example/api/status --auth none
```

---

### 2.1 （選用）用腳本取得 Session（cookie jar）

僅在以下情況你會需要 session：

- 2FA 登入流程（`/api/user/login` → `/api/user/login/2fa`）
- Passkey / Codex OAuth 這類需要跨請求保存 state 的流程
- 安全驗證（`/api/verify`）以及取渠道 key（`/api/channel/:id/key`）

若你的站台有開 Turnstile，純腳本很可能無法登入；那就改走「UI 產生 access_token」的路線。

在 Turnstile 未啟用、且 2FA 未啟用或你能提供 2FA code 的前提下：

```bash
export NEW_API_BASE_URL='http://127.0.0.1:3000'
export NEW_API_COOKIE_JAR='/tmp/new-api.cookies'

# 1) login
login_json="$(bash skills/new-api-manage/scripts/newapi login --username 'admin' --password '...')"
export NEW_API_USER_ID="$(echo "$login_json" | jq -r '.data.id')"

# 2) (optional) complete 2FA login if required
# bash skills/new-api-manage/scripts/newapi login2fa --code 123456 | jq .
```

接著就能用 `--auth session` 呼叫需要 session 的端點。

---

## 3. 認證與角色（權限模型）

### 3.1 角色常數（後端實際值）

來源：`$NEW_API_CODE_DIR/common/constants.go`

- Guest: `0`
- Common user: `1`
- Admin: `10`
- Root: `100`

### 3.2 兩種登入態

Access Token 模式（推薦）

- Header: `Authorization: Bearer {access_token}`
- Header: `New-Api-User: {user_id}`
- 優點：最適合自動化；不需要維持 cookie
- 限制：需要先有 access_token（通常由 UI 先登入後產生一次，或在無 Turnstile/2FA 的情況下用 API 取得）

Session/Cookie 模式（處理需要 session 的流程）

- Cookie: `session=...`（用 `curl -c/-b cookiejar`）
- Header: `New-Api-User: {user_id}`
- 典型用途：
  - `/api/verify` 安全驗證（會把驗證狀態寫進 session）
  - `/api/channel/:id/key`（取渠道 key，需要安全驗證）
  - Codex OAuth start/complete（需要在 session 暫存 state/verifier）
  - Passkey/2FA login 流程

### 3.3 Turnstile 影響（非常重要）

若 `TurnstileCheckEnabled=true`，那麼 `/api/user/login`、`/api/user/register`、`/api/user/checkin` 等會要求 query string 帶 `?turnstile=...`，且 token 必須是 Cloudflare Turnstile 的有效 response。

這代表「純腳本」可能無法登入；此時最穩健的做法是：**用瀏覽器登入 UI 一次 → 產生 access_token → 之後都走 Access Token 模式。**

---

## 4. 回應格式與分頁

多數管理 API 使用：

```json
{"success": true, "message": "", "data": ...}
```

清單型 API 常見分頁參數：

- `p`：頁碼（從 1 開始）
- `page_size`：每頁數量（後端會 clamp 到 <= 100）

回傳常見為：

```json
{"success": true, "message": "", "data": {"total": 123, "items": [...]}}
```

---

## 4.5 如何在「不猜」的前提下確認 payload（強烈建議）

new-api 的管理 API 並非所有端點都有同步更新的 OpenAPI；**最可靠的真相來源永遠是 router + controller 的 Go struct**。

當你不確定某個端點的 request body 長什麼樣，請直接在容器內用這些做法定位：

```bash
# 先找路由掛在哪個 controller function
sed -n '1,260p' "$NEW_API_CODE_DIR/router/api-router.go"

# 再去 controller 檔案內看 ShouldBindJSON/Decode 對應的 struct
rg -n "func AddChannel\(" "$NEW_API_CODE_DIR/controller" -S
rg -n "type AddChannelRequest" "$NEW_API_CODE_DIR/controller/channel.go" -S

# 最後需要看 model struct（實際 JSON 欄位名）
rg -n "type Channel struct" "$NEW_API_CODE_DIR/model/channel.go" -S
```

常用對照表（本版本已實測存在）：

- 建立渠道：`controller/channel.go:AddChannelRequest` + `model/channel.go:Channel`
- 更新渠道：`controller/channel.go:PatchChannel`
- 多 key 管理：`controller/channel.go:MultiKeyManageRequest`
- 建立/更新 Token：`model/token.go:Token`
- 建立/更新 兌換碼：`model/redemption.go:Redemption`
- 更新系統設定：`controller/option.go:OptionUpdateRequest`
- Prefill group：`model/prefill_group.go:PrefillGroup`
- Vendor meta：`model/vendor_meta.go:Vendor`
- Model meta：`model/model_meta.go:Model`
- 訂閱方案：`model/subscription.go:SubscriptionPlan` + `controller/subscription.go:AdminUpsertSubscriptionPlanRequest`
- Ratio sync：`dto/ratio_sync.go:UpstreamRequest`
- IoNet 部署：`pkg/ionet/types.go:DeploymentRequest`

---

## 4.6 OpenAPI 文件（可用但可能落後程式碼）

專案內有 OpenAPI JSON：

- 管理 API：`$NEW_API_CODE_DIR/docs/openapi/api.json`
- 轉發/相容 API：`$NEW_API_CODE_DIR/docs/openapi/relay.json`

注意：在目前這份程式碼裡，`api.json` **仍未涵蓋** subscription、deployments、performance、custom-oauth-provider、部分 channel 子端點（Codex/Ollama/upstream_updates…）等；因此它只能當「輔助參考」，不能當唯一依據。

如果你需要從 OpenAPI 快速列 path：

```bash
jq -r '.paths | keys[]' "$NEW_API_CODE_DIR/docs/openapi/api.json" | sort
```

---

## 4.7 自動產生「完整路由表」（建議作為唯一真相來源）

如果你想要**完整列出當前版本所有 `/api/*` 路由**（含 method/path/auth/handler），請用本 skill 內建的產生器直接解析 `router/api-router.go`。

生成 Markdown：

```bash
export NEW_API_CODE_DIR='/data/workspace/new-api-latest'
python3 skills/new-api-manage/scripts/generate_routes.py --format md --out skills/new-api-manage/ROUTES.generated.md
```

生成 JSON（方便做 diff 或丟給其他工具處理）：

```bash
python3 skills/new-api-manage/scripts/generate_routes.py --format json --out /tmp/new-api.routes.json
```

> `ROUTES.generated.md` 是「機器生成」檔案，適合當索引；而本 `SKILL.md` 的端點章節則是「人工整理」的操作導覽，兩者各司其職。

---

## 5. 端點總覽（以 router/api-router.go 為準）

下面列出**目前版本**所有 `/api/*` 管理端點（含 admin/root/system）。如果你要對照實作，直接開：`$NEW_API_CODE_DIR/router/api-router.go`。

（本 skill 以 `$NEW_API_CODE_DIR/router/api-router.go` 為準。）

### 5.1 系統 / 公開資訊

- `GET  /api/setup` / `POST /api/setup`
- `GET  /api/status`
- `GET  /api/uptime/status`
- `GET  /api/models`（UserAuth；回傳「各 channel type 支援的模型清單」給後台 UI 用）
- `GET  /api/status/test`（AdminAuth；狀態自檢）
- `GET  /api/notice`
- `GET  /api/user-agreement`
- `GET  /api/privacy-policy`
- `GET  /api/about`
- `GET  /api/home_page_content`
- `GET  /api/pricing`（可匿名；登入後會多回一些資訊）
- `GET  /api/ratio_config`（需後端啟用 expose ratio）

金流 Webhook（通常不需要人手呼叫；給金流平台 callback 用）：

- `POST /api/stripe/webhook`
- `POST /api/creem/webhook`

### 5.2 OAuth / 驗證信

- `GET /api/verification`（寄 email 驗證碼，可能需要 Turnstile）
- `GET /api/reset_password`（寄重設密碼信，可能需要 Turnstile）
- `POST /api/user/reset`（重設密碼）

- `GET /api/oauth/state`
- `GET /api/oauth/email/bind`
- `GET /api/oauth/wechat` / `GET /api/oauth/wechat/bind`
- `GET /api/oauth/telegram/login` / `GET /api/oauth/telegram/bind`
- `GET /api/oauth/:provider`（GitHub/Discord/OIDC/LinuxDO...）

### 5.3 安全驗證（Session 相關）

- `POST /api/verify`（UserAuth；成功後在 session 寫入 `secure_verified_at`，有效 5 分鐘）

### 5.4 使用者（含後台管理）

公開（不需 UserAuth）：

- `POST /api/user/register`
- `POST /api/user/login`
- `POST /api/user/login/2fa`
- `POST /api/user/passkey/login/begin`
- `POST /api/user/passkey/login/finish`
- `GET  /api/user/logout`
- `GET|POST /api/user/epay/notify`
- `GET  /api/user/groups`

Self（UserAuth）：

- `GET    /api/user/self`
- `PUT    /api/user/self`
- `DELETE /api/user/self`
- `GET    /api/user/self/groups`
- `GET    /api/user/models`
- `GET    /api/user/token`（產生 access_token）
- `PUT    /api/user/setting`
- `GET    /api/user/aff`
- `POST   /api/user/aff_transfer`

- `GET    /api/user/topup/info`
- `GET    /api/user/topup/self`
- `POST   /api/user/topup`

- `POST   /api/user/pay`
- `POST   /api/user/amount`
- `POST   /api/user/stripe/pay`
- `POST   /api/user/stripe/amount`
- `POST   /api/user/creem/pay`

2FA（UserAuth）：

- `GET  /api/user/2fa/status`
- `POST /api/user/2fa/setup`
- `POST /api/user/2fa/enable`
- `POST /api/user/2fa/disable`
- `POST /api/user/2fa/backup_codes`

Passkey（UserAuth）：

- `GET    /api/user/passkey`
- `POST   /api/user/passkey/register/begin`
- `POST   /api/user/passkey/register/finish`
- `POST   /api/user/passkey/verify/begin`
- `POST   /api/user/passkey/verify/finish`
- `DELETE /api/user/passkey`

Check-in（UserAuth）：

- `GET  /api/user/checkin`
- `POST /api/user/checkin`

Custom OAuth binding（UserAuth）：

- `GET    /api/user/oauth/bindings`
- `DELETE /api/user/oauth/bindings/:provider_id`

Admin（AdminAuth）：

- `GET    /api/user/`（全使用者列表）
- `GET    /api/user/search`
- `GET    /api/user/:id/oauth/bindings`（列出指定使用者的 OAuth 綁定；不可操作同級/更高級，除非你是 root）
- `DELETE /api/user/:id/oauth/bindings/:provider_id`（管理員代解除自訂 OAuth 綁定）
- `DELETE /api/user/:id/bindings/:binding_type`（清除使用者某種綁定，例如 email/wechat/telegram...；實際可用值看 `user.ClearBinding()`）
- `GET    /api/user/:id`
- `POST   /api/user/`（建立使用者）
- `PUT    /api/user/`（更新使用者）
- `POST   /api/user/manage`（disable/enable/delete/promote/demote）
- `DELETE /api/user/:id`
- `DELETE /api/user/:id/reset_passkey`

- `GET  /api/user/topup`
- `POST /api/user/topup/complete`

- `GET    /api/user/2fa/stats`
- `DELETE /api/user/:id/2fa`

### 5.5 渠道（Channel）（AdminAuth）

- `GET    /api/channel/`
- `GET    /api/channel/search`
- `GET    /api/channel/models`
- `GET    /api/channel/models_enabled`
- `GET    /api/channel/:id`

- `POST   /api/channel/`（新增：single/batch/multi_to_single）
- `PUT    /api/channel/`（更新）
- `DELETE /api/channel/:id`
- `POST   /api/channel/batch`（批次刪除）

- `GET    /api/channel/test`
- `GET    /api/channel/test/:id`

- `GET    /api/channel/update_balance`
- `GET    /api/channel/update_balance/:id`

- `DELETE /api/channel/disabled`（刪除所有 disabled 渠道）
- `POST   /api/channel/fix`（修復 abilities）

Tag 管理：

- `POST /api/channel/tag/disabled`
- `POST /api/channel/tag/enabled`
- `PUT  /api/channel/tag`
- `POST /api/channel/batch/tag`
- `GET  /api/channel/tag/models?tag=...`

抓取上游模型：

- `GET  /api/channel/fetch_models/:id`
- `POST /api/channel/fetch_models`

多 Key 管理：

- `POST /api/channel/multi_key/manage`

上游模型變更偵測/套用（AdminAuth；用於「比對上游 /models，找出新增/移除模型」的半自動維護）：

- `POST /api/channel/upstream_updates/detect`（body: `{id}`）
- `POST /api/channel/upstream_updates/apply`（body: `{id, add_models, remove_models, ignore_models}`）
- `POST /api/channel/upstream_updates/detect_all`（無 body；對所有啟用且開啟 `UpstreamModelUpdateCheckEnabled` 的渠道）
- `POST /api/channel/upstream_updates/apply_all`（無 body；套用所有渠道目前 pending 的變更）

複製渠道：

- `POST /api/channel/copy/:id?suffix=_复制&reset_balance=true`

Codex OAuth（需要 session 才能跨請求保存 state/verifier）：

- `POST /api/channel/codex/oauth/start`
- `POST /api/channel/codex/oauth/complete`
- `POST /api/channel/:id/codex/oauth/start`
- `POST /api/channel/:id/codex/oauth/complete`
- `POST /api/channel/:id/codex/refresh`
- `GET  /api/channel/:id/codex/usage`

Ollama：

- `POST   /api/channel/ollama/pull`
- `POST   /api/channel/ollama/pull/stream`（SSE）
- `DELETE /api/channel/ollama/delete`
- `GET    /api/channel/ollama/version/:id`

取渠道 key（**RootAuth + CriticalRateLimit + SecureVerificationRequired**）：

- `POST /api/channel/:id/key`

### 5.6 令牌（Token）（UserAuth）

- `GET    /api/token/`
- `GET    /api/token/search`
- `GET    /api/token/:id`
- `POST   /api/token/:id/key`（回傳 full token key；敏感資訊）
- `POST   /api/token/`
- `PUT    /api/token/`
- `DELETE /api/token/:id`
- `POST   /api/token/batch`

Token 用量（TokenAuthReadOnly；注意這裡的 Authorization 是 `sk-...` token key）：

- `GET /api/usage/token/`

用 `scripts/newapi`（建議）：

```bash
export NEW_API_TOKEN_KEY='sk-...'
bash skills/new-api-manage/scripts/newapi usage token
```

### 5.7 兌換碼（Redemption）（AdminAuth）

- `GET    /api/redemption/`
- `GET    /api/redemption/search`
- `GET    /api/redemption/:id`
- `POST   /api/redemption/`（回傳 keys array）
- `PUT    /api/redemption/`
- `DELETE /api/redemption/invalid`
- `DELETE /api/redemption/:id`

### 5.8 日誌 / 統計（AdminAuth / UserAuth / TokenAuthReadOnly）

- `GET    /api/log/`（Admin）
- `DELETE /api/log/?target_timestamp=...`（Admin）
- `GET    /api/log/stat`（Admin）
- `GET    /api/log/self/stat`（User）
- `GET    /api/log/self`（User）

（保留但已廢棄，會回 success=false）：

- `GET /api/log/search`
- `GET /api/log/self/search`

Token 查詢自身 log：

- `GET /api/log/token`（TokenAuthReadOnly）

用 `scripts/newapi`（建議）：

```bash
export NEW_API_TOKEN_KEY='sk-...'
bash skills/new-api-manage/scripts/newapi log token
```

Channel affinity cache usage（Admin）：

- `GET /api/log/channel_affinity_usage_cache?rule_name=...&key_fp=...&using_group=...`

### 5.9 額度資料（AdminAuth / UserAuth）

- `GET /api/data/`（Admin）
- `GET /api/data/self`（User）

### 5.10 分組（AdminAuth）

- `GET /api/group/`

### 5.11 Prefill Groups（AdminAuth）

- `GET    /api/prefill_group/?type=model|tag|endpoint`
- `POST   /api/prefill_group/`
- `PUT    /api/prefill_group/`
- `DELETE /api/prefill_group/:id`

### 5.12 任務 / MJ（UserAuth / AdminAuth）

- `GET /api/task/self`（User）
- `GET /api/task/`（Admin）
- `GET /api/mj/self`（User）
- `GET /api/mj/`（Admin）

### 5.13 供應商（Vendor Meta）（AdminAuth）

- `GET    /api/vendors/`
- `GET    /api/vendors/search`
- `GET    /api/vendors/:id`
- `POST   /api/vendors/`
- `PUT    /api/vendors/`
- `DELETE /api/vendors/:id`

### 5.14 模型（Model Meta + Sync）（AdminAuth）

- `GET  /api/models/`（注意尾端 `/`）
- `GET  /api/models/search`
- `GET  /api/models/:id`
- `POST /api/models/`
- `PUT  /api/models/`
- `DELETE /api/models/:id`

- `GET  /api/models/missing`
- `GET  /api/models/sync_upstream/preview?locale=en|zh-CN|zh-TW|ja`
- `POST /api/models/sync_upstream`（body: overwrite/locale）

### 5.15 訂閱（Subscription）（UserAuth / AdminAuth）

User：

- `GET /api/subscription/plans`
- `GET /api/subscription/self`
- `PUT /api/subscription/self/preference`
- `POST /api/subscription/epay/pay`
- `POST /api/subscription/stripe/pay`
- `POST /api/subscription/creem/pay`

Admin：

- `GET   /api/subscription/admin/plans`
- `POST  /api/subscription/admin/plans`
- `PUT   /api/subscription/admin/plans/:id`
- `PATCH /api/subscription/admin/plans/:id`（enabled 開關）
- `POST  /api/subscription/admin/bind`

- `GET    /api/subscription/admin/users/:id/subscriptions`
- `POST   /api/subscription/admin/users/:id/subscriptions`
- `POST   /api/subscription/admin/user_subscriptions/:id/invalidate`
- `DELETE /api/subscription/admin/user_subscriptions/:id`

Callback（無 auth）：

- `GET|POST /api/subscription/epay/notify`
- `GET|POST /api/subscription/epay/return`

### 5.16 系統設定（Option）（RootAuth）

- `GET  /api/option/`
- `PUT  /api/option/`（body: {key,value}）
- `POST /api/option/rest_model_ratio`
- `POST /api/option/migrate_console_setting`

Channel affinity cache：

- `GET    /api/option/channel_affinity_cache`
- `DELETE /api/option/channel_affinity_cache?all=true`
- `DELETE /api/option/channel_affinity_cache?rule_name=...`

### 5.17 Custom OAuth Provider（RootAuth）

- `POST   /api/custom-oauth-provider/discovery`（透過後端抓 OIDC discovery；body: `{well_known_url|issuer_url}`）
- `GET    /api/custom-oauth-provider/`
- `GET    /api/custom-oauth-provider/:id`
- `POST   /api/custom-oauth-provider/`
- `PUT    /api/custom-oauth-provider/:id`
- `DELETE /api/custom-oauth-provider/:id`

### 5.18 效能（Performance）（RootAuth）

- `GET    /api/performance/stats`
- `DELETE /api/performance/disk_cache`
- `POST   /api/performance/reset_stats`
- `POST   /api/performance/gc`

### 5.19 倍率同步（Ratio Sync）（RootAuth）

- `GET  /api/ratio_sync/channels`
- `POST /api/ratio_sync/fetch`（body: {channel_ids|upstreams, timeout}）

### 5.20 部署（Deployments / IoNet）（AdminAuth）

- `GET  /api/deployments/settings`
- `POST /api/deployments/settings/test-connection`
- `GET  /api/deployments/`
- `GET  /api/deployments/search`
- `POST /api/deployments/test-connection`
- `GET  /api/deployments/hardware-types`
- `GET  /api/deployments/locations`
- `GET  /api/deployments/available-replicas?hardware_id=...&gpu_count=...`
- `POST /api/deployments/price-estimation`
- `GET  /api/deployments/check-name?name=...`
- `POST /api/deployments/`（body: ionet.DeploymentRequest）

- `GET    /api/deployments/:id`
- `GET    /api/deployments/:id/logs?container_id=...&limit=...&cursor=...&follow=true`
- `GET    /api/deployments/:id/containers`
- `GET    /api/deployments/:id/containers/:container_id`
- `PUT    /api/deployments/:id`
- `PUT    /api/deployments/:id/name`
- `POST   /api/deployments/:id/extend`
- `DELETE /api/deployments/:id`

---

## 6. 關鍵操作範本（可直接套用）

本段只列「最常用且最容易出錯」的管理動作。其餘較少用的端點，一律用 `newapi call` 套用即可。

### 6.1 建立渠道（Channel）

端點：`POST /api/channel/`（AdminAuth）

模式一：single

```bash
bash skills/new-api-manage/scripts/newapi channel create --json skills/new-api-manage/scripts/examples/channel.create.single.json
```

模式二：batch（同一設定、多行 key 批量建立）

```bash
bash skills/new-api-manage/scripts/newapi channel create --json skills/new-api-manage/scripts/examples/channel.create.batch.json
```

模式三：multi_to_single（把多個 key 合併成「單一渠道、多 Key 模式」）

```bash
bash skills/new-api-manage/scripts/newapi channel create --json skills/new-api-manage/scripts/examples/channel.create.multi_to_single.json
```

### 6.2 更新渠道（Channel）

端點：`PUT /api/channel/`（AdminAuth）

```bash
bash skills/new-api-manage/scripts/newapi channel update --json skills/new-api-manage/scripts/examples/channel.update.basic.json
```

多 Key 渠道追加 key（`key_mode=append`）

```bash
bash skills/new-api-manage/scripts/newapi channel update --json skills/new-api-manage/scripts/examples/channel.update.append_key.json
```

### 6.3 多 Key 狀態管理

端點：`POST /api/channel/multi_key/manage`（AdminAuth）

```bash
bash skills/new-api-manage/scripts/newapi call POST /api/channel/multi_key/manage --auth token \
  --json skills/new-api-manage/scripts/examples/channel.multi_key.get_status.json
```

### 6.3.1 上游模型變更偵測 / 套用（channels upstream_updates）

先偵測某個渠道的上游模型變更（會把 pending 結果寫進該 channel 的 other settings，並回傳 add/remove 清單）：

```bash
bash skills/new-api-manage/scripts/newapi channel upstream-updates detect --id 123
```

再把你選定的變更套用回該渠道（通常你會只選一部分 add/remove，其餘 ignore）：

```bash
bash skills/new-api-manage/scripts/newapi channel upstream-updates apply --id 123 \
  --add 'gpt-4o,gpt-4o-mini' \
  --remove 'deprecated-model' \
  --ignore 'some-upstream-model-you-never-want'
```

如果你要一鍵處理全部渠道：

```bash
# detect all
bash skills/new-api-manage/scripts/newapi channel upstream-updates detect-all

# apply all (會套用各 channel 當前 pending 的變更)
bash skills/new-api-manage/scripts/newapi channel upstream-updates apply-all
```

### 6.4 取得渠道 key（高風險操作）

端點：`POST /api/channel/:id/key`（RootAuth + SecureVerificationRequired）

流程一定要走 session：

第一步，用 session 做安全驗證（2FA code）。

```bash
bash skills/new-api-manage/scripts/newapi call POST /api/verify --auth session \
  --data '{"method":"2fa","code":"123456"}'
```

第二步，5 分鐘內呼叫取 key：

```bash
bash skills/new-api-manage/scripts/newapi call POST /api/channel/123/key --auth session
```

> 注意：此端點回傳的 `data.key` 會是敏感資訊。避免在公開 log / chat 直接貼出。

### 6.5 使用者管理（Admin）

建立使用者：`POST /api/user/`

```bash
bash skills/new-api-manage/scripts/newapi user create --json skills/new-api-manage/scripts/examples/user.create.json
```

封禁/啟用/升降權：`POST /api/user/manage`

```bash
bash skills/new-api-manage/scripts/newapi user manage --id 123 --action disable
```

### 6.6 建立 Token（使用者自己的 token key）

端點：`POST /api/token/`（UserAuth）

```bash
bash skills/new-api-manage/scripts/newapi token create --json skills/new-api-manage/scripts/examples/token.create.json
```

### 6.6.1 取得 Token Key（敏感）

端點：`POST /api/token/:id/key`（UserAuth）

```bash
# 建議寫入檔案，避免 key 出現在終端歷史/CI log
bash skills/new-api-manage/scripts/newapi token key --id 123 --out /tmp/newapi.token.key

# 若你真的要印在 stdout（不推薦）
# bash skills/new-api-manage/scripts/newapi token key --id 123 --stdout
```

> 回傳的 `data.key` 就是完整 token key（含 `sk-` 前綴）。請避免貼到公開頻道或長期 log。

### 6.7 更新系統設定（Root）

端點：`PUT /api/option/`

```bash
bash skills/new-api-manage/scripts/newapi option set --key RegisterEnabled --value false

# 或者直接丟 JSON 檔（適合 value 很長、例如整包 JSON 字串）
# bash skills/new-api-manage/scripts/newapi call PUT /api/option/ --auth token --json skills/new-api-manage/scripts/examples/option.update.json
```

### 6.8 同步上游模型資料（Admin）

預覽差異：

```bash
bash skills/new-api-manage/scripts/newapi call GET '/api/models/sync_upstream/preview?locale=zh-TW' --auth token
```

開始同步：

```bash
bash skills/new-api-manage/scripts/newapi call POST /api/models/sync_upstream --auth token \
  --json skills/new-api-manage/scripts/examples/models.sync_upstream.json
```

### 6.9 建立訂閱方案（Admin）

```bash
bash skills/new-api-manage/scripts/newapi call POST /api/subscription/admin/plans --auth token \
  --json skills/new-api-manage/scripts/examples/subscription.plan.create.json
```

### 6.10 建立 IoNet 部署（Admin）

```bash
bash skills/new-api-manage/scripts/newapi call POST /api/deployments/ --auth token \
  --json skills/new-api-manage/scripts/examples/deployment.create.json
```

### 6.11 Custom OAuth Discovery（Root）

端點：`POST /api/custom-oauth-provider/discovery`

```bash
bash skills/new-api-manage/scripts/newapi call POST /api/custom-oauth-provider/discovery --auth token \
  --json skills/new-api-manage/scripts/examples/custom_oauth.discovery.json
```

---

## 7. 附錄：渠道 Type（建立渠道時最常用）

來源：`$NEW_API_CODE_DIR/constant/channel.go`

建議做法：**先用 UI 參考一個現有渠道的 payload**，再用 API 建新的；因為每種 provider 的 key 格式、base_url、setting/settings 可能不同。

常見 type：

- `1` OpenAI
- `3` Azure
- `4` Ollama
- `14` Anthropic
- `20` OpenRouter
- `24` Gemini
- `41` VertexAI
- `43` DeepSeek
- `57` Codex

Multi-key 模式（`multi_key_mode`）：

- `random`
- `polling`
