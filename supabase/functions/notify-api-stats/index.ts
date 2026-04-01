import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERUS_API_URL = Deno.env.get('VERUS_API_URL') || 'https://api.projetopapiro.com.br'
const VERUS_API_KEY = Deno.env.get('VERUS_WEBHOOK_SECRET') || ''

Deno.serve(async (req) => {
  try {
    const { question_id } = await req.json()
    if (!question_id) {
      return new Response(JSON.stringify({ error: 'question_id required' }), { status: 400 })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Count non-deleted comments
    const { count: comments_count } = await supabase
      .from('question_comments')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', question_id)
      .eq('is_deleted', false)

    // Check if any pinned comment exists
    const { count: pinned_count } = await supabase
      .from('question_comments')
      .select('*', { count: 'exact', head: true })
      .eq('question_id', question_id)
      .eq('is_pinned', true)
      .eq('is_deleted', false)

    const has_teacher_resolution = (pinned_count ?? 0) > 0

    // Call API Verus with retry (3 attempts: 1s, 2s, 4s)
    let lastError: Error | null = null
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(
          `${VERUS_API_URL}/api/v1/questoes/${question_id}/community-stats`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'X-Webhook-Secret': VERUS_API_KEY,
            },
            body: JSON.stringify({
              comments_count: comments_count ?? 0,
              has_teacher_resolution,
            }),
          }
        )
        if (res.ok) {
          return new Response(JSON.stringify({
            success: true,
            comments_count,
            has_teacher_resolution,
          }))
        }
        lastError = new Error(`API returned ${res.status}`)
      } catch (e) {
        lastError = e as Error
      }
      await new Promise(r => setTimeout(r, 1000 * Math.pow(2, attempt)))
    }

    return new Response(JSON.stringify({ error: lastError?.message }), { status: 502 })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500 })
  }
})
