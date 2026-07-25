import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const USE_DIST = process.env.MEDIA_GENERATION_CLI === "dist";
const API_KEY = "sk-media-test-secret";
const PROMPT = "a private test prompt";
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

let servers: Array<ReturnType<typeof Bun.serve>> = [];
let cleanupPaths: string[] = [];

afterEach(async () => {
  for (const server of servers) await server.stop(true);
  servers = [];
  for (const cleanupPath of cleanupPaths) {
    await fs.rm(cleanupPath, { recursive: true, force: true });
  }
  cleanupPaths = [];
});

async function tempDirectory(prefix: string): Promise<string> {
  const directory = await fs.mkdtemp(path.join(tmpdir(), prefix));
  cleanupPaths.push(directory);
  return directory;
}

function startServer(
  fetch: (request: Request) => Response | Promise<Response>,
) {
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch });
  servers.push(server);
  return server;
}

async function runCLI(
  args: readonly string[],
  options: {
    server?: ReturnType<typeof Bun.serve>;
    cwd?: string;
    env?: Record<string, string>;
  } = {},
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const command = USE_DIST
    ? [path.join(ROOT, "media-generation"), ...args]
    : [process.execPath, path.join(ROOT, "src/cli.ts"), ...args];
  const processHandle = Bun.spawn(command, {
    cwd: options.cwd ?? ROOT,
    env: {
      ...process.env,
      OPENAI_COMPATIBLE_BASE_URL: options.server
        ? `http://127.0.0.1:${options.server.port}`
        : "",
      OPENAI_COMPATIBLE_API_KEY: options.server ? API_KEY : "",
      ...options.env,
    },
    stdin: "ignore",
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(processHandle.stdout).text(),
    new Response(processHandle.stderr).text(),
    processHandle.exited,
  ]);
  return { stdout, stderr, exitCode };
}

function parseSuccess(result: Awaited<ReturnType<typeof runCLI>>) {
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  const parsed = JSON.parse(result.stdout) as {
    ok: boolean;
    data: Record<string, unknown>;
  };
  expect(parsed.ok).toBe(true);
  return parsed.data;
}

function parseFailure(result: Awaited<ReturnType<typeof runCLI>>) {
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toBe("");
  const parsed = JSON.parse(result.stderr) as {
    ok: boolean;
    error: { code: string; message: string };
  };
  expect(parsed.ok).toBe(false);
  return parsed.error;
}

