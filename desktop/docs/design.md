# Subnota Desktop Design and UI Parity Guide

Last verified: 2026-08-15

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

- Full-bleed white workspace with a neutral gray navigation/sidebar surface.
- Warm dark-brown ink rather than pure black for most body text.
- Ink-blue brand accent, used sparingly: primary action, focus, selection.
- Warm neutral borders, neutral-gray chrome, and restrained depth.
- Compact desktop controls paired with a comfortable 16px editor.
- Color blocks and hairlines establish hierarchy; heavy shadows are rare.
- Motion is short and functional, with subtle press scale feedback.

## Color system

> **Settled (2026-08-13): the brand colour is ink blue `#325496`.**
>
> The coral is gone. Mark and UI accent now share one hue (OKLCH 262°), so the
> forget-me-not and the interface read as one family. The mark stays a separate
> token (`--app-color-brand-mark`, one step lighter) because a logo is not held
> to text-contrast rules — do not collapse the two.
>
> The mark carries a second colour: **the right-hand petal alone** is malachite
> `#0b6e4f` (`--app-color-brand-petal`). Viridian was rejected — it sits within
> 0.003 lightness of the mark colour, so that petal vanishes in greyscale and
> under every colour-vision deficiency. Malachite clears it by 0.076.
>
> Brand colour is used in **seven places only**: the one primary action per
> screen (outline, never filled), the focus ring, the selected-memo rail,
> today/now in the calendar, the text caret and selection, real inline links,
> and progress/notification dots. Everything else — hover, pressed, selected
> surfaces, icon defaults, data, badges — is neutral. See the state table below.
>
> Any change to the brand values is one pass over `_color-tokens.scss`,
> `lib/colorTokens.ts`, `resources/icon.svg`,
> `scripts/generate-brand-assets.mjs`, `web/app/globals.css` and
> `web/app/subnota-ui/tokens.css` together. The last two are the landing site's
> copy of these tokens — it renders the real app UI, so it drifts visibly.

Primary light-mode values from `_color-tokens.scss`:

| Role | Token | Value |
| --- | --- | --- |
| Application background | `--app-color-bg` | `#fdfdfb` |
| Canvas/surface/paper | `--app-color-bg-canvas`, `--app-color-bg-surface` | `#ffffff` |
| Toolbar chrome | `--app-color-bg-toolbar` | `#fbfbfa` |
| Muted surface | `--app-color-bg-muted` | `#f7f7f4` |
| Selected surface | `--app-color-state-selected` | `rgba(20,20,19,.06)` |
| Hover surface | `--app-color-state-hover` | `rgba(20,20,19,.04)` |
| Primary text | `--app-color-text` | `#2c2520` |
| Strong text | `--app-color-text-strong` | `#1d1d1f` |
| Muted text | `--app-color-muted` | `#9c8e7c` |
| Accent neutral | `--app-color-accent` | `#8b7355` |
| Brand primary | `--app-color-brand-500` | `#325496` |
| Brand hover | `--app-color-brand-600` | `#254582` |
| Logo mark | `--app-color-brand-mark` | `#4c71b7` |
| Logo accent petal (right only) | `--app-color-brand-petal` | `#0b6e4f` |
| Default border | `--app-color-border` | `#e9e7e1` |
| Danger | `--app-color-danger` | `#b42318` |

Use semantic `--app-color-*` tokens first. The `--legacy-*` names in
`subnota-workspace.scss` are compatibility aliases, not permission to add new
hard-coded values, and **new code should reference `--app-color-*` directly**
rather than adding another `--legacy-*` alias.

### Intentional palettes — do not absorb into app tokens

Some colors are data, illustration, or third-party brand marks rather than
application chrome. They stay local on purpose and each site carries a
`/* 의도된 팔레트 … */` marker comment. Anyone (or any agent) tidying colors
must leave these alone:

