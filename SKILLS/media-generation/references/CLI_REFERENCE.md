# CLI Reference

## Invocation

The wrapper resolves its own directory and runs the bundled Node-target JavaScript:

```bash
./media-generation <command> [--field value]
```

Both `--field value` and `--field=value` are accepted. Kebab-case forms such as
`--output-dir`, `--input-images`, `--aspect-ratio`, and `--timeout-ms` are aliases for the
documented camelCase fields. Unknown fields, duplicate scalar fields, missing values, and
positional arguments fail with `INVALID_INPUT`.

## Commands

### doctor

Takes no arguments. Requires both environment variables and performs authenticated model
discovery. The API key check is represented only as `<redacted>`.

### models

Takes no arguments and performs no network access. Returns image and video aliases, routes, and
capabilities from the static registry.

### image

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `prompt` | yes | - | Generation or edit instruction |
| `model` | no | `gpt-image-2` | Registry alias |
| `outputDir` | no | current directory | Destination directory |
| `inputImages` | no | - | Repeat or comma-separate local image paths |
| `maskImage` | no | - | Local mask; requires `inputImages` |
| `size` | no | model default | `widthxheight`; mutually exclusive with `aspectRatio` |
| `aspectRatio` | no | model default | `width:height` |
| `timeoutMs` | no | `600000` | Whole operation timeout, 100-1800000 |

Image output uses `generated-image.<ext>`. Existing files are not overwritten; the next file is
`generated-image (1).<ext>`.

### video

| Field | Required | Default | Meaning |
| --- | --- | --- | --- |
| `prompt` | yes | - | Video instruction |
| `model` | no | `grok-imagine-video` | Registry alias |
| `path` | yes | - | Output path; `.mp4`, `.webm`, `.mov`, or no extension |
| `inputImage` | no | - | Local image for image-to-video |
| `seconds` | no | provider default | Duration, 1-15 |
| `size` | no | provider default | Supported `widthxheight` |
| `pollIntervalMs` | no | `2000` | Status poll delay, 10-30000 |
| `timeoutMs` | no | `600000` | Whole operation timeout, 100-1800000 |
| `maxDownloadBytes` | no | `268435456` | Stream bound, maximum 536870912 |

Partial video files are removed after aborts, provider errors, I/O errors, and download-limit
failures. Existing output names receive a numbered suffix.

## JSON And Exit Codes

Success is written only to stdout with exit code 0:

```json
{"ok":true,"data":{"path":"/absolute/output.png","bytes":123,"mimeType":"image/png","model":"gpt-image-2","route":"gpt-image-2"}}
```

Failures are written only to stderr with exit code 1:

```json
{"ok":false,"error":{"code":"UNSUPPORTED_CAPABILITY","message":"[UNSUPPORTED_CAPABILITY] ..."}}
```

Prompts and credentials are omitted from success payloads. Diagnostics redact Bearer tokens,
`sk-*` tokens, and the exact configured API key.

## Local File Safety

Relative paths resolve from the caller's current directory; `~/` is expanded. NUL-containing
paths are rejected. Inputs must resolve to regular files and are validated by byte signature.
Supported inputs are PNG, JPEG, GIF, and WebP, bounded to 20 MiB each. Output directories are
created with private permissions and files use exclusive creation with mode `0600`.