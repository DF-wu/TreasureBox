import { CustomMediaError, redactDiagnostic } from "./errors";

export const BASE_URL_ENV = "OPENAI_COMPATIBLE_BASE_URL";
export const API_KEY_ENV = "OPENAI_COMPATIBLE_API_KEY";

export type ResolvedCredentials = {
  baseURL: string;
  apiKey: string;
};

export function normalizeOpenAICompatibleBaseURL(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new CustomMediaError(
      "INVALID_CONFIG",
      "The configured base URL is not a valid URL.",
    );
  }
  if (!new Set(["http:", "https:"]).has(url.protocol)) {
    throw new CustomMediaError(
      "INVALID_CONFIG",
      "The configured base URL must use HTTP or HTTPS.",
    );
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new CustomMediaError(
      "INVALID_CONFIG",
      "The configured base URL must not contain credentials, query parameters, or a fragment.",
    );
  }
  let pathname = url.pathname.replace(/\/+$/u, "");
  if (!pathname.endsWith("/v1")) pathname = `${pathname}/v1`;
  url.pathname = pathname.replace(/^$/u, "/v1");
  return url.toString().replace(/\/$/u, "");
}

export function resolveCredentials(): ResolvedCredentials {
  const rawBaseURL = process.env[BASE_URL_ENV]?.trim();
  const apiKey = process.env[API_KEY_ENV]?.trim();
  if (!rawBaseURL) {
    throw new CustomMediaError(
      "MISSING_ENV",
      `Required base URL environment variable '${BASE_URL_ENV}' is not set.`,
    );
  }
  if (!apiKey) {
    throw new CustomMediaError(
      "MISSING_ENV",
      `Required API key environment variable '${API_KEY_ENV}' is not set.`,
    );
  }
  try {
    return { baseURL: normalizeOpenAICompatibleBaseURL(rawBaseURL), apiKey };
  } catch (error) {
    if (error instanceof CustomMediaError) throw error;
    throw new CustomMediaError(
      "INVALID_CONFIG",
      `Could not resolve provider configuration: ${redactDiagnostic(error, [apiKey])}`,
    );
  }
}