| Palette | Where | Why |
| --- | --- | --- |
| Kakao brand | `.provider-badge.kakao`, `.oauth-btn.kakao`, `&.kakao` | Kakao's brand guidelines fix `#FEE500` / `#191919` |
| Google brand | `GoogleIcon()` in `features/settings/SettingsModal.tsx` | Google's four-colour mark |
| Schedule tone chips | `.month-cell em.tone-clay` / `-ink` / `-olive` | A user-facing categorical palette |
| Drop preview | `.cal-schedule-drop-preview` | Green means "this drop is valid" |
| Boot orbs / auth panel | `.orb-1`, `.orb-2`, `.auth-character-panel` | Illustration gradients |
| Auth flower field | `PETAL_COLORS` in `AuthCharacters.tsx` | Five blues around the logo colour. Painting all 46 flowers in the logo colour would read as 46 logos, not an illustration |
| Password strength | `.password-strength-*` | Weak/fair/good status colours |
| Graph + highlighter | `MemoSplitWorkspace.tsx`, `knowledgeGraph.ts`, `use-color-highlight.ts`, `code-block-node.scss`, `AuthCharacters.tsx`, `CalendarWorkspace.tsx` event palette | Data and content colour, chosen per item |

Everything else — surfaces, borders, text, muted text, hover and pressed
states — belongs in `--app-color-*`.

Dark mode is defined under `html.dark`. Do not create dark-mode overrides in
components when the corresponding semantic token already changes.

## Typography

The UI and editor use the shared stack (`--legacy-font-ui` / `-editor`):

```text
Pretendard, 'Apple SD Gothic Neo', -apple-system, BlinkMacSystemFont,
'Segoe UI', sans-serif
```

**Pretendard leads and is bundled.** It was built to cover exactly what the old
`Apple SD Gothic Neo` + `Inter` pair covered, so macOS sees the smallest change
while Windows escapes the Segoe UI fallback. Everything after Pretendard exists
for font-load failure, not as a design choice.

There is one more face. `--legacy-font-wordmark` (`'Alegreya Sans', 'Optima',
Candara`) is for the **wordmark only** — the text beside the mark in login,
Quick Subnota, and the error window. It is deliberately a different face from
body text: the same face would read as a large label, not a logo. Never use it
for content.

Monospace content uses JetBrains Mono or the system monospace fallback.

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

## Localization

The desktop UI supports Korean and English from **Settings → General → Display
language**. The choice is stored locally; when unset, the device language is
used. User memo content is never translated. Calendar/date rendering follows
the selected UI language: Korean uses `ko-KR`, while English uses the device's
English regional locale (for example, `en-US` or `en-GB`).

Korean and English date expressions are handled by the shared conservative
parser. Numeric English dates such as `6/10` use the device locale's CLDR
ordering only when it clearly establishes MDY or DMY (for example, US versus
UK/Australia). YMD or unavailable regional ordering remains unparsed instead of
being guessed. Backend batch parsing stays conservative because it does not
receive the device region.

## Geometry and rhythm

The spacing scale advances mainly in 2px increments from 2px through 24px.
Common structural sizes:

| Element | Size |
| --- | --- |
| Navigation rail | 58px |
| Session/memo rail | 200px default (200–300px resizable) |
| Merged command/title bar | 44px |
| Split-pane header | 32px |
| Toolbar button | 28px |
| Pane action button | 24px |
| Editor/view tab | 25px |
| Editor horizontal padding | 28px |

Radius runs 4–13px for ordinary controls, and 14–16px for the floating
app-level surfaces that sit above the workspace — the preview/schedule side
panels (16px), the settings window and date popover (14px). Avoid making every
ordinary surface a large rounded card; the larger radii are what mark a surface
as *floating*.

**Full pills (`999px`) are for controls that hold one short label, plus
indicators that are round by nature.** In practice that means:

- Segmented switchers and the button groups beside them — the calendar's 주/월,
  its `‹ 오늘 ›` nav, and every Mantine `SegmentedControl`. The track *and* its
  inner buttons both take the radius, or a square indicator sits inside a round
  track. Mantine needs `radius={999}` for this; the theme's `xl` is only 16px,
  so it is set once in `mantineTheme.ts` rather than per call site.
