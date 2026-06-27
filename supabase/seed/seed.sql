-- Subnota test seed: wipe all per-user data + insert 40 Korean memos + 14 calendar blocks.
-- Single-user DB (one profiles row). MCP/service-role bypasses RLS. Run in Supabase SQL editor.
begin;
-- 1) wipe all per-user test data (FK-safe child->parent order)
delete from memo_chunk_edges;
delete from memo_chunks;
delete from chunk_embedding_cache;
delete from topic_memo_edges;
delete from topic_cluster_memos;
delete from topic_memo_embedding_cache;
delete from topic_clusters;
delete from schedule_inbox;
delete from activity_completions;
delete from calendar_blocks;
delete from inbox_session_embeddings;
delete from inbox_sessions;
delete from briefings;
delete from memo_tombstones;
delete from daily_completions;
delete from trees;
delete from network_rate_limits;
delete from memo_chunk_index_leases;
delete from memos;

-- 2) 40 realistic Korean memos across 6 themes, spread over the past week
with u as (select id as uid from profiles order by created_at limit 1)
insert into memos (user_id, content, content_hash, category, sync_status, topic_dirty, last_synced_at, created_at, updated_at, content_updated_at, revision)
select u.uid, v.content, md5(v.content), 'Ideas', 'synced', true, v.ts, v.ts, v.ts, v.ts, 1
from u, (values
($m$RAG 파이프라인 청킹 전략 정리
문장 단위로 자르면 검색 정확도가 올라가는데 너무 잘게 자르면 문맥이 끊긴다. Kiwi 형태소 분석으로 문장 경계 잡고 256토큰 윈도우로 묶는 방향으로 테스트.$m$, '2026-06-20 09:12+09'::timestamptz),
($m$오늘 5km 러닝 기록
페이스 5분 40초, 한강 따라 뛰니까 덜 지루함. 무릎 안 아픈 거 보니 러닝화 바꾼 게 효과 있다.$m$, '2026-06-20 11:40+09'),
($m$연금저축 ETF 리밸런싱
미국 S&P랑 나스닥 비중이 너무 커져서 일부 채권형으로 옮김. 연 1회만 손대기로 규칙 정함.$m$, '2026-06-20 15:05+09'),
($m$제주 3박4일 코스 초안
1일 동부 성산일출봉, 2일 서부 한림공원, 3일 한라산 영실코스, 4일 카페투어. 렌트카 예약부터.$m$, '2026-06-20 21:30+09'),
($m$김치찌개 황금레시피
돼지목살 먼저 볶고 신김치 넣어 더 볶기. 설탕 반스푼이 신맛 잡아줌. 두부는 마지막에.$m$, '2026-06-20 22:10+09'),
($m$Electron 보안 기본값 체크리스트
nodeIntegration false, contextIsolation true, sandbox true. preload에서 contextBridge로만 노출. 외부 링크는 http/https/mailto만 허용.$m$, '2026-06-21 10:00+09'),
($m$이번 주 회고
할 일은 많았는데 집중한 시간은 적었다. 오전에 딥워크 2시간 확보하는 습관을 만들어보자.$m$, '2026-06-21 13:20+09'),
($m$일본 오사카 먹킷리스트
쿠로몬 시장 회덮밥, 도톤보리 타코야키, 우메다 라멘. 교토 당일치기도 끼워넣기.$m$, '2026-06-21 16:45+09'),
($m$에어프라이어 요리 모음
삼겹살 200도 12분, 고구마 180도 30분, 닭다리 200도 25분. 기름 안 둘러도 바삭하다.$m$, '2026-06-21 20:15+09'),
($m$Supabase RLS 정책 다시 점검
auth.uid 기반 ownership 체크 빠진 테이블 없는지 확인. update 정책에 with check 꼭 넣기. anon에 select 열려있는지도.$m$, '2026-06-22 09:30+09'),
($m$단백질 식단 1주 계획
아침 계란 3개, 점심 닭가슴살 샐러드, 저녁 두부. 간식은 그릭요거트. 탄수 줄이니 오후에 덜 졸림.$m$, '2026-06-22 12:05+09'),
($m$6월 가계부 결산
식비가 예산 초과. 배달 줄이고 장 봐서 해먹기. 고정비는 통신비 알뜰폰 갈아타서 절감.$m$, '2026-06-22 19:40+09'),
($m$읽은 책 미라클모닝 정리
결국 일찍 일어나는 게 아니라 나만의 시간 확보가 핵심. 새벽 1시간 독서로 시작해보기.$m$, '2026-06-22 22:30+09'),
($m$pgvector 코사인 검색 느릴 때
ivfflat 인덱스 lists 값 튜닝하고 쿼리 전에 probes 올려보기. 1만건 넘으면 체감 차이가 크다.$m$, '2026-06-23 09:50+09'),
($m$가을 캠핑 장비 점검
타프 방수 코팅 벗겨짐. 침낭은 3계절용으로 충분. 화로대랑 랜턴 건전지 미리 사두기.$m$, '2026-06-23 14:00+09'),
($m$집들이 메뉴 고민
파스타 두 종류랑 감바스, 카프레제. 디저트는 사두는 걸로. 와인 페어링도 생각.$m$, '2026-06-23 18:20+09'),
($m$사이드프로젝트 아이디어
메모 앱에 음성 입력을 붙이면 어떨까. 운전 중이나 산책할 때 떠오른 생각을 바로 기록.$m$, '2026-06-23 23:10+09'),
($m$프롬프트 캐싱으로 비용 절감
system 프롬프트를 캐시 블록으로 분리하니 토큰 비용이 절반. 5분 TTL이라 연속 호출을 묶는 게 관건.$m$, '2026-06-24 10:25+09'),
($m$수면 패턴 개선 실험
자기 2시간 전 화면 끄고 스트레칭. 카페인은 오후 2시 이후 금지. 일주일 해보니 잠드는 시간 30분 단축.$m$, '2026-06-24 13:00+09'),
($m$비상금 통장 분리
월급통장이랑 섞이니까 자꾸 쓰게 됨. CMA로 3개월치 생활비를 따로 빼두기.$m$, '2026-06-24 17:30+09'),
($m$부모님 생신 선물 고민
아버지는 등산화, 어머니는 안마기. 직접 손편지도 같이. 외식 장소 예약 잊지 말기.$m$, '2026-06-24 21:00+09'),
($m$로컬 우선 동기화 설계 메모
타이핑은 절대 네트워크를 안 탐. Zustand에 먼저 쓰고 세션 있을 때만 Supabase로 밀기. 실패하면 pending으로 두고 재시도.$m$, '2026-06-25 09:15+09'),
($m$강릉 주말 여행 메모
안목해변 커피거리, 정동진 일출, 초당순두부. KTX 표는 주말이면 빨리 매진되니 미리 예매.$m$, '2026-06-25 12:40+09'),
($m$다이어트 도시락 레시피
현미밥 반공기, 닭가슴살 데리야키, 브로콜리 두부무침. 전날 밤에 미리 싸두면 아침이 편함.$m$, '2026-06-25 18:50+09'),
($m$친구 결혼식 체크리스트
축의금, 정장 드라이클리닝, 화환 보낼지 확인. 사회 부탁받아서 멘트도 준비해야 한다.$m$, '2026-06-25 22:05+09'),
($m$SQLite WAL 모드 전환 후기
synchronous NORMAL과 WAL 조합으로 쓰기 지연이 거의 사라짐. userData 폴더에 파일 하나로 관리하니 백업도 편함.$m$, '2026-06-26 09:05+09'),
($m$비 오는 날 부침개
부추전 반죽에 오징어 넣고 바삭하게. 막걸리 한 잔이 빠지면 섭섭하다.$m$, '2026-06-26 12:30+09'),
($m$배당주 공부 시작
배당락일이랑 배당기준일을 헷갈렸음. 분기배당 종목 위주로 캘린더에 정리해보기.$m$, '2026-06-26 15:10+09'),
($m$유럽 배낭여행 버킷리스트
체코 프라하, 오스트리아 할슈타트, 스위스 인터라켄. 유레일패스 가격 비교부터.$m$, '2026-06-26 17:45+09'),
($m$방 정리 미니멀 도전
1년간 안 입은 옷 정리해서 기부. 책상 위는 노트북이랑 컵만. 비우니까 머리도 가벼워진다.$m$, '2026-06-26 20:20+09'),
($m$영어 공부 다시 시작
출퇴근 길에 팟캐스트 듣기. 모르는 표현은 메모해뒀다가 주말에 복습. 회화 스터디도 알아보기.$m$, '2026-06-26 22:40+09'),
($m$무릎 통증 스트레칭 메모
계단 내려갈 때 시큰함. 대퇴사두근 강화랑 폼롤러로 IT밴드 풀어주기. 안 나으면 정형외과.$m$, '2026-06-27 08:30+09'),
($m$물 2L 마시기 챌린지
텀블러 4번 채우면 끝. 알림 맞춰두니까 확실히 덜 까먹는다.$m$, '2026-06-27 09:40+09'),
($m$청약통장 유지 고민
당분간 분양 계획 없는데 금리가 낮아서 애매. 그래도 1순위 조건은 지켜두는 게 나을 듯.$m$, '2026-06-27 10:30+09'),
($m$환율 오를 때 달러 적립
환율 1380 넘으니 부담. 매달 일정 금액 분할매수로 평단 관리하는 전략 유지.$m$, '2026-06-27 11:15+09'),
($m$부산 1박 미식 여행
자갈치 회, 밀면, 돼지국밥. 광안리 야경 보면서 맥주. 숙소는 해운대보다 광안리가 가성비.$m$, '2026-06-27 12:50+09'),
($m$홈카페 라떼 연습
에스프레소 추출 시간 25초 맞추고 우유 스팀은 60도까지. 라떼아트는 아직 하트도 어렵다.$m$, '2026-06-27 14:20+09'),
($m$비 오는 날 부추전과 막걸리
부추 듬뿍 넣고 기름 넉넉히. 가장자리 바삭한 게 핵심. 간장에 식초 살짝.$m$, '2026-06-27 15:30+09'),
($m$새로 시작한 취미 드로잉
아이패드로 매일 10분 끄적이기. 잘 그리려 하지 말고 그냥 그리는 게 목표.$m$, '2026-06-27 16:40+09'),
($m$올해 하반기 목표 점검
상반기 목표는 절반 정도 달성. 운동 습관은 잡혔고 저축은 부족. 하반기엔 사이드프로젝트 출시.$m$, '2026-06-27 18:05+09')
) as v(content, ts);

