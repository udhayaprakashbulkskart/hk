# @hkfinhub/ui: design system

Design tokens and shared primitives for HK FinHub web and admin.

- `src/tokens.css`: colour tokens for dark (default brand theme) and light themes, set on `:root` and `[data-theme]`. Palette from the brand spec: Hong Kong red `#B5121B`, dark background `#080B10`, card `#141821`, secondary `#202631`, gold `#C6A34A`, text `#F5F5F5` and `#A8ADB8`, success `#159B70`, error `#E04444`.
- `src/button.tsx`, `card.tsx`, `badge.tsx`, `input.tsx`, `stat.tsx`, `logo.tsx`: primitives in the shadcn/ui style (hand-written, no CLI). Minimum 44 px touch targets on small screens.
- `src/logo.tsx`: an original HK FinHub mark. It is not a bank or government emblem.

Components reference CSS variables only, never raw colours, so both themes work everywhere.
