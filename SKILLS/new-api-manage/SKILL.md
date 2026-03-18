---
name: new-api-manage
description: 以 QuantumNous/new-api 的管理 API（/api/*）做實際維運。當使用者提到 new-api、管理後台、channel/token/user/option/model/vendor/subscription/deployment、效能統計、倍率同步、管理員驗證、或要從 router/api-router.go 反查端點與 payload 時，都應使用此 skill，即使對方沒有明講「skill」。
metadata: {"clawdbot":{"requires":{"bins":["curl","jq","python3","git"]}}}
---

# new-api-manage

用這個 skill 操作 **new-api 的管理面 `/api/*`**。它的重點是維運、稽核、查證、管理，不是一般客戶端的 `/v1/*` 模型呼叫。

優先使用內建 CLI：`scripts/newapi`。它已經把最常見的管理流程做成高階子命令；只有在 CLI 還沒包到的端點上，才退回 `call`。

假設目前工作目錄在 **skill 根目錄**。如果不是，請把 `scripts/newapi`、`scripts/examples/...`、`references/...` 換成實際路徑。

---

## 什麼時候該用這個 skill

以下情境都直接用它。

- 需要管理或查證 **channel / token / user / option / model / vendor / subscription / deployment**
- 需要驗證 **管理員 access token / session** 是否正常
- 需要對 new-api 部署做 **read-only smoke test** 或 production 巡檢
- 需要從 `router/api-router.go` 重新產生 **完整路由索引**
- 需要在不猜 payload 的前提下，回 source code 查 controller / struct
- 需要用 `/api/*` 管理介面做一次性操作，但高階 CLI 還沒有包好

---

## 先記住這幾件事

- **管理 API 主認證不是 `sk-...`。** 一般管理操作要用 **access token + `New-Api-User`**。
- `--auth sk` 只給 `TokenAuthReadOnly` 類端點，例如 `/api/usage/token/`、`/api/log/token`。
- 需要 session 狀態的流程（`/api/verify`、2FA、passkey、部分 OAuth、取 channel key）要改用 `--auth session`。
- 部署中的 new-api 版本可能和本機 source tree 不同。先看 `GET /api/status` 的 `version`，再決定 `NEW_API_CODE_DIR` 要指向哪個版本。
- **`call` 是保底 escape hatch。** 只要路由存在，就能先用 `call` 操作；之後再決定要不要補高階子命令。

---

## 快速開始

### 1. 設定環境變數

最常用的是 access token 模式：

```bash
export NEW_API_BASE_URL='https://your-new-api'
export NEW_API_USER_ID='1'
export NEW_API_ACCESS_TOKEN='<access_token>'
```

若要操作 `TokenAuthReadOnly` 類端點：

```bash
export NEW_API_TOKEN_KEY='sk-...'
```

若要走 session / cookie：

```bash
export NEW_API_COOKIE_JAR='/tmp/new-api.cookies'
```

其他常見設定：

```bash
export NEW_API_INSECURE=true
export NEW_API_CONFIG='./scripts/examples/config.json.example'
export NEW_API_CODE_DIR='/path/to/new-api'
```

### 2. 先做最小檢查

```bash
bash scripts/newapi doctor
bash scripts/newapi doctor --deep
```

`doctor` 會先做基本連線 / 認證檢查；`doctor --deep` 會再加上 read-only 的管理面 smoke test。

### 3. 開始操作

```bash
bash scripts/newapi channel list --p 1 --page-size 20
bash scripts/newapi token list --p 1 --page-size 20
bash scripts/newapi user self
bash scripts/newapi option get
```

如果不知道 CLI 的完整參數，直接看它自己的 help：

```bash
bash scripts/newapi --help
```

---

## 建議操作順序

第一，先 `doctor`；如果是 production，先跑 `doctor --deep`。  
第二，優先用高階子命令：`channel`、`token`、`user`、`option`、`models`、`vendors`、`usage`、`log`、`data`、`group`、`prefill-group`、`mj`、`task`、`redemption`、`performance`、`ratio-sync`、`subscription`、`deployments`。  
第三，CLI 還沒包到的端點才用 `call`。  
第四，不確定 payload 時，先看 `references/WORKFLOWS.md` 的 payload discovery，再對照 `ROUTES.generated.md` 與 source code。  
第五，只有在明確被要求時才做 destructive 操作；`DELETE`、批次刪除、清 cache、terminate deployment 一律要求 `--yes`。

---

## 最常用的命令

### 健康檢查與 smoke test

```bash
bash scripts/newapi doctor
bash scripts/newapi doctor --deep
bash scripts/newapi doctor --deep --json
```

### 通用 escape hatch

```bash
bash scripts/newapi call GET /api/status --auth none
bash scripts/newapi call GET /api/channel/ --auth token
bash scripts/newapi call POST /api/channel/ --auth token --json scripts/examples/channel.create.single.json
```

### 高頻維運

```bash
bash scripts/newapi channel list --p 1 --page-size 20
bash scripts/newapi channel search --keyword openai
bash scripts/newapi token list --p 1 --page-size 20
bash scripts/newapi user self
bash scripts/newapi option get
bash scripts/newapi models sync preview --locale zh-TW
bash scripts/newapi subscription admin plans list
bash scripts/newapi deployments settings
```

### 路由索引重建

```bash
export NEW_API_CODE_DIR='/path/to/new-api'
bash scripts/newapi routes gen --format md --out ROUTES.generated.md
bash scripts/newapi routes gen --format json --out /tmp/new-api.routes.json
```

---

## 這個 skill 的其他檔案怎麼用

- **`references/AUTH_AND_TESTING.md`**：認證模式、session 流程、production 測試梯度、`doctor --deep` 解讀方式。
- **`references/WORKFLOWS.md`**：常見維運流程、常用命令範例、payload discovery、何時退回 `call`。
- **`ROUTES.generated.md`**：由 `scripts/generate_routes.py` 自動產生的完整路由索引。當你需要 method/path/auth/handler 的完整對照表時，看這份。
- **`scripts/examples/*.json`**：現成 payload 範本，適合直接複製後修改。

---

## 不要猜 payload：直接回 source

遇到以下情況，不要硬猜：

- 不確定 request body 欄位名
- 不確定某端點掛的是哪個 auth middleware
- OpenAPI 文件和實作看起來不一致
- 部署版本與目前 skill 記錄不同

最可靠的查法是：

1. `router/api-router.go`
2. 對應 controller 的 `ShouldBindJSON` / request struct
3. 對應 model / dto struct
4. 最後才把 OpenAPI 當輔助參考

如果當前工作區有 new-api source tree，請把它設到 `NEW_API_CODE_DIR`，再用 `routes gen` 與 `rg` / `sed` 去追。

---

## 安全邊界

- 先查再改；先列出目標物件，再做 mutation。
- 會吐出敏感 key 的命令優先用 `--out` 落檔，不要直接 stdout。
- 不要在回覆裡貼出 access token、token key、session cookie。
- 對 production 做變更前，先確認 **scope / ID / payload / 是否可回滾**。

---

## 維護這個 skill

當 upstream 或部署版本有變化時，照這個順序做：

1. 先 `GET /api/status` 看實際版本。
2. 把 `NEW_API_CODE_DIR` 指到對應 source tree。
3. 重跑 `bash scripts/newapi routes gen ...`。
4. 如果 CLI 行為跟著變了，再補 `scripts/newapi`。
5. `SKILL.md` 只保留高密度操作導覽；長篇端點百科放到 reference / generated files。
