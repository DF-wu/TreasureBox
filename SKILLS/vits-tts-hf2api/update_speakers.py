#!/usr/bin/env python3
"""Fetch speaker list from upstream and update references/vits_speakers.json.

Usage:
    python3 update_speakers.py

Reads /config from ikechan8370 HF Space, extracts speaker dropdown choices,
generates aliases (English pinyin + short names), and writes to JSON.
The Go binary reads this file at runtime for speaker resolution.

After updating, rebuild:
    cd src/go && CGO_ENABLED=0 go build -ldflags="-s -w" -o ../../vits-tts ./cmd/vits-tts/
"""
import json
import urllib.request
import os
import sys
import re

URL = "https://ikechan8370-vits-uma-genshin-honkai.hf.space/config"
HERE = os.path.dirname(os.path.abspath(__file__))
# Two outputs, kept in lockstep so the Go binary's go:embed copy never drifts
# from the canonical references/ copy used by humans and Python.
OUTPUTS = [
    os.path.join(HERE, "references", "vits_speakers.json"),
    os.path.join(HERE, "src", "go", "internal", "speaker", "vits_speakers.json"),
]

# Hard alias map for common romaji → character name lookups (stable across upstream changes)
HARD_ALIASES = {
    "ayaka": "日语神里绫华（早见沙织）",
    "ganyu": "日语甘雨（上田丽奈）",
    "hutao": "日语胡桃（高桥李依）",
    "keqing": "日语刻晴（喜多村英梨）",
    "paimon": "日语派蒙（古贺葵）",
    "zhongli": "日语钟离（前野智昭）",
    "raiden": "日语雷电将军（泽城美雪）",
    "kazuha": "日语万叶（岛崎信长）",
    "yoimiya": "日语宵宫（植田佳奈）",
    "nahida": "日语纳西妲（田村由加莉）",
    "furina": "日语芙宁娜",
    "yae": "日语八重神子（佐仓绫音）",
    "kokomi": "日语心海（三森铃子）",
    "eula": "日语优菈（佐藤利奈）",
    "xiao": "日语魈（松冈祯丞）",
    "venti": "日语温迪（村濑步）",
    "mona": "日语莫娜（小原好美）",
    "klee": "日语可莉（久野美咲）",
    "diluc": "日语迪卢克（小野贤章）",
    "jean": "日语琴（斋藤千和）",
    "lisa": "日语丽莎（田中理惠）",
    "amber": "日语安柏（石见舞菜香）",
    "barbara": "日语芭芭拉（鬼头明里）",
    "kaeya": "日语凯亚（鸟海浩辅）",
    "bennett": "日语班尼特（逢坂良太）",
    "fischl": "日语菲谢尔（内田真礼）",
    "noelle": "日语诺艾尔（高尾奏音）",
    "sucrose": "日语砂糖（藤田茜）",
    "xiangling": "日语香菱（小泽亚李）",
    "beidou": "日语北斗（小清水亚美）",
    "ningguang": "日语凝光（大原沙耶香）",
    "xingqiu": "日语行秋（皆川纯子）",
    "chongyun": "日语重云（齐藤壮马）",
    "qiqi": "日语七七（田村由加莉）",
    "albedo": "日语阿贝多（野岛健儿）",
    "rosaria": "日语罗莎莉亚（加隈亚衣）",
    "tartaglia": "日语达达利亚（木村良平）",
    "yaoyao": "瑶瑶",
    "shenhe": "日语申鹤（川澄绫子）",
    "nilou": "日语妮露（金元寿子）",
    "cyno": "日语赛诺（入野自由）",
    "dehya": "迪希雅",
    "alhaitham": "艾尔海森",
    "yaemiko": "日语八重神子（佐仓绫音）",
    "shogun": "日语雷电将军（泽城美雪）",
    "itto": "日语一斗（西川贵教）",
    "heizou": "日语鹿野院平藏（井口祐一）",
    "collei": "日语柯莱（前川凉子）",
    "dori": "日语多莉（金田朋子）",
    "candace": "日语坎蒂丝（柚木凉香）",
    "layla": "莱依拉",
    "faruzan": "珐露珊",
    "kaveh": "卡维",
    "baizhu": "日语白术（游佐浩二）",
    "kuki": "日语久岐忍（水桥香织）",
    "sara": "日语九条裟罗（濑户麻沙美）",
    "thoma": "日语托马（森田成一）",
    "sayu": "日语早柚（洲崎绫）",
    "gorou": "日语五郎",
    "tighnari": "日语提纳里（小林沙苗）",
    "wanderer": "日语散兵（柿原彻也）",
    "kafka": "卡芙卡",
    "silverwolf": "银狼",
    "seele": "希儿",
    "bronya": "布洛妮娅",
    "himeko": "姬子",
    "welt": "瓦尔特",
    "march7th": "三月七",
    "danheng": "丹恒",
    "acheron": "黄泉",
    "firefly": "流萤",
    "robin": "知更鸟",
    "rem": "蕾姆",
    "ram": "拉姆",
    "emilia": "爱蜜莉雅",
    "kirito": "桐人",
    "asuna": "亚丝娜",
    "mikasa": "三笠",
    "levi": "利威尔",
    "eren": "艾伦",
    "tanjiro": "炭治郎",
    "nezuko": "祢豆子",
    "luffy": "路飞",
    "zoro": "索隆",
    "naruto": "鸣人",
    "sasuke": "佐助",
    "goku": "孙悟空",
}


def main():
    print(f"Fetching: {URL}")
    try:
        resp = urllib.request.urlopen(URL, timeout=60)
        config = json.loads(resp.read())
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

    choices = None
    for c in config.get("components", []):
        if c.get("id") == 13 and c.get("type") == "dropdown":
            choices = c["props"]["choices"]
            break
    if not choices:
        print("ERROR: Could not find speaker dropdown (id=13)", file=sys.stderr)
        sys.exit(1)

    # Build auto-aliases: extract base name from Gradio string
    # E.g., "日语甘雨（上田丽奈）" → alias "甘雨" → "日语甘雨（上田丽奈）"
    auto_aliases = {}
    for gc in choices:
        name = gc
        if name.startswith("日语"):
            name = name[2:]
        if "（" in name:
            base = name.split("（")[0]
            auto_aliases[base] = gc

    # Merge: hard aliases override auto (hard aliases point to specific JP voices)
    aliases = {}
    for alias, canonical in sorted(auto_aliases.items()):
        if canonical in choices:
            aliases[alias] = canonical
    for alias, target in sorted(HARD_ALIASES.items()):
        if target in choices:
            aliases[alias] = target

    ref = {
        "choices": choices,
        "aliases": aliases,
        "count": len(choices),
        "alias_count": len(aliases),
        "generated_from": URL,
    }
    for out in OUTPUTS:
        os.makedirs(os.path.dirname(out), exist_ok=True)
        with open(out, "w", encoding="utf-8") as f:
            json.dump(ref, f, ensure_ascii=False, indent=2)
        print(f"Wrote {len(choices)} speakers + {len(aliases)} aliases to {out}")
    print("  Rebuild: cd src/go && CGO_ENABLED=0 go build -ldflags='-s -w' -o ../../vits-tts ./cmd/vits-tts/")

if __name__ == "__main__":
    main()
