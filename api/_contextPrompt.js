/**
 * Builds a context block string from a GenerationContext object.
 * Used by image and video generation endpoints to enhance prompts.
 */

const STYLE_LABELS = {
  photorealistic: 'photorealistic, ultra high-quality photography',
  illustration: 'premium illustration style',
  '3d_render': '3D rendered, polished CGI aesthetic',
  watercolor: 'watercolor painting style with soft washes',
  minimalist: 'clean minimalist design with generous whitespace',
  vintage: 'vintage/retro aesthetic with warm tones and grain',
  cinematic: 'cinematic, wide-angle, film-grade color grading',
  flat_design: 'flat design with bold shapes and clean lines',
  anime: 'anime/manga-inspired illustration',
};

const MOOD_LABELS = {
  professional: 'professional, polished, business-appropriate',
  playful: 'playful, bright, lighthearted',
  dramatic: 'dramatic, high-contrast, bold shadows',
  warm: 'warm, inviting, cozy atmosphere',
  cool: 'cool-toned, serene, modern',
  energetic: 'energetic, vibrant, dynamic movement',
  calm: 'calm, peaceful, meditative',
  luxurious: 'luxurious, premium, aspirational',
};

const CAMERA_LABELS = {
  static: 'static camera, locked-off shot',
  pan: 'smooth horizontal pan',
  zoom: 'slow cinematic zoom',
  tracking: 'tracking shot following the subject',
  dolly: 'dolly movement, depth-revealing push in/out',
  handheld: 'handheld, organic camera movement (UGC feel)',
  orbit: '360-degree orbit around the subject',
};

export function buildContextBlock(context) {
  if (!context) return '';

  const lines = [];

  if (context.style && STYLE_LABELS[context.style]) {
    lines.push(`STYLE: ${STYLE_LABELS[context.style]}`);
  }
  if (context.mood && MOOD_LABELS[context.mood]) {
    lines.push(`MOOD: ${MOOD_LABELS[context.mood]}`);
  }
  if (context.subject) {
    lines.push(`SUBJECT FOCUS: ${context.subject}`);
  }
  if (context.includesPeople) {
    lines.push('Include people in the scene — authentic, emotionally engaging.');
  }
  if (context.includesText) {
    lines.push('Leave generous clean space for text overlay placement.');
  }
  if (context.colorHints) {
    lines.push(`COLOR PALETTE: ${context.colorHints}`);
  }
  if (context.negativePrompt) {
    lines.push(`AVOID: ${context.negativePrompt}`);
  }

  return lines.length > 0 ? '\n' + lines.join('\n') : '';
}

export function buildVideoContextBlock(context) {
  if (!context) return '';

  let block = buildContextBlock(context);

  if (context.cameraMotion && CAMERA_LABELS[context.cameraMotion]) {
    block += `\nCAMERA: ${CAMERA_LABELS[context.cameraMotion]}`;
  }
  if (context.hasDialogue) {
    block += '\nIncludes dialogue or voiceover — maintain visual pacing for speech.';
  }

  return block;
}

export function resolveStyleLabel(context) {
  if (!context?.style) return 'photorealistic';
  return STYLE_LABELS[context.style] ? context.style : 'photorealistic';
}
