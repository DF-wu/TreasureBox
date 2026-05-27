---
name: vits-uma-jp
description: 操作自建的 vits-uma-genshin-honkai OpenAI 相容 TTS API（原神／星穹鐵道日配限定）。65 個日配音色，含完整原神角色日配（早見沙織、悠木碧、高橋李依等）。部署、查詢音色、生成語音。
metadata: {"clawdbot":{"requires":{"bins":["curl","python3","docker"],"skills":[]}}}
---

# vits-uma-jp

自建 OpenAI 相容 TTS API，底層封裝 HuggingFace space `zomehwh/vits-uma-genshin-honkai`（Gradio 3.7，VITS-UMA 模型），僅取日配音色。

## 部署位置

- 主機：axolotl
- 容器名：`vits-uma-api`
- 網路：`--network=container:gluetun-proxy`（對外流量走 VPN）
- 內部位址：`http://172.16.1.130:8080`
- Image：`vits-uma-api:latest`（本地 build）

## 部署／重建

Dockerfile 和 app.py 放在 axolotl 的 `/tmp/vits-uma-api/`：

```bash
# 重建 image
docker build -t vits-uma-api:latest /tmp/vits-uma-api

# 啟動
docker rm -f vits-uma-api 2>/dev/null
docker run -d --name vits-uma-api \
  --network=container:gluetun-proxy \
  --restart=unless-stopped \
  -e HTTP_PORT=8080 \
  -e LANGUAGE=日语 \
  vits-uma-api:latest
```

注意：此空間使用 Gradio 3.7（websocket 協議），必須用 `gradio_client<1`（0.x 版），與 qwen-tts2api 的 gradio_client 2.x 不相容。因此拆成兩個容器、兩個 port。

## API

### GET /v1/models

回傳 65 個日配音色。voice key 為角色名（不含「日语」前綴與聲優名）。

```bash
curl -s http://172.16.1.130:8080/v1/models | jq '.voices | keys'
```

### POST /v1/audio/speech

生成日文語音。

```bash
curl -s -X POST http://172.16.1.130:8080/v1/audio/speech \
  -H "Content-Type: application/json" \
  -d '{
    "input": "お兄ちゃん、ただいま！",
    "voice": "胡桃",
    "speed": 1.0
  }' -o output.wav
```

參數：

| 參數 | 必填 | 說明 | 範圍 | 預設 |
|---|---|---|---|---|
| `input` | ✓ | 日文文本 | — | — |
| `voice` | ✓ | 角色名 | 見音色表 | — |
| `noise_scale` | | 情感起伏程度 | 0.1–1.0 | 0.6 |
| `noise_scale_w` | | 音素發音長度 | 0.1–1.0 | 0.668 |
| `speed` | | 語速 | 0.1–2.0 | 1.2 |

`GET` 也通，參數放 query string。

空間本身標註「結果有隨機性，可多次生成取最佳效果」——同樣的文本與參數可能產出不同語調。

## 完整音色表（65）

