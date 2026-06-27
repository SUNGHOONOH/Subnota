// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { GoogleGenAI } from 'npm:@google/genai'

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const MAX_RECENT_MEMOS = 10
const MAX_PAST_CHUNK_CANDIDATES = 12
const OLD_RANDOM_CHUNK_LIMIT = 20

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey =
  Deno.env.get('SERVICE_ROLE_KEY') ??
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
  ''
const geminiApiKey = Deno.env.get('GEMINI_API_KEY') ?? ''
const briefingPrimaryModel =
  Deno.env.get('BRIEFING_PRIMARY_MODEL') ?? 'gemma-4-31b-it'
const briefingFallbackModel =
  Deno.env.get('BRIEFING_FALLBACK_MODEL') ?? 'gemma-4-26b-a4b-it'
const briefingModels = [briefingPrimaryModel, briefingFallbackModel].filter(
  (model, index, models) => model && models.indexOf(model) === index,
)
const dailyBriefingCronKey = Deno.env.get('DAILY_BRIEFING_CRON_KEY') ?? ''
const ai = new GoogleGenAI({ apiKey: geminiApiKey })

type PastChunk = {
  chunk_text: string
  created_at: string
  label: string
  source: string
}

const truncate = (value: string, limit: number) => {
  const normalized = String(value ?? '').replace(/\s+/g, ' ').trim()
  return normalized.length > limit ? `${normalized.slice(0, limit)}...` : normalized
}

const getKstParts = (date = new Date()) => {
  const shifted = new Date(date.getTime() + KST_OFFSET_MS)
  return {
    day: shifted.getUTCDate(),
    month: shifted.getUTCMonth(),
    year: shifted.getUTCFullYear(),
  }
}

const kstMidnightUtc = (year: number, month: number, day: number) => {
  return new Date(Date.UTC(year, month, day) - KST_OFFSET_MS)
}

const kstDayFromToday = (offsetDays: number) => {
  const today = getKstParts()
  return kstMidnightUtc(today.year, today.month, today.day + offsetDays)
}

const getKstDateString = () => {
  const today = getKstParts()
  const month = String(today.month + 1).padStart(2, '0')
  const day = String(today.day).padStart(2, '0')
  return `${today.year}-${month}-${day}`
}

const getPastWindow = (daysAgo: number, radiusDays: number) => {
  return {
    end: kstDayFromToday(-daysAgo + radiusDays + 1).toISOString(),
    start: kstDayFromToday(-daysAgo - radiusDays).toISOString(),
  }
}

const getTomorrowWindow = () => {
  return {
    end: kstDayFromToday(2).toISOString(),
    start: kstDayFromToday(1).toISOString(),
  }
}

const fetchTomorrowBlocks = async (supabase, userId: string) => {
  const { start, end } = getTomorrowWindow()
  const { data, error } = await supabase
    .from('calendar_blocks')
    .select('title, start_date')
    .eq('user_id', userId)
    .gte('start_date', start)
    .lt('start_date', end)
    .order('start_date', { ascending: true })

  if (error) throw error
  return data ?? []
}

const fetchRecentMemos = async (supabase, userId: string) => {
  const { data, error } = await supabase
    .from('memos')
    .select('content, created_at, updated_at')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('updated_at', { ascending: false })
    .limit(MAX_RECENT_MEMOS)

  if (error) throw error
  return (data ?? []).map((memo) => ({
    content: truncate(memo.content, 260),
    created_at: memo.created_at,
    updated_at: memo.updated_at,
  }))
}

const fetchMemoCreatedAtMap = async (
  supabase,
  userId: string,
  start?: string,
  end?: string,
) => {
  let query = supabase
    .from('memos')
    .select('id, created_at')
    .eq('user_id', userId)
    .eq('is_archived', false)
    .order('created_at', { ascending: false })
    .limit(OLD_RANDOM_CHUNK_LIMIT)

  if (start) {
    query = query.gte('created_at', start)
  }

  if (end) {
    query = query.lt('created_at', end)
  }

  const { data, error } = await query

  if (error) throw error

  return new Map((data ?? []).map((memo) => [memo.id, memo.created_at]))
}

const normalizePastRows = (
  rows: Array<Record<string, unknown>>,
  createdAtByMemoId: Map<string, string>,
  label: string,
  source: string,
): PastChunk[] => {
  return rows
    .map((row) => ({
      chunk_text: truncate(String(row.chunk_text ?? ''), 220),
      created_at: createdAtByMemoId.get(String(row.memo_id ?? '')) ?? '',
      label,
      source,
    }))
    .filter((row) => row.chunk_text.trim())
}

