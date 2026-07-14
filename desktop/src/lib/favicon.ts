// 도메인 파비콘 — 구글 s2 서비스로 메타데이터 추가 수집 없이 가져온다.
// 실패하면 호출부에서 onError로 이미지를 숨긴다.
export const faviconUrlFor = (domain: string | null) =>
  domain
    ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`
    : null;