- Chips and tags — topic chips, report chips, link keywords.
- Key caps and value badges — the shortcut value in settings.
- Row actions that would otherwise read as running prose. Settings rows put
  `위치 변경` and `폴더 열기` side by side; as bare text they merge into one
  sentence, so each is wrapped in a small pill.
- Dots, rails, handles and "today" markers, which are round regardless.

Everything else — cards, inline panels, inputs, icon buttons — stays in the
4–13px range. An icon button turned into a full circle loses a legible hover
target, and a card at `999px` reads as a chip.

## Main shell

- The app fills the window height.
- The 58px icon-only navigation rail and memo/session rail collapse together.
  In that state neither reserves layout width; hovering the left window edge
  reveals only a short, vertically centred rounded navigation rail as an
  overlay. When expanded, both rails form one flat muted sidebar surface
  instead of separate cards.
- The workspace fills the window without an exposed shell background, rounded
  cards, or gutters. The merged command bar is transparent and doubles as a
  draggable titlebar region where native controls are not present.
- Split-pane tab strips use the top edge of each pane. With the sidebar
  collapsed, only the first pane's tabs are offset past the global controls.
  Tabs and action buttons remain interactive; empty header space drags the
  native window.
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
- Inline code uses the neutral selected-state surface and body ink — no accent
  colour. (`code { background: var(--legacy-bg-active) }`)
- Code blocks use the warm dark code surface and scroll horizontally.
- Blockquotes have no `border-left`; the rule is a `::before` bar painted with
  `--app-color-action-primary`.
- Task checkboxes take `accent-color: var(--legacy-coral-500)`. The token name
  is a leftover alias — its value is the ink-blue `--app-color-brand-500`.
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
- Primary actions use the brand outline pattern (`--app-color-action-primary-border`
  + `-ink`, never filled) or the established dark-ink button. The brand is ink
  blue; that is not licence to use blue as a generic action colour — outside the
  seven places listed in the colour section, actions stay neutral.
- Destructive actions use semantic danger tokens.

## Preview panel and ambient ghost line

Two surfaces intentionally break the usual card treatment. Both exist to be
read *while the user keeps writing*, so they must stay quiet.

**App-level side panels** — contextual surfaces such as Preview and the
calendar's schedule Inbox are fixed to the far right above the workspace at
every window width. They are the only major surfaces that use elevation.

- Distinguish it from a split pane with four signals: a hairline border,
  left-cast shadow, **no tab strip**, and no caret. The missing tab strip is
  still the strongest signal.
- Do **not** dim the text to express read-only. Dimming is the *disabled*
  pattern; a preview exists to be read, so contrast matches body text and only
  the editing affordances are removed.
- Width is user-resizable (280–600px) and remembered. Do not pin it — no
  comparable app ships a fixed-width side panel.
- It closes on `Esc` or `✕` only. Never close it on outside click or on
  typing: the whole point is referencing something while writing.

Any future app-level side panel uses the same fixed far-right slot, even when
the workspace contains two split panes. It must not be mounted inside a pane.
Feature-internal utility panels remain part of their feature layout and do not
use this app-level slot.

The slot never compresses the calendar or editor. Manual collapse remains
available from the panel header. The schedule Inbox is interactive: its rows can
be dropped only on the week calendar, where a green one-hour ghost previews the
resulting date and time. Month view never accepts these drops. The `draggable`
attribute sits on the row's own button, not on a wrapper — a drag that starts on
a button should not have to propagate out of it (see `.cal-event`).

**Ambient ghost line** — the recommendation under the editor. No border, no
background; a thin left rule marks it as "not your text".

- It must keep a metadata prefix (`7일 전 ·`). Without it, grey text next to a
  cursor reads as an insertable completion, which is a promise this feature
  cannot keep — it is a reference, not a suggestion.