const fetchPastChunksInWindow = async (
  supabase,
  userId: string,
  daysAgo: number,
  radiusDays: number,
  label: string,
  source: string,
) => {
  const { start, end } = getPastWindow(daysAgo, radiusDays)
  const createdAtByMemoId = await fetchMemoCreatedAtMap(supabase, userId, start, end)
  const memoIds = [...createdAtByMemoId.keys()]

  if (memoIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('memo_chunks')
    .select('memo_id, chunk_text, chunk_index')
    .eq('user_id', userId)
    .in('memo_id', memoIds)
    .order('chunk_index', { ascending: true })
    .limit(MAX_PAST_CHUNK_CANDIDATES)

  if (error) throw error
  return normalizePastRows(data ?? [], createdAtByMemoId, label, source)
}

const shuffle = <T,>(items: T[]) => {
  return [...items].sort(() => Math.random() - 0.5)
}

const fetchOldRandomChunks = async (supabase, userId: string) => {
  const cutoff = kstDayFromToday(-30).toISOString()
  const createdAtByMemoId = await fetchMemoCreatedAtMap(
    supabase,
    userId,
    undefined,
    cutoff,
  )
  const memoIds = [...createdAtByMemoId.keys()]

  if (memoIds.length === 0) {
    return []
  }

  const { data, error } = await supabase
    .from('memo_chunks')
    .select('memo_id, chunk_text')
    .eq('user_id', userId)
    .in('memo_id', memoIds)
    .limit(OLD_RANDOM_CHUNK_LIMIT)

  if (error) throw error
  return shuffle(
    normalizePastRows(
      data ?? [],
      createdAtByMemoId,
      '예전에 적어둔 문장',
      'old_random',
    ),
  ).slice(0, 2)
}

const fetchPastChunks = async (supabase, userId: string) => {
  const windows = [
    { daysAgo: 30, label: '한 달 전쯤', radiusDays: 3, source: '30d' },
    { daysAgo: 90, label: '세 달 전쯤', radiusDays: 7, source: '90d' },
    { daysAgo: 21, label: '3주 전쯤', radiusDays: 2, source: '21d' },
  ]

  for (const window of windows) {
    const chunks = await fetchPastChunksInWindow(
      supabase,
      userId,
      window.daysAgo,
      window.radiusDays,
      window.label,
      window.source,
    )

    if (chunks.length > 0) {
      return {
        chunks,
        source: window.source,
      }
    }
  }

  const chunks = await fetchOldRandomChunks(supabase, userId)
  return {
    chunks,
    source: chunks.length > 0 ? 'old_random' : 'none',
  }
}

const generateBriefing = async ({
  blocks,
  memos,
  pastChunks,
}: {
  blocks: Array<Record<string, unknown>>
  memos: Array<Record<string, unknown>>
  pastChunks: PastChunk[]
}) => {
  if (!geminiApiKey) {
    throw new Error('GEMINI_API_KEY is required')
  }

  const prompt = [
    '너는 사용자의 일상과 잊혀가는 무의식을 연결해 주는 다정하고 스마트한 개인 비서이자 동반자다.',
    '사용자의 내일 일정, 최근 메모, 과거 생각 조각 후보를 바탕으로 차분하고 따뜻한 로우파이 감성의 데일리 브리핑을 작성해라.',
    '과거 생각 조각 후보가 여러 개라면 내일 일정 또는 최근 메모와 가장 자연스럽게 이어지는 1개만 선택해라.',
    '사적인 고민은 단정하지 말고 조심스럽게 질문 형태로 다루어라.',
    '',
    '[입력 데이터]',
    `내일 일정: ${JSON.stringify(blocks)}`,
    `최근 메모: ${JSON.stringify(memos)}`,
    `과거 생각 조각 후보: ${JSON.stringify(pastChunks)}`,
    '',
    '[출력 형식]',
    '🌙 내일의 예보',
    '- 내일 일정들의 타임라인과 전반적인 페이스를 2문장 이내로 요약해라. 일정이 없다면 여유롭게 준비하도록 격려해라.',
    '',
    '📌 손에 잡히는 행동',
    '- 최근 메모 중 내일이나 조만간 해결할 가치가 있는 실용적인 태스크나 아이디어를 1~2문장으로 제안해라.',
    '',
    '🌱 사라지던 기억 조각',
    '- 선택한 과거 생각 조각을 label과 함께 소환해라. 예: "한 달 전쯤 적어둔 문장..."',
    '- 현재 시점과 연결해 볼 수 있는 다정한 질문이나 성찰 코멘트를 2문장 이내로 던져라.',
    '',
    '전체는 5~6문장 이내로 작성해라. 각 섹션 제목은 그대로 유지해라.',
  ].join('\n')

  let lastError: unknown

  for (const model of briefingModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          temperature: 0.35,
        },
      })

      return {
        content: response.text?.trim() || '내일 브리핑을 생성하지 못했습니다.',
        model,
      }
    } catch (error) {
      lastError = error
      console.error(`Daily briefing generation failed with ${model}`, error)
    }
  }

  throw lastError ?? new Error('Daily briefing generation failed')
}

serve(async (req) => {
  try {
    if (
      !dailyBriefingCronKey ||
      req.headers.get('x-daily-briefing-key') !== dailyBriefingCronKey
    ) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { 'Content-Type': 'application/json' },
        status: 401,
      })
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey)
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, briefing_time')

    if (userError) throw userError

    const briefingDate = getKstDateString()
    const results = []

    for (const user of users ?? []) {
      const blocks = await fetchTomorrowBlocks(supabase, user.id)
      const memos = await fetchRecentMemos(supabase, user.id)
      const past = await fetchPastChunks(supabase, user.id)

      const briefing = await generateBriefing({
        blocks,
        memos,
        pastChunks: past.chunks,
      })

      const metadata = {
        model: briefing.model,
        past_chunk_count: past.chunks.length,
        past_chunk_source: past.source,
        recent_memo_count: memos.length,
        tomorrow_block_count: blocks.length,
      }

      const { error: briefingError } = await supabase.from('briefings').upsert(
        {
          briefing_date: briefingDate,
          content: briefing.content,
          metadata,
          type: 'daily',
          user_id: user.id,
        },
        { onConflict: 'user_id,type,briefing_date' },
      )

      if (briefingError) throw briefingError

      results.push({
        past_chunk_source: past.source,
        user_id: user.id,
      })
    }

    return new Response(
      JSON.stringify({ briefing_date: briefingDate, results }),
      { headers: { 'Content-Type': 'application/json' }, status: 200 },
    )
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})
