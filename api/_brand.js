import { getSupabase } from './db.js';

/**
 * Fetch the brand profile for a project and format it as a prompt section.
 * Returns an empty string if no profile exists.
 */
export async function getBrandContext(projectId) {
  if (!projectId) return '';

  const supabase = getSupabase();
  if (!supabase) return '';

  try {
    const { data } = await supabase
      .from('brand_profiles')
      .select('brand_style, fonts, font_styling, colors, tagline, button_styles, spacing, voice_and_tone')
      .eq('project_id', projectId)
      .maybeSingle();

    if (!data) return '';

    const parts = ['=== BRAND GUIDELINES (MUST FOLLOW) ==='];

    if (data.brand_style) {
      parts.push(`Brand Style: ${data.brand_style}`);
    }

    if (data.voice_and_tone) {
      parts.push(`Voice & Tone: ${data.voice_and_tone}`);
    }

    if (data.tagline) {
      parts.push(`Tagline: "${data.tagline}"`);
    }

    const colors = data.colors || [];
    if (colors.length > 0) {
      parts.push('Color Palette:');
      for (const c of colors) {
        parts.push(`  - ${c.hex} (${c.name || c.role}) — role: ${c.role}`);
      }
      parts.push('Use these exact hex colors in your CSS. The primary color should be the dominant accent. Background and text colors define the base palette.');
    }

    const fonts = data.fonts || {};
    if (fonts.heading?.family || fonts.body?.family) {
      parts.push('Typography:');
      if (fonts.heading?.family) {
        parts.push(`  - Headings: ${fonts.heading.family} (weight: ${fonts.heading.weight || '700'}, style: ${fonts.heading.style || 'normal'})`);
      }
      if (fonts.body?.family) {
        parts.push(`  - Body: ${fonts.body.family} (weight: ${fonts.body.weight || '400'}, style: ${fonts.body.style || 'normal'})`);
      }
      parts.push('Use these fonts in CSS. Import from Google Fonts if applicable.');
    }

    const fontStyling = data.font_styling || {};
    if (fontStyling.headingCase && fontStyling.headingCase !== 'none') {
      parts.push(`Heading Case: text-transform: ${fontStyling.headingCase}`);
    }
    if (fontStyling.letterSpacing) {
      parts.push(`Letter Spacing: ${fontStyling.letterSpacing}`);
    }

    const buttons = data.button_styles || [];
    if (buttons.length > 0) {
      parts.push('Button Styles:');
      for (const b of buttons) {
        parts.push(`  - ${b.variant || 'primary'}: ${b.css}`);
      }
      parts.push('Style all buttons and CTAs to match these patterns exactly.');
    }

    const spacing = data.spacing || {};
    if (spacing.borderRadius || spacing.shadows) {
      parts.push('Spacing & Effects:');
      if (spacing.borderRadius) parts.push(`  - Border Radius: ${spacing.borderRadius}`);
      if (spacing.shadows && spacing.shadows !== 'none') parts.push(`  - Box Shadow: ${spacing.shadows}`);
    }

    parts.push('These brand guidelines MUST be reflected in all generated CSS, copy tone, and visual design choices.');

    return parts.join('\n');
  } catch (err) {
    console.error('[Brand] Failed to fetch brand context:', err.message);
    return '';
  }
}
