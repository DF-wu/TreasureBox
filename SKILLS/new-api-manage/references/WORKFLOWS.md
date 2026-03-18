# Workflows

這份檔案放的是**高頻工作流**與**不猜 payload 的查法**。

假設目前工作目錄在 skill 根目錄。若不是，請把 `scripts/newapi`、`scripts/examples/...` 換成實際路徑。

---

## 1. Channel 管理

### 查清單 / 搜尋 / 單筆查看

```bash
bash scripts/newapi channel list --p 1 --page-size 20
bash scripts/newapi channel search --keyword openai
bash scripts/newapi channel get --id 123
```

### 建立 / 更新

```bash
bash scripts/newapi channel create --json scripts/examples/channel.create.single.json
bash scripts/newapi channel update --json scripts/examples/channel.update.basic.json
```

### 高風險動作

```bash
bash scripts/newapi channel delete --id 123 --yes
bash scripts/newapi channel batch-delete --ids 1,2,3 --yes
bash scripts/newapi channel batch-tag --ids 1,2,3 --tag foo --yes
```

### Upstream 更新檢查

```bash
bash scripts/newapi channel upstream-updates detect --id 123
bash scripts/newapi channel upstream-updates apply --id 123 --json scripts/examples/channel.upstream_updates.apply.json
bash scripts/newapi channel upstream-updates detect-all
bash scripts/newapi channel upstream-updates apply-all
```

---

## 2. Token 管理

### 查清單 / 單筆 / 建立更新

```bash
bash scripts/newapi token list --p 1 --page-size 20
bash scripts/newapi token search --keyword foo
bash scripts/newapi token get --id 123
bash scripts/newapi token create --json scripts/examples/token.create.json
bash scripts/newapi token update --json scripts/examples/token.create.json
```

### 取 full token key

這類操作有敏感資訊，優先落檔：

```bash
bash scripts/newapi token key --id 123 --out /tmp/newapi.token.key
```

如果沒有明確要求，不要把 key 直接 stdout 到對話裡。

---

## 3. User 管理

```bash
bash scripts/newapi user self
bash scripts/newapi user list --p 1 --page-size 20
bash scripts/newapi user search --keyword alice
bash scripts/newapi user get --id 123
bash scripts/newapi user create --json scripts/examples/user.create.json
bash scripts/newapi user update --json scripts/examples/user.create.json
bash scripts/newapi user manage --id 123 --action disable --yes
bash scripts/newapi user oauth-bindings --id 123
```

---

## 4. Option / Model / Vendor

### 系統設定

```bash
bash scripts/newapi option get
bash scripts/newapi option set --key RegisterEnabled --value false
bash scripts/newapi option reset-model-ratio --yes
```

### Model / Vendor metadata

```bash
bash scripts/newapi models list --p 1 --page-size 20
bash scripts/newapi models search --keyword claude
bash scripts/newapi models get --id 10
bash scripts/newapi models sync preview --locale zh-TW
bash scripts/newapi models sync run --json scripts/examples/models.sync_upstream.json

bash scripts/newapi vendors list --p 1 --page-size 20
bash scripts/newapi vendors search --keyword anthropic
bash scripts/newapi vendors get --id 10
```

---

## 5. Subscription / Deployment / Performance

### 訂閱

```bash
bash scripts/newapi subscription plans
bash scripts/newapi subscription self
bash scripts/newapi subscription admin plans list
bash scripts/newapi subscription admin plans create --json scripts/examples/subscription.plan.create.json
```

### Deployment

```bash
bash scripts/newapi deployments settings
bash scripts/newapi deployments list --p 1 --page-size 20
bash scripts/newapi deployments get --id 123
bash scripts/newapi deployments hardware-types
bash scripts/newapi deployments locations
```

如果站台沒有啟用 io.net deployment，這組命令可能會回 feature disabled。那是環境差異，不一定是 CLI 問題。

### Performance

```bash
bash scripts/newapi performance stats
bash scripts/newapi performance clear-disk-cache --yes
bash scripts/newapi performance gc --yes
```

後兩個會改系統狀態，先確認需求再動。

---

## 6. Usage / Log / Data / Task / Redemption

```bash
bash scripts/newapi usage token --auth sk
bash scripts/newapi log token --auth sk
bash scripts/newapi data self
bash scripts/newapi task self
bash scripts/newapi redemption list --p 1 --page-size 20
```

---

## 7. 當 CLI 還沒包到：直接用 `call`

只要你知道 method / path / auth / payload，就能直接走：

```bash
bash scripts/newapi call GET /api/status --auth none
bash scripts/newapi call GET /api/channel/ --auth token
bash scripts/newapi call POST /api/custom-oauth-provider/discovery --auth token --json scripts/examples/custom_oauth.discovery.json
```

判斷原則很簡單：

- **高頻操作**：先找高階子命令
- **低頻或剛新增的路由**：先用 `call`
- **確認會重複用**：再把它補成正式子命令

---

## 8. Payload discovery：不要猜

當你不確定 body / query / auth 時，直接回 source code。

### 8.1 先找路由

```bash
sed -n '1,260p' "$NEW_API_CODE_DIR/router/api-router.go"
```

### 8.2 再找 controller 與 request struct

```bash
rg -n "func AddChannel\(" "$NEW_API_CODE_DIR/controller" -S
rg -n "type AddChannelRequest" "$NEW_API_CODE_DIR/controller" -S
```

### 8.3 最後看 model / dto

```bash
rg -n "type Channel struct" "$NEW_API_CODE_DIR/model" -S
rg -n "type Token struct" "$NEW_API_CODE_DIR/model" -S
rg -n "type .*Request" "$NEW_API_CODE_DIR/controller" -S
```

---

## 9. OpenAPI 的定位

OpenAPI 可以當輔助，但不要把它當唯一真相來源。實務上仍以：

1. `router/api-router.go`
2. controller request binding
3. model / dto struct

為主。

如果要快速列 path，可以用：

```bash
jq -r '.paths | keys[]' "$NEW_API_CODE_DIR/docs/openapi/api.json" | sort
```

---

## 10. 路由索引重建

```bash
export NEW_API_CODE_DIR='/path/to/new-api'
bash scripts/newapi routes gen --format md --out ROUTES.generated.md
bash scripts/newapi routes gen --format json --out /tmp/new-api.routes.json
```

`ROUTES.generated.md` 適合做總覽；真的要做 payload 級別查證，回 source code。
