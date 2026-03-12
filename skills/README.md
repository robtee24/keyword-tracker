# Skills for Keyword Tracking Tool

Skills provide AI guidance for marketing, content, and creative tasks. Use the correct skill based on the task.

## Image & Video Generation

| Skill | Use When | Contexts |
|-------|----------|----------|
| **ai-image-generation** | Generating images | Ads, social, blogs |
| **ai-video-generation** | Generating videos | Ads, social |
| **ad-creative** | Ad copy + visuals strategy | Ads |
| **social-media-designer** | Platform dimensions, safe zones | Social |
| **social-graphic** | Social graphics workflow | Social |

### Routing by Image Type

- **Ads** → ai-image-generation + ad-creative (Imagen 4, Gemini 3 Pro)
- **Social** → ai-image-generation + social-media-designer (Imagen 4 Fast)
- **Blog** → ai-image-generation (Imagen 4, no text in image)

### Routing by Video Type

- **Video Ads** → ai-video-generation (Veo 3.1)
- **Social Video** → ai-video-generation (LTX 2 Fast)

## External Skills (Optional)

Install for extended model access and platform specs:

```bash
# 50+ image models (FLUX, Gemini 3 Pro, Grok, Seedream, Reve)
npx skills add https://github.com/inference-shell/skills --skill ai-image-generation

# 40+ video models (Veo, Grok, Seedance, Wan)
npx skills add https://github.com/inference-shell/skills --skill ai-video-generation

# Gemini 3 Pro / Nano Banana Pro — 4K, text rendering
npx skills add https://github.com/adaptationio/skrillz --skill gemini-3-image-generation

# Ad creative — platform specs, performance strategy
npx skills add https://github.com/coreyhaines31/marketingskills --skill ad-creative

# Social media — platform dimensions, safe zones
npx skills add https://github.com/eddiebe147/claude-settings --skill 'Social Media Designer'

# Social graphics — platform-specific design
npx skills add https://github.com/kenneth-liao/ai-launchpad-marketplace --skill social-graphic
```

## All Skills

| Skill | Description |
|-------|-------------|
| ai-image-generation | Image generation with model routing by type |
| ai-video-generation | Video generation (Veo, LTX) by context |
| ad-creative | Ad copy, headlines, creative strategy |
| social-content | Social media content, scheduling |
| copywriting | Marketing copy, landing pages |
| content-strategy | Content planning, topic clusters |
| programmatic-seo | Template pages, SEO at scale |
| ... | See individual SKILL.md files |