- Express muting with a muted text token, not element `opacity`; opacity dims
  the background too and turns the surface muddy.
- The shortcut hint stays hidden until hover or focus.

## Quick Subnota

The floating quick-capture panel (`MiniComposer`, still `mini-*` in code) is a
compact shared renderer with the same SCSS on both platforms:

- Draggable header: brand mark, "Quick Subnota", `Esc 닫기` hint, main-app action.
- Paper textarea taking the remaining height. It carries **no focus ring**: the
  panel autofocuses the textarea on open, so a ring would be permanently lit and
  read as an error state, and `:focus-visible` is no answer either — a text input
  matches that selector however it received focus. Focus is shown by darkening
  the border to `--app-color-border-strong` instead.
- One action row shared with the "최근 링크" heading, buttons right-aligned:
  `현재 페이지 저장` and `메모 저장`, both on the white secondary surface. The
  accent is already spent on the brand mark; a filled button in a 380px panel
  competes with it. Each button carries its shortcut in a tooltip. The row renders even when the
  heading does not.
- A full-width status line at the bottom, wrapping to two lines. It clears as
  soon as the user types again.
- macOS may show the capture button and recent captures.
- Windows omits the capture button and uses `Ctrl`/`Alt`/`Shift` labels.

The panel does **not** edit global shortcuts. Recording them here means
suspending and re-registering OS bindings inside the very window the binding
opens; that belongs to `ShortcutRecorder` in settings. Where to surface the
panel's own toggle shortcut is still open — do not park it beside the title.

Do not create a separate Windows Quick component. Policy filtering must not
change the shared typography, color, padding, control style or save behavior.

## Saved-item density

Both "저장함" surfaces — the schedule Inbox side panel and the link Inbox grid —
follow one rule: **the item is the click target, and per-item buttons are the
exception, not the frame.** They previously each carried a filled primary button
plus two more controls on every row, so a 360px panel held nine buttons and a
224px card held four colour families at once. That is the look to avoid.

- The row/card itself opens the item. A per-item "자세히"/"수정" button is
  redundant with that and is not allowed back.
- Actions that the item's own click *cannot* express (place, delete, like) are
  hover-revealed icon buttons. Reveal them on `:hover` **and `:focus-within`** —
  hover alone is unreachable by keyboard.
- State is not an action. A liked item keeps its heart visible without hover;
  only then can a list distinguish liked from unliked.
- Rows inside an app-level side panel take a hairline border and a hover ring,
  **never a drop shadow**. The panel is already `--legacy-bg-paper`; a shadowed
  card on the same white reads as a box inside a box.
  `.schedule-approve-row` and `.preview-list-row` are deliberately the same
  shape — two side panels, one rule.
- Colour is a scarce signal. Do not spend it on a field that is present on every
  row (a date in a schedule list, a keyword on every card). The same data must
  not change colour between surfaces: link keywords are neutral
  `variant="default"` chips in both `InboxWorkspace` and `SourceDetailPane`.
- Grid cards may keep a fixed height for alignment, but the inside is natural
  flow with the last block pinned by `margin-top: auto`. Fixed per-slot flex
  bases leave empty holes mid-card when an item has no summary or keywords.
- Placeholders use the flat `--app-color-skeleton`. No decorative gradients —
  a diagonal gradient tells the user nothing about what is loading.

If a clickable card needs a full-surface overlay button, it must come **after**
`Card.Section` in the DOM: Mantine bleeds the first section to the card edge
with a `:first-child` negative margin, so an overlay placed before it leaves a
white gap above the thumbnail.

## Settings

The settings window (`.settings-window`) is `min(880px, 100vw - 80px)` wide by
`min(620px, 100vh - 80px)` tall: a 220px nav rail and a scrolling page. Inside a page, related rows live in one **group card**; the group's name
sits *outside* the card, above it.

- Group name is 12px muted — smaller and quieter than the 13px row label inside
  the card. A group name at row weight reads as another setting.
