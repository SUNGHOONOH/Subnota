# Subnota Desktop Design and UI Parity Guide

Last verified: 2026-07-14

This document describes the UI that exists in the unified `desktop/` app. It
is not a marketing-site design analysis. Code is the final source of truth;
token paths are listed so an agent can verify every claim before editing.

## Core invariant

The current macOS renderer is the canonical Subnota desktop UI/UX. Windows
uses the same React components and the same SCSS. A migration or Windows fix
must not bring back older Windows layout, styling, copy, state behavior, or
interaction patterns.

Platform-specific native chrome is allowed. Renderer divergence is allowed
only where a capability is unavailable:

- Windows uses the notification-area tray instead of the macOS menu bar.
- Windows Mini omits current-page capture and recent-capture UI.
- Windows settings omit the unavailable capture shortcut row.
- Keyboard labels use macOS glyphs or Windows key names as appropriate.

No other visual or interaction divergence is approved.

## Sources of truth

1. `src/styles/_color-tokens.scss` — semantic color decisions.
2. `src/styles/subnota-workspace.scss` — workspace typography, spacing, sizes,
   radii, motion and component layout.
3. `src/styles/_variables.scss` — Tiptap-compatible scales and dark mode.
4. `src/lib/colorTokens.ts` and `src/lib/mantineTheme.ts` — Mantine mapping.
5. Colocated component SCSS — feature-specific presentation only.

Do not introduce a second platform stylesheet or copy tokens into a Windows
file.

## Visual character

Subnota is a restrained warm editorial workspace, not a dense enterprise
dashboard and not a generic cool-gray Electron shell.

- Near-white warm canvas with white paper/surfaces.
- Warm dark-brown ink rather than pure black for most body text.
- Muted coral brand accent for focus, selection and primary action.
- Warm neutral borders and quiet chrome.
- Compact desktop controls paired with a comfortable 16px editor.
- Color blocks and hairlines establish hierarchy; heavy shadows are rare.
- Motion is short and functional, with subtle press scale feedback.

## Color system

Primary light-mode values from `_color-tokens.scss`:

| Role | Token | Value |
| --- | --- | --- |
| Application background | `--app-color-bg` | `#fdfdfb` |
| Canvas/surface/paper | `--app-color-bg-canvas`, `--app-color-bg-surface` | `#ffffff` |
| Toolbar chrome | `--app-color-bg-toolbar` | `#fbfbfa` |
| Muted surface | `--app-color-bg-muted` | `#f7f7f4` |
| Active surface | `--app-color-bg-active` | `#f8e4da` |
| Primary text | `--app-color-text` | `#2c2520` |
| Strong text | `--app-color-text-strong` | `#1d1d1f` |
| Muted text | `--app-color-muted` | `#9c8e7c` |
| Accent neutral | `--app-color-accent` | `#8b7355` |
| Brand primary | `--app-color-brand-500` | `#cc4929` |
| Brand hover | `--app-color-brand-600` | `#bf3f22` |
| Default border | `--app-color-border` | `#e9e7e1` |
| Danger | `--app-color-danger` | `#b42318` |

Use semantic `--app-color-*` tokens first. The `--legacy-*` names in
`subnota-workspace.scss` are compatibility aliases, not permission to add new
hard-coded values. Feature/data palettes such as tree or graph colors may stay
local when they represent data rather than application chrome.

Dark mode is defined under `html.dark`. Do not create dark-mode overrides in
components when the corresponding semantic token already changes.

## Typography

The UI and editor use the shared stack:

```text
Apple SD Gothic Neo, Inter, -apple-system, BlinkMacSystemFont,
Segoe UI, sans-serif
```

This order intentionally gives Korean text a native-feeling face on macOS and
falls through to Segoe UI on Windows. Monospace content uses JetBrains Mono or
the system monospace fallback.

| Role | Token/value |
| --- | --- |
| Tiny metadata | 10px |
| Secondary label | 11px |
| Compact UI label | 12px |
| Default UI | 13px |
| Emphasized UI | 15px |
| Editor body | 16px / line-height 1.6 |
| Small title | 18px |
| Heading | 22px / 28px / 30px |

Weight is restrained: body 400, controls 500, emphasis/headings normally 600,
and large titles no heavier than 700. Do not compensate for hierarchy by using
800/900 weights.

## Geometry and rhythm

The spacing scale advances mainly in 2px increments from 2px through 24px.
Common structural sizes:

| Element | Size |
| --- | --- |
| Navigation rail | 50px |
| Session/memo rail | 284px |
| Merged command/title bar | 38px |
| Split-pane header | 32px |
| Toolbar button | 28px |
| Pane action button | 24px |
| Editor/view tab | 25px |
| Editor horizontal padding | 28px |

Radius ranges from 4–13px for ordinary controls, with 16–18px reserved for
chips/brand moments and full pills only for pill-shaped controls. Avoid making
every surface a large rounded card.

## Main shell

- The app fills the window height.
- The 50px icon-only navigation rail stays visible.
- The memo/session rail sits beside the shared workspace and can collapse.
- The merged command bar stays at the top and doubles as a draggable titlebar
  region where native controls are not present.