-- 3) 14 calendar blocks across the week (past = completed, upcoming = pending)
with u as (select id as uid from profiles order by created_at limit 1)
insert into calendar_blocks (user_id, title, note, start_date, end_date, all_day, all_day_date, time_zone, color, is_completed, completed_at, "order", created_at)
select u.uid, c.title, c.note, c.start_date, c.end_date, c.all_day, c.all_day_date, 'Asia/Seoul', c.color, c.done, case when c.done then c.start_date else null end, 0, c.start_date - interval '1 day'
from u, (values
('팀 주간회의',        '스프린트 리뷰와 다음 주 계획',     '2026-06-22 10:00+09'::timestamptz, '2026-06-22 11:00+09'::timestamptz, false, null::date,            '#007AFF', true),
('헬스 PT',           '하체 집중',                    '2026-06-23 19:00+09', '2026-06-23 20:00+09', false, null,                  '#66705A', true),
('건강검진',          '공복 유지, 신분증 지참',          '2026-06-24 00:00+09', null,                  true,  '2026-06-24'::date,    '#E0533D', true),
('치과 예약',         '스케일링',                     '2026-06-25 14:00+09', '2026-06-25 15:00+09', false, null,                  '#cc785c', true),
('모닝 러닝 5km',     '한강 코스',                     '2026-06-26 09:30+09', '2026-06-26 10:00+09', false, null,                  '#4C9A8E', true),
('아침 스트레칭',      '무릎 재활 루틴',                '2026-06-27 09:00+09', '2026-06-27 09:30+09', false, null,                  '#66705A', false),
('사이드프로젝트 코딩', '음성 입력 프로토타입',           '2026-06-27 11:00+09', '2026-06-27 12:30+09', false, null,                  '#cc785c', false),
('친구 저녁 약속',     '광안리 회식',                   '2026-06-27 18:00+09', '2026-06-27 20:00+09', false, null,                  '#E0533D', false),
('제주 항공권 예약 마감','특가 마지막 날',                '2026-06-28 00:00+09', null,                  true,  '2026-06-28'::date,    '#007AFF', false),
('연금저축 리밸런싱 검토','채권 비중 조정',                '2026-06-29 10:00+09', '2026-06-29 11:00+09', false, null,                  '#66705A', false),
('영어 회화 스터디',   '온라인 모임',                   '2026-06-30 20:00+09', '2026-06-30 21:00+09', false, null,                  '#4C9A8E', false),
('7월 가계부 시작',    '예산 카테고리 재설정',           '2026-07-01 00:00+09', null,                  true,  '2026-07-01'::date,    '#cc785c', false),
('부모님 생신 외식 예약','장소 확인 전화',                '2026-07-02 15:00+09', '2026-07-02 16:00+09', false, null,                  '#E0533D', false),
('집들이',            '파스타와 감바스 준비',           '2026-07-03 19:00+09', '2026-07-03 21:00+09', false, null,                  '#007AFF', false)
) as c(title, note, start_date, end_date, all_day, all_day_date, color, done);

commit;
