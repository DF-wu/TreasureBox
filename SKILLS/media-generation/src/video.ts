import fs, { type FileHandle } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { resolveCredentials } from "./config";
import {
  asCustomMediaError,
  CustomMediaError,
  parseWithSchema,
} from "./errors";
import {
  assertSuccessfulResponse,
  authorizationHeaders,
  providerURL,
  readProviderJson,
} from "./http";
import { readValidatedImage, videoExtensionForMime } from "./media";
import { validateVideoModelInput } from "./models";
import {
  prepareOutputDirectory,
  reserveUniqueFile,
  resolveLocalPath,
} from "./paths";
import {
  videoInputSchema,
  videoOutputSchema,
  type VideoOutput,
} from "./schemas";
import { abortableSleep, createCallSignal } from "./signal";

const videoTaskSchema = z
  .object({
    id: z.string().min(1),
    status: z.string().min(1),
    progress: z.number().optional(),
    error: z
      .union([
        z.string(),
        z.object({ message: z.string().optional() }).passthrough(),
        z.null(),
      ])
      .optional(),
  })
  .passthrough();

const SUCCEEDED_STATUSES = new Set(["succeeded", "completed"]);
const FAILED_STATUSES = new Set(["failed", "cancelled", "canceled", "expired"]);

function taskErrorMessage(task: z.infer<typeof videoTaskSchema>): string {
  if (typeof task.error === "string") return task.error;
  if (task.error && typeof task.error.message === "string")
    return task.error.message;
  return `Video task ended with status '${task.status}'.`;
}

async function parseVideoTask(
  response: Response,
  operation: string,
  apiKey: string,
) {
  const raw = await readProviderJson(response, operation, apiKey);
  const parsed = videoTaskSchema.safeParse(raw);
  if (!parsed.success) {
    throw new CustomMediaError(
      "PROVIDER_ERROR",
      `${operation} returned malformed task JSON.`,
    );
  }
  return parsed.data;
}

async function createVideoTask(params: {
  baseURL: string;
  apiKey: string;
  route: string;
  input: z.infer<typeof videoInputSchema>;
  inputImage?: Awaited<ReturnType<typeof readValidatedImage>>;
  signal: AbortSignal;
}) {
  const form = new FormData();
  form.set("prompt", params.input.prompt);
  form.set("model", params.route);
  if (params.input.seconds !== undefined)
    form.set("seconds", String(params.input.seconds));
  if (params.input.size) form.set("size", params.input.size);
  if (params.inputImage) {
    form.set(
      "input_reference",
      new Blob([params.inputImage.bytes], { type: params.inputImage.mimeType }),
      params.inputImage.filename,
    );
  }
  const response = await fetch(providerURL(params.baseURL, "videos"), {
    method: "POST",
    headers: authorizationHeaders(params.apiKey),
    body: form,
    signal: params.signal,
  });
  return await parseVideoTask(response, "Create video", params.apiKey);
}

async function waitForVideoTask(params: {
  baseURL: string;
  apiKey: string;
  initialTask: z.infer<typeof videoTaskSchema>;
  pollIntervalMs: number;
  signal: AbortSignal;
}) {
  let task = params.initialTask;
  while (true) {
    const status = task.status.toLowerCase();
    if (SUCCEEDED_STATUSES.has(status)) return task;
    if (FAILED_STATUSES.has(status)) {
      throw new CustomMediaError("VIDEO_FAILED", taskErrorMessage(task));
    }
    await abortableSleep(params.pollIntervalMs, params.signal);
    const response = await fetch(
      providerURL(params.baseURL, `videos/${encodeURIComponent(task.id)}`),
      { headers: authorizationHeaders(params.apiKey), signal: params.signal },
    );
    task = await parseVideoTask(response, "Poll video", params.apiKey);
  }
}

async function writeChunk(
  handle: FileHandle,
  chunk: Uint8Array,
): Promise<void> {
  let offset = 0;
  while (offset < chunk.byteLength) {
    const result = await handle.write(
      chunk,
      offset,
      chunk.byteLength - offset,
      null,
    );
    if (result.bytesWritten === 0)
      throw new CustomMediaError("IO_ERROR", "Video write stalled.");
    offset += result.bytesWritten;
  }
}

