#!/usr/bin/env node
import { z } from "zod";
import { API_KEY_ENV, BASE_URL_ENV, resolveCredentials } from "./config";
import { CustomMediaError, redactDiagnostic } from "./errors";
import { authorizationHeaders, providerURL, readProviderJson } from "./http";
import { generateImageCommand } from "./image";
import { IMAGE_MODEL_REGISTRY, VIDEO_MODEL_REGISTRY } from "./models";
import { generateVideoCommand } from "./video";

type Command = "doctor" | "models" | "image" | "video";
type JsonSuccess = { ok: true; data: unknown };
type JsonFailure = { ok: false; error: { code: string; message: string } };

const modelListSchema = z.object({
  data: z.array(z.object({ id: z.string() }).passthrough()),
});

const IMAGE_FIELDS = new Set([
  "prompt",
  "model",
  "outputDir",
  "inputImages",
  "maskImage",
  "size",
  "aspectRatio",
  "timeoutMs",
]);
const VIDEO_FIELDS = new Set([
  "prompt",
  "model",
  "path",
  "inputImage",
  "seconds",
  "size",
  "pollIntervalMs",
  "timeoutMs",
  "maxDownloadBytes",
]);

function writeSuccess(data: unknown): void {
  const output: JsonSuccess = { ok: true, data };
  process.stdout.write(`${JSON.stringify(output)}\n`);
}

function writeFailure(error: unknown): never {
  const known =
    error instanceof CustomMediaError
      ? error
      : new CustomMediaError("PROVIDER_ERROR", redactDiagnostic(error));
  const output: JsonFailure = {
    ok: false,
    error: { code: known.code, message: known.message },
  };
  process.stderr.write(`${JSON.stringify(output)}\n`);
  process.exit(1);
}

function usageData() {
  return {
    usage: "media-generation <doctor|models|image|video> [--field value]",
    commands: ["doctor", "models", "image", "video"],
    environment: ["OPENAI_COMPATIBLE_BASE_URL", "OPENAI_COMPATIBLE_API_KEY"],
  };
}

function canonicalField(raw: string): string {
  const aliases: Record<string, string> = {
    "output-dir": "outputDir",
    "input-images": "inputImages",
    "mask-image": "maskImage",
    "aspect-ratio": "aspectRatio",
    "timeout-ms": "timeoutMs",
    "input-image": "inputImage",
    "poll-interval-ms": "pollIntervalMs",
    "max-download-bytes": "maxDownloadBytes",
  };
  return aliases[raw] ?? raw;
}

export function parseCommandArguments(
  command: "image" | "video",
  args: readonly string[],
): Record<string, unknown> {
  const allowed = command === "image" ? IMAGE_FIELDS : VIDEO_FIELDS;
  const result: Record<string, unknown> = {};
  const inputImages: string[] = [];

  for (let index = 0; index < args.length; index++) {
    const token = args[index]!;
    if (!token.startsWith("--") || token === "--") {
      throw new CustomMediaError(
        "INVALID_INPUT",
        `Unexpected positional argument '${token}'.`,
      );
    }
    const equalIndex = token.indexOf("=");
    const rawField = token.slice(2, equalIndex < 0 ? undefined : equalIndex);
    const field = canonicalField(rawField);
    if (!allowed.has(field)) {
      throw new CustomMediaError(
        "INVALID_INPUT",
        `Unknown ${command} option '--${rawField}'.`,
      );
    }
    let value: string;
    if (equalIndex >= 0) {
      value = token.slice(equalIndex + 1);
    } else {
      const next = args[index + 1];
      if (next === undefined || next.startsWith("--")) {
        throw new CustomMediaError(
          "INVALID_INPUT",
          `Option '--${rawField}' requires a value.`,
        );
      }
      value = next;
      index += 1;
    }
    if (!value.length) {
      throw new CustomMediaError(
        "INVALID_INPUT",
        `Option '--${rawField}' must not be empty.`,
      );
    }
    if (field === "inputImages") {
      inputImages.push(
        ...value
          .split(",")
          .map((entry) => entry.trim())
          .filter(Boolean),
      );
      continue;
    }
    if (Object.hasOwn(result, field)) {
      throw new CustomMediaError(
        "INVALID_INPUT",
        `Option '--${rawField}' was provided twice.`,
      );
    }
    result[field] = value;
  }
  if (inputImages.length) result.inputImages = inputImages;
  return result;
}

async function doctorCommand(): Promise<unknown> {
  const credentials = resolveCredentials();
  let raw: unknown;
  try {
    const response = await fetch(providerURL(credentials.baseURL, "models"), {
      headers: authorizationHeaders(credentials.apiKey),
      signal: AbortSignal.timeout(10_000),
    });
    raw = await readProviderJson(response, "List models", credentials.apiKey);
  } catch (error) {
    if (error instanceof CustomMediaError) throw error;
    throw new CustomMediaError(
      "PROVIDER_ERROR",
      `List models failed: ${redactDiagnostic(error, [credentials.apiKey])}`,
    );
  }
  const parsed = modelListSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CustomMediaError(
      "PROVIDER_ERROR",
      "List models returned malformed JSON.",
    );
  }
  const availableIds = new Set(parsed.data.data.map((model) => model.id));
  const routes = [
    ...Object.values(IMAGE_MODEL_REGISTRY),
    ...Object.values(VIDEO_MODEL_REGISTRY),
  ].map((registration) => registration.route);
  return {
    checks: [
      { check: BASE_URL_ENV, status: "ok", value: credentials.baseURL },
      { check: API_KEY_ENV, status: "ok", value: "<redacted>" },
      {
        check: "GET /models",
        status: "ok",
        value: `${parsed.data.data.length} models`,
      },
    ],
    availableModels: [...new Set(routes)].map((id) => ({
      id,
      available: availableIds.has(id),
    })),
  };
}

function modelsCommand(): unknown {
  return {
    imageModels: Object.values(IMAGE_MODEL_REGISTRY).map((registration) => ({
      alias: registration.alias,
      route: registration.route,
      capabilities: {
        supportsEdit: registration.profile.supportsEdit,
        supportsMask: registration.profile.supportsMask,
        maxInputImages: registration.profile.maxInputImages,
      },
    })),
    videoModels: Object.values(VIDEO_MODEL_REGISTRY).map((registration) => ({
      alias: registration.alias,
      route: registration.route,
      capabilities: {
        supportsInputImage: registration.profile.supportsInputImage,
      },
    })),
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    writeSuccess(usageData());
    return;
  }
  const command = args[0] as Command;
  if (!new Set<Command>(["doctor", "models", "image", "video"]).has(command)) {
    throw new CustomMediaError(
      "INVALID_INPUT",
      `Unknown command '${args[0]}'.`,
    );
  }
  if ((command === "doctor" || command === "models") && args.length > 1) {
    throw new CustomMediaError(
      "INVALID_INPUT",
      `${command} does not accept arguments.`,
    );
  }

  switch (command) {
    case "doctor":
      writeSuccess(await doctorCommand());
      return;
    case "models":
      writeSuccess(modelsCommand());
      return;
    case "image":
      writeSuccess(
        await generateImageCommand(
          parseCommandArguments("image", args.slice(1)),
        ),
      );
      return;
    case "video":
      writeSuccess(
        await generateVideoCommand(
          parseCommandArguments("video", args.slice(1)),
        ),
      );
      return;
  }
}

main().catch(writeFailure);
