// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// 환경 변수 설정
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

serve(async (_req) => {
  try {
    // Service Role Key를 사용하여 모든 데이터에 접근 권한 획득
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // 1. 트리거 대상 유저 찾기 (예: 현재 시간이 유저의 briefing_time과 일치하는 유저)
    // 실제 프로덕션에서는 매 분마다 도는 크론잡이 현재 시간(HH:MM)과 일치하는 유저를 찾도록 쿼리합니다.
    // 여기서는 예시로 모든 활성 유저를 대상으로 진행한다고 가정합니다.
    const { data: users, error: userError } = await supabase
      .from('profiles')
      .select('id, push_token, briefing_time')
      // .eq('briefing_time', current_time_formatted) // 실제 구현 시 추가

    if (userError) throw userError;

    for (const user of users) {
      // 2. 해당 유저의 내일 일정(Calendar Blocks) 및 최근 메모(Memos) 가져오기
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStart = new Date(tomorrow.setHours(0,0,0,0)).toISOString();
      const tomorrowEnd = new Date(tomorrow.setHours(23,59,59,999)).toISOString();

      const { data: blocks } = await supabase
        .from('calendar_blocks')
        .select('title, start_date, end_date')
        .eq('user_id', user.id)
        .gte('start_date', tomorrowStart)
        .lte('start_date', tomorrowEnd);

      const { data: memos } = await supabase
        .from('memos')
        .select('content')
        .eq('user_id', user.id)
        .eq('is_archived', false)
        .limit(10); // 최근 10개 메모 참고

      // 3. LLM API (OpenAI) 호출하여 브리핑 텍스트 생성
      /*
      // --- 실제 OpenAI 연동 주석 처리 ---
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openAiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4',
          messages: [
            { role: 'system', content: '당신은 유저의 스케줄을 정리해주는 친절한 비서입니다.' },
            { role: 'user', content: `내일 일정: ${JSON.stringify(blocks)}, 최근 메모: ${JSON.stringify(memos)}. 내일 할 일을 짧고 간결하게 브리핑해줘.` }
          ]
        })
      });
      const aiData = await response.json();
      const briefingContent = aiData.choices[0].message.content;
      */
      
      // 임시 목업 브리핑 텍스트
      const briefingContent = `[임시 생성] 내일은 총 ${blocks?.length || 0}개의 일정이 있습니다. 최근 메모 ${memos?.length || 0}개도 확인해 주세요.`;

      // 4. 생성된 브리핑을 DB에 저장
      await supabase.from('briefings').insert({
        user_id: user.id,
        content: briefingContent,
        type: 'daily'
      });

      // 5. 푸시 알림 발송 (FCM / APNs 연동 필요)
      if (user.push_token) {
        console.log(`Sending push notification to ${user.push_token}: ${briefingContent}`);
        // TODO: Send push using Expo Push API or raw FCM
      }
    }

    return new Response(
      JSON.stringify({ message: 'Briefings generated successfully' }),
      { headers: { "Content-Type": "application/json" }, status: 200 }
    )

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 400,
    })
  }
})
