# Model Registry Reference

This document describes the model registry implementation in `src/models.ts`.

## Image Models

### gpt-image-2

- **Route:** `gpt-image-2`
- **Capabilities:** Generation, Editing, Masking
- **Max Input Images:** 16
- **Size Constraints:**
  - Generation (no input): Custom sizes with edges divisible by 16, ≤3840, ratio ≤3:1, 655360-8294400 pixels
  - Editing (with input): Standard sizes only (1024x1024, 1536x1024, 1024x1536)
- **Aspect Ratios:** 1:1, 3:2, 2:3 (auto-mapped to standard sizes)

### gpt-5-image

- **Route:** `gpt-image-1.5`
- **Capabilities:** Generation, Editing, Masking
- **Max Input Images:** 16
- **Standard Sizes:** 1024x1024, 1536x1024, 1024x1536
- **Aspect Ratios:** 1:1, 3:2, 2:3

### nanobanana (Gemini 2.5 Flash Image)

- **Route:** `google/gemini-2.5-flash-image`
- **Capabilities:** Generation, Editing, Masking
- **Max Input Images:** 4
- **Aspect Ratios:** 21:9, 16:9, 3:2, 4:3, 5:4, 1:1, 4:5, 3:4, 2:3, 9:16
- **Size:** Optional custom size support

### nanobanana-2 (Gemini 3.1 Flash Image Preview)

- **Route:** `google/gemini-3.1-flash-image-preview`
- **Capabilities:** Generation, Editing, Masking
- **Max Input Images:** 4
- **Aspect Ratios:** Extended set (includes 1:4, 4:1, 1:8, 8:1)

### nanobanana-2-lite (Gemini 3.1 Flash Lite Image)

- **Route:** `google/gemini-3.1-flash-lite-image`
- **Capabilities:** Generation, Editing (no masking)
- **Max Input Images:** 4
- **Aspect Ratios:** Extended set
- **Size:** Not supported (produces 1K output, use aspectRatio only)

### nanobanana-pro (Gemini 3 Pro Image Preview)

- **Route:** `google/gemini-3-pro-image-preview`
- **Capabilities:** Generation, Editing, Masking
- **Max Input Images:** 4
- **Aspect Ratios:** Standard set

### grok-imagine-image

- **Route:** `grok-imagine-image`
- **Capabilities:** Generation, Editing (no masking)
- **Max Input Images:** 1
- **Aspect Ratios:** 1:1, 16:9, 9:16, 4:3, 3:4, 3:2, 2:3, 2:1, 1:2, 19.5:9, 9:19.5, 20:9, 9:20
- **Size:** Not supported

### grok-imagine-image-pro

- **Route:** `grok-imagine-image-pro`
- **Capabilities:** Generation, Editing (no masking)
- **Max Input Images:** 1
- **Aspect Ratios:** Same as grok-imagine-image
- **Size:** Not supported

## Video Models

### grok-imagine-video

- **Route:** `grok-imagine-video`
- **Capabilities:** Generation with optional input image reference
- **Supported Sizes:** 1280x720, 720x1280, 854x480, 480x854, 640x480, 480x640, 640x640, 960x640, 640x960

## Validation Rules

All models are validated before HTTP requests:

1. **Model existence** – Unknown aliases are rejected by the input schema with `INVALID_INPUT`
2. **Capability check** – Operations not supported by the model fail with `UNSUPPORTED_CAPABILITY`
3. **Size/aspect ratio** – Invalid dimensions are rejected per model's allowed list
4. **Input image count** – Exceeding `maxInputImages` fails validation
5. **Mask support** – Using `maskImage` with non-supporting models is rejected

## No Fallbacks

- Validation failures result in immediate errors
- No automatic downgrading or retry logic
- No hidden model substitution