- The workspace can contain at most two horizontal panes.
- Each pane may contain multiple editor or view tabs.
- Pane resizing never creates a page-level horizontal scrollbar. Memo text
  reflows; non-editor content may clip or own a local scroll region.
- A focused pane gets a subtle inset focus treatment, not a heavy card shadow.

The main shell intentionally does not turn into a mobile navigation layout when
the desktop window narrows. Secondary screens may reflow at 920px and 620px;
the navigation rail and split-workspace mental model remain stable.

## Editor

- Editor body is 16px with 1.6 line height.
- H1/H2/H3 use 28/22/18px with restrained weights.
- Paragraphs keep 12px bottom rhythm.
- Inline code uses a muted surface and coral text.
- Code blocks use the warm dark code surface and scroll horizontally.
- Blockquotes use a 3px coral left rule.
- Task checkboxes use the coral accent.
- The shared toolbar remains visible but disabled when the focused pane is a
  non-editor view, preserving spatial stability.

Do not alter editor typography on only one operating system.

## Navigation, tabs and controls

- Navigation is icon-only; accessible names come from `aria-label`/tooltips.
- Hover changes use quiet warm neutral backgrounds.
- Active navigation does not become a large colored pill.
- Tabs stay compact, single-line and horizontally scroll when necessary.
- Close affordances appear on active or hovered tabs.
- Buttons use short color transitions and approximately `0.96` press scale.
- Disabled controls remain visible with reduced opacity when retaining their
  position helps users understand the interface.

## Cards, menus and overlays

- Ordinary content surfaces use warm hairline borders with little or no shadow.
- Floating menus may use the shared small shadow plus a soft long ambient
  shadow.
- Modal overlays use the semantic warm-black overlay token.
- Primary actions use brand coral or the established dark-ink button pattern;
  do not introduce blue as a generic action color.
- Destructive actions use semantic danger tokens.

## Mini Subnota

Mini is a compact shared renderer with the same SCSS on both platforms:

- Draggable header with title, shortcut hint and main-app action.
- Paper textarea with coral focus border/ring.
- Compact shortcut controls using native-looking keycaps.
- Primary save action in coral.
- macOS may show capture shortcut and recent captures.
- Windows shows the Mini shortcut only and uses `Ctrl`/`Alt`/`Shift` labels.

Do not create a separate Windows Mini component. Policy filtering must not
change the shared typography, color, padding, control style or save behavior.

## Inbox and web collection

The main Inbox is shared UI. On both platforms it must retain:

- Manual URL input and save action.
- Local-first pending/offline state.
- Saved item list and refresh behavior.
- Metadata/summary presentation.
- Opening a saved source in the shared detail pane.

Windows not having active-browser capture must never hide or degrade these
manual Inbox flows.

## Calendar and tree

- Calendar owns local scrolling when its grid cannot fit.
- Week/month controls remain compact and stable.
- Completion state and tree growth are data visualization, not decorative
  platform chrome; they must match across operating systems.
- Olive tree/forest actions are an intentional secondary semantic palette and
  should not replace the coral application action color elsewhere.

## Motion and accessibility

- Common motion durations are 140–200ms; long motion is reserved for meaningful
  transitions.
- Respect `prefers-reduced-motion` rules already present in shared SCSS.
- Icon-only controls require accessible labels.
- Focus must remain visible using the shared coral focus ring.
- Do not reduce target sizes or hide keyboard focus to make Windows look more
  native.

## Platform-native differences

Native differences are contained outside shared content:

- macOS uses hidden-inset titlebar behavior, menu bar, Apple Events permission
  and AppleScript capture.
- Windows uses native window chrome, notification-area tray and Windows close
  preference behavior.
- macOS package surfaces are DMG/ZIP; Windows uses Squirrel Setup EXE.

The native shell may differ because the operating systems differ. Everything
inside the renderer remains the shared Subnota design except the approved
capability rows.

## Agent UI change checklist

Before changing visible code:

1. Identify the existing shared component and token source.
2. Confirm whether the request is truly platform policy or shared UI.
3. If shared, edit one component/style path only.
4. Do not consult the legacy Windows UI as a design source.
5. Compare all renderer/SCSS changes against the macOS baseline.
6. Test light and dark mode, narrow window, two panes and keyboard navigation.
7. Test Mini and manual Inbox URL flows on both policies when relevant.
8. Run type-checking and the full test suite.
9. Before deleting legacy folders, perform real macOS and Windows screenshot/
   interaction QA.

## Forbidden regressions

- Separate macOS and Windows renderer trees.
- Platform-specific copies of SCSS.
- Replacing current shared UI with an older Windows implementation.
- Disabling Mini Subnota on Windows.
- Disabling or hiding manual Inbox URL capture on Windows.
- Showing unreleased browser-capture controls on Windows.
- Changing shared layout, fonts, spacing or colors merely to match native
  Windows conventions.
- Removing a visible shared control without an explicit product-policy reason.
