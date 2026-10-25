# Hat: UX, Accessibility, and RTL

Use for user-interface structure, controls, interaction, responsive styling, or Hebrew/RTL behavior.

- Preserve Hebrew user-facing language and RTL direction. Use logical CSS properties (`margin-inline`, `inset-inline`) where appropriate; isolate genuinely LTR content such as URLs.
- Check semantic structure, accessible names, keyboard operation, visible focus, correct `aria-*` state, and status announcements that do not overwhelm (`aria-live`).
- Meet WCAG 2.1 AA: text contrast at least 4.5:1, non-text/UI boundaries at least 3:1, and do not communicate state by color alone.
- Touch targets are at least 44×44 CSS px, including coarse-pointer layouts. Avoid horizontal overflow at representative 360/390/430 px widths; ensure form controls are at least 16 px to avoid iOS auto-zoom.
- Dialogs/sheets must manage focus, close behavior, escape handling, and return focus. Destructive actions need a reversible path where the product supports undo; preserve all state in an undo snapshot.
- Respect `prefers-reduced-motion`. Check `[hidden]` behavior against display rules and ensure disabled/empty states remain understandable.
- Do not change protected DOM IDs or public contracts casually. Test the actual changed interaction, not only its visual appearance.
