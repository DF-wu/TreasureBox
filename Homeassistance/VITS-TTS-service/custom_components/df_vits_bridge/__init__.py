from __future__ import annotations

import asyncio
from pathlib import Path

from homeassistant.core import HomeAssistant, ServiceCall
from homeassistant.exceptions import HomeAssistantError

DOMAIN = "df_vits_bridge"
SERVICE_GENERATE = "generate"
WRAPPER_PATH = "/config/bin/df-room-vits-generate.sh"
ALLOWED_DIR = Path("/media/vits")


async def async_setup(hass: HomeAssistant, config: dict) -> bool:
    async def handle_generate(call: ServiceCall) -> dict[str, object]:
        text = str(call.data.get("text", ""))
        lang = str(call.data.get("lang", "zh"))
        speaker = str(call.data.get("speaker", ""))
        output = str(call.data.get("output", ""))

        output_path = Path(output)
        if not output or not str(output_path).startswith(str(ALLOWED_DIR) + "/"):
            raise HomeAssistantError(f"output path must stay under {ALLOWED_DIR}")

        def run_wrapper() -> dict[str, object]:
            import subprocess

            completed = subprocess.run(
                [WRAPPER_PATH, text, lang, speaker, output],
                check=False,
                capture_output=True,
                text=True,
                timeout=55,
            )
            if completed.returncode != 0:
                raise HomeAssistantError(
                    completed.stderr.strip()
                    or completed.stdout.strip()
                    or "vits generation failed"
                )

            if not output_path.exists():
                raise HomeAssistantError("output file missing")
            if output_path.stat().st_size == 0:
                raise HomeAssistantError("output file empty")

            return {
                "returncode": completed.returncode,
                "stdout": completed.stdout,
                "stderr": completed.stderr,
                "output": output,
            }

        return await asyncio.to_thread(run_wrapper)

    hass.services.async_register(
        DOMAIN, SERVICE_GENERATE, handle_generate, supports_response="only"
    )
    return True
