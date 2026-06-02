---
name: Screen Translation Review
description: A quiet, notebook-like review interface for translation history and vocabulary learning.
colors:
  ink-primary: "#2c3e5a"
  ink-primary-hover: "#1a2d44"
  paper-bg: "#fafafa"
  paper-surface: "#ffffff"
  ink-text: "#1a1a1a"
  ink-muted: "#6b6b6b"
  ink-border: "#e5e5e5"
  ink-border-hover: "#cccccc"
typography:
  body:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.6
  title:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Inter, system-ui, -apple-system, sans-serif"
    fontSize: "0.8rem"
    fontWeight: 500
    letterSpacing: "0.02em"
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink-primary}"
    textColor: "#ffffff"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-primary-hover:
    backgroundColor: "{colors.ink-primary-hover}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.sm}"
    padding: "10px 20px"
  button-ghost-hover:
    backgroundColor: "{colors.ink-border}"
  card:
    backgroundColor: "{colors.paper-surface}"
    rounded: "{rounded.md}"
    padding: "16px"
  input:
    backgroundColor: "{colors.paper-surface}"
    textColor: "{colors.ink-text}"
    rounded: "{rounded.sm}"
    padding: "10px 14px"
---

# Design System: Screen Translation Review

## 1. Overview

**Creative North Star: "The Quiet Notebook"**

A digital notebook that stays out of the way. Like a well-made paper notebook — clean pages, clear ink, no decoration — this interface serves one purpose: to help you review translations and learn from them. The UI is a container, not a participant.

The system is monochrome-restrained: grayscale with a single muted blue accent that evokes fountain pen ink. No gradients, no loud shadows, no colorful badges. Everything on screen must justify itself. Typography does the heavy lifting — Inter, a workhorse sans-serif with excellent legibility at small sizes and clean proportions at display sizes.

This is a tool for one person. It doesn't need to impress; it needs to be clear, fast, and invisible. The best compliment is that you forget about the interface entirely.

**Key Characteristics:**
- Monochrome at rest, a single ink-blue accent on interaction
- Typography-driven hierarchy; color is a signal, not decoration
- Flat surfaces with hairline borders; no floating shadows
- Dense but breathable — information-rich without feeling cramped
- Mobile-first with desktop as a wider canvas, not a different design

## 2. Colors

A restrained palette built on paper and ink. One accent. No gradients.

### Primary
- **Ink Blue** (`#2c3e5a`): Links, primary buttons, active tab indicators, focus rings. Used on ≤5% of any screen — its scarcity is its power.

### Neutral
- **Paper** (`#fafafa`): Page background. Near-white with zero chroma — not cream, not warm, not cool. Just paper.
- **Surface** (`#ffffff`): Cards, inputs, elevated containers. The slight contrast against Paper creates separation without shadows.
- **Ink** (`#1a1a1a`): Body text, headings. Near-black for maximum readability.
- **Muted** (`#6b6b6b`): Secondary text, captions, meta information, placeholder text. Meets 4.5:1 on both Paper and Surface.
- **Border** (`#e5e5e5`): Dividers, card borders, input strokes. Present but not prominent.
- **Border Hover** (`#cccccc`): Border on hover/focus states.

### Named Rules
**The One Accent Rule.** Ink Blue appears on ≤5% of any screen. Links, the active tab underline, the primary button. If you see blue in three places at once, something is over-signaling.

**The No Tint Rule.** Paper is achromatic — zero chroma, no warm or cool bias. The notebook is blank; the content provides the color.

## 3. Typography

**Font:** Inter (with system-ui, -apple-system fallback)

**Character:** Inter is a pragmatic workhorse. Clean x-height, open apertures, no personality quirks. It reads well at 14px on mobile and looks sharp at 24px in headings. One weight axis (400–600) is enough.

**Loading:** Subset to latin + latin-ext, woff2 only, `font-display: swap`. The system fallback is close enough that the swap is invisible.

### Hierarchy
- **Title** (600, 1.25rem, 1.4): Page and section headings. Only one level; deeper hierarchy uses spacing, not size.
- **Body** (400, 16px / 1rem, 1.6): All body text, card content, form labels. 16px floor prevents iOS zoom on input focus. Max line length 70ch on desktop.
- **Label** (500, 0.8rem, 0.02em letter-spacing): Meta text, dates, language tags, tab labels when inactive.

