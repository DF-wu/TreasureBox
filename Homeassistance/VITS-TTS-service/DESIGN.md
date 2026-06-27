# DF VITS Broadcast Service Design

## Goal

Provide a Home Assistant broadcast path that can be triggered manually, from automations, and from external API callers while preserving dynamic `text`, `lang`, `speaker`, and per-run output files.

## Final Architecture

```text
script.df_room_say_vits
  -> df_vits_bridge.generate
    -> /config/bin/df-room-vits-generate.sh
      -> /config/bin/vits-tts
  -> media_player.play_media
```

## Why This Architecture

The original `shell_command` path was not reliable on `df-ha`.

- Multi-line command bodies lost argv.
- Inline env assignment was treated as an executable name.
- `sh -c` transport variants still arrived at the wrapper with zero positional args.
- An external localhost bridge process worked functionally but added process-lifecycle fragility inside HAOS.

The custom component service avoids those problems because it runs inside Home Assistant and invokes the wrapper with a real argv list via Python `subprocess.run([...])`.

## Key Design Decisions

### 1. In-HA generation service

`custom_components/df_vits_bridge/__init__.py` registers `df_vits_bridge.generate` and validates:

- output path must stay under `/media/vits`
- subprocess must exit `0`
- output file must exist
- output file must be non-empty

### 2. Per-run output files

`scripts.yaml` generates one file per invocation:

```text
df-room-<context.id>.wav
```

This prevents queued broadcasts from overwriting each other.

### 3. Fail-closed playback

`script.df_room_say_vits` captures the service response in `shell_response` and stops before playback if generation fails.

### 4. Cast-friendly playback URL

The VITS script plays a direct local HTTP URL:

```text
http://192.168.11.201:8123/media/local/vits/<file>.wav
```

This matches the successful fetch pattern already used by Edge TTS on the same Home Assistant instance.

### 5. Device selection

Both broadcast scripts support selectable `media_players`, defaulting to `media_player.nestaudio4326` when omitted.

## External API Usage

Two supported HA API entry points exist.

### Option A: Call the user-facing script

Recommended for external callers.

```http
POST /api/services/script/df_room_say_vits
Authorization: Bearer <token>
Content-Type: application/json

{
  "message": "今晚十點關燈",
  "lang": "zh",
  "speaker": "",
  "volume": 0.2,
  "media_players": ["media_player.nestaudio4326"]
}
```

Use this when the caller wants generation plus playback.

### Option B: Call the generation service directly

```http
POST /api/services/df_vits_bridge/generate?return_response
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "今晚十點關燈",
  "lang": "zh",
  "speaker": "",
  "output": "/media/vits/manual.wav"
}
```

Typical response body:

```json
{
  "changed_states": [],
  "service_response": {
    "returncode": 0,
    "stdout": "",
    "stderr": "",
    "output": "/media/vits/manual.wav"
  }
}
```

Use this when the caller only wants file generation.

## Files That Matter

- `configuration.yaml`
- `scripts.yaml`
- `bin/df-room-vits-generate.sh`
- `custom_components/df_vits_bridge/__init__.py`
- `custom_components/df_vits_bridge/services.yaml`

## Deprecated Paths Removed

The repo no longer treats these as active architecture:

- `shell_command`-based VITS transport
- external localhost bridge daemon

They were removed because runtime debugging on `df-ha` showed them to be the source of transport instability.