- The card carries the border; rows do not. Separators come from
  `.settings-reference-card > * + *`, so no line trails under the last row.
- Card radius stays at 10px with a hairline border — see the geometry rule
  above against turning every surface into a large rounded card.
- A control that acts on more than one group (the shortcut save bar) belongs
  *outside* the cards, as a page-level action row. Putting it in the last group
  implies it only saves that group.
- Group by what the rows actually do, not by what the page is called. `일반`
  once had notification, update and search toggles under `시작 및 창`.

## Inbox and web collection

The main Inbox is shared UI. On both platforms it must retain:

- Manual URL input and save action.
- Local-first pending/offline state.
- Saved item list and refresh behavior.
- Metadata/summary presentation.
- Opening a saved source in the shared detail pane.

Windows not having active-browser capture must never hide or degrade these
manual Inbox flows.

## Calendar and monthly report

- Calendar owns local scrolling when its grid cannot fit.
- Week/month controls remain compact and stable.
- Completion state and the monthly report are data visualization, not decorative
  platform chrome; they must match across operating systems.

## Brand motion

The mark is drawn in exactly one place (`components/SubnotaMark.tsx`); every
motion below imports its petal path and placements from there, so the logo can
never drift between surfaces.

| Surface | Component | Behaviour |
| --- | --- | --- |
| Boot, cold start | `BootBrandMark` (`assemble`) | Scattered note cards gather and unfold into the mark, then colour fills petal by petal. Plays to the end (1.19s) — a truncated assembly reads as a fault. |
| Boot, reload / reopened window | `BootBrandMark` (`spin`) | Petal chase. An endless loop, so cutting it at any frame is fine; the screen is never held. |
| Any spinner | `SubnotaSpinner` | The same chase, small. Replaced every rotating icon. |
| State B search | `SubnotaScatterMark` | The inverse of the boot motion: petals fly outward and morph into circles. Search is spreading out; boot is tidying up. |

All of it is CSS `@keyframes`, including the card->petal and petal->circle shape
morphs (Chromium interpolates SVG `d` when both paths share the same command
structure — hence the zero-length trailing cubic on the petal). Do not put a JS
motion library on the boot path: it is the first thing that must paint.

Every one of these stops under `prefers-reduced-motion`.

## Motion and accessibility

- Common motion durations are 140–200ms; long motion is reserved for meaningful
  transitions.
- Respect `prefers-reduced-motion` rules already present in shared SCSS.
- Enter/exit pairs use `framer-motion` with `{ type: 'spring', duration: 0.3,
  bounce: 0 }`. Exits are shorter and quieter than enters (~0.15s) — attention
  is already moving on.
- `AnimatePresence` must sit **outside** the conditional it animates. Placing it
  inside unmounts the whole tree and silently skips the exit animation.
- Icon-only controls require accessible labels.
- Focus must remain visible using the shared focus ring:
  `outline: 2px solid var(--app-color-focus-ring)` + `outline-offset: 2px`.
  The ring is the ink-blue brand, sized for WCAG 2.2 SC 1.4.11 (3:1).
- Do not reduce target sizes or hide keyboard focus to make Windows look more
  native.

## Empty states

One component, `src/components/EmptyState.tsx`. It replaced seven classes that
did the same job with different fonts, padding and alignment (`.empty-panel`,
`.empty-text`, `.preview-empty`, `.global-search-empty`, `.knowledge-graph-empty`,
`.cal-todo-empty`, `.mini-composer__recent-empty`).

**`size` is decided by the container:**

| size | Where | Shape |
| --- | --- | --- |
| `inline` | sidebar sections, day panel, Quick recent links | one muted line, left-aligned |
| `panel` | grids and panel bodies | centred block, flows in layout |
| `canvas` | graph areas | centred block, absolutely fills its frame |

**`tone` is decided by why it is empty:**

| tone | Meaning | Mark |
| --- | --- | --- |
| `start` | nothing done yet, or still being prepared | **yes** (not in `inline`) |
| `result` | searched or filtered down to zero | no |
| `neutral` | empty is normal, or even good | no |

