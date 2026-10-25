# Hat: Mobile and PWA

Use for `manifest.webmanifest`, service worker, install flows, offline behavior, safe areas, and mobile-specific UI.

- Check manifest identity, start URL/scope, icons, theme colors, standalone behavior, and install guidance for Android/iOS differences.
- Verify service-worker cache/version updates and a cold offline start for the features promised offline. Never cache OpenStreetMap tiles.
- Preserve safe-area insets, orientation/resizing behavior, Hebrew keyboard usability, and input sizes that avoid automatic iOS zoom. Test coarse-pointer targets and prevent unintended map interaction while scrolling.
- Keep the beta storage namespace separate from production (`jlm-street-journal-beta-v1` vs `jlm-street-journal-v1`). Do not let test state contaminate production data.
- Automated checks cannot replace a real-device test. State clearly whether iOS Safari/Android Chrome and install/offline behavior were tested on hardware or only simulated.
- Check that cached resources and update prompts do not leave users on an incoherent mix of app versions.
