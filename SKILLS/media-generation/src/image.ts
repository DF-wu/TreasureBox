import path from "node:path";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateImage } from "ai";
import { resolveCredentials } from "./config";
import {
  asCustomMediaError,
  CustomMediaError,
  parseWithSchema,
} from "./errors";
import { imageExtensionFromBytes, readValidatedImage } from "./media";
import { resolveImageDimensions, validateImageModelInput } from "./models";
import {
  prepareOutputDirectory,
  resolveLocalPath,
  writeUniqueFile,
} from "./paths";
import {
  imageInputSchema,
  imageOutputSchema,
  type ImageOutput,
} from "./schemas";
import { createCallSignal } from "./signal";

type GenerateImagePrompt = Parameters<typeof generateImage>[0]["prompt"];

async function buildPrompt(
  input: ReturnType<typeof imageInputSchema.parse>,
  cwd: string,
): Promise<GenerateImagePrompt> {
  if (!input.inputImages?.length) return input.prompt;
  const images: Uint8Array[] = [];
  for (const imagePath of input.inputImages) {
    const resolved = resolveLocalPath(cwd, imagePath);
    images.push((await readValidatedImage({ filePath: resolved })).bytes);
  }
  let mask: Uint8Array | undefined;
  if (input.maskImage) {
    const resolved = resolveLocalPath(cwd, input.maskImage);
    mask = (await readValidatedImage({ filePath: resolved })).bytes;
  }
  return { text: input.prompt, images, mask };
}

export async function generateImageCommand(
  rawInput: Record<string, unknown>,
  options: { cwd?: string; signal?: AbortSignal } = {},
): Promise<ImageOutput> {
  const input = parseWithSchema(imageInputSchema, rawInput, "image input");
  const registration = validateImageModelInput(input);
  const credentials = resolveCredentials();
  const cwd = options.cwd ?? process.cwd();
  const callSignal = createCallSignal(options.signal, input.timeoutMs);

  try {
    const prompt = await buildPrompt(input, cwd);
    const dimensions = resolveImageDimensions(input);
    const provider = createOpenAICompatible({
      name: "customMedia",
      baseURL: credentials.baseURL,
      apiKey: credentials.apiKey,
    });
    const result = await generateImage({
      model: provider.imageModel(registration.route),
      prompt,
      size: dimensions.size,
      providerOptions: dimensions.aspectRatio
        ? { customMedia: { aspect_ratio: dimensions.aspectRatio } }
        : undefined,
      maxRetries: 0,
      abortSignal: callSignal.signal,
    });

    const bytes = result.image.uint8Array;
    const extension = imageExtensionFromBytes(bytes);
    const outputDir = resolveLocalPath(cwd, input.outputDir ?? ".");
    const realOutputDir = await prepareOutputDirectory(outputDir);
    const outputPath = await writeUniqueFile(
      path.join(realOutputDir, `generated-image${extension}`),
      bytes,
    );
    return imageOutputSchema.parse({
      ok: true,
      path: outputPath,
      bytes: bytes.byteLength,
      mimeType: result.image.mediaType,
      model: input.model,
      route: registration.route,
    });
  } catch (error) {
    if (callSignal.signal.aborted) callSignal.mapAbort(error);
    if (error instanceof CustomMediaError) throw error;
    throw asCustomMediaError(
      error,
      "PROVIDER_ERROR",
      "Image generation failed",
      [credentials.apiKey],
    );
  } finally {
    callSignal.cleanup();
  }
}
