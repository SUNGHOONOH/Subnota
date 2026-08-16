# 랜딩 개편 — 남은 일

작업이 끝나면 지운다. 시스템 규칙은 `web/DESIGN.md`.

## 상태

`pnpm build` ✅ · `pnpm exec tsc --noEmit` ✅ · impeccable 디텍터 0건 ·
finish review 1회 통과 후 CRITICAL 4건 / HIGH 5건 전부 반영.

## 남은 것

1. **다운로드 URL** — `.env` 에 `NEXT_PUBLIC_DOWNLOAD_MAC_URL` /
   `NEXT_PUBLIC_DOWNLOAD_WIN_URL` 을 채우면 "출시 예정" 배지가 실제 링크로
   바뀐다. 코드 수정 불필요.
2. **`NEXT_PUBLIC_SITE_URL`** — canonical·OG·sitemap 이 쓴다. 미설정 시
   `https://subnota.com` 으로 떨어진다.
3. **`package.json` 버전 핀** — `next`/`react`/`react-dom`/타입이 아직
   `"latest"` 라 빌드가 재현되지 않는다. 실제 설치 버전으로 고정할 것.

## 남겨 둔 판단

- `vercel.json` 의 `/app` → `subnota-pwa.vercel.app` rewrite 를 지우지 않았다.
  사이트에서 링크하는 곳은 이제 없지만 외부에 퍼진 링크가 있을 수 있다.
- `app/legal.css` 는 기존 `globals.css` 의 법적 페이지 블록을 그대로 떼어낸
  것이다. 내용은 손대지 않았다.

## 앱 쪽 정정 (2026-08-15, 완료)

랜딩이 앱 수치를 이식하면서 `desktop/docs/design.md` 가 코드와 어긋난 것을
발견해 **문서를 코드에 맞춰** 고쳤다. 코드가 기준이다.

문서만 틀렸던 것: nav rail 50→58px, 커맨드바 38→44px, radius 범위(4–13px →
떠 있는 패널 14–16px 별도), 설정 창 860×660 → `min(880, 100vw-80) ×
min(620, 100vh-80)`, 서체 스택(Pretendard 선두·Inter 제거·워드마크 누락),
그리고 코랄 시절 서술 6곳(인라인 코드·blockquote·체크박스·focus 링·빈 화면
마크·Quick 입력란).

**코드도 틀렸던 것 3곳:**

- `lib/previewPanelWidth.ts` `NAV_RAIL_WIDTH` 가 50 이었다. 자기 주석이
  `--legacy-size-nav-rail` 과 같은 값이라고 적어 두었는데 토큰은 58 이다 —
  레일이 넓어질 때 따라오지 못한 화석이고, 문서의 "50px" 와 같은 뿌리다.
  8px 을 덜 빼고 있어 사이드 패널 push/overlay 경계가 어긋나 있었다.
  **동작 변화:** 저장 폭 600px 기준 push 가능한 최소 창폭이 850 → 857px.
  850px 창에서는 본문이 396px 밖에 안 남아(코드가 선언한 하한 400 미달)
  이제 오버레이로 떨어진다. 테스트 기대값도 함께 정정.
- `styles/subnota-workspace.scss` 에서 `--legacy-radius-panel` 이 같은
  `:root` 안에 12px·14px 두 번 선언돼 있었다. 실효값은 14px 이므로 죽은
  12px 줄을 제거.
- `lib/mantineTheme.ts` 의 `lg` 주석이 위 중복 때문에 `// 12px` 로 적혀
  있었다 → `// 14px`.

전체 테스트 42 failed / 738 passed 는 **변경 전후 동일**하다(진행 중인 UI
리팩터의 기존 실패). `pnpm exec tsc --noEmit` 통과.