### Named Rules
**The Single Weight Jump Rule.** Title to Body is 400→600 weight and 1.25rem→1rem size. One step each. More contrast than that and the page starts shouting.

## 4. Elevation

Flat by default. No box-shadows on static elements. Cards and surfaces separate from the background via a 1px border (`--ink-border`) and the 2% brightness difference between Paper and Surface.

**The Flat-At-Rest Rule.** Shadows appear only as a response to interaction: a card lifts 2px on hover with a tight 4px blur shadow. No ambient/diffuse shadows. No shadow layering. If it's not being interacted with, it's flat.

### Interaction Shadows
- **Card hover** (`0 2px 8px rgba(0,0,0,0.08)`): Cards lift slightly on hover to signal clickability.

## 5. Components

### Buttons
- **Shape:** Rounded corners (6px). Clean, not pill-shaped.
- **Primary:** Ink Blue background (`#2c3e5a`), white text, 10px 20px padding. One per screen maximum.
- **Ghost:** Transparent, Muted text, identical padding. Used for secondary actions (Cancel, Back). On hover, fills with Border (`#e5e5e5`).
- **Hover / Focus:** Primary shifts to `#1a2d44`. Focus-visible gets a 2px Ink Blue outline offset by 2px. Transition 150ms ease on background only.
- **Touch:** Minimum 44px height on all interactive elements.

### Cards
- **Corner Style:** 10px radius. Gentle, not round.
- **Background:** Surface (`#ffffff`).
- **Border:** 1px Border (`#e5e5e5`). No shadow at rest.
- **Hover:** Border shifts to Border Hover (`#cccccc`), card lifts 2px via `transform: translateY(-2px)` with a tight shadow.
- **Internal Padding:** 16px (spacing.md).
- **Image thumbnails:** 6px radius inside cards.

### Inputs / Fields
- **Style:** 1px Border stroke, Surface background, 6px radius.
- **Padding:** 10px 14px. Font-size 16px minimum.
- **Focus:** Border shifts to Ink Blue, 2px offset outline. No glow.
- **Error / Disabled:** Error adds a single red border (`#d32f2f`). Disabled drops opacity to 0.5.

### Tabs
- **Style:** Horizontal row, bottom border 2px Border. Active tab: Ink Blue text + Ink Blue bottom border. Inactive: Muted text.
- **Touch:** Full-width tabs on mobile, min-height 44px.

### Toast
- **Style:** Fixed bottom-center, Ink text on Surface background, 1px Border, 10px radius. Fades in/out over 300ms. No icon.

### Lightbox
- **Style:** Fixed fullscreen, `rgba(0,0,0,0.92)` backdrop. Image constrained to 95vw/95vh. Close button top-right, white, 44px touch target.

## 6. Do's and Don'ts

### Do:
- **Do** use the system font stack as the first render; Inter loads as enhancement.
- **Do** keep spacing in multiples of 4px (4, 8, 16, 24, 32).
- **Do** use 1px borders for separation instead of shadows.
- **Do** ensure every interactive element has a 44px minimum touch target.
- **Do** set `font-size: 16px` on all inputs to prevent iOS zoom.

### Don't:
- **Don't** use border-left or border-right greater than 1px as a colored accent stripe.
- **Don't** use gradient text, glassmorphism, or decorative blur.
- **Don't** use box-shadow + 1px border together on cards at rest (the "ghost-card" pattern).
- **Don't** round cards beyond 14px or buttons beyond 8px.
- **Don't** use the Pico.css default blue (`#1095c1`) — too saturated for this system.
- **Don't** add SaaS landing-page clichés: hero metrics, gradient CTAs, numbered section markers, tiny uppercase tracked eyebrows.
- **Don't** use warm-tinted backgrounds (cream, sand, beige, paper-like warm tones). The Paper neutral is achromatic.
- **Don't** add emoji as icons in the UI. Use text labels or a consistent SVG icon set.
- **Don't** add more than one primary button per screen.
