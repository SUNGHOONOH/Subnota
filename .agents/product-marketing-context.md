# Product Marketing Context

*Last updated: 2026-05-21*

## Product Overview
**One-liner:** MemoApp is a local-first memo app that turns quick notes into calendars, resurfaced memories, and daily briefings without making writing depend on the cloud.

**What it does:** MemoApp gives users a quiet writing surface for capturing thoughts, tasks, meetings, and dated ideas as soon as they appear. Dates inside Korean memo text can become calendar blocks, and optional online enrichment can collect schedule candidates, index memo chunks, surface related past sentences near the cursor, discover long-term topics, and generate daily briefings that connect upcoming plans with recent and older memories.

**Product category:** Local-first memo app, personal knowledge management app, calendar-linked notes app, AI memory assistant.

**Product type:** React Native mobile app with optional cloud/backend enrichment.

**Business model:** Not defined in the repo. The near-term marketing posture should treat this as a released productivity app with platform downloads, not as a priced SaaS product.

## Target Audience
**Target companies:** Primarily individual users rather than companies. The strongest inferred audience is Korean-speaking knowledge workers, founders, product builders, researchers, students, and solo operators who live in notes and schedules.

**Decision-makers:** The user is usually the buyer and evaluator. For team or institution use, an operations lead or team lead may care about privacy and workflow fit, but B2B buying is not visible in the repo.

**Primary use case:** Capture messy thoughts quickly, then let the app help connect those notes to time, context, and older memories.

**Jobs to be done:**
- Save an idea or obligation before it disappears.
- Turn a sentence like "내일 10시 회의" into something that appears on the calendar.
- Find the older thought that is related to what I am writing now.
- Review what matters today without manually combing through every memo.

**Use cases:**
- Write local-first memos offline with no login requirement.
- Select text in a memo and manually register it as a calendar block.
- Use the calendar tab to arrange local blocks across month and week views.
- Open the briefing tab to review priority notes, schedule inbox candidates, and daily briefings.
- Pause while writing and see a quiet Ambient Mirror card with a similar past sentence.
- Explore topic clusters through the "무의식 지도" sidebar mode when online indexing is available.

## Personas
| Persona | Cares about | Challenge | Value we promise |
|---------|-------------|-----------|------------------|
| Solo maker | Capturing raw thinking, revisiting old ideas, moving fast | Ideas and tasks scatter across notes, calendars, and chat apps | One place where notes stay writable first, then become schedule and memory context |
| Product or research worker | Connecting meetings, decisions, and recurring themes | Important context is buried in old notes when a new thread starts | Related past sentences and topic maps make old context reappear at the moment of writing |
| Busy planner | Seeing what matters today without manual cleanup | Dates written in memos do not reliably become usable calendar items | Date-aware memo capture and schedule inbox reduce missed obligations |
| Privacy-sensitive note taker | Local access, graceful offline behavior, control | Many AI note tools require login and cloud processing before the basics work | Memo writing and manual calendar registration work locally first |

## Problems & Pain Points
**Core problem:** Notes are easy to capture but hard to turn into action or long-term memory. Users write down obligations, ideas, and context, then later cannot find the related note, miss a date, or lose the thread that made the note valuable.

**Why alternatives fall short:**
- Plain notes apps capture text but rarely connect text to schedules or older related memories.
- Calendar apps organize time but are too rigid for messy thinking and early ideas.
- General AI assistants can summarize or search, but often require cloud-first workflows and explicit prompting.
- Heavy personal knowledge management tools demand structure before the user has enough clarity to structure anything.

**What it costs them:** Missed follow-ups, repeated context switching, manual calendar cleanup, lost ideas, and the feeling that past notes are write-only storage.

**Emotional tension:** "I know I wrote this somewhere," "I need this to become a schedule," "I do not want another system to maintain," and "I want AI help without giving up local-first capture."

## Competitive Landscape
**Direct:** Apple Notes, Bear, Craft, Obsidian mobile, Notion mobile, Reflect, Mem, Capacities — strong for capture or organization, but they may require manual structure, cloud-first usage, or separate calendar workflows.

**Secondary:** Apple Calendar, Google Calendar, Todoist, Things, TickTick — strong for tasks and time, but weak as a natural place for raw thought and contextual writing.

**Secondary:** ChatGPT and general AI note workflows — flexible, but the user has to prompt, paste, and manage context rather than receiving ambient resurfacing inside the note surface.

**Indirect:** Paper notebooks, chat-to-self, screenshots, and scattered reminders — low friction, but poor at retrieval, scheduling, and long-term connection.

## Differentiation
**Key differentiators:**
- Local-first capture: memo writing and manual calendar registration do not require login or network.
- Korean date-aware writing: natural date phrases can be highlighted, inserted, and registered as schedule blocks.
- Calendar blocks: notes can become draggable month/week planning bricks rather than separate todo entries.
- Ambient Mirror: after a writing pause, the app can quietly surface one related past sentence near the cursor.
- Daily briefing archive: briefings combine upcoming schedules, recent notes, and a memory from around one month ago.
- Topic discovery: optional backend clustering can turn synced notes into a "무의식 지도" for longer-term themes.

