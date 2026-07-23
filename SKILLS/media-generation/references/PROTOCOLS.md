# Provider Protocols

## Environment And Base URL

Only these environment variables are read:

```text
OPENAI_COMPATIBLE_BASE_URL
OPENAI_COMPATIBLE_API_KEY
```

The base URL accepts HTTP or HTTPS, rejects URL credentials/query/fragment, and receives a `/v1`
suffix when absent.

## Doctor

`doctor` sends:

```http
GET /v1/models
Authorization: Bearer <API key>
```

It requires JSON shaped as `{ "data": [{ "id": "..." }] }`, reports route availability, and
fails on non-2xx or malformed responses. Error bodies are bounded and credentials are redacted.

## Image

Image generation uses AI SDK `createOpenAICompatible` plus `generateImage` with `maxRetries: 0`.
The selected alias maps to exactly one route; no model or provider fallback exists.

Generation sends JSON to `/v1/images/generations`. Editing sends multipart form data to
`/v1/images/edits`, with repeated `image` parts and optional `mask`. Model capability validation
and local image validation complete before HTTP.

For non-GPT aliases, `aspectRatio` is passed as provider field `aspect_ratio`. GPT aliases map
their supported ratios to standard image sizes.

## Video

The implementation follows QuantumNous/new-api's OpenAI-compatible video API:

1. `POST /v1/videos` as multipart form data with `prompt`, `model`, optional `seconds`, optional
   `size`, and optional file field `input_reference`.
2. Poll `GET /v1/videos/:id` until `succeeded`/`completed` or a terminal failure.
3. Stream `GET /v1/videos/:id/content` to an exclusive local file.

All requests use the same Bearer credential and operation AbortSignal. The timeout covers upload,
polling, and download. Both `Content-Length` and actual streamed bytes are checked against the
download bound; partial output is unlinked on failure.