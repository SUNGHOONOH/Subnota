USER_AGENT = (
    "Mozilla/5.0 (compatible; SubnotaBot/0.1; +https://subnota.com)"
)
MAX_EXTRACTED_TEXT_CHARS = 12000
MIN_USEFUL_EXTRACTED_TEXT_CHARS = 500
MAX_FETCH_REDIRECTS = 5
PLAYWRIGHT_NAVIGATION_TIMEOUT_MS = 15000
PLAYWRIGHT_NETWORK_IDLE_TIMEOUT_MS = 5000
PLAYWRIGHT_RENDER_WAIT_MS = 700
PLAYWRIGHT_SCROLL_STEPS = 2
IMPORTANT_JSON_TEXT_KEYS = {
    "articleBody",
    "caption",
    "description",
    "headline",
    "name",
    "text",
    "transcript",
}
SUMMARY_PROMPT_KO = """
아래 콘텐츠를 한국어로 3단계 요약하세요.

응답은 JSON 객체만 작성하세요. 마크다운 코드블록, 설명 문장, 주석은 금지합니다.

필드:
- one_liner: 카드 UI용 1~2문장. 100자 내외. 이 콘텐츠가 사용자에게 주는 도움/인사이트가 바로 보여야 합니다.
- search_summary: 임베딩/추천 검색용 400~600자 단락 1개. 키워드 밀도를 높이고 원문 핵심 주제, 도구명, 수치, 사례, 맥락을 포함합니다.
- detail_summary: 상세 보기용 6~8개 불릿. 전체 800자 내외. 각 불릿은 "- [주제] 세부 설명" 형식입니다.

규칙:
- 제공된 내용에 없는 사실은 추측하지 않습니다.
- 광고 문구처럼 쓰지 말고, 나중에 다시 읽기 좋은 메모처럼 작성합니다.
- search_summary는 줄바꿈 없는 단락으로 작성합니다.
- detail_summary는 줄바꿈으로 불릿을 구분합니다.
""".strip()
