---
name: METRA Design System
colors:
  surface: '#f8f9fa'
  surface-dim: '#d9dadb'
  surface-bright: '#f8f9fa'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f3f4f5'
  surface-container: '#edeeef'
  surface-container-high: '#e7e8e9'
  surface-container-highest: '#e1e3e4'
  on-surface: '#191c1d'
  on-surface-variant: '#44474e'
  inverse-surface: '#2e3132'
  inverse-on-surface: '#f0f1f2'
  outline: '#74777f'
  outline-variant: '#c4c6cf'
  surface-tint: '#495f82'
  primary: '#001026'
  on-primary: '#ffffff'
  primary-container: '#0b2545'
  on-primary-container: '#778db2'
  inverse-primary: '#b1c7f0'
  secondary: '#755b00'
  on-secondary: '#ffffff'
  secondary-container: '#fed255'
  on-secondary-container: '#735a00'
  tertiary: '#1d0b00'
  on-tertiary: '#ffffff'
  tertiary-container: '#3c1d00'
  on-tertiary-container: '#b38259'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#d5e3ff'
  primary-fixed-dim: '#b1c7f0'
  on-primary-fixed: '#001c3b'
  on-primary-fixed-variant: '#314769'
  secondary-fixed: '#ffe08e'
  secondary-fixed-dim: '#ecc246'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#584400'
  tertiary-fixed: '#ffdcc2'
  tertiary-fixed-dim: '#f3bb8e'
  on-tertiary-fixed: '#2e1500'
  on-tertiary-fixed-variant: '#643e1b'
  background: '#f8f9fa'
  on-background: '#191c1d'
  surface-variant: '#e1e3e4'
typography:
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.01em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  data-point:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '700'
    lineHeight: 24px
  trust-score:
    fontFamily: Source Serif 4
    fontSize: 48px
    fontWeight: '600'
    lineHeight: 48px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 16px
  margin-mobile: 16px
  margin-desktop: 32px
  container-max: 1200px
---

## Brand & Style
The design system is engineered for the high-stakes environment of legal metrology and field inspections. The brand personality is **clinical, diagnostic, and official**, emphasizing evidence-based reporting and administrative precision. 

The aesthetic is a hybrid of **Modern Corporate and Utilitarian Minimalism**. It prioritizes high information density and immediate scannability over decorative flair. The UI should feel like a digital extension of a physical legal instrument: cold, precise, and indisputable. Visual fluff is replaced by structural integrity, using clear hierarchies to guide field officers through complex compliance workflows without distraction.

## Colors
The palette is rooted in authority and compliance. 

*   **Primary (Deep Navy):** Reserved for the "Command Layer"—headers, primary action buttons, and active navigational states. It establishes a foundation of legal stability.
*   **Data Highlight (Muted Gold):** Used with strict intent for numerical data, verification stamps, and key metric highlights. It signifies "Value" and "Accuracy."
*   **Compliance Tones:** A standardized set of semantic colors for status reporting. Green indicates "Compliant," Amber for "Review Required," Red for "Violation," and Gray for "Historical/Inactive."
*   **Surfaces:** Utilize the Surface Neutral (#F8F9FA) to define content areas against the Clean White (#FFFFFF) background, creating subtle but effective contrast without the need for shadows.

## Typography
The typographic system relies on **Inter** for its neutral, highly legible glyphs, particularly effective for dense data and technical strings.

*   **Numerical Emphasis:** All measurements, case IDs, and timestamps must use **Bold** weights to ensure they are the first elements scanned on a page.
*   **The Trust Exception:** The "Seller Trust Score" is the only element permitted to use **Source Serif 4**. This provides a distinct "institutional" or "notarized" feel to the specific metric, separating it from raw field data.
*   **Hierarchy:** Use the `label-caps` style for section headers within forms to maintain an organized, ledger-like structure.

## Layout & Spacing
This design system utilizes a **Rigid Grid** model to mirror the structure of official legal documents. 

*   **Grid:** A 12-column grid on desktop and a 4-column grid on mobile. 
*   **Rhythm:** An 8px base unit (derived from 2x 4px units) governs all spacing. Vertical rhythm is critical; maintain consistent padding within data cards to allow the eye to track across rows easily.
*   **Density:** Content density should be high. Use tight internal margins (12px) within cards to maximize the information visible above the fold, reducing the need for excessive scrolling during field inspections.

## Elevation & Depth
This design system avoids traditional depth metaphors like drop shadows or blurs to maintain a "flat and factual" appearance.

*   **Structural Outlines:** Hierarchy is defined through **1px or 2px solid strokes**. Surfaces are layered using slight tonal shifts (e.g., a white card on a #F8F9FA background).
*   **Border Hierarchy:** Use a 1px #E5E7EB stroke for standard containers. Use a 2px Deep Navy stroke for active or focused inputs and primary containers.
*   **Overlays:** Modal backdrops use the semi-transparent navy overlay to maintain brand presence while dimming background data.

## Shapes
Shapes are functional and structured. The system uses specific radii to distinguish between different content types:

*   **Primary Containers (Cards):** 12px radius to provide a modern, organized frame for complex data sets.
*   **Action Elements (Buttons/Inputs):** 8px radius. This "Soft" rectangular approach maintains a professional look without feeling aggressive or overly consumer-oriented.
*   **Messaging (Chat/Logs):** 6px radius for chat bubbles to indicate a slight shift in tone for communication logs while remaining aligned with the overall geometric rigor.

## Components
Components are designed for rapid data entry and "at-a-glance" verification.

*   **Buttons:** Strictly rectangular with 8px corners. Primary buttons use Deep Navy with White text. Secondary buttons use a 1px navy border. No gradients or hover-lifts; use color shifts (slightly lighter navy) for interaction states.
*   **Data Cards:** Defined by a 1px stroke. The header of a card may have a 4px left-border accent in a semantic color (Green/Amber/Red) to indicate the compliance status of that specific record.
*   **Input Fields:** High-contrast labels (Inter Bold, 12px). Active states use a 2px Deep Navy border. Success/Error states use the respective compliance colors for the border and helper text.
*   **Chips/Badges:** Use a "Status Fill"—light background tints with dark text (e.g., Light Green background with Dark Green text) for non-interactive status labels.
*   **Icons:** Use 24px line icons with a consistent 2px stroke weight. Avoid filled icons unless used as a notification indicator. Icons should be strictly functional (e.g., Scale, Document, Signature, Camera).
*   **Evidence List:** A specialized list component featuring a thumbnail, timestamp, and metadata string, separated by subtle 1px dividers.