describe("media-generation CLI", () => {
  test.serial(
    "doctor authenticates GET /models and redacts its key",
    async () => {
      const server = startServer((request) => {
        expect(new URL(request.url).pathname).toBe("/v1/models");
        expect(request.method).toBe("GET");
        expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
        return Response.json({
          data: [{ id: "gpt-image-2" }, { id: "grok-imagine-video" }],
        });
      });
      const result = await runCLI(["doctor"], { server });
      const data = parseSuccess(result);
      expect(result.stdout).not.toContain(API_KEY);
      expect(data.checks).toContainEqual({
        check: "OPENAI_COMPATIBLE_API_KEY",
        status: "ok",
        value: "<redacted>",
      });
    },
  );

  test.serial(
    "models returns the route registry without credentials",
    async () => {
      const result = await runCLI(["models"]);
      const data = parseSuccess(result);
      expect(data.imageModels).toBeArray();
      expect(data.videoModels).toBeArray();
      expect(result.stdout).not.toContain("OPENAI_COMPATIBLE_API_KEY");
    },
  );

  test.serial("image generation sends exact auth and JSON body", async () => {
    const outputDir = await tempDirectory("media-image-generation-");
    let requestCount = 0;
    const server = startServer(async (request) => {
      requestCount += 1;
      expect(new URL(request.url).pathname).toBe("/v1/images/generations");
      expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
      const body = (await request.json()) as Record<string, unknown>;
      expect(body).toMatchObject({
        model: "gpt-image-1.5",
        prompt: PROMPT,
        n: 1,
        size: "1536x1024",
        response_format: "b64_json",
      });
      return Response.json({ data: [{ b64_json: PNG.toString("base64") }] });
    });
    const result = await runCLI(
      [
        "image",
        "--prompt",
        PROMPT,
        "--model=gpt-5-image",
        "--aspectRatio",
        "3:2",
        "--outputDir",
        outputDir,
      ],
      { server },
    );
    const data = parseSuccess(result);
    expect(requestCount).toBe(1);
    expect(result.stdout).not.toContain(PROMPT);
    expect(result.stdout).not.toContain(API_KEY);
    expect(data).toMatchObject({
      model: "gpt-5-image",
      route: "gpt-image-1.5",
      mimeType: "image/png",
    });
    expect(await fs.readFile(data.path as string)).toEqual(PNG);
  });

  test.serial(
    "image edit accepts repeated and comma-separated inputImages",
    async () => {
      const outputDir = await tempDirectory("media-image-edit-");
      for (const name of ["one.png", "two.png", "three.png", "mask.png"]) {
        await fs.writeFile(path.join(outputDir, name), PNG);
      }
      const server = startServer(async (request) => {
        expect(new URL(request.url).pathname).toBe("/v1/images/edits");
        expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
        const form = await request.formData();
        expect(form.get("model")).toBe("gpt-image-2");
        expect(form.get("prompt")).toBe(PROMPT);
        expect(form.getAll("image[]")).toHaveLength(3);
        expect(form.get("mask")).toBeInstanceOf(File);
        return Response.json({ data: [{ b64_json: PNG.toString("base64") }] });
      });
      const result = await runCLI(
        [
          "image",
          "--prompt",
          PROMPT,
          "--inputImages",
          "one.png,two.png",
          "--inputImages=three.png",
          "--maskImage",
          "mask.png",
          "--outputDir",
          outputDir,
        ],
        { server, cwd: outputDir },
      );
      parseSuccess(result);
    },
  );

  test.serial("capability validation fails before HTTP", async () => {
    let requestCount = 0;
    const server = startServer(() => {
      requestCount += 1;
      return Response.json({ data: [] });
    });
    const result = await runCLI(
      [
        "image",
        "--prompt",
        PROMPT,
        "--model",
        "grok-imagine-image",
        "--size",
        "1024x1024",
      ],
      { server },
    );
    expect(parseFailure(result).code).toBe("UNSUPPORTED_CAPABILITY");
    expect(requestCount).toBe(0);
  });

  test.serial(
    "video sends multipart input_reference, polls, and downloads content",
    async () => {
      const outputDir = await tempDirectory("media-video-");
      await fs.writeFile(path.join(outputDir, "frame.png"), PNG);
      await fs.writeFile(path.join(outputDir, "clip.mp4"), "existing");
      let polls = 0;
      const server = startServer(async (request) => {
        const url = new URL(request.url);
        expect(request.headers.get("authorization")).toBe(`Bearer ${API_KEY}`);
        if (request.method === "POST" && url.pathname === "/v1/videos") {
          const form = await request.formData();
          expect(form.get("prompt")).toBe(PROMPT);
          expect(form.get("model")).toBe("grok-imagine-video");
          expect(form.get("seconds")).toBe("5");
          expect(form.get("size")).toBe("1280x720");
          expect(form.get("input_reference")).toBeInstanceOf(File);
          return Response.json(
            { id: "video_1", status: "processing" },
            { status: 201 },
          );
        }
        if (url.pathname === "/v1/videos/video_1") {
          polls += 1;
          return Response.json({ id: "video_1", status: "succeeded" });
        }
        if (url.pathname === "/v1/videos/video_1/content") {
          return new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(new TextEncoder().encode("video-"));
                controller.enqueue(new TextEncoder().encode("bytes"));
                controller.close();
              },
            }),
            { headers: { "content-type": "video/mp4" } },
          );
        }
        return new Response("not found", { status: 404 });
      });
      const result = await runCLI(
        [
          "video",
          "--prompt",
          PROMPT,
          "--path",
          "clip.mp4",
          "--inputImage",
          "frame.png",
          "--seconds",
          "5",
          "--size",
          "1280x720",
          "--pollIntervalMs",
          "10",
        ],
        { server, cwd: outputDir },
      );
      const data = parseSuccess(result);
      expect(polls).toBe(1);
      expect(result.stdout).not.toContain(PROMPT);
      expect(data.path).toBe(path.join(outputDir, "clip (1).mp4"));
      expect(await fs.readFile(path.join(outputDir, "clip.mp4"), "utf8")).toBe(
        "existing",
      );
      expect(await fs.readFile(data.path as string, "utf8")).toBe(
        "video-bytes",
      );
    },
  );

  test.serial("bounded video streams remove partial output", async () => {
    const outputDir = await tempDirectory("media-video-bounded-");
    const server = startServer((request) => {
      const url = new URL(request.url);
      if (request.method === "POST") {
        return Response.json(
          { id: "video_limit", status: "succeeded" },
          { status: 201 },
        );
      }
      if (url.pathname.endsWith("/content")) {
        return new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(8));
              controller.close();
            },
          }),
          { headers: { "content-type": "video/mp4" } },
        );
      }
      return new Response("not found", { status: 404 });
    });
    const result = await runCLI(
      [
        "video",
        "--prompt",
        PROMPT,
        "--path",
        "bounded.mp4",
        "--maxDownloadBytes",
        "4",
      ],
      { server, cwd: outputDir },
    );
    expect(parseFailure(result).code).toBe("DOWNLOAD_TOO_LARGE");
    expect(await fs.readdir(outputDir)).toEqual([]);
  });

  test.serial("terminal video task errors redact credentials", async () => {
    const outputDir = await tempDirectory("media-video-error-");
    const server = startServer(() =>
      Response.json({
        id: "video_failed",
        status: "failed",
        error: { message: `bad Authorization: Bearer ${API_KEY}` },
      }),
    );
    const result = await runCLI(
      ["video", "--prompt", PROMPT, "--path", "failed.mp4"],
      { server, cwd: outputDir },
    );
    const error = parseFailure(result);
    expect(error.code).toBe("VIDEO_FAILED");
    expect(result.stderr).not.toContain(API_KEY);
    expect(result.stderr).toContain("REDACTED");
    expect(await fs.readdir(outputDir)).toEqual([]);
  });

  test.serial(
    "timeout aborts the provider request and leaves no output",
    async () => {
      const outputDir = await tempDirectory("media-video-timeout-");
      const server = startServer(async () => {
        await Bun.sleep(500);
        return Response.json(
          { id: "too_late", status: "succeeded" },
          { status: 201 },
        );
      });
      const result = await runCLI(
        [
          "video",
          "--prompt",
          PROMPT,
          "--path",
          "timeout.mp4",
          "--timeoutMs",
          "100",
        ],
        { server, cwd: outputDir },
      );
      expect(parseFailure(result).code).toBe("TIMEOUT");
      expect(await fs.readdir(outputDir)).toEqual([]);
    },
  );

  test.serial(
    "malformed provider errors are JSON and redact credentials",
    async () => {
      const server = startServer(
        () =>
          new Response(`malformed Bearer ${API_KEY}`, {
            status: 200,
            headers: { "content-type": "application/json" },
          }),
      );
      const result = await runCLI(["doctor"], { server });
      const error = parseFailure(result);
      expect(error.code).toBe("PROVIDER_ERROR");
      expect(result.stderr).not.toContain(API_KEY);
      expect(result.stderr).toContain("REDACTED");
    },
  );

  const bundleOnlyTest = USE_DIST ? test.serial : test.skip;
  bundleOnlyTest(
    "committed wrapper and bundle run while node_modules is unavailable",
    async () => {
      const nodeModules = path.join(ROOT, "node_modules");
      const hidden = path.join(
        ROOT,
        `.node_modules-offline-${crypto.randomUUID()}`,
      );
      await fs.rename(nodeModules, hidden);
      try {
        const result = await runCLI(["models"]);
        parseSuccess(result);
      } finally {
        await fs.rename(hidden, nodeModules);
      }
    },
  );
});
