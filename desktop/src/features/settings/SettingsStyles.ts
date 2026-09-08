// Settings modal visual system. Keep the declaration order stable: the modal renders this string inline.
export const SETTINGS_CSS = `
.settings-reference-frame {
  --ref-text: var(--app-color-text-strong);
  --ref-selected: var(--app-color-bg-muted);
  width: min(820px, calc(100vw - 48px));
  aspect-ratio: 41 / 30;
  max-height: calc(100dvh - 48px);
  position: relative;
  overflow: hidden;
  border-radius: 18px;
  margin-inline: auto;
}

.settings-reference {
  --ref-bg: var(--app-color-bg-surface);
  --ref-text: var(--app-color-text-strong);
  --ref-muted: var(--app-color-muted-design);
  --ref-line: var(--app-color-border);
  --ref-selected: var(--app-color-bg-muted);
  --ref-focus: var(--app-color-text-strong);
  --ref-scale: 0.72;
  /* The reference layout is rendered at 72%; these resolve to the app's
     24/28px control and 14/16px icon tiers after scaling. */
  --ref-control-compact: 33.333px;
  --ref-control-standard: 38.889px;
  --ref-icon-compact: 19.444px;
  --ref-icon-standard: 22.222px;
  --ref-font-compact: 16.667px;
  --ref-font-standard: 18.056px;
  --ref-padding-compact: 11.111px;
  --ref-padding-standard: 13.889px;
  display: flex;
  width: calc(100% / var(--ref-scale));
  height: calc(100% / var(--ref-scale));
  background: var(--ref-bg);
  color: var(--ref-text);
  border: 1px solid var(--app-color-border-strong);
  border-radius: 22px;
  overflow: hidden;
  transform: scale(var(--ref-scale));
  transform-origin: top left;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.settings-reference * {
  box-sizing: border-box;
}

.settings-reference-sidebar {
  flex: 0 0 320px;
  width: 320px;
  padding: 29px 16px 32px;
  border-right: 1px solid var(--ref-line);
  background: var(--app-color-bg-surface);
}

.settings-reference-sidebar-title {
  margin: 0 24px 43px;
  font-size: 26px;
  line-height: 1.16;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--ref-text);
}

.settings-reference-nav {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.settings-reference-nav-button.mantine-Button-root {
  width: 100%;
  height: 58px;
  padding: 0 18px;
  border: 0;
  border-radius: 12px;
  background: transparent;
  color: var(--ref-text);
  font-size: 18px;
  line-height: 1.2;
  font-weight: 400;
  letter-spacing: 0;
  justify-content: flex-start;
}

.settings-reference-nav-button .mantine-Button-inner {
  justify-content: flex-start;
}

.settings-reference-nav-button .mantine-Button-section {
  margin-inline-end: 17px;
}

.settings-reference-nav-button svg {
  width: 25px;
  height: 25px;
  stroke-width: 1.9;
}

.settings-reference-nav-button[data-active] {
  background: var(--ref-selected);
}

.settings-reference-nav-button:hover,
.settings-reference-nav-button:active {
  background: var(--ref-selected);
}

.settings-reference-nav-button:focus-visible,
.settings-reference-link:focus-visible,
.settings-reference-shortcut-record:focus-visible {
  outline: 2px solid var(--ref-focus);
  outline-offset: 2px;
}

.settings-reference-main {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: 29px 24px 72px;
  scrollbar-width: none;
}

.settings-reference-main::-webkit-scrollbar {
  display: none;
}

.settings-reference-page-title {
  margin: 0 0 49px;
  font-size: 26px;
  line-height: 1.16;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--ref-text);
}

.settings-reference-sections {
  display: flex;
  flex-direction: column;
  gap: 49px;
}

.settings-reference-section-title {
  margin: 0 0 7px;
  font-size: 23px;
  line-height: 1.18;
  font-weight: 700;
  letter-spacing: 0;
  color: var(--ref-text);
}


.settings-reference-row {
  min-height: 98px;
  padding: 23px 0 22px;
}

.settings-reference-row-label {
  margin: 0;
  color: var(--ref-text);
  font-size: 18px;
  line-height: 1.23;
  font-weight: 600;
  letter-spacing: 0;
}

.settings-reference-row-value {
  margin-top: 4px;
  color: var(--ref-muted);
  font-size: 17px;
  line-height: 1.22;
  font-weight: 400;
  letter-spacing: 0;
  overflow-wrap: anywhere;
}

.settings-reference-link {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--ref-text);
  font-size: 18px;
  line-height: 1.23;
  font-weight: 400;
  letter-spacing: 0;
  text-decoration: none;
  cursor: pointer;
  white-space: nowrap;
}

.settings-reference-link:hover {
  color: var(--ref-text);
  text-decoration: underline;
}

.settings-reference-link[aria-disabled="true"] {
  color: var(--ref-muted);
  cursor: default;
  text-decoration: none;
}

.settings-reference-badge.mantine-Badge-root {
  height: 29px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: var(--app-color-bg-muted);
  color: var(--app-color-text);
  font-size: 15px;
  line-height: 1;
  font-weight: 600;
  letter-spacing: 0;
  text-transform: none;
}

.settings-reference-provider-value {
  display: inline-flex;
  align-items: center;
  gap: 9px;
}

.settings-reference-provider-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex: 0 0 22px;
}

.settings-reference-subnota-logo {
  border-radius: 6px;
  /* 로고는 배경 없이 마크만. 색은 --app-color-brand-mark 한 곳에서 온다. */
  background: transparent;
  color: var(--app-color-brand-mark);
  font-family: Apple SD Gothic Neo, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
  font-size: 15px;
  font-weight: 700;
  line-height: 22px;
}

.settings-reference-close {
  align-items: center;
  appearance: none;
  position: absolute;
  top: 13px;
  right: 13px;
  z-index: 10;
  display: inline-flex;
  justify-content: center;
  width: var(--ref-control-compact);
  height: var(--ref-control-compact);
  min-width: var(--ref-control-compact);
  padding: 0;
  border: 0;
  border-radius: 17px;
  background: transparent;
  color: var(--ref-text);
}

.settings-reference-close:hover,
.settings-reference-close:active {
  background: var(--ref-selected);
}

.settings-reference-close svg {
  width: var(--ref-icon-compact);
  height: var(--ref-icon-compact);
  stroke-width: 2;
}

.settings-reference-expanded {
  padding: 23px 0 22px;
}

.settings-reference-save.mantine-Button-root,
.settings-reference-cancel.mantine-Button-root {
  height: var(--ref-control-compact);
  padding: 0 var(--ref-padding-compact);
  border-radius: 8px;
  font-size: var(--ref-font-compact);
  line-height: 1;
  font-weight: 600;
}

.settings-reference-save.mantine-Button-root {
  background: var(--ref-text);
  color: var(--app-color-bg-surface);
}

.settings-reference-cancel.mantine-Button-root {
  background: transparent;
  color: var(--ref-text);
}

.settings-reference-segmented .mantine-SegmentedControl-root {
  background: var(--ref-selected);
}

/* Mantine 기본 lg 라벨은 9px인데, 이 화면 전체가 --ref-scale(0.72)로 축소돼
   실효 7px가 된다. 다른 텍스트와 같은 기준으로 키워 둔다. */
.settings-reference-switch {
  --switch-label-font-size: 12px;
}

.settings-reference-shortcut-control {
  display: flex;
  align-items: center;
  flex: 0 0 auto;
  gap: 7px;
}

.settings-reference-shortcut-value {
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 74px;
  min-height: var(--ref-control-standard);
  padding: 4px 11px;
  border: 0;
  border-radius: 14px;
  background: var(--ref-selected);
  color: var(--ref-text);
  cursor: pointer;
  transition: background 150ms ease-out, scale 150ms ease-out;
}

/* 바탕이 --ref-selected(회색)라 hover는 한 단계 눌린 회색이어야 한다.
   코랄로 올리면 단축키 칸이 브랜드 강조처럼 보인다. */
.settings-reference-shortcut-value:hover {
  background: var(--app-color-bg-pressed);
}

.settings-reference-shortcut-value:active {
  scale: 0.96;
}

.settings-reference-shortcut-value .mantine-Kbd-root {
  min-width: 0;
  padding: 0;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: inherit;
  font-size: var(--ref-font-compact);
  font-weight: 500;
}

.settings-reference-shortcut-value[data-conflict] {
  background: color-mix(in srgb, var(--app-color-danger) 12%, var(--ref-selected));
  color: var(--app-color-danger);
}

.settings-reference-shortcut-edit.mantine-ActionIcon-root {
  width: var(--ref-control-compact);
  height: var(--ref-control-compact);
  min-width: var(--ref-control-compact);
  border-radius: 50%;
  color: var(--ref-muted);
}

.settings-reference-shortcut-edit.mantine-ActionIcon-root:hover {
  background: var(--ref-selected);
  color: var(--ref-text);
}

.settings-reference-shortcut-edit svg {
  width: var(--ref-icon-compact);
  height: var(--ref-icon-compact);
  stroke-width: 1.9;
}

.settings-reference-shortcut-record {
  display: flex;
  align-items: center;
  min-width: 270px;
  min-height: var(--ref-control-standard);
  padding: 4px 12px;
  border: 1px solid var(--app-color-brand-500);
  border-radius: 14px;
  background: var(--app-color-bg-surface);
  color: var(--ref-text);
  cursor: text;
  text-align: left;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-color-brand-500) 32%, transparent);
}

.settings-reference-shortcut-record[data-conflict] {
  border-color: var(--app-color-danger);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-color-danger) 32%, transparent);
}

.settings-reference-shortcut-record:focus-visible {
  outline: none;
}

.settings-reference-shortcut-recording-text {
  color: var(--ref-muted);
  font-size: var(--ref-font-standard);
  font-weight: 500;
}

.settings-reference-shortcut-cancel.mantine-Button-root {
  height: var(--ref-control-standard);
  padding: 0 8px;
  border-radius: 8px;
  color: var(--ref-muted);
  font-size: var(--ref-font-compact);
  font-weight: 600;
}

.settings-reference-shortcut-cancel.mantine-Button-root:hover {
  background: transparent;
  color: var(--ref-text);
}

.settings-reference-shortcut-conflict {
  color: var(--app-color-danger);
}

.settings-reference-feedback {
  margin-top: 28px;
}

.settings-reference-frame {
  width: min(860px, calc(100vw - 48px));
  height: min(660px, calc(100dvh - 48px));
  max-height: calc(100dvh - 48px);
  aspect-ratio: auto;
  overflow: hidden;
  border: 1px solid var(--app-color-border);
  border-radius: 13px;
  background: var(--app-color-bg-surface);
}

.settings-reference {
  --settings-control-height: 28px;
  --settings-icon-size: 16px;
  display: flex;
  width: 100%;
  height: 100%;
  transform: none;
  transform-origin: initial;
  overflow: hidden;
  border: 0;
  border-radius: 0;
  background: var(--app-color-bg-surface);
  color: var(--app-color-text-strong);
  font-family: Apple SD Gothic Neo, Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif;
}

.settings-reference-sidebar {
  flex: 0 0 220px;
  width: 220px;
  padding: 24px 12px;
  border-right: 1px solid var(--app-color-border);
  background: var(--app-color-bg-muted);
}

.settings-reference-sidebar-title {
  margin: 0 12px 20px;
  color: var(--app-color-text-strong);
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
}

.settings-reference-nav {
  gap: 2px;
}

.settings-reference-nav-button.mantine-Button-root {
  width: 100%;
  min-height: 32px;
  height: 32px;
  padding: 0 10px;
  border-radius: 7px;
  color: var(--app-color-text);
  font-size: 13px;
  font-weight: 500;
}

.settings-reference-nav-button .mantine-Button-section {
  margin-inline-end: 9px;
}

.settings-reference-nav-button svg {
  width: 16px;
  height: 16px;
  stroke-width: 1.8;
}

/* 코랄 틴트(--app-color-bg-active)를 쓰면 탐색 항목이 브랜드 강조처럼 읽힌다.
   여기는 "지금 보고 있는 곳"을 알리는 자리지 강조할 자리가 아니다.

   사이드바 바탕이 --app-color-bg-muted라, hover에 --app-color-bg-hover를 쓰면
   **같은 값이라 아무 변화가 없다**. 회색 바탕에서는 방향을 뒤집는다 —
   선택은 종이색으로 떠오르고, hover는 한 단계 눌린 회색이다. */
.settings-reference-nav-button[data-active] {
  background: var(--app-color-bg-surface);
  box-shadow: 0 1px 2px rgba(var(--legacy-ink-rgb), 0.06);
}

.settings-reference-nav-button:not([data-active]):hover,
.settings-reference-nav-button:not([data-active]):active {
  background: var(--app-color-bg-pressed);
}

.settings-reference-main {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 28px 36px;
  scrollbar-gutter: stable;
  scrollbar-width: thin;
  scrollbar-color: var(--app-color-border) transparent;
}

.settings-reference-main::-webkit-scrollbar {
  display: block;
  width: 8px;
}

.settings-reference-main::-webkit-scrollbar-thumb {
  border: 2px solid transparent;
  border-radius: 8px;
  background: var(--app-color-border);
  background-clip: padding-box;
}

.settings-reference-page-title {
  margin: 0 0 28px;
  color: var(--app-color-text-strong);
  font-size: 20px;
  line-height: 1.3;
  font-weight: 600;
}

.settings-reference-sections {
  gap: 26px;
}

/* 묶음 이름은 카드 밖 위에. 카드 안 행 제목(13px)보다 작고 흐려야
   "이건 항목이 아니라 이름"으로 읽힌다. */
.settings-reference-section-title {
  margin: 0 0 7px;
  padding-left: 2px;
  color: var(--app-color-muted-design);
  font-size: 12px;
  line-height: 1.4;
  font-weight: 600;
}

.settings-reference-section-description {
  margin: -3px 0 8px;
  padding-left: 2px;
  color: var(--app-color-muted);
  font-size: 12px;
  line-height: 1.45;
}

/* design.md: "Avoid making every surface a large rounded card." 그래서
   radius를 16~18px이 아닌 10px로 두고 hairline 테두리만 쓴다 — 미리보기
   패널 행·링크 카드와 같은 급이다. */
.settings-reference-card {
  border: 1px solid var(--app-color-border);
  border-radius: 10px;
  overflow: hidden;
  background: var(--app-color-bg-surface);
}

/* 자식 사이에만 선을 넣는다. 행이 직접 구분선을 그리면 마지막 행 아래에도
   선이 남아 카드 모서리와 겹친다. */
.settings-reference-card > * + * {
  border-top: 1px solid var(--app-color-border-soft);
}

/* 묶음 하나에 속하지 않는 페이지 단위 동작(단축키 저장 등). 카드 밖에 둔다. */
.settings-reference-actions {
  gap: 8px;
  margin-top: -8px;
}

.settings-reference-row {
  min-height: 0;
  padding: 13px 14px;
  gap: 20px;
}

.settings-reference-row > .mantine-Box-root {
  min-width: 0;
}

.settings-reference-row-label {
  color: var(--app-color-text);
  font-size: 13px;
  line-height: 1.45;
  font-weight: 500;
}

.settings-reference-row-value {
  margin-top: 2px;
  color: var(--app-color-muted);
  font-size: 12px;
  line-height: 1.45;
  font-weight: 400;
}

/* 맨 글자로 두면 "위치 변경 폴더 열기"처럼 두 동작이 한 문장으로 붙어 읽힌다.
   아주 작은 pill로 감싸 각각이 누를 수 있는 것임을 알린다. 카드 안이라
   테두리는 hairline, 높이는 컴팩트 단(24px)에 맞춘다. */
.settings-reference-link {
  align-items: center;
  background: var(--app-color-bg-surface);
  border: 1px solid var(--app-color-border);
  border-radius: 999px;
  color: var(--app-color-text-soft);
  display: inline-flex;
  font-size: 12px;
  font-weight: 500;
  height: 24px;
  justify-content: center;
  line-height: 1;
  min-height: 24px;
  padding: 0 10px;
  text-decoration: none;
  transition: background-color 120ms ease, color 120ms ease, scale 120ms ease;
}

.settings-reference-link:hover {
  background: var(--app-color-bg-hover);
  color: var(--app-color-text-strong);
  text-decoration: none;
}

.settings-reference-link:active {
  scale: 0.96;
}

/* 여러 개가 나란히 설 때(위치 변경 · 폴더 열기) 간격을 좁힌다. */
.settings-reference-row .mantine-Group-root .settings-reference-link + .settings-reference-link {
  margin-left: 0;
}

.settings-reference-link[aria-disabled='true'] {
  background: transparent;
  border-color: var(--app-color-border-soft);
  color: var(--app-color-muted);
}

.settings-reference-badge.mantine-Badge-root {
  min-height: 22px;
  padding: 0 8px;
  border-radius: 8px;
  background: var(--app-color-bg-muted);
  color: var(--app-color-text);
  font-size: 11px;
  font-weight: 500;
}

.settings-reference-provider-value {
  gap: 6px;
}

.settings-reference-provider-icon {
  width: 16px;
  height: 16px;
  flex-basis: 16px;
}

.settings-reference-subnota-logo {
  border-radius: 4px;
  font-size: 10px;
  line-height: 16px;
}

.settings-reference-close {
  appearance: none;
  position: absolute;
  top: 16px;
  right: 16px;
  z-index: 10;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--settings-control-height, 28px);
  min-width: var(--settings-control-height, 28px);
  height: var(--settings-control-height, 28px);
  padding: 0;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--app-color-text);
  cursor: pointer;
  font-size: 22px;
  font-weight: 300;
  line-height: 1;
}

.settings-reference-close svg {
  width: var(--settings-icon-size, 16px);
  height: var(--settings-icon-size, 16px);
}

.settings-reference-close:focus-visible {
  outline: 2px solid var(--app-color-focus-ring);
  outline-offset: 2px;
}

.settings-reference-expanded {
  padding: 13px 14px;
}

.settings-reference-save.mantine-Button-root,
.settings-reference-cancel.mantine-Button-root {
  height: var(--settings-control-height);
  min-height: var(--settings-control-height);
  padding: 0 10px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
}

.settings-reference-save.mantine-Button-root {
  background: var(--app-color-brand-500);
  color: var(--app-color-bg-surface);
}

.settings-reference-save.mantine-Button-root:hover {
  background: var(--app-color-brand-600);
}

.settings-reference-cancel.mantine-Button-root {
  color: var(--app-color-text);
}

/* radius는 테마(mantineTheme.ts)의 defaultProps가 정한다 — 여기서 다시 쓰면
   네 곳 중 설정만 각진 채로 남는다. */
.settings-reference-segmented .mantine-SegmentedControl-root {
  min-height: var(--settings-control-height);
  padding: 2px;
  background: var(--app-color-bg-muted);
}

.settings-reference-segmented .mantine-SegmentedControl-label {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 24px;
  padding: 0 8px;
  color: var(--app-color-text);
  font-size: 12px;
  font-weight: 500;
  line-height: 1;
  text-align: center;
}

.settings-reference-switch {
  --switch-label-font-size: 10px;
}

.settings-reference-shortcut-control {
  flex: 0 0 auto;
  gap: 6px;
}

/* 짧은 라벨 하나를 담는 컨트롤이라 알약이다 — 키 캡처럼 읽혀야 한다.
   좌우 여백을 늘려 둥근 끝이 글자를 물지 않게 한다. */
.settings-reference-shortcut-value {
  display: inline-flex;
  align-items: center;
  min-width: 54px;
  min-height: var(--settings-control-height);
  padding: 3px 11px;
  border-radius: 999px;
  background: var(--app-color-bg-muted);
  color: var(--app-color-text);
  cursor: default;
}

.settings-reference-shortcut-value .mantine-Kbd-root {
  color: inherit;
  font-size: 12px;
  font-weight: 400;
}

.settings-reference-shortcut-value[data-conflict] {
  background: color-mix(in srgb, var(--app-color-danger) 10%, var(--app-color-bg-muted));
  color: var(--app-color-danger);
}

.settings-reference-shortcut-edit.mantine-ActionIcon-root,
.settings-reference-shortcut-reset.mantine-ActionIcon-root {
  width: var(--settings-control-height);
  min-width: var(--settings-control-height);
  height: var(--settings-control-height);
  border-radius: 7px;
  color: var(--app-color-muted);
}

.settings-reference-shortcut-edit.mantine-ActionIcon-root:hover,
.settings-reference-shortcut-reset.mantine-ActionIcon-root:hover {
  background: var(--app-color-bg-muted);
  color: var(--app-color-text);
}

.settings-reference-shortcut-edit svg,
.settings-reference-shortcut-reset svg {
  width: var(--settings-icon-size);
  height: var(--settings-icon-size);
  stroke-width: 1.8;
}

.settings-reference-shortcut-record {
  min-width: 184px;
  min-height: 32px;
  padding: 4px 10px;
  border-radius: 8px;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--app-color-brand-500) 28%, transparent);
}

.settings-reference-shortcut-recording-text {
  font-size: 13px;
  font-weight: 400;
}

.settings-reference-shortcut-cancel.mantine-Button-root {
  min-height: 28px;
  height: 28px;
  padding: 0 6px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 500;
}

.settings-reference-shortcut-conflict {
  color: var(--app-color-danger);
}

.settings-reference-feedback {
  margin-top: 20px;
  font-size: 12px;
  line-height: 1.45;
}

/* 카드 안에 들어가므로 자체 테두리·모서리를 두지 않는다 — 카드 속 카드가
   된다. 되돌릴 수 없는 작업이라 배경으로만 구분한다. */
.settings-reference-confirmation {
  margin: 0;
  padding: 13px 14px;
  border: 0;
  border-radius: 0;
  background: var(--app-color-bg-muted);
}

@media (max-width: 640px) {
  .settings-reference-frame {
    width: calc(100vw - 24px);
    height: calc(100dvh - 24px);
    max-height: calc(100dvh - 24px);
  }

  .settings-reference-sidebar {
    flex-basis: 176px;
    width: 176px;
    padding: 18px 8px;
  }

  .settings-reference-sidebar-title {
    margin: 0 8px 16px;
    font-size: 18px;
  }

  .settings-reference-nav-button.mantine-Button-root {
    padding: 0 8px;
    font-size: 12px;
  }

  .settings-reference-main {
    padding: 20px;
  }

  .settings-reference-row {
    gap: 12px;
  }

  .settings-reference-shortcut-record {
    min-width: 152px;
  }
}`;
