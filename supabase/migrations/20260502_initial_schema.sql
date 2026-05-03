-- 1. Profiles 테이블 (유저 정보 및 브리핑 설정)
create table public.profiles (
  id uuid references auth.users not null primary key,
  display_name text,
  push_token text,
  briefing_time time default '22:00', -- 유저가 설정한 브리핑 시간 (기본값: 전날 밤 10시)
  created_at timestamptz default now()
);

-- 2. Memos 테이블 (순수 메모 데이터)
create table public.memos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  is_archived boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Calendar Blocks 테이블 (메모에서 추출되거나 수동 추가된 일정 블럭)
create table public.calendar_blocks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  memo_id uuid references public.memos(id) on delete set null, -- 원본 메모와의 연결고리
  title text not null,
  start_date timestamptz not null,
  end_date timestamptz,
  all_day boolean default false,
  "order" int default 0, -- 같은 날짜 내에서의 정렬 순서 (D&D 용)
  color text default '#007AFF',
  is_completed boolean default false,
  created_at timestamptz default now()
);

-- 4. Briefings 테이블 (LLM이 생성한 브리핑 기록)
create table public.briefings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  type text check (type in ('daily', 'weekly')),
  created_at timestamptz default now()
);

-- RLS (Row Level Security) 설정 (간략화)
alter table public.profiles enable row level security;
alter table public.memos enable row level security;
alter table public.calendar_blocks enable row level security;
alter table public.briefings enable row level security;

-- 정책 예시: 자신의 데이터만 조회/수정 가능
create policy "Users can view own profile" on profiles for select using ( auth.uid() = id );
create policy "Users can view own memos" on memos for select using ( auth.uid() = user_id );
create policy "Users can view own blocks" on calendar_blocks for select using ( auth.uid() = user_id );
create policy "Users can view own briefings" on briefings for select using ( auth.uid() = user_id );
