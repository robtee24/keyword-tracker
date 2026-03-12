# Image Prompting by Context

Use the correct prompt structure and model based on where the image will appear.

---

## Ads

**Skill:** ad-creative  
**Models:** Imagen 4, Gemini 3 Pro, FLUX, Ideogram

### Static Ad Images (No Text in Image)

```
Create a premium, photorealistic background image for a [platform] ad.
Text will be added separately later.

CONCEPT: [product/visual description]

CRITICAL RULES:
- DO NOT include ANY text, words, letters, numbers, logos, or typography
- The image must be completely clean of all text
- Leave negative space for text overlay (center, lower third)

VISUAL QUALITY:
- Ultra high-quality, photorealistic or premium illustration
- Bold, scroll-stopping visual with clear focal point
- Rich, vibrant colors, professional studio lighting
- Modern, premium aesthetic — think Apple or Nike ad
```

### Ad Images with Headlines (Text in Image)

Use **Gemini 3 Pro** or **Reve**. Specify text explicitly:

```
Create a professional [platform] ad image with:
- Headline: "[exact headline text]"
- Subtext: "[exact subtext]"
- [Visual description]
- All text clearly readable, high contrast
- Modern, clean design
```

### Platform Dimensions for Ads

| Platform | Placement | Size |
|----------|-----------|------|
| Meta | Feed | 1080×1080 |
| Meta | Stories/Reels | 1080×1920 |
| Google Display | Landscape | 1200×628 |
| LinkedIn | Feed | 1200×627 |
| TikTok | Feed | 1080×1920 |
| X/Twitter | Card | 1200×675 |

---

## Social Media

**Skills:** Social Media Designer, social-graphic  
**Models:** Imagen 4 Fast, Imagen 4, FLUX

### Feed Posts

```
Create a premium [platform] feed post image.
CONCEPT: [description]

RULES:
- NO text, words, or typography — text added separately
- Dimensions: [from platform spec]
- Scroll-stopping, bold colors, clear focal point
- Professional lighting, modern aesthetic
```

### Stories / Reels Covers

```
Create a vertical story/reel cover image.
CONCEPT: [description]
Safe zones: avoid top 250px and bottom 250px.
NO text in image. Clean, high-contrast, mobile-optimized.
```

### Carousel Slides

```
Create a carousel slide image for [platform].
CONCEPT: [description]
Square format, one idea per slide.
Leave space for headline overlay.
Consistent style across series.
```

---

## Blogs

**Models:** Imagen 4, FLUX (no text in image)

### Hero / Feature Images

```
Create a premium, photorealistic blog article image.
CONCEPT: [article topic/visual]

CRITICAL: DO NOT include ANY text, words, letters, or typography.
Text will be added separately with perfect typography.

STYLE: Ultra high-quality editorial photography, professional lighting,
modern composition, rich colors. Leave clean space in lower third for caption.
Think top-tier magazine or brand campaign quality.
```

### In-Article Images

```
Create an editorial-style image for a blog section about [topic].
Photorealistic, professional, no text in image.
Clean composition, single focal point.
Suitable for placement after [H2 heading].
```

### Image + Caption Workflow

1. Generate image **without** text
2. Use sharp/composite to overlay caption with perfect typography
3. Ensures readable text, consistent branding

---

## Quick Reference: Model by Need

| Need | Model |
|------|-------|
| No text, editorial quality | Imagen 4, FLUX |
| Text in image, readable | Gemini 3 Pro, Reve, Ideogram |
| Fast batch (social) | Imagen 4 Fast |
| Product consistency | FLUX (multi-ref) |
| 4K output | Gemini 3 Pro, Imagen 4 Ultra |
