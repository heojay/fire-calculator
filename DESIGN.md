---
version: alpha
name: Coinbase-design-analysis
description: An inspired interpretation of Coinbase's marketing design language: a quiet institutional finance surface built from a white canvas, restrained ink, soft gray bands, scarce Coinbase Blue (#0052ff) for primary actions, and full-bleed near-black editorial product heroes with layered dashboard mockups.

colors:
  primary: "#0052ff"
  primary-active: "#003ecc"
  primary-disabled: "#a8b8cc"
  accent-yellow: "#f4b000"
  canvas: "#ffffff"
  surface-soft: "#f7f7f7"
  surface-strong: "#eef0f3"
  surface-dark: "#0a0b0d"
  surface-dark-elevated: "#16181c"
  hairline: "#dee1e6"
  hairline-soft: "#eef0f3"
  ink: "#0a0b0d"
  body: "#5b616e"
  body-strong: "#0a0b0d"
  muted: "#7c828a"
  muted-soft: "#a8acb3"
  on-primary: "#ffffff"
  on-dark: "#ffffff"
  on-dark-soft: "#a8acb3"
  semantic-up: "#05b169"
  semantic-down: "#cf202f"

typography:
  display-mega:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 80px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -2px
  display-xl:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 64px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -1.6px
  display-lg:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 52px
    fontWeight: 400
    lineHeight: 1
    letterSpacing: -1.3px
  display-md:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 44px
    fontWeight: 400
    lineHeight: 1.09
    letterSpacing: -1px
  display-sm:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 36px
    fontWeight: 400
    lineHeight: 1.11
    letterSpacing: -0.5px
  title-lg:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 32px
    fontWeight: 400
    lineHeight: 1.13
    letterSpacing: -0.4px
  title-md:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 18px
    fontWeight: 600
    lineHeight: 1.33
  title-sm:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.25
  body-md:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 16px
    fontWeight: 400
    lineHeight: 1.5
  body-strong:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 16px
    fontWeight: 700
    lineHeight: 1.5
  body-sm:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 14px
    fontWeight: 400
    lineHeight: 1.5
  caption:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 13px
    fontWeight: 400
    lineHeight: 1.5
  caption-strong:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 12px
    fontWeight: 600
    lineHeight: 1.5
  number-display:
    fontFamily: JetBrains Mono, Geist Mono, ui-monospace, SFMono-Regular, monospace
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
  button:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 16px
    fontWeight: 600
    lineHeight: 1.15
  nav-link:
    fontFamily: Inter, system-ui, -apple-system, Segoe UI, sans-serif
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4

rounded:
  none: 0px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  pill: 100px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  base: 16px
  md: 20px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 96px

