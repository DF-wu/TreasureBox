---
name: qwen-tts2api
description: 操作 aahl/qwen-tts2api 容器與其 OpenAI 相容 TTS API（Qwen3 TTS）。用於部署、查詢音色、生成語音、或批次跑全部音色。49 個音色，含中日韓英西法德俄義葡及方言。
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"],"skills":[]}}}
---

# qwen-tts2api

以 `aahl/qwen-tts2api` Docker 容器提供 Qwen3 TTS 的 OpenAI 相容語音合成 API。

上游空間：HuggingFace `qwen-qwen3-tts-demo.hf.space`，但容器走 gluetun VPN 隔離網路流量。

## 部署位置

- 主機：axolotl
- 容器名：`qwen-tts2api`
- 網路：`--network=container:gluetun-proxy`（對外流量走 VPN）
- 內部位址：`http://172.16.1.130:80`（gluetun-proxy 的 docker network IP）

## 部署指令

```bash
docker pull ghcr.io/aahl/qwen-tts2api:main
docker rm -f qwen-tts2api 2>/dev/null
docker run -d --name qwen-tts2api \
  --network=container:gluetun-proxy \
  --restart=unless-stopped \
  -e BASE_URL="https://qwen-qwen3-tts-demo.hf.space" \
  ghcr.io/aahl/qwen-tts2api:main
```

注意：原始 BASE_URL `https://qwen-qwen3-tts-demo.ms.show` 已失效（被重導向至 ModelScope SDK-only endpoint）。必須改用 HF space。

## API

### GET /v1/models

回傳所有可用音色。

```bash
curl -s http://172.16.1.130:80/v1/models | jq '.voices | keys'
```

### POST /v1/audio/speech

生成語音。OpenAI 相容格式。

```bash
curl -s -X POST http://172.16.1.130:80/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{"voice": "vivian", "input": "こんにちは"}' \
  -o output.wav
```

參數：
- `voice`（必填）：音色 ID。49 個可選，見 `/v1/models`
- `input`（必填）：文本。上限約 100 字
- `model`（選填）：固定 `qwen-tts`

## 音色一覽（49）

| 類別 | 音色 |
|---|---|
| 中文女聲 | cherry, serena, chelsie, momo, vivian, moon, maia, bella, jennifer, katerina, nini, stella |
| 中文男聲 | ethan, kai, ryan, aiden, vincent, neil, elias, arthur, pip |
| 方言／地方 | li（南京）, marcus（陕西）, roy（闽南）, peter（天津）, eric（四川）, rocky（粤语男）, kiki（粤语女）, sunny（四川女）, jada（上海）, dylan（北京） |
| 日語 | ono anna |
| 韓語 | sohee |
| 英語 | nofish |
| 西班牙語 | bodega, sonrisa（拉美） |
| 俄語 | alek |
| 義大利語 | dolce |
| 德語 | lenn |
| 法語 | emilien |
| 葡萄牙語 | andre（歐）, radio gol（巴） |
| 精品百人 | eldric sage, mia, mochi, bellona, bunny, ebona, seren |

## 批次生成全部音色

Python script 放在 `/tmp/qwen_tts_batch.py` on axolotl，使用 `concurrent.futures.ThreadPoolExecutor`、parallel=3：

```python
import urllib.request, json, os
from concurrent.futures import ThreadPoolExecutor, as_completed

API = "http://172.16.1.130:80"
OUTDIR = "/tmp/qwen-tts-output"
TEXT = "要生成的中文文本"

os.makedirs(OUTDIR, exist_ok=True)
req = urllib.request.Request(f"{API}/v1/models")
with urllib.request.urlopen(req, timeout=30) as resp:
    voices = list(json.loads(resp.read())["voices"].keys())

def gen(voice):
    payload = json.dumps({"voice": voice, "input": TEXT}).encode()
    req = urllib.request.Request(f"{API}/v1/audio/speech", data=payload,
        headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as resp:
        with open(f"{OUTDIR}/{voice}.wav", "wb") as f:
            f.write(resp.read())
    return voice

with ThreadPoolExecutor(max_workers=3) as pool:
    for f in as_completed([pool.submit(gen, v) for v in voices]):
        print(f"OK: {f.result()}")
```

## 疑難排解

- **500 / "Could not fetch config"** → upstream 換位址。改 `BASE_URL` 環境變數重啟容器
- **403 from ms.show** → 該域名已遷移至 ModelScope，需 SDK token。改用 HF space
- **容器 port 80 衝突** → gluetun-proxy 的 network namespace 內 80 已被佔用時，改用其他 port