async function downloadVideo(params: {
  response: Response;
  targetPath: string;
  maxBytes: number;
}): Promise<{ path: string; bytes: number; mimeType: string }> {
  const lengthHeader = params.response.headers.get("content-length");
  if (lengthHeader) {
    const length = Number(lengthHeader);
    if (!Number.isSafeInteger(length) || length < 0) {
      throw new CustomMediaError(
        "PROVIDER_ERROR",
        "Video response has an invalid Content-Length.",
      );
    }
    if (length > params.maxBytes) {
      throw new CustomMediaError(
        "DOWNLOAD_TOO_LARGE",
        `Video Content-Length ${length} exceeds the ${params.maxBytes}-byte limit.`,
      );
    }
  }
  const mimeType =
    params.response.headers.get("content-type") ?? "application/octet-stream";
  const inferredExtension = videoExtensionForMime(mimeType);
  const requestedExtension = path.extname(params.targetPath).toLowerCase();
  if (
    requestedExtension &&
    !new Set([".mp4", ".webm", ".mov"]).has(requestedExtension)
  ) {
    throw new CustomMediaError(
      "INVALID_INPUT",
      "Video output path must use .mp4, .webm, or .mov, or omit the extension.",
    );
  }
  const targetPath = requestedExtension
    ? params.targetPath
    : `${params.targetPath}${inferredExtension}`;
  const realDirectory = await prepareOutputDirectory(path.dirname(targetPath));
  const reserved = await reserveUniqueFile(
    path.join(realDirectory, path.basename(targetPath)),
  );
  let bytes = 0;

  try {
    if (!params.response.body) {
      throw new CustomMediaError(
        "PROVIDER_ERROR",
        "Video response did not include a body.",
      );
    }
    const reader = params.response.body.getReader();
    try {
      while (true) {
        const item = await reader.read();
        if (item.done) break;
        bytes += item.value.byteLength;
        if (bytes > params.maxBytes) {
          await reader.cancel();
          throw new CustomMediaError(
            "DOWNLOAD_TOO_LARGE",
            `Video stream exceeded the ${params.maxBytes}-byte limit.`,
          );
        }
        await writeChunk(reserved.handle, item.value);
      }
    } finally {
      reader.releaseLock();
    }
    await reserved.handle.close();
    return {
      path: reserved.path,
      bytes,
      mimeType: mimeType.split(";")[0]!.trim(),
    };
  } catch (error) {
    await reserved.handle.close().catch(() => undefined);
    await fs.unlink(reserved.path).catch(() => undefined);
    throw error;
  }
}

export async function generateVideoCommand(
  rawInput: Record<string, unknown>,
  options: { cwd?: string; signal?: AbortSignal } = {},
): Promise<VideoOutput> {
  const input = parseWithSchema(videoInputSchema, rawInput, "video input");
  const registration = validateVideoModelInput(input);
  const credentials = resolveCredentials();
  const cwd = options.cwd ?? process.cwd();
  const targetPath = resolveLocalPath(cwd, input.path);
  const callSignal = createCallSignal(options.signal, input.timeoutMs);

  try {
    let inputImage: Awaited<ReturnType<typeof readValidatedImage>> | undefined;
    if (input.inputImage) {
      inputImage = await readValidatedImage({
        filePath: resolveLocalPath(cwd, input.inputImage),
      });
    }
    const created = await createVideoTask({
      baseURL: credentials.baseURL,
      apiKey: credentials.apiKey,
      route: registration.route,
      input,
      inputImage,
      signal: callSignal.signal,
    });
    const completed = await waitForVideoTask({
      baseURL: credentials.baseURL,
      apiKey: credentials.apiKey,
      initialTask: created,
      pollIntervalMs: input.pollIntervalMs,
      signal: callSignal.signal,
    });
    const contentResponse = await fetch(
      providerURL(
        credentials.baseURL,
        `videos/${encodeURIComponent(completed.id)}/content`,
      ),
      {
        headers: authorizationHeaders(credentials.apiKey),
        signal: callSignal.signal,
      },
    );
    await assertSuccessfulResponse(
      contentResponse,
      "Download video",
      credentials.apiKey,
    );
    const downloaded = await downloadVideo({
      response: contentResponse,
      targetPath,
      maxBytes: input.maxDownloadBytes,
    });
    return videoOutputSchema.parse({
      ok: true,
      path: downloaded.path,
      bytes: downloaded.bytes,
      mimeType: downloaded.mimeType,
      model: input.model,
      route: registration.route,
      videoId: completed.id,
    });
  } catch (error) {
    if (callSignal.signal.aborted) callSignal.mapAbort(error);
    if (error instanceof CustomMediaError) throw error;
    throw asCustomMediaError(
      error,
      "PROVIDER_ERROR",
      "Video generation failed",
      [credentials.apiKey],
    );
  } finally {
    callSignal.cleanup();
  }
}