components:
  top-nav-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.nav-link}"
    height: 64px
  top-nav-on-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.nav-link}"
    height: 64px
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "{spacing.sm} {spacing.md}"
    height: 44px
  button-primary-active:
    backgroundColor: "{colors.primary-active}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  button-primary-disabled:
    backgroundColor: "{colors.primary-disabled}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
  button-secondary-light:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    padding: "{spacing.sm} {spacing.md}"
  button-secondary-dark:
    backgroundColor: "{colors.surface-dark-elevated}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
  button-outline-on-dark:
    backgroundColor: transparent
    textColor: "{colors.on-dark}"
    borderColor: "{colors.on-dark}"
    rounded: "{rounded.pill}"
  button-tertiary-text:
    backgroundColor: transparent
    textColor: "{colors.primary}"
    typography: "{typography.button}"
  button-pill-cta:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.pill}"
    height: 56px
    padding: "{spacing.base} {spacing.xl}"
  hero-band-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-mega}"
    padding: "{spacing.section} {spacing.xl}"
  hero-band-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    typography: "{typography.display-mega}"
    padding: "{spacing.section} {spacing.xl}"
  product-ui-card-dark:
    backgroundColor: "{colors.surface-dark-elevated}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  product-ui-card-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  feature-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  asset-row:
    backgroundColor: transparent
    borderColor: "{colors.hairline}"
    numberTypography: "{typography.number-display}"
  price-up-cell:
    textColor: "{colors.semantic-up}"
    typography: "{typography.number-display}"
  price-down-cell:
    textColor: "{colors.semantic-down}"
    typography: "{typography.number-display}"
  asset-icon-circular:
    backgroundColor: "{colors.surface-strong}"
    rounded: "{rounded.full}"
    size: 32px
  pricing-tier-card:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  pricing-tier-featured:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  text-input:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    height: 48px
    padding: 14px 16px
  search-input-pill:
    backgroundColor: "{colors.surface-strong}"
    rounded: "{rounded.pill}"
    height: 44px
    padding: "{spacing.sm} {spacing.md}"
  badge-pill:
    backgroundColor: "{colors.surface-strong}"
    textColor: "{colors.ink}"
    typography: "{typography.caption-strong}"
    rounded: "{rounded.pill}"
  cta-band-dark:
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    padding: "{spacing.section}"
  footer-light:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.body}"
    typography: "{typography.body-sm}"
  legal-band:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.muted}"
    typography: "{typography.caption}"

  ex-pricing-tier:
    description: "Default pricing tier card using Coinbase light card chrome."
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  ex-pricing-tier-featured:
    description: "Featured tier through dark inversion, not a colored ribbon."
    backgroundColor: "{colors.surface-dark}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  ex-product-selector:
    description: "Product or plan selector card on a white canvas."
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  ex-cart-drawer:
    description: "Subscription or calculation summary drawer."
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: "{spacing.lg}"
    item-divider: "{colors.hairline}"
  ex-app-shell-row:
    description: "Sidebar row with scarce Coinbase Blue active indicator."
    backgroundColor: "{colors.canvas}"
    activeIndicator: "{colors.primary}"
    rounded: "{rounded.sm}"
    padding: "{spacing.sm} {spacing.base}"
  ex-data-table-cell:
    description: "Default table chrome with mono numerical values."
    headerBackground: "{colors.canvas}"
    headerTypography: "{typography.caption-strong}"
    bodyTypography: "{typography.body-sm}"
    numberTypography: "{typography.number-display}"
    cellPadding: "{spacing.sm} {spacing.base}"
    rowBorder: "{colors.hairline}"
  ex-auth-form-card:
    description: "Sign-in or sign-up card using input primitives."
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  ex-modal-card:
    description: "Modal surface using the same rounded card geometry."
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
  ex-empty-state-card:
    description: "Quiet empty state card."
    backgroundColor: "{colors.surface-soft}"
    rounded: "{rounded.xl}"
    padding: "{spacing.xl}"
    captionTypography: "{typography.body-md}"
  ex-toast:
    description: "Toast notification surface."
    backgroundColor: "{colors.canvas}"
    rounded: "{rounded.lg}"
    padding: "{spacing.sm} {spacing.base}"
    typography: "{typography.body-sm}"
---

## Overview

Coinbase reads like an institutional financial brand that happens to trade crypto. The marketing surface is quiet, white-canvas, editorially spaced, and nearly monochromatic. The single brand voltage is **Coinbase Blue** (`{colors.primary}` -- `#0052ff`), used sparingly for primary CTA pills, the brand wordmark, and inline emphasis links.

Type pairs **CoinbaseDisplay** for hero headlines with **CoinbaseSans** for body, captions, and navigation. Because the licensed Coinbase families are unavailable here, use Inter as the display/body substitute and JetBrains Mono or Geist Mono for tabular numbers. Display copy stays at weight 400.

The page rhythm rotates three modes: bright white editorial sections, soft-gray elevation bands, and full-bleed dark editorial heroes carrying layered product-UI mockup cards. For this FIRE calculator, the first screen should behave like a product tool, not a marketing landing page: short copy on top, then a calculator-first input/result layout.

**Key Characteristics:**
- Single accent color: `{colors.primary}` (`#0052ff`) carries primary CTAs, active controls, wordmark, and inline links.
- Modest display weights: display headlines stay weight 400, never 700+.
- Editorial pill geometry: CTAs use `{rounded.pill}`, cards use `{rounded.xl}`, asset/icon plates use `{rounded.full}`.
- Dark product mockup surfaces are the signature hero pattern; use them selectively for product-like result panels.
- Trading green/red are semantic text colors only, never button backgrounds.
- Major editorial spacing is generous, with `{spacing.section}` (`96px`) for full bands.

## Colors

### Brand & Accent
- **Coinbase Blue** (`{colors.primary}` -- `#0052ff`): the only action color.
- **Coinbase Blue Active** (`{colors.primary-active}` -- `#003ecc`): pressed/active primary state.
- **Coinbase Blue Disabled** (`{colors.primary-disabled}` -- `#a8b8cc`): disabled primary CTA tint.
- **Accent Yellow** (`{colors.accent-yellow}` -- `#f4b000`): illustrative-only Bitcoin/asset glyph accent.

### Surface
- **Canvas** (`{colors.canvas}` -- `#ffffff`): default page floor.
- **Surface Soft** (`{colors.surface-soft}` -- `#f7f7f7`): alternating band surface.
- **Surface Strong** (`{colors.surface-strong}` -- `#eef0f3`): secondary controls and asset plates.
- **Surface Dark** (`{colors.surface-dark}` -- `#0a0b0d`): dark editorial bands.
- **Surface Dark Elevated** (`{colors.surface-dark-elevated}` -- `#16181c`): floating product UI cards on dark bands.

