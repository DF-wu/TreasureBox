# Home Assistant VITS-TTS Service

This directory is the git-managed source for the `df-ha` VITS broadcast implementation.

## What This Contains

- `configuration.yaml`
  - Managed HA config fragment showing the required `df_vits_bridge:` setup hook.
- `scripts.yaml`
  - Canonical `df_room_say_vits` and `df_room_say_edge` definitions.
- `bin/df-room-vits-generate.sh`
  - Runtime wrapper that normalizes text/lang/speaker input before invoking `vits-tts`.
- `custom_components/df_vits_bridge/`
  - In-HA custom service that generates VITS output through a real argv subprocess call.
- `DESIGN.md`
  - Full architecture and API design notes.
- `tests/`
  - Regression tests for wrapper normalization, HA script shape, and custom service registration.

## Runtime Behavior

- `script.df_room_say_vits` is the user-facing VITS broadcast entry point.
- `script.df_room_say_edge` supports selectable broadcast devices.
- `df_vits_bridge.generate` is the low-level HA service that writes one WAV file per run under `/media/vits`.
- `zh` defaults to `云堇`.
- `ja` defaults to `ayaka`.
- Explicit `speaker` overrides are preserved.
- Discord bridge payload markers such as `<LILAC_META:v1>...</LILAC_META:v1>` and `@df_chatbot` are stripped before synthesis.

## Why The Final Design Uses A Custom Component

Runtime debugging on `df-ha` showed that HA's `shell_command` transport was not reliable for this workload:

- positional args were dropped
- inline env assignment failed
- `sh -c` variants still arrived with zero argv in this environment

The final working design therefore moves generation into a Home Assistant custom service and leaves only playback orchestration in `scripts.yaml`.

## External API Support

Home Assistant can invoke this service externally through its REST API.

- Broadcast + playback:
  - `POST /api/services/script/df_room_say_vits`
- Generation only:
  - `POST /api/services/df_vits_bridge/generate?return_response`

See `DESIGN.md` for request and response examples.

## Live Files On `df-ha`

- `/homeassistant/configuration.yaml`
- `/homeassistant/scripts.yaml`
- `/homeassistant/bin/df-room-vits-generate.sh`
- `/homeassistant/custom_components/df_vits_bridge/__init__.py`
- `/homeassistant/custom_components/df_vits_bridge/manifest.json`
- `/homeassistant/custom_components/df_vits_bridge/services.yaml`

## Verification Status

- Local managed tests pass.
- `ha core check` passes on `df-ha`.
- `df_vits_bridge.generate` writes WAV files successfully on `df-ha`.
- `script.df_room_say_vits` generates per-run VITS WAV files and updates Cast playback to those files.
