---
name: ai-video-generation
description: "When generating videos for ads, social media, or marketing. Use when the user mentions 'generate video,' 'video ad,' 'social video,' 'Reel,' 'TikTok video,' or 'video creative.' Routes to the correct model (Veo, LTX, etc.) based on context. For image generation, see ai-image-generation. For ad copy, see ad-creative."
metadata:
  version: 1.0.0
---

# AI Video Generation

Generate videos with the correct model based on **context** (ads vs. social) and **format** (text-to-video, image-to-video). Use this skill for all video generation across ad video, social posts, and marketing content.

## Related External Skills

```bash
# 40+ video models via inference.sh (Veo, Grok, Seedance, Wan, etc.)
npx skills add https://github.com/inference-shell/skills --skill ai-video-generation

# Ad creative — platform specs, video ad strategy
npx skills add https://github.com/coreyhaines31/marketingskills --skill ad-creative
```

---

## Routing: Which Model for Which Video Type

| Context | Video Type | Recommended Model | Why |
|---------|------------|-------------------|-----|
| **Video Ads** | Multi-scene video ads | Veo 3.1 | Native audio, 1080p, long-running ops |
| **Video Ads** | Single-scene ad clips | Veo 3.1 Fast | Speed, optional audio |
| **Social** | Instagram Reels, TikTok | LTX 2 Fast | Synchronous, platform-optimized |
| **Social** | LinkedIn, X, Facebook video | LTX 2 Fast | 1920×1080, 6–20 sec |
| **Social** | Pinterest Video Pin | LTX | 8 sec, vertical |

---

## Model Overview

### Veo (Google) — Video Ads

- **Veo 3.1** — Best quality, frame interpolation
- **Veo 3.1 Fast** — Fast with optional audio
- **Use for:** Video ad campaigns, multi-scene projects, vertical social ads
- **API:** Gemini API (`veo-3.1-generate-preview`)
- **Flow:** Long-running operation + polling

### LTX — Social Video

- **LTX 2 Fast** — Fast text-to-video for social
- **Use for:** Instagram Reels, TikTok, LinkedIn, X, Pinterest
- **API:** LTX API (`api.ltx.video`)
- **Flow:** Synchronous, returns base64 video
- **Resolutions:** 1920×1080, 2560×1440, 3840×2160
- **Durations:** 6, 8, 10, 12, 14, 16, 18, 20 sec (even only)

### Other Models (via inference.sh)

| Model | App ID | Best For |
|-------|--------|----------|
| Grok Video | xai/grok-imagine-video | Configurable duration |
| Seedance 1.5 Pro | bytedance/seedance-1-5-pro | First-frame control |
| Wan 2.5 | falai/wan-2-5 | Image-to-video |

---

## Video Prompting Best Practices

### 1. Visual-Only Prompts (No Text in Video)

```
Premium cinematic [platform] video. Ultra high-quality, professional lighting,
smooth camera movements, rich color grading.
NO text, words, letters, or typography anywhere in the video.
[Scene descriptions]. Modern aesthetic, shallow depth of field.
```

### 2. Scene Structure for Multi-Shot

```
Scene 1 (0-3s): [visual description]
Scene 2 (3-6s): [visual description]
Scene 3 (6-10s): [visual description]
```

### 3. Platform-Specific Specs

| Platform | Resolution | Duration | Aspect |
|----------|------------|----------|--------|
| Instagram Reel | 1920×1080 | 14 sec | 9:16 |
| TikTok | 1920×1080 | 10 sec | 9:16 |
| LinkedIn | 1920×1080 | 10 sec | 16:9 |
| X/Twitter | 1920×1080 | 10 sec | 16:9 |
| Pinterest | 1920×1080 | 8 sec | 9:16 |

### 4. Avoid

- Text or typography in video (add in post or overlay)
- Overly long prompts (trim to key visual elements)
- Inconsistent scene descriptions

---

## Context-Specific Guidance

### Video Ads (ad-creative)

- Use **ad-creative** for platform specs and creative strategy
- Veo for multi-scene, long-running generation
- Native audio support for dialogue and sound effects

### Social (Social Media Designer)

- Use **Social Media Designer** for platform dimensions
- LTX for synchronous, fast social video
- Match resolution and duration to platform

---

## References

- [ad-creative/references/generative-tools.md](../ad-creative/references/generative-tools.md) — Veo, Kling, Runway, Sora, Seedance
- [ad-creative/references/platform-specs.md](../ad-creative/references/platform-specs.md) — Ad platform video specs
