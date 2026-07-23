import fs, { type FileHandle } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import { CustomMediaError } from "./errors";

function expandTilde(input: string): string {
  if (input === "~") return homedir();
  if (input.startsWith("~/")) return path.join(homedir(), input.slice(2));
  return input;
}

export function resolveLocalPath(cwd: string, inputPath: string): string {
  if (inputPath.includes("\0")) {
    throw new CustomMediaError(
      "UNSAFE_PATH",
      "File paths must not contain NUL bytes.",
    );
  }
  const expanded = expandTilde(inputPath);
  return path.resolve(
    path.isAbsolute(expanded) ? expanded : path.join(cwd, expanded),
  );
}

export async function assertSafeInputFile(
  filePath: string,
): Promise<{ realPath: string; size: number }> {
  let realPath: string;
  let stat: Awaited<ReturnType<typeof fs.stat>>;
  try {
    realPath = await fs.realpath(filePath);
    stat = await fs.stat(realPath);
  } catch {
    throw new CustomMediaError(
      "UNSAFE_PATH",
      `Input file '${filePath}' is not readable.`,
    );
  }
  if (!stat.isFile()) {
    throw new CustomMediaError(
      "UNSAFE_PATH",
      `Input path '${filePath}' is not a file.`,
    );
  }
  return { realPath, size: stat.size };
}

export async function prepareOutputDirectory(
  directory: string,
): Promise<string> {
  try {
    await fs.mkdir(directory, { recursive: true, mode: 0o700 });
    return await fs.realpath(directory);
  } catch {
    throw new CustomMediaError(
      "IO_ERROR",
      `Could not prepare output directory '${directory}'.`,
    );
  }
}

export async function reserveUniqueFile(targetPath: string): Promise<{
  path: string;
  handle: FileHandle;
}> {
  const extension = path.extname(targetPath);
  const base = extension ? targetPath.slice(0, -extension.length) : targetPath;
  for (let index = 0; index < 10_000; index++) {
    const candidate =
      index === 0 ? targetPath : `${base} (${index})${extension}`;
    try {
      const handle = await fs.open(candidate, "wx", 0o600);
      return { path: candidate, handle };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "EEXIST") continue;
      throw new CustomMediaError(
        "IO_ERROR",
        "Could not create an exclusive output file.",
      );
    }
  }
  throw new CustomMediaError(
    "IO_ERROR",
    "Could not find an unused output filename.",
  );
}

export async function writeUniqueFile(
  targetPath: string,
  bytes: Uint8Array,
): Promise<string> {
  const reserved = await reserveUniqueFile(targetPath);
  try {
    await reserved.handle.writeFile(bytes);
    await reserved.handle.close();
    return reserved.path;
  } catch {
    await reserved.handle.close().catch(() => undefined);
    await fs.unlink(reserved.path).catch(() => undefined);
    throw new CustomMediaError("IO_ERROR", "Could not write the output file.");
  }
}