### Text
- **Ink** (`{colors.ink}` -- `#0a0b0d`): headings and primary text.
- **Body** (`{colors.body}` -- `#5b616e`): running text.
- **Muted** (`{colors.muted}` -- `#7c828a`): secondary captions.
- **On Primary** (`{colors.on-primary}` -- `#ffffff`): text on Coinbase Blue.
- **On Dark Soft** (`{colors.on-dark-soft}` -- `#a8acb3`): muted text on dark.

### Trading Semantics
- **Semantic Up** (`{colors.semantic-up}` -- `#05b169`): positive price/asset movement text only.
- **Semantic Down** (`{colors.semantic-down}` -- `#cf202f`): negative price/asset movement text only.

## Typography

Display headings use the CoinbaseDisplay substitute at weight 400 with negative tracking. Body, buttons, labels, and navigation use the CoinbaseSans substitute at weights 400/600/700. Every numerical value that behaves like tabular data uses `{typography.number-display}`.

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---:|---:|---:|---:|---|
| `{typography.display-mega}` | 80px | 400 | 1.0 | -2px | Homepage hero h1 |
| `{typography.display-xl}` | 64px | 400 | 1.0 | -1.6px | Subsidiary heroes |
| `{typography.display-lg}` | 52px | 400 | 1.0 | -1.3px | Section heads |
| `{typography.display-md}` | 44px | 400 | 1.09 | -1px | CTA-band headlines |
| `{typography.display-sm}` | 36px | 400 | 1.11 | -0.5px | Compact heads |
| `{typography.title-lg}` | 32px | 400 | 1.13 | -0.4px | Card group titles |
| `{typography.title-md}` | 18px | 600 | 1.33 | 0 | Component titles |
| `{typography.body-md}` | 16px | 400 | 1.5 | 0 | Default body |
| `{typography.caption}` | 13px | 400 | 1.5 | 0 | Captions |
| `{typography.number-display}` | 18px | 500 | 1.4 | 0 | Prices, amounts, percentages |
| `{typography.button}` | 16px | 600 | 1.15 | 0 | CTA pills |

## Layout

- **Base unit:** 4px.
- **Major section rhythm:** `{spacing.section}` (`96px`) for editorial bands.
- **Content width:** cap large content around 1200px and center it.
- **Calculator-first home:** short headline and one-line subcopy first, then an input card and result card occupying the first viewport.
- **Desktop calculator grid:** input card left, result/detail card right.
- **Mobile calculator grid:** headline, input card, result card, detail tabs in one column.

## Components

### Navigation
`top-nav-light` is the default white-canvas nav. The wordmark uses `{colors.primary}`. Utility actions use secondary pill buttons unless they are primary conversion actions.

### Buttons
Primary buttons are Coinbase Blue pills. Secondary buttons use `{colors.surface-strong}` with ink text. Inline text actions use Coinbase Blue without a filled background.

### Calculator Cards
The calculator input card is a light `product-ui-card-light`: white canvas, 1px hairline, `{rounded.xl}`, 32px padding. Result cards may use the same light card pattern or a restrained dark elevated surface when a product-mockup feel is needed. Numbers use mono typography.

### Forms
Inputs use a 48px minimum height, 12px radius, 1px hairline border, and a 2px Coinbase Blue focus outline. Money, percent, and year inputs keep native keyboard accessibility.

### Results
Result summaries present the four primary FIRE outputs first: expected FIRE timing, required assets, monthly savings, and progress to target. Detailed charts/tables live below the first result card.

## Do's and Don'ts

### Do
- Reserve Coinbase Blue for primary actions, active states, wordmark, and inline links.
- Use pill buttons and 24px cards.
- Keep display type at weight 400.
- Render tabular numbers with mono typography.
- Use soft gray bands instead of extra accent colors.

### Don't
- Don't introduce a secondary brand color.
- Don't use green/red as CTA backgrounds.
- Don't bold display headlines.
- Don't create decorative gradient/orb backgrounds.
- Don't turn the first screen into a marketing landing page when the product is a calculator.

## Responsive Behavior

| Name | Width | Key Changes |
|---|---:|---|
| Mobile | < 640px | Calculator grid becomes one column, cards fill width, hero h1 steps to 36-40px. |
| Tablet | 640-1024px | Calculator grid may remain one column or balanced two-up when space allows. |
| Desktop | 1024-1280px | Full two-column calculator grid, content capped around 1200px. |
| Wide | > 1280px | Content remains capped; dark/product bands may go full-bleed. |

Touch targets stay at least 44px. Calculator fields, mode tabs, and result tabs remain keyboard reachable.