**How we do it differently:** MemoApp keeps the writing surface primary. It does not force the user to classify notes up front; it lets notes become schedules, related-memory cards, topic clusters, and briefings only when those layers are useful.

**Why that's better:** Users can capture first and organize later without losing the advantages of calendars, retrieval, and AI-assisted context.

**Why customers choose us:** They want a note app that respects fast private writing but still helps memories come back and schedules become visible.

## Objections
| Objection | Response |
|-----------|----------|
| "Why not just use Apple Notes?" | Apple Notes is excellent capture, but MemoApp adds date-aware scheduling, calendar blocks, related-memory resurfacing, and daily briefings around the memo surface. |
| "Do I have to trust a cloud AI with every memo?" | The core capture and manual calendar features are local-first. Online enrichment is optional and bounded to sync, indexing, schedule inbox, network search, topic discovery, and briefing features. |
| "Will this be another system I need to maintain?" | The product should be positioned as capture-first: write naturally, then register dates, review briefings, or inspect maps only when useful. |
| "Is the AI realtime?" | No. Automatic schedule suggestions and topic discovery are batch-backed. The page should describe this as calm enrichment, not realtime automation. |

**Anti-persona:** Teams that need shared workspaces, permissioned documents, or enterprise admin features today; users who only want a strict task manager; users who need fully cloud-synced collaboration as the core value; people who do not write enough notes for memory resurfacing to matter.

## Switching Dynamics
**Push:** Existing notes become piles of forgotten text, calendars require duplicate entry, AI tools interrupt writing, and structured PKM systems feel too heavy.

**Pull:** Local-first capture, natural Korean date handling, calendar blocks, ambient memory resurfacing, and daily context briefings.

**Habit:** Users already dump notes into Apple Notes, KakaoTalk self-chat, Notion, reminders, screenshots, or paper notebooks.

**Anxiety:** Concern about data privacy, AI accuracy, migration effort, unfinished beta features, and whether a new note app will last.

## Customer Language
**How they describe the problem:**
- "분명히 적어뒀는데 어디 있는지 모르겠어요."
- "메모는 했는데 일정으로 옮기는 걸 자꾸 까먹어요."
- "생각은 흩어지고 캘린더는 따로 놀아요."
- "정리부터 하라고 하면 그냥 안 쓰게 돼요."
- "예전 메모가 지금 쓰는 내용이랑 연결됐으면 좋겠어요."

**How they describe us:**
- "메모가 일정과 기억으로 이어지는 앱"
- "로컬-first 개인 메모와 브리핑"
- "예전 생각을 조용히 다시 꺼내주는 메모장"
- "정리보다 캡처가 먼저인 메모 앱"

**Words to use:** 로컬-first, 빠른 캡처, 날짜 인식, 캘린더 블럭, 일정 인박스, 브리핑, 비슷한 기억, 무의식 지도, Ambient Mirror, daily briefing, optional sync.

**Words to avoid:** 완전 자동화, 완벽한 AI 기억, 무제한 협업, 팀 지식베이스, 실시간 일정 추출, 검증된 생산성 향상률 unless proof exists.

**Glossary:**
| Term | Meaning |
|------|---------|
| Local-first | Core writing and manual calendar actions work without login or network |
| Calendar block | A scheduled memo or manually created planning block shown in month/week views |
| Schedule inbox | Online batch output where suggested schedule candidates wait for accept/dismiss |
| Ambient Mirror | A quiet related-memory card shown after the user stops typing near a meaningful chunk |
| State B network | Cursor-based similar memo chunk search through the backend and pgvector |
| State A topic discovery | Backend topic clustering over synced, dirty memos |
| Daily briefing | A generated note that connects upcoming schedules, recent memos, and older memories |

## Brand Voice
**Tone:** Calm, focused, warm, precise.

**Style:** Korean-first, direct, low-hype, product-led, concrete.

**Personality:** Quiet, thoughtful, trustworthy, memory-aware, pragmatic.

## Proof Points
**Metrics:** No public adoption, conversion, retention, or performance metrics are available in the repo.

**Customers:** No named customers or logos are available in the repo.

**Testimonials:**
> No testimonials found yet.

**Value themes:**
| Theme | Proof |
|-------|-------|
| Capture works before cloud | README states memo writing and manual calendar registration do not require login |
| Notes can become time | Memo selection can create local calendar blocks; calendar has month/week views and draggable weekly layout |
| Memory resurfaces inside writing | Cursor-based State B search and Ambient Mirror card are implemented around memo chunks |
| Calm batch enrichment | Schedule inbox, topic discovery, and daily briefing are backend or Edge Function flows rather than disruptive realtime UI |
| Korean writing fit | Date parser, Korean labels, and product UI are built around Korean memo/calendar language |

## Goals
**Business goal:** Launch a differentiated local-first memory and planning app for Korean-speaking individual users.

**Conversion action:** Drive platform-specific downloads for macOS, Windows, and iOS. If official store URLs or installer files are not available in the repo yet, the landing page should keep download links easy to configure at deploy time.

**Current metrics:** Not available in the repo.
