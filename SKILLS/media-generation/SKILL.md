---
name: media-generation
description: Generate or edit images and generate videos through an OpenAI-compatible new-api endpoint. Use for gpt-image-2, gpt-5-image, nanobanana variants, Grok image, or Grok video; also use doctor to verify endpoint credentials and model routes.
homepage: https://github.com/QuantumNous/new-api
metadata: {"clawdbot":{"requires":{"bins":["node"]}}}
---

# Media Generation

Use the bundled CLI from this skill directory. It needs no runtime package installation.

```bash
./media-generation <doctor|models|image|video> [options]
```

Set the exact environment variables before network commands:

```bash
export OPENAI_COMPATIBLE_BASE_URL="https://new-api.example.com/v1"
export OPENAI_COMPATIBLE_API_KEY="..."
```

## Choose A Command

- `doctor`: authenticate `GET /v1/models` and compare provider routes with the registry.
- `models`: inspect aliases and capabilities locally; no credentials or network required.
- `image`: generate an image or edit one or more local images.
- `video`: submit a new-api video task, poll it, and stream the result to disk.

## Common Calls

```bash
./media-generation doctor
./media-generation models

./media-generation image \
  --prompt "A quiet harbor at dawn" \
  --model gpt-image-2 \
  --aspectRatio 3:2 \
  --outputDir ./media

./media-generation image \
  --prompt "Replace the sky with morning light" \
  --model gpt-5-image \
  --inputImages ./base.png,./reference.png \
  --maskImage ./mask.png \
  --outputDir ./media

./media-generation video \
  --prompt "A slow cinematic camera move" \
  --model grok-imagine-video \
  --inputImage ./frame.png \
  --seconds 5 \
  --size 1280x720 \
  --path ./media/clip.mp4
```

Options accept both `--field value` and `--field=value`. Repeat `--inputImages` or use a
comma-separated value. There is no provider fallback and image retries are disabled.

Success is one JSON object on stdout. Failure is one JSON object on stderr with exit code 1.
Success payloads contain output metadata, never prompts or credentials.

## Detailed References

- [CLI_REFERENCE.md](references/CLI_REFERENCE.md): every argument, JSON envelopes, file behavior,
  timeout and download limits.
- [MODEL_REGISTRY.md](references/MODEL_REGISTRY.md): alias routes and per-model capability rules.
- [PROTOCOLS.md](references/PROTOCOLS.md): doctor, AI SDK image, and new-api video HTTP flows.