| 角色 | Voice Key | 聲優 |
|---|---|---|
| 阿貝多 | `阿贝多` | 野島健児 |
| 埃洛伊 | `埃洛伊` | 高垣彩陽 |
| 安柏 | `安柏` | 石見舞菜香 |
| 神里綾華 | `神里绫华` | 早見沙織 |
| 神里綾人 | `神里绫人` | 石田彰 |
| 白术 | `白术` | 遊佐浩二 |
| 芭芭拉 | `芭芭拉` | 鬼頭明里 |
| 北斗 | `北斗` | 小清水亜美 |
| 班尼特 | `班尼特` | 逢坂良太 |
| 坎蒂絲 | `坎蒂丝` | 柚木涼香 |
| 重雲 | `重云` | 斉藤壮馬 |
| 柯萊 | `柯莱` | 前川涼子 |
| 賽諾 | `赛诺` | 入野自由 |
| 戴因斯雷布 | `戴因斯雷布` | 津田健次郎 |
| 迪盧克 | `迪卢克` | 小野賢章 |
| 迪奧娜 | `迪奥娜` | 井澤詩織 |
| 多莉 | `多莉` | 金田朋子 |
| 優菈 | `优菈` | 佐藤利奈 |
| 菲謝爾 | `菲谢尔` | 内田真礼 |
| 甘雨 | `甘雨` | 上田麗奈 |
| 鹿野院平藏 | `鹿野院平藏` | 井口祐一 |
| 空 | `空` | 堀江瞬 |
| 蛍 | `荧` | 悠木碧 |
| 胡桃 | `胡桃` | 高橋李依 |
| 一斗 | `一斗` | 西川貴教 |
| 凱亞 | `凯亚` | 鳥海浩輔 |
| 万葉 | `万叶` | 島崎信長 |
| 刻晴 | `刻晴` | 喜多村英梨 |
| 可莉 | `可莉` | 久野美咲 |
| 心海 | `心海` | 三森鈴子 |
| 九条裟羅 | `九条裟罗` | 瀬戸麻沙美 |
| 麗莎 | `丽莎` | 田中理恵 |
| 莫娜 | `莫娜` | 小原好美 |
| 納西妲 | `纳西妲` | 田村由加莉 |
| 妮露 | `妮露` | 金元寿子 |
| 凝光 | `凝光` | 大原沙耶香 |
| 諾艾爾 | `诺艾尔` | 高尾奏音 |
| 奥茲 | `奥兹` | 増谷康紀 |
| 派蒙 | `派蒙` | 古賀葵 |
| 琴 | `琴` | 斎藤千和 |
| 七七 | `七七` | 田村由加莉 |
| 雷電将軍 | `雷电将军` | 沢城美雪 |
| 雷澤 | `雷泽` | 内山昂輝 |
| 羅莎莉亞 | `罗莎莉亚` | 加隈亜衣 |
| 早柚 | `早柚` | 洲崎綾 |
| 散兵 | `散兵` | 柿原徹也 |
| 申鶴 | `申鹤` | 川澄綾子 |
| 久岐忍 | `久岐忍` | 水橋香織 |
| 女士 | `女士` | 庄子裕衣 |
| 砂糖 | `砂糖` | 藤田茜 |
| 達達利亞 | `达达利亚` | 木村良平 |
| 托馬 | `托马` | 森田成一 |
| 提納里 | `提纳里` | 小林沙苗 |
| 温迪 | `温迪` | 村瀬歩 |
| 香菱 | `香菱` | 小澤亜李 |
| 魈 | `魈` | 松岡禎丞 |
| 行秋 | `行秋` | 皆川純子 |
| 辛焱 | `辛焱` | 高橋智秋 |
| 八重神子 | `八重神子` | 佐倉綾音 |
| 煙緋 | `烟绯` | 花守由美里 |
| 夜蘭 | `夜兰` | 遠藤綾 |
| 宵宮 | `宵宫` | 植田佳奈 |
| 雲菫 | `云堇` | 小岩井小鳥 |
| 鍾離 | `钟离` | 前野智昭 |
| （旁白/通用）| `未知` | 畠中祐 |

## 技術細節

- 上游 HF space 使用 Gradio 3.7，`show_api: false`，無 REST endpoint
- 只能用 `gradio_client` 0.x 透過 websocket 呼叫
- wrapper 內用 `asyncio.to_thread()` + threading.Lock 序列化請求
- 免費 CPU space，每次生成約 1–3 秒
- gradio_client 會將音檔下載到 local temp dir，wrapper 讀取後以 `audio/wav` 回傳

## 疑難排解

- **health 回 0 voices** → container 剛啟動，`init_voices` 還在連 HF 拉 config。等 10–15 秒
- **HTTP 500** → 查看 `docker logs vits-uma-api`。通常是 upstream space sleeping/排隊中
- **Unknown voice** → voice key 用簡體中文角色名。完整清單：`GET /v1/models`
- **port 8080 衝突** → 改 `HTTP_PORT` 環境變數
