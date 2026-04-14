import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function parseWithRecovery(text: string): unknown[] {
  try {
    return JSON.parse(text);
  } catch (_firstErr) {
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace > 0) {
      const recovered = text.substring(0, lastBrace + 1) + ']';
      try {
        const result = JSON.parse(recovered);
        if (Array.isArray(result)) return result;
      } catch (_) { /* fall through */ }
    }
    throw new Error(`JSON parse failed. First 200 chars: ${text.substring(0, 200)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    if (!serviceKey || !supabaseUrl) {
      return new Response(JSON.stringify({ error: 'Missing env vars' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify caller is admin
    const userClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supaAdmin = createClient(supabaseUrl, serviceKey);

    // Check admin
    const { data: profile } = await supaAdmin
      .from('user_profiles')
      .select('global_role')
      .eq('id', user.id)
      .single();

    if (profile?.global_role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin only' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const { conversation_ids, prompt_version_id, draft_prompt, draft_themes } = body;

    if (!conversation_ids || !Array.isArray(conversation_ids) || conversation_ids.length === 0) {
      return new Response(JSON.stringify({ error: 'conversation_ids required (array)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (conversation_ids.length > 20) {
      return new Response(JSON.stringify({ error: 'Max 20 conversations per test' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve prompt
    let systemPrompt = '';
    let validThemes: string[] = [];

    if (draft_prompt) {
      systemPrompt = draft_prompt;
      validThemes = draft_themes ?? [];
    } else if (prompt_version_id) {
      const { data: cfg } = await supaAdmin
        .from('classification_prompt_config')
        .select('system_prompt, valid_themes')
        .eq('id', prompt_version_id)
        .single();
      if (!cfg) {
        return new Response(JSON.stringify({ error: 'Prompt version not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      systemPrompt = cfg.system_prompt;
      validThemes = (cfg.valid_themes as string[]) ?? [];
    } else {
      // Use active prompt
      const { data: cfg } = await supaAdmin
        .from('classification_prompt_config')
        .select('system_prompt, valid_themes')
        .eq('active', true)
        .maybeSingle();
      if (!cfg) {
        return new Response(JSON.stringify({ error: 'No active prompt config found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      systemPrompt = cfg.system_prompt;
      validThemes = (cfg.valid_themes as string[]) ?? [];
    }

    // Fetch messages for the conversations
    const { data: messages, error: msgErr } = await supaAdmin
      .from('interactions')
      .select('id, content, sender_side, occurred_at, conversation_id, tone, theme, sentiment, classified_at, classification_model')
      .in('conversation_id', conversation_ids)
      .not('content', 'is', null)
      .order('occurred_at', { ascending: true });

    if (msgErr) {
      return new Response(JSON.stringify({ error: `Fetch messages: ${msgErr.message}` }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Group by conversation
    const conversations = new Map<string, typeof messages>();
    for (const msg of (messages ?? [])) {
      if (!conversations.has(msg.conversation_id)) conversations.set(msg.conversation_id, []);
      conversations.get(msg.conversation_id)!.push(msg);
    }

    // Build payload for AI
    const conversationPayload = Array.from(conversations.entries()).map(([convId, msgs]) => ({
      conversation_id: convId,
      messages: msgs.map(m => ({
        sender: m.sender_side,
        content: m.content,
        timestamp: m.occurred_at,
      })),
    }));

    const userPrompt = JSON.stringify(conversationPayload);

    // Call Gemini (primary) or Claude (fallback)
    const geminiKey = Deno.env.get('GEMINI_API_KEY');
    const claudeKey = Deno.env.get('CLAUDE_API_KEY');
    let classifications: unknown[] | null = null;
    let modelUsed = '';

    if (geminiKey) {
      try {
        const geminiRes = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            signal: AbortSignal.timeout(55_000),
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\nConversations:\n${userPrompt}` }] }],
              generationConfig: {
                responseMimeType: 'application/json',
                responseSchema: {
                  type: 'ARRAY',
                  items: {
                    type: 'OBJECT',
                    properties: {
                      conversation_id: { type: 'STRING' },
                      theme: { type: 'STRING', enum: validThemes.length > 0 ? validThemes : undefined },
                      theme_detail: { type: 'STRING' },
                      tone: { type: 'STRING', enum: ['ok', 'atencao', 'alerta', 'critico'] },
                      tone_detail: { type: 'STRING' },
                      sentiment: { type: 'NUMBER' },
                      is_out_of_scope: { type: 'BOOLEAN' },
                    },
                    required: ['conversation_id', 'theme', 'tone', 'sentiment'],
                  },
                },
              },
            }),
          },
        );
        if (geminiRes.ok) {
          const data = await geminiRes.json();
          const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            classifications = parseWithRecovery(text);
            modelUsed = 'gemini-2.5-pro';
          }
        }
      } catch (err) {
        console.error(`[test-classify] Gemini error: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (!classifications && claudeKey) {
      try {
        const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          signal: AbortSignal.timeout(45_000),
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': claudeKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });
        if (claudeRes.ok) {
          const data = await claudeRes.json();
          const text = data.content?.[0]?.text;
          if (text) {
            const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
            classifications = parseWithRecovery(cleaned);
            modelUsed = 'claude-sonnet-4';
          }
        }
      } catch (err) {
        console.error(`[test-classify] Claude error: ${err instanceof Error ? err.message : err}`);
      }
    }

    if (!classifications) {
      return new Response(JSON.stringify({ error: 'Both Gemini and Claude failed' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build comparison: current vs new
    const results = (classifications as Array<Record<string, unknown>>).map((newC) => {
      const convId = newC.conversation_id as string;
      const currentMsgs = conversations.get(convId);
      const firstMsg = currentMsgs?.[0];

      return {
        conversation_id: convId,
        message_count: currentMsgs?.length ?? 0,
        current: {
          tone: firstMsg?.tone ?? null,
          theme: firstMsg?.theme ?? null,
          sentiment: firstMsg?.sentiment ?? null,
          model: firstMsg?.classification_model ?? null,
        },
        new: {
          tone: newC.tone ?? null,
          theme: newC.theme ?? null,
          theme_detail: newC.theme_detail ?? null,
          tone_detail: newC.tone_detail ?? null,
          sentiment: newC.sentiment ?? null,
          is_out_of_scope: newC.is_out_of_scope ?? false,
        },
        changed: (firstMsg?.tone !== newC.tone) || (firstMsg?.theme !== newC.theme),
      };
    });

    return new Response(JSON.stringify({
      model_used: modelUsed,
      conversations_tested: results.length,
      results,
    }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    console.error('[test-classify] Error:', err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : 'Unknown error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
