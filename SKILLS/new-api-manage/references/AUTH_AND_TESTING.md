# Auth and Testing

這份檔案只講兩件事：**怎麼選認證模式**，以及 **怎麼安全測 production**。

假設目前工作目錄在 skill 根目錄。若不是，請把 `scripts/newapi` 換成實際路徑。

---

## 1. 認證模式怎麼選

### 1.1 Access token：管理維運的主力模式

大部分管理 API 都該走這個模式。

```bash
export NEW_API_BASE_URL='https://your-new-api'
export NEW_API_USER_ID='1'
export NEW_API_ACCESS_TOKEN='<access_token>'
```

`newapi` 會自動補上：

- `Authorization: Bearer <access_token>`
- `New-Api-User: <user_id>`

這是 **管理面 `/api/*`** 最常見、最穩定的自動化路線。

---

### 1.2 Token key：只給 TokenAuthReadOnly 路由

這不是一般管理 API 的主要認證方式。

```bash
export NEW_API_TOKEN_KEY='sk-...'
```

它只適合這類端點：

- `/api/usage/token/`
- `/api/log/token`

使用方式：

```bash
bash scripts/newapi usage token --auth sk
bash scripts/newapi log token --auth sk
```

如果你要做 channel / token / user / option / model / vendor 管理，請回去用 access token。

---

### 1.3 Session / Cookie：處理需要 session state 的流程

以下情況通常要改走 session：

- `/api/verify`
- 2FA 登入流程
- passkey login / register
- 部分 OAuth flow
- 取 channel key 這種依賴安全驗證狀態的端點

```bash
export NEW_API_COOKIE_JAR='/tmp/new-api.cookies'
```

如果站台有開 Turnstile，純腳本登入常常走不通。這種情況下，穩健做法通常是：

1. 用 UI 登入一次
2. 產生 access token
3. 後續維運一律改走 access token

---

## 2. 角色判斷

`doctor --deep` 會先查 `/api/user/self`，再依 role 決定跑哪些 smoke checks。

常見 role 值：

- `0`：guest
- `1`：common user
- `10`：admin
- `100`：root

一般來說：

- user 能做自己的資料 / 訂閱 / 任務查詢
- admin 才能碰管理清單
- root 才會碰 `option`、部分系統級設定與更高權限端點

---

## 3. Production 測試梯度

### 第 0 層：永遠先做 read-only

在沒有明確要求前，不要用 create / update / delete 當 smoke test。

優先順序是：

1. `doctor`
2. `doctor --deep`
3. 指定幾個 read-only list/get endpoint
4. 最後才是有明確範圍的 mutation

---

### 第 1 層：最小檢查

```bash
bash scripts/newapi doctor
```

這會先確認：

- `/api/status` 是否可連
- 如果你有 access token / session，`/api/user/self` 是否正常

---

### 第 2 層：read-only smoke suite

```bash
bash scripts/newapi doctor --deep
bash scripts/newapi doctor --deep --json
```

`doctor --deep` 的檢查策略：

- **一定檢查**：`/api/status`
- **有登入態時**：`/api/user/self`
- **依角色遞增**：
  - user：`subscription self`、`data self`、`task self`
  - admin：`channel list`、`token list`、`models list`、`vendors list`、`group list`、`prefill-group list`、`redemption list`、`performance stats`
  - root：`option get`、`subscription admin plans`
- **軟失敗（soft fail）**：`deployments settings`

為什麼 `deployments settings` 是 soft fail？因為很多站台根本沒開 io.net deployment，或缺對應 api key。這種情況表示「該功能未啟用」，不代表整個 skill 壞掉。

`doctor --deep` 退出碼規則：

- 沒有 hard fail：exit 0
- 只出現 soft fail：exit 0
- 出現 hard fail：exit 1

---

## 4. 解讀 `doctor --deep`

### PASS

端點可達、回應 JSON 正常、且 `success=true`。

### SOFT

端點可達，但功能未啟用或站台缺必要設定；這通常是環境差異，不一定是 bug。

### FAIL

這代表要停下來查：

- 認證錯了
- `New-Api-User` 不對
- 權限不夠
- 部署版本不相容
- 端點真的壞了

先查 `/api/user/self` 的 role，再對照該端點理論上需要的 auth / role。

---

## 5. 最小 production smoke test 手順

如果你手上有管理員 access token，建議照這個順序：

```bash
export NEW_API_BASE_URL='https://your-new-api'
export NEW_API_USER_ID='1'
export NEW_API_ACCESS_TOKEN='<access_token>'

bash scripts/newapi doctor --deep
bash scripts/newapi channel list --p 1 --page-size 5
bash scripts/newapi token list --p 1 --page-size 5
bash scripts/newapi option get
bash scripts/newapi subscription admin plans list
```

如果上面都正常，再去做更窄的 targeted checks，例如：

```bash
bash scripts/newapi channel get --id 123
bash scripts/newapi user get --id 1
bash scripts/newapi models get --id 10
```

---

## 6. Session 登入備忘

在 **沒有 Turnstile**、且你真的需要 session flow 時，可以這樣：

```bash
export NEW_API_BASE_URL='https://your-new-api'
export NEW_API_COOKIE_JAR='/tmp/new-api.cookies'

bash scripts/newapi login --username 'admin' --password '...' | jq .
bash scripts/newapi login2fa --code '123456' | jq .
```

之後把 `NEW_API_USER_ID` 設起來，再用 `--auth session` 呼叫需要 session 的端點。

---

## 7. 測試時不要做的事

- 不要拿 create / delete 當第一輪 smoke test
- 不要把 access token / token key 回貼到聊天
- 不要在沒確認 scope 前做 batch 操作
- 不要用 `--stdout` 直接把敏感 key 打到對話裡

如果真的需要驗證敏感 key 類端點，優先：

```bash
bash scripts/newapi token key --id 123 --out /tmp/newapi.token.key
```
