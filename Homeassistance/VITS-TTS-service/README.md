# Home Assistant VITS-TTS Service Incident Note

## Scope

This note captures the debugging trail for the Home Assistant `VITS` TTS setup that was misbehaving on `zh` output and leaking Discord metadata into the spoken text.

## Observed Problems

- `zh` synthesis was still producing the wrong voice path.
- The spoken output included raw metadata payloads such as `<LILAC_META:v1>...</LILAC_META:v1>`.
- The generated text sometimes still looked like it was coming from the Discord bridge payload rather than the human-visible message.
- A Lovelace resource called `mushroom-better-sliders` was unexpectedly present again after restoring dashboard resources from backup.

## Root Causes Identified

- The `df_room_say_vits` flow had an incorrect Chinese default speaker selection.
- The shell command used for VITS was relying on a brittle invocation shape and defaulted in a way that did not match the intended language routing.
- The message being handed to TTS was not sanitized before synthesis.
- The Lovelace resource list was restored from an older backup and reintroduced a stale custom card resource.

## Live System Changes Applied

- `scripts.yaml`
  - Rewrote `df_room_say_vits` cleanly.
  - `zh` now defaults to `云堇`.
  - `ja` still routes to `ayaka`.
  - Added `clean_message` to strip Discord metadata and the `@df_chatbot` marker before synthesis.
- `shell_commands.yaml`
  - Switched VITS invocation to explicit `-t` text input.
  - Set the default speaker to `云堇`.
  - Set the default language to `zh`.
- `lovelace_resources`
  - Removed `mushroom-better-sliders` after confirming it came from the older backup restoration.

## Verification So Far

- VITS CLI accepts `zh`, `ja`, and `mix`.
- `zh` synthesis succeeds with `云堇`.
- The `mushroom-better-sliders` resource is no longer present in the restored Lovelace resource list.
- The current repo copy of the note is meant to preserve the incident history; it does not replace live validation on Home Assistant.

## Current Status

The repo has a documented record of the incident and the implemented mitigation. If the live `VITS` path still sounds wrong after these changes, the next step is to inspect the exact runtime payload reaching the `script.df_room_say_vits` call and confirm whether an upstream caller is still overriding the speaker or injecting extra text.
