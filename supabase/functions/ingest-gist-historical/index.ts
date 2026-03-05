const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GIST_BASE = 'https://api.getgist.com';
const DEFAULT_MAX_PAGES = 5;

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

interface GistPaginationPages {
  next?: string;
  first?: string;
  last?: string;
}

interface GistConversationsResponse {
  conversations: GistConversation[];
  pages: GistPaginationPages;
}

interface GistMessagesResponse {
  messages: GistMessage[];
  pages?: GistPaginationPages;
}

interface ChannelBinding {
  id: string;
  client_id: string;
  active: boolean | null;
}

interface Participant {
  id: string;
  client_id: string | null;
  side: string;
  identifiers: Array<{ channel: string; value: string }> | null;
}

interface ParticipantInfo {
  participantId: string;
  clientId: string | null;
  side: string;
}

interface RequestBody {
  page?: number;
  max_pages?: number;
  delete_client_id?: string;
}

function extractPageFromUrl(url?: string): number {
  if (!url) return 0;
  const match = url.match(/[?&]page=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
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
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supaAuth.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json().catch(() => ({})) as RequestBody;
    let currentPage = body.page ?? 1;
    const maxPages = body.max_pages ?? DEFAULT_MAX_PAGES;

    // Optional: delete interactions for a client before ingestion
    if (body.delete_client_id) {
      const { error: delErr } = await supaAdmin
        .from('interactions')
        .delete()
        .eq('client_id', body.delete_client_id);
      if (delErr) {
        return new Response(JSON.stringify({ error: 'Delete failed: ' + delErr.message }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // 1. Load all gist channel bindings (keyed by client_id)
    const { data: bindings, error: bindErr } = await supaAdmin
      .from('channel_bindings')
      .select('id, client_id, active')
      .eq('channel', 'gist')
      .limit(500);

    if (bindErr) throw new Error('Failed to load channel_bindings: ' + bindErr.message);

    const bindingByClientId = new Map<string, ChannelBinding>();
    for (const b of (bindings ?? []) as ChannelBinding[]) {
      bindingByClientId.set(b.client_id, b);
    }

    // 2. Load participants with gist identifiers
    const { data: participants, error: partErr } = await supaAdmin
      .from('participants')
      .select('id, client_id, side, identifiers')
      .not('identifiers', 'is', null)
      .limit(1000);

    if (partErr) throw new Error('Failed to load participants: ' + partErr.message);

    const gistIdToParticipant = new Map<string, ParticipantInfo>();
    for (const p of (participants ?? []) as Participant[]) {
      if (!p.identifiers) continue;
      for (const ident of p.identifiers) {
        if (ident.channel === 'gist') {
          gistIdToParticipant.set(ident.value, {
            participantId: p.id,
            clientId: p.client_id ?? null,
            side: p.side,
          });
        }
      }
    }

    // 3. Process up to maxPages of conversations
    let messagesFetched = 0;
    let messagesInserted = 0;
    let messagesSkipped = 0;
    let messagesQuarantined = 0;
    let conversationsFetched = 0;
    const errors: string[] = [];
    let hasMore = false;
    let nextPage: number | undefined;
    let pagesProcessed = 0;
    let totalPagesCount = 0;

    while (pagesProcessed < maxPages) {
      let convosResponse: GistConversationsResponse;

      try {
        convosResponse = await gistGet<GistConversationsResponse>(apiKey, 'conversations', {
          page: String(currentPage),
          per_page: '20',
          state: 'all',
        });
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'retryable' in err) {
          await sleep(2000);
          convosResponse = await gistGet<GistConversationsResponse>(apiKey, 'conversations', {
            page: String(currentPage),
            per_page: '20',
            state: 'all',
          });
        } else {
          throw err;
        }
      }

      const conversations = convosResponse.conversations ?? [];
      const totalPages = extractPageFromUrl(convosResponse.pages?.last);
      totalPagesCount = totalPages;
      const hasNextPage = !!convosResponse.pages?.next;

      console.log(`[ingest] Page ${currentPage}/${totalPages} — ${conversations.length} convos, hasNext=${hasNextPage}, pages=${JSON.stringify(convosResponse.pages)}`);

      conversationsFetched += conversations.length;
      pagesProcessed++;

      // Process each conversation on this page
      for (const convo of conversations) {
        try {
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

            // Use URL-based pagination for messages too
            msgHasMore = !!msgRes.pages?.next;
            msgPage++;
          }

          messagesFetched += allMessages.length;

          // Resolve client_id from the first contact-type author
          let resolvedClientId: string | null = null;
          let resolvedBindingId: string | null = null;

          const contactMsg = allMessages.find(
            (m) => m.author?.type === 'contact' || m.author?.type === 'user'
          );

          if (contactMsg?.author?.id) {
            const contactGistId = String(contactMsg.author.id);
            const participantInfo = gistIdToParticipant.get(contactGistId);

            if (participantInfo) {
              if (participantInfo.side === 'umode') {
                resolvedClientId = null;
              } else if (participantInfo.clientId) {
                resolvedClientId = participantInfo.clientId;
                const binding = bindingByClientId.get(participantInfo.clientId);
                resolvedBindingId = binding?.id ?? null;
              }
            }
          }

          if (!resolvedClientId) {
            messagesQuarantined += allMessages.length;
            await sleep(100);
            continue;
          }

          const rows = allMessages.map((msg) => {
            const isInbound = msg.is_inbound ?? (msg.author?.type === 'user' || msg.author?.type === 'contact');
            const senderSide = isInbound ? 'client' : 'umode';
            const senderGistId = msg.author?.id ? String(msg.author.id) : null;
            const senderInfo = senderGistId ? gistIdToParticipant.get(senderGistId) : undefined;
            const senderParticipantId = senderInfo?.participantId ?? null;

            return {
              channel: 'gist' as const,
              external_id: String(msg.id),
              client_id: resolvedClientId!,
              channel_binding_id: resolvedBindingId,
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

          await sleep(100);
        } catch (convoErr) {
          const msg = convoErr instanceof Error ? convoErr.message : 'Unknown error';
          errors.push(`Conv ${convo.id}: ${msg}`);
        }
      }

      // Check if there are more pages
      console.log(`[ingest] Decision: currentPage=${currentPage}, totalPages=${totalPages}, hasNextPage=${hasNextPage}, pagesProcessed=${pagesProcessed}/${maxPages}`);
      if (hasNextPage) {
        currentPage++;
        if (pagesProcessed >= maxPages) {
          hasMore = true;
          nextPage = currentPage;
          console.log(`[ingest] Yielding: has_more=true, next_page=${nextPage}`);
        }
      } else {
        console.log(`[ingest] All pages processed, no more.`);
        break;
      }
    }

    // Extract total pages from the last conversation page processed
    const lastPageUrl = hasMore ? undefined : undefined; // already tracked in loop
    
    return new Response(
      JSON.stringify({
        conversations_fetched: conversationsFetched,
        messages_fetched: messagesFetched,
        messages_inserted: messagesInserted,
        messages_skipped: messagesSkipped,
        messages_quarantined: messagesQuarantined,
        errors,
        has_more: hasMore,
        next_page: nextPage,
        total_pages: totalPagesCount,
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
