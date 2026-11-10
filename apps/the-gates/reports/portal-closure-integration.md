# Approved portal closure — 2026-10-19

Presentation only; no maths/book/event ordering changes.

- Shared circular close: inward pulse, accelerating uniform shrink, counter-rotating rim/vortex, final fading light pin and six sparks.
- Symbol portals retain existing suction, then close for 500/260/220 ms (Normal/Fast/Turbo). Existing skip-tail compression remains available.
- Gate rewards use the last 500 ms of the existing normal outro; pending Hidden rewards keep the portal open. All reward kinds share this renderer.
- Bonus entry waits for user dismissal, swallows content for 400 ms, then closes for 500 ms. Bonus end uses the same order before the doors close/reopen to base. No second portal on reopening.
- Reduced motion has no new curls, spin or particles. Effects use bounded Pixi Graphics geometry, no new textures, filters or timers.
- Runtime overrides replace the older short baked close tracks; existing authoring assets remain intact.

Verification: 360 frontend tests passed; TypeScript check passed; production Vite build passed. New tests cover continuity, uniform skeleton scale/transparent endpoint, reward outro interval, and bonus popup-before-portal ordering. Live gameplay visual review still recommended on desktop and mobile.
