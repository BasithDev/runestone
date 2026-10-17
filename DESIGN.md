---
name: Runestone Cinematic
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#adc6ff'
  on-secondary: '#002e6a'
  secondary-container: '#0566d9'
  on-secondary-container: '#e6ecff'
  tertiary: '#ffb3af'
  on-tertiary: '#650911'
  tertiary-container: '#fc7c78'
  on-tertiary-container: '#711419'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#d8e2ff'
  secondary-fixed-dim: '#adc6ff'
  on-secondary-fixed: '#001a42'
  on-secondary-fixed-variant: '#004395'
  tertiary-fixed: '#ffdad7'
  tertiary-fixed-dim: '#ffb3af'
  on-tertiary-fixed: '#410005'
  on-tertiary-fixed-variant: '#842225'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
  headline-lg:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: '1.2'
    letterSpacing: -0.03em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.3'
    letterSpacing: -0.02em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: -0.01em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
    letterSpacing: 0em
  label-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: '1'
    letterSpacing: 0.05em
  headline-xl-mobile:
    fontFamily: Inter
    fontSize: 28px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 16px
  margin: 20px
---

## Brand & Style
The design system is engineered for a premium, mobile-first entertainment tracking experience. It prioritizes content immersion by utilizing a **Modern Cinematic** aesthetic, drawing inspiration from high-end streaming platforms and editorial film journals. 

The brand personality is sophisticated, precise, and unobtrusive. It employs a **Glassmorphic** approach to depth, using translucent layers and background blurs to maintain a sense of context and "physical" space within the UI. The emotional response is one of high-value curation—making the act of tracking media feel as prestigious as the media itself. High-contrast typography and a pitch-black foundation ensure that imagery remains the focal point while maintaining a cutting-edge, tech-forward feel.

## Colors
The palette is rooted in a "True Black" (#000000) environment to maximize the contrast of OLED displays and cinematic imagery. 

- **Primary Emerald (#10B981):** Used exclusively for high-priority actions, active states, and progress indicators. It provides a vibrant, "electric" energy against the dark backdrop.
- **Secondary Blue (#3B82F6):** Reserved for secondary data visualizations or subtle interactive cues.
- **Neutral Hierarchy:** Surfaces are built using a tiered charcoal system (#121212 for primary containers, #1E1E1E for elevated cards).
- **Typography:** Pure White (#FFFFFF) is used for all headlines to ensure maximum legibility, while Zinc (#A1A1AA) provides a soft, non-distracting tone for metadata and body copy.

## Typography
This design system utilizes **Inter** across all levels to maintain a systematic, utilitarian, and modern feel. The hierarchy is characterized by tight leading and negative letter-spacing on headlines to evoke a premium editorial look.

- **Headlines:** Use Bold (700) or SemiBold (600) weights with tight tracking to create a compact, impactful visual block.
- **Body:** Uses Regular (400) weight for maximum readability. Zinc color is preferred here to reduce eye strain in dark mode.
- **Labels:** Small labels use a slightly heavier weight and increased letter spacing with uppercase styling for clear categorization and metadata tagging (e.g., Genre, Runtime).

## Layout & Spacing
The layout follows a **Fluid Grid** model optimized for mobile-first interaction. 

- **Grid:** A standard 4-column mobile grid with 16px gutters and 20px side margins. 
- **Rhythm:** An 8pt linear scale is used for most spacing, but 4px "half-steps" are permitted for tight component internals (like icon-to-text relationships).
- **Reflow:** On tablet devices, content expands to a 12-column grid. Poster cards should maintain a fixed aspect ratio (2:3) and scale based on the column width.

## Elevation & Depth
Depth is communicated through **Glassmorphism** and **Tonal Layering** rather than traditional drop shadows.

1.  **Level 0 (Background):** Pure #000000.
2.  **Level 1 (Surface):** #121212 with a 1px subtle stroke (#FFFFFF at 5% opacity).
3.  **Level 2 (Floating/Overlay):** Glassmorphic surfaces. Use a background blur of 20px-30px with a 60% opaque fill of #1E1E1E. 
4.  **Shadows:** When used on poster cards, shadows should be large, very soft, and low-opacity (#000000 at 40%), intended to lift the card slightly off the black background.

## Shapes
The shape language is defined by "Smooth Corners" (Squircular influence). 

- **Standard Elements:** Buttons and input fields use a **rounded-lg** (16px) radius.
- **Containers:** Content cards, posters, and modal sheets use **rounded-xl** (24px) to create a friendly yet modern enclosure.
- **Interactive Cues:** Progress bar tracks and small tags use a fully pill-shaped (100px) radius to differentiate them from structural containers.

## Components

### Cinematic Poster Cards
- **Aspect Ratio:** 2:3.
- **Styling:** 24px corner radius. A subtle inner stroke of 1px (White at 10% opacity) to define edges against the black background. Metadata is overlaid at the bottom using a subtle black-to-transparent gradient scrim.

### Progress Bars
- **Track:** #1E1E1E background.
- **Fill:** Primary Emerald (#10B981) with a subtle glow (2px blur of the same color).
- **Height:** 4px for secondary info; 8px for primary tracking.

### Glassmorphic Navigation
- **Tab Bar:** Positioned at the bottom. Background blur (20px) with a #121212 fill at 70% opacity. 1px top border (#FFFFFF at 10%).
- **Buttons:** Primary buttons use a solid Emerald fill with black text. Secondary buttons use a glassmorphic style: transparent background, 1px white border (20% opacity), and white text.

### Statistics Cards
- **Structure:** Level 1 Surface (#121212). Large "Headline-xl" typography for the primary metric.
- **Visuals:** Use 2px thick sparklines in Primary Emerald or Secondary Blue to denote trends.

### Input Fields
- **Styling:** #121212 background, 16px radius, 1px border (#1E1E1E). Active state changes border to Primary Emerald.