Rules that hold across all of them:

- **The mark appears in `start` only, and never in `inline`.** A no-results state
  fires dozens of times while someone types; a repeated illustration wears out and
  becomes noise. In a 200px sidebar the empty state would outgrow the list it
  replaces. In practice the mark shows in two places in the whole app.
- The mark is `--app-color-brand-mark` at 30% opacity — present, but never louder
  than the title it sits above.
- **No action buttons.** Everything the user could do is already in its normal
  place on the screen; a button per empty screen is CTA overload.
- No dashed borders and no background. `dashed` reads as "drop something here".
- Copy states what the space is for, not what is missing. Internal terms
  ("graph", "nightly topic batch", "index") never appear.
- Empty is not an error. A dangling reference (graph node whose source was
  deleted) is `neutral` with an explanation; real failures keep their own error
  surface with a retry, such as `.preview-error` in the preview panel.

## Loading states

One system, chosen by the shape of the work — not one text style for everything.

| Kind of wait | Surface | Where |
| --- | --- | --- |
| Under ~1s | nothing | everywhere by default |
| App start, local workspace not ready | brand mock (≤1.2s) → app-shell skeleton, hard cap 4s | `WorkspaceBootSkeleton`, `lib/bootPhase.ts` |
| Fetching structured content | skeleton shaped like the real content | Inbox cards, web-summary body |
| Known progress | determinate `<progress>` | model download, first local index |
| Background work | bottom-right toast, or a 6px `.inline-busy` dot beside a label | `LocalIndexProgress`, Topics title, settings rows |
| Result set with no known shape | centred core + faint dots in the graph area only; label appears after 1.2s | `.net-search-bloom` |
| Automatic/unrequested work | nothing at all | Ambient Mirror auto search, incremental index |

Rules that hold across all of them:

- Existing data stays on screen while it refreshes. A reload never blanks a
  populated view, and a skeleton never covers content that is already there.
- Loading UI must not push layout or move content. Reserve the space or overlay.
- **Placeholder count follows the incoming data, not the window.** A paged grid
  renders exactly one page of placeholders (`InboxCardSkeleton count={PAGE_SIZE}`)
  and lets the grid's `auto-fill` decide the columns. Sizing a skeleton to the
  viewport promises more rows than will arrive, so the grid shrinks on load.
- **A list that fills its container renders a generous fixed count and clips**
  (`.boot-skeleton-sidebar` + `overflow: hidden`). No resize listener, and it
  fills at any window height. Body copy is the exception — a real document is
  short at the top, so filling the height there makes the load look like a loss.
- Skeleton geometry copies the real element's width rule and padding, not an
  approximation. The boot document uses the editor's `22px 28px` and full width
  for exactly this reason.
- Skeletons are for cards, lists and body copy only — never inside a toast,
  modal or dropdown.
- `.subnota-skeleton` styles Mantine's `<Skeleton>` with the app tokens and
  replaces its pulse with a slow left→right shimmer. Use the Mantine component;
  do not hand-roll placeholders.
- One status per operation. A modal that starts a job closes and hands off to
  the toast; it never runs alongside it.
- Status copy is short and concrete ("주변 메모 찾는 중"), never vague
  ("AI가 생각 중"). Prefer a small visual indicator over a large centred sentence.
- `prefers-reduced-motion: reduce` stops every shimmer, pulse and halo, and
  reveals delayed labels immediately.
- Keep `role="status"` / `aria-live` on anything a sighted user learns visually.

Brand note: the Phase A boot mark is a **mock**. The final brand motion is a
later redesign — do not grow message rotations or looping animation there.

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
- Disabling Quick Subnota on Windows.
- Disabling or hiding manual Inbox URL capture on Windows.
- Showing unreleased browser-capture controls on Windows.
- Changing shared layout, fonts, spacing or colors merely to match native
  Windows conventions.
- Removing a visible shared control without an explicit product-policy reason.
