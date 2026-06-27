#!/bin/sh

set -eu

TEXT=${VITS_TEXT-${1-}}
LANG_CODE=${VITS_LANG-${2-zh}}
SPEAKER=${VITS_SPEAKER-${3-}}
OUTPUT=${VITS_OUTPUT-${4-/media/vits/df-room-latest.wav}}
VITS_BIN=${VITS_BIN:-/config/bin/vits-tts}

sanitize_message() {
    printf '%s' "$1" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e '/^[[:space:]]*<LILAC_META:v1>/d' -e '/^[[:space:]]*@df_chatbot[[:space:]]*$/d' -e '/^[[:space:]]*$/d'
}

normalize_scalar() {
    value=$1
    value=${value#\"}
    value=${value%\"}
    printf '%b' "$(printf '%s' "$value" | sed -e 's/\\"/"/g' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
}

TEXT=$(normalize_scalar "$TEXT")
LANG_CODE=$(normalize_scalar "$LANG_CODE")
SPEAKER=$(normalize_scalar "$SPEAKER")

RESOLVED_TEXT=$(sanitize_message "$TEXT")
if [ -z "$RESOLVED_TEXT" ]; then
    printf '%s\n' 'message is empty after sanitization' >&2
    exit 2
fi

if [ -z "$LANG_CODE" ]; then
    LANG_CODE=zh
fi

if [ -z "$SPEAKER" ]; then
    if [ "$LANG_CODE" = "ja" ]; then
        SPEAKER=ayaka
    else
        SPEAKER=云堇
    fi
fi

mkdir -p "$(dirname "$OUTPUT")"
exec "$VITS_BIN" -t "$RESOLVED_TEXT" -s "$SPEAKER" -l "$LANG_CODE" -o "$OUTPUT" -q
