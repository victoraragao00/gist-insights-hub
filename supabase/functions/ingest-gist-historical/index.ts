const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GIST_BASE = 'https://api.getgist.com';

interface GistMessage {
  id: number;
  body: string;
  created_at: number;
  author: { id: number; type: string; email?: string; name?: string } | null;
  is_inbound?: boolean;
  attachments?: unknown[];
}

interface GistConversation {
  id: number;
  created_at: number;
  updated_at: number;
  state: string;
}

interface GistConversationsResponse {
  conversations: GistConversation[];
  pages: { total_count: number; per_page: number; page: number };
}

interface GistMessagesResponse {
  messages: GistMessage[];
  pages?: { total_count: number; per_page: number; page: number };
}

interface ChannelBinding {
  id: string;
  client_id: string;
  active: boolean | null;
}

interface Participant {
  id: string;
  client_id: string | null;
  identifiers: Array<{ channel: string; value: string }> | null;
}

interface RequestBody {
  page?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gistGet<T>(apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${GIST_BASE}/${path}${qs}`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });

  if (res.status === 429) {
    throw { retryable: true, status: 429 };
  }

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist ${path} ${res.status}: ${text.substring(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GIST_API_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (!apiKey || !serviceKey || !supabaseUrl || !anonKey) {
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supaAdmin = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supaAuth = createClient(supabaseUrl, anonKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    const { data: authData, error: authError } = await supaAuth.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({})) as RequestBody;
    const requestedPage = body.page ?? 1;

    // 1. Load all gist channel bindings
    const { data: bindings, error: bindErr } = await supaAdmin
      .from('channel_bindings')
      .select('id, client_id, active')
      .eq('channel', 'gist')
      .limit(500);

    if (bindErr) throw new Error('Failed to load channel_bindings: ' + bindErr.message);

    const bindingList = (bindings ?? []) as ChannelBinding[];
    if (bindingList.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No gist channel bindings found. Run contact discovery first.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const bindingByClientId = new Map<string, ChannelBinding>();
    for (const b of bindingList) {
      bindingByClientId.set(b.client_id, b);
    }

    const firstActiveBinding = bindingList.find((b) => b.active !== false) ?? bindingList[0];

    // 2. Load participants with gist identifiers into memory map
    const { data: participants, error: partErr } = await supaAdmin
      .from('participants')
      .select('id, client_id, identifiers')
      .not('identifiers', 'is', null)
      .limit(1000);

    if (partErr) throw new Error('Failed to load participants: ' + partErr.message);

    const gistIdToParticipant = new Map<string, { participantId: string; clientId: string | null }>();
    for (const p of (participants ?? []) as Participant[]) {
      if (!p.identifiers) continue;
      for (const ident of p.identifiers) {
        if (ident.channel === 'gist') {
          gistIdToParticipant.set(ident.value, {
            participantId: p.id,
            clientId: p.client_id ?? null,
          });
        }
      }
    }

    // 3. Fetch conversations page
    let convosResponse: GistConversationsResponse;

    try {
      convosResponse = await gistGet<GistConversationsResponse>(apiKey, 'conversations', {
        page: String(requestedPage),
        per_page: '20',
      });
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'retryable' in err) {
        await sleep(2000);
        convosResponse = await gistGet<GistConversationsResponse>(apiKey, 'conversations', {
          page: String(requestedPage),
          per_page: '20',
        });
      } else {
        throw err;
      }
    }

    const conversations = convosResponse.conversations ?? [];
    const totalConvos = convosResponse.pages?.total_count ?? 0;
    const totalPages = Math.ceil(totalConvos / 20);
    const hasMore = requestedPage < totalPages;

    let messagesFetched = 0;
    let messagesInserted = 0;
    let messagesSkipped = 0;
    const errors: string[] = [];

    // 4. Process each conversation
    for (const convo of conversations) {
      try {
        // Fetch ALL messages for this conversation
        let msgPage = 1;
        let msgHasMore = true;
        const allMessages: GistMessage[] = [];

        while (msgHasMore) {
          let msgRes: GistMessagesResponse;

          try {
            msgRes = await gistGet<GistMessagesResponse>(apiKey, `conversations/${convo.id}/messages`, {
              page: String(msgPage),
              per_page: '50',
            });
          } catch (retryErr: unknown) {
            if (retryErr && typeof retryErr === 'object' && 'retryable' in retryErr) {
              await sleep(2000);
              msgRes = await gistGet<GistMessagesResponse>(apiKey, `conversations/${convo.id}/messages`, {
                page: String(msgPage),
                per_page: '50',
              });
            } else {
              throw retryErr;
            }
          }

          const msgs = msgRes.messages ?? [];
          allMessages.push(...msgs);

          const msgTotalPages = msgRes.pages ? Math.ceil(msgRes.pages.total_count / 50) : 1;
          msgHasMore = msgPage < msgTotalPages;
          msgPage++;
        }

        messagesFetched += allMessages.length;

        const clientFrequency = new Map<string, number>();
        for (const msg of allMessages) {
          const senderGistId = msg.author?.id ? String(msg.author.id) : null;
          if (!senderGistId) continue;
          const senderInfo = gistIdToParticipant.get(senderGistId);
          if (!senderInfo?.clientId) continue;
          if (!bindingByClientId.has(senderInfo.clientId)) continue;
          clientFrequency.set(senderInfo.clientId, (clientFrequency.get(senderInfo.clientId) ?? 0) + 1);
        }

        const resolvedClientIdFromParticipants = Array.from(clientFrequency.entries()).sort(
          (a, b) => b[1] - a[1],
        )[0]?.[0];

        const resolvedBinding =
          (resolvedClientIdFromParticipants
            ? bindingByClientId.get(resolvedClientIdFromParticipants)
            : undefined) ?? firstActiveBinding;

        // Map messages to interactions
        const rows = allMessages.map((msg) => {
          const isInbound = msg.is_inbound ?? (msg.author?.type === 'user');
          const senderSide = isInbound ? 'client' : 'umode';
          const senderGistId = msg.author?.id ? String(msg.author.id) : null;
          const senderInfo = senderGistId ? gistIdToParticipant.get(senderGistId) : undefined;
          const senderParticipantId = senderInfo?.participantId ?? null;

          return {
            channel: 'gist' as const,
            external_id: String(msg.id),
            client_id: resolvedBinding.client_id,
            channel_binding_id: resolvedBinding.id,
            content: msg.body ?? null,
            sender_side: senderSide,
            sender_raw: msg.author?.name ?? msg.author?.email ?? null,
            sender_participant_id: senderParticipantId,
            occurred_at: new Date(msg.created_at * 1000).toISOString(),
            interaction_type: 'text' as const,
            tone: 'ok' as const,
            classified_at: null,
            raw_payload: msg as unknown,
            attachments: msg.attachments ?? [],
          };
        });

        if (rows.length > 0) {
          let convoUpserted = 0;

          // Insert in batches of 100
          for (let i = 0; i < rows.length; i += 100) {
            const batch = rows.slice(i, i + 100);
            const { data: inserted, error: insertErr } = await supaAdmin
              .from('interactions')
              .upsert(batch, { onConflict: 'channel,external_id' })
              .select('id');

            if (insertErr) {
              errors.push(`Conv ${convo.id} batch ${i}: ${insertErr.message}`);
            } else {
              convoUpserted += (inserted ?? []).length;
            }
          }

          messagesInserted += convoUpserted;
          messagesSkipped += Math.max(0, rows.length - convoUpserted);
        }

        // Rate limit: 100ms delay between conversations
        await sleep(100);
      } catch (convoErr) {
        const msg = convoErr instanceof Error ? convoErr.message : 'Unknown error';
        errors.push(`Conv ${convo.id}: ${msg}`);
      }
    }

    return new Response(
      JSON.stringify({
        conversations_fetched: conversations.length,
        messages_fetched: messagesFetched,
        messages_inserted: messagesInserted,
        messages_skipped: messagesSkipped,
        errors,
        has_more: hasMore,
        next_page: hasMore ? requestedPage + 1 : undefined,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
