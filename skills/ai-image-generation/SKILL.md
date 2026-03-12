---
name: ai-image-generation
description: "When generating images for ads, social media, blogs, or any marketing asset. Use when the user mentions 'generate image,' 'create visual,' 'blog hero image,' 'ad creative image,' 'social graphic,' or 'product photo.' Routes to the correct model and prompting approach based on image type. For ad copy (headlines, descriptions), see ad-creative. For video generation, see ai-video-generation."
metadata:
  version: 1.0.0
---

# AI Image Generation

Generate images with the correct model and prompting approach based on **image type** and **context**. Use this skill for all image generation across ads, social, blogs, and marketing assets.

## Related External Skills

Install these for extended capabilities:

```bash
# 50+ models via inference.sh (FLUX, Gemini 3 Pro, Grok, Seedream, Reve)
npx skills add https://github.com/inference-shell/skills --skill ai-image-generation

# Gemini 3 Pro / Nano Banana Pro — 4K, text rendering, grounded generation
npx skills add https://github.com/adaptationio/skrillz --skill gemini-3-image-generation

# Ad creative — platform specs, performance creative strategy
npx skills add https://github.com/coreyhaines31/marketingskills --skill ad-creative

# Social media — platform dimensions, safe zones
npx skills add https://github.com/eddiebe147/claude-settings --skill 'Social Media Designer'

# Social graphics — platform-specific design
npx skills add https://github.com/kenneth-liao/ai-launchpad-marketplace --skill social-graphic
```

---

## Routing: Which Model for Which Image Type

| Context | Image Type | Recommended Model | Why |
|---------|------------|-------------------|-----|
| **Ads** | Static ad images, banners | Imagen 4 / Gemini 3 Pro | Text rendering, brand consistency |
| **Ads** | Product mockups, variations | FLUX (multi-ref) | Product consistency across variations |
| **Ads** | Ad images with headlines | Ideogram / Reve / Gemini 3 Pro | Best text-in-image accuracy |
| **Social** | Feed posts, stories | Imagen 4 / FLUX | Platform dimensions, scroll-stopping |
| **Social** | Carousels, graphics | social-graphic + Gemini 3 Pro | Platform specs, brand compliance |
| **Social** | Profile/cover images | Social Media Designer specs | Safe zones, dimensions |
| **Blog** | Hero images, feature images | Imagen 4 / FLUX | Editorial quality, no text in image |
| **Blog** | Images with captions | Imagen 4 (text overlay separate) | Avoid baked-in text; composite captions |
| **Blog** | Infographics, data viz | Gemini 3 Pro / Reve | Text rendering for labels |

---

## Image Prompting Best Practices

### 1. Always Specify (No Text in Image Unless Required)

For blog and most ad images, **do not include text in the image** — add it separately with perfect typography:

```
Create a premium, photorealistic blog article image. CONCEPT: [description].
CRITICAL RULE: DO NOT include ANY text, words, letters, numbers, logos, or typography.
The image must be completely clean — text will be added separately.
STYLE: Ultra high-quality editorial photography, professional lighting, modern composition.
Leave clean space in the lower third for text overlay.
```

### 2. When Text Must Be in the Image

Use **Gemini 3 Pro** or **Reve** — specify text explicitly in quotes:

```
Create a professional business card design with:
- Company name: "TechVision AI"
- Text: "Dr. Sarah Chen" — Chief AI Officer
- Modern, clean design, all text clearly readable
```

### 3. Platform Dimensions (Always Include)

| Platform | Format | Dimensions |
|----------|--------|------------|
| Meta Feed | Square | 1080×1080 |
| Meta Stories/Reels | Vertical | 1080×1920 |
| LinkedIn | Landscape | 1200×627 |
| Twitter/X | Landscape | 1200×675 |
| Blog hero | Landscape | 1792×1024 or 1920×1080 |
| Pinterest | Vertical | 1000×1500 |

### 4. Quality Descriptors

Add to prompts for better output:
- "4K ultra-high definition" (when using Gemini 3 Pro)
- "Professional studio lighting"
- "Shallow depth of field"
- "Cinematic color grading"
- "Scroll-stopping visual with clear focal point"

### 5. Avoid

- Vague prompts ("a nice image")
- Text in image when it will be overlaid separately
- Stock photo clichés (handshakes, pointing at screens)
- Wrong aspect ratio for target platform

---

## Context-Specific Guidance

### Ads (see ad-creative)

- Use **ad-creative** skill for copy and platform specs
- Use **generative-tools.md** in ad-creative for tool selection
- Image generation: Imagen 4 or Gemini 3 Pro for text; FLUX for product consistency

### Social (see social-media-designer, social-graphic)

- Use **Social Media Designer** for platform dimensions and safe zones
- Use **social-graphic** for design workflow and brand compliance
- Image generation: Imagen 4 Fast for speed; Imagen 4 for quality

### Blogs

- Hero images: No text, editorial quality, 16:9 or 1792×1024
- Captions: Add via composite overlay, not baked into image
- Suggested images: 3–5 per article, placed after H2 sections

---

## Model Quick Reference

| Model | Best For | Text in Image | Cost |
|-------|----------|---------------|------|
| Imagen 4 | Flagship quality, best text | Yes | $0.04/image |
| Imagen 4 Fast | Speed, social batches | Yes | $0.02/image |
| Gemini 3 Pro | 4K, grounded, conversational | Yes | ~$0.13/image |
| FLUX Dev | Photorealistic, rapid iteration | No | ~$0.01/image |
| Reve | Natural language editing, text | Yes | — |
| Seedream 4.5 | 2K–4K cinematic | Good | — |

---

## References

- [ad-creative/references/generative-tools.md](../ad-creative/references/generative-tools.md) — Full tool comparison, API examples
- [ad-creative/references/platform-specs.md](../ad-creative/references/platform-specs.md) — Ad platform dimensions
- [references/image-prompting-by-context.md](references/image-prompting-by-context.md) — Prompt templates by context
