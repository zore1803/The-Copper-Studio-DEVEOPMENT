# The Copper Studio Project Plan

## Canonical Design Direction

Use the quieter editorial studio system across the entire product:

- Headlines: Eb Garamond
- Body: Barlow Condensed
- Labels and metadata: Courier Prime
- Primary color: muted copper brown, `#6e5b48`
- Background: warm off-white, `#fff8f5`
- Shape language: restrained 4-8px radii, light borders, minimal shadows

The Storefront Home page should be rebuilt on this same system before React componentization. Avoid carrying forward a separate Inter/Playfair/orange-brown visual language.

## Commercial Flow

The public site is meeting-gated. Visitors should not see fixed package pricing or reach a pay-now flow before a consultation and approved quotation.

Primary public CTA:

- Book a Consultation

Checkout rules:

- Checkout is only reachable from the authenticated/client portal flow after a quotation is approved.
- Order summary content must render from a Quotation record, not static package pricing.
- Coupon/promo codes can remain, but only as adjustments against an approved quoted total.
- No public pricing tiers should appear on the Services page.

## MERN Build Notes

When moving from static HTML to MERN:

- Set up Tailwind through Vite rather than Tailwind CDN.
- Lift the canonical tokens into `tailwind.config.js`.
- Split the interface into shared components: Navbar, Footer, Hero, ServiceCard, AccordionItem, ConsultationCTA, QuoteSummary, CheckoutForm.
- Replace static checkout data with quotation-driven state from the API.
- Home animation can be a real CSS copper gradient animation; avoid the old `{{DATA:ANIMATION:ANIMATION_1}}` placeholder.

## UI Sections to Preserve

The static prototype now includes the core UI blocks to carry into React:

- Trust strip with business-model promises instead of fake client logos.
- Consultation-to-quotation journey timeline.
- Before/after workflow comparison.
- Client portal preview with quote status, metrics, mini timeline, and animated progress.
- Consultation request form with service intent, studio size, timeline, and email fields.
- Checkout progress strip and quotation snapshot before billing details.

These should become data-driven components, but the structure and motion language can stay.

## Shipping Flags

- Social proof names such as MAISON, ARCADE, STUDIO 8, PRISM, and VELVET are prototype placeholders and must be replaced or removed before launch.
- Legal pages are lightweight placeholders and need proper review before production.
