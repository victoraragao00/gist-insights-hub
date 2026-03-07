const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GIST_BASE = 'https://api.getgist.com';
const MAX_PAGES_PER_RUN = 5;

// ── Shared helpers ──

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function gistGet<T>(apiKey: string, url: string): Promise<T> {
  const fullUrl = url.startsWith('http') ? url : `${GIST_BASE}/${url}`;
  const res = await fetch(fullUrl, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 429) throw { retryable: true, status: 429 };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist ${res.status}: ${text.substring(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

async function gistGetWithRetry<T>(apiKey: string, url: string): Promise<T> {
  try {
    return await gistGet<T>(apiKey, url);
  } catch (err: unknown) {
    if (err && typeof err === 'object' && 'retryable' in err) {
      await sleep(2000);
      return await gistGet<T>(apiKey, url);
    }
    throw err;
  }
}

function extractPageFromUrl(url?: string): number {
  if (!url) return 0;
  const match = url.match(/[?&]page=(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

// ── Types ──

interface SyncJob {
  id: string;
  type: string;
  status: string;
  client_id: string | null;
  payload: Record<string, unknown>;
  progress: Record<string, unknown>;
  retry_count: number;
  max_retries: number;
  created_by: string | null;
  started_at: string | null;
  completed_at: string | null;
  heartbeat_at: string | null;
}

interface HandlerResult {
  has_more: boolean;
  progress: Record<string, unknown>;
  error?: string;
}

// ── Gist types ──

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'live.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'proton.me',
  'protonmail.com', 'aol.com', 'mail.com',
]);

interface GistContact {
  id: number;
  name: string;
  email: string;
  last_seen_at: number | string | null;
  custom_properties?: { company_name?: string; [k: string]: unknown };
}

interface GistContactsResponse {
  contacts: GistContact[];
  pages: { next?: string; page: number; per_page: number; total_pages: number; total_count: number };
}

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

interface ClientRecord {
  id: string;
  name: string;
  slug: string;
  metadata: Record<string, unknown> | null;
}

// ── Sync Contacts Handler ──

function parseLastSeen(val: number | string | null): Date | null {
  if (!val) return null;
  if (typeof val === 'number') return new Date(val * 1000);
  return new Date(val);
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function handleSyncContacts(
  supaAdmin: any,
  apiKey: string,
  job: SyncJob,
  updateHeartbeat: () => Promise<void>,
): Promise<HandlerResult> {
  const progress = { ...(job.progress as any) };
  const startPage = (progress.next_page as number) || 1;
  const skipInactivation = (job.payload as any)?.skip_inactivation ?? false;
  const callerUserId = job.created_by;

  // Pre-load clients
  const clientsBySlug = new Map<string, ClientRecord>();
  const { data: existingClients } = await supaAdmin
    .from('clients').select('id, name, slug, metadata').limit(2000);
  for (const c of (existingClients ?? []) as ClientRecord[]) {
    clientsBySlug.set(c.slug, c);
  }

  let contactsProcessed = (progress.contacts_processed as number) || 0;
  let contactsUnresolved = (progress.contacts_unresolved as number) || 0;
  let clientsCreated = (progress.clients_created as number) || 0;
  let participantsCreated = (progress.participants_created as number) || 0;
  let participantsUpdated = (progress.participants_updated as number) || 0;
  const errors: string[] = [];

  const clientLastSeen = new Map<string, Date>();
  const newClientIds = new Set<string>();

  async function findOrCreateClient(name: string, slug: string): Promise<ClientRecord> {
    const existing = clientsBySlug.get(slug);
    if (existing) return existing;

    const { data: inserted, error: insertErr } = await supaAdmin
      .from('clients')
      .upsert({ name, slug, active: true, metadata: { auto_created: true, source: 'gist_sync' } }, { onConflict: 'slug' })
      .select('id, name, slug, metadata')
      .single();
    if (insertErr) throw new Error(`Client upsert failed for ${slug}: ${insertErr.message}`);
    const record = inserted as ClientRecord;
    clientsBySlug.set(slug, record);
    newClientIds.add(record.id);
    clientsCreated++;
    return record;
  }

  async function upsertParticipant(contact: GistContact, clientId: string | null) {
    const gistIdStr = String(contact.id);
    const identifierFilter = JSON.stringify([{ channel: 'gist', value: gistIdStr }]);
    const { data: existing } = await supaAdmin
      .from('participants').select('id').filter('identifiers', 'cs', identifierFilter).limit(1);
    const participantName = contact.name || contact.email || `Gist #${contact.id}`;
    if (existing && existing.length > 0) {
      await supaAdmin.from('participants').update({ name: participantName }).eq('id', existing[0].id);
      participantsUpdated++;
    } else {
      const { error: insErr } = await supaAdmin.from('participants').insert({
        name: participantName, side: 'client', client_id: clientId,
        identifiers: [{ channel: 'gist', value: gistIdStr }], active: true,
      });
      if (insErr) errors.push(`Participant insert ${gistIdStr}: ${insErr.message}`);
      else participantsCreated++;
    }
  }

  // Incremental: skip contacts older than since_timestamp
  const sinceTs = (job.payload as any)?.since_timestamp;
  const sinceUnix = sinceTs ? Math.floor(new Date(sinceTs).getTime() / 1000) : 0;

  let currentPage = startPage;
  let pagesProcessed = 0;
  let hasMore = false;
  let totalPages: number | null = null;

  while (pagesProcessed < MAX_PAGES_PER_RUN) {
    const url = `${GIST_BASE}/contacts?order_by=last_seen_at&order=desc&per_page=60&page=${currentPage}`;
    console.log(`[process-jobs:contacts] fetching page ${currentPage}... (since=${sinceTs ?? 'full'})`);

    const contactsRes = await gistGetWithRetry<GistContactsResponse>(apiKey, url);
    const contacts = contactsRes.contacts ?? [];
    const pages = contactsRes.pages;

    if (contacts.length === 0) break;

    totalPages = pages?.total_pages ?? totalPages;

    let reachedOldContacts = false;
    for (const contact of contacts) {
      // Break when contacts are older than last sync
      const contactLastSeenUnix = typeof contact.last_seen_at === 'number' ? contact.last_seen_at
        : contact.last_seen_at ? Math.floor(new Date(contact.last_seen_at).getTime() / 1000) : 0;
      if (sinceUnix > 0 && contactLastSeenUnix > 0 && contactLastSeenUnix < sinceUnix) {
        reachedOldContacts = true;
        break;
      }
      try {
        contactsProcessed++;
        const contactLastSeen = parseLastSeen(contact.last_seen_at);
        let companyName: string | null = null;
        let slug: string | null = null;

        const cpCompany = contact.custom_properties?.company_name;
        if (cpCompany && typeof cpCompany === 'string' && cpCompany.trim()) {
          companyName = cpCompany.trim();
          slug = toSlug(companyName);
        }

        if (!slug && contact.email?.includes('@')) {
          const domain = contact.email.split('@')[1].toLowerCase();
          if (!GENERIC_DOMAINS.has(domain)) {
            const domainSlug = toSlug(domain.replace(/\.(com|net|org|io|co|com\.br|app|dev|tech)(\..+)?$/i, ''));
            let matched = false;
            for (const [existingSlug, client] of clientsBySlug) {
              if (existingSlug.includes(domainSlug) || domainSlug.includes(existingSlug)) {
                companyName = client.name;
                slug = existingSlug;
                matched = true;
                break;
              }
            }
            if (!matched) { companyName = domain; slug = toSlug(domain); }
          }
        }

        if (!slug) { contactsUnresolved++; await upsertParticipant(contact, null); continue; }

        const client = await findOrCreateClient(companyName!, slug);
        if (contactLastSeen) {
          const current = clientLastSeen.get(client.id);
          if (!current || contactLastSeen > current) clientLastSeen.set(client.id, contactLastSeen);
        }
        await upsertParticipant(contact, client.id);
      } catch (err) {
        errors.push(`Contact ${contact.id}: ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }

    pagesProcessed++;
    await updateHeartbeat();

    if (reachedOldContacts) {
      console.log(`[process-jobs:contacts] Reached old contacts at page ${currentPage}, stopping.`);
      break;
    }

    const hasNextPage = pages?.next != null && pages.next !== '';
    if (!hasNextPage) break;

    currentPage++;
    if (pagesProcessed >= MAX_PAGES_PER_RUN) { hasMore = true; break; }
    await sleep(150);
  }

  // Post: update clients.metadata.last_seen_at
  for (const [clientId, lastSeen] of clientLastSeen) {
    try {
      const client = [...clientsBySlug.values()].find(c => c.id === clientId);
      const existingMeta = (client?.metadata ?? {}) as Record<string, unknown>;
      await supaAdmin.from('clients').update({ metadata: { ...existingMeta, last_seen_at: lastSeen.toISOString() } }).eq('id', clientId);
    } catch (err) {
      errors.push(`Update metadata ${clientId}: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // Grant access for new clients
  if (newClientIds.size > 0 && callerUserId) {
    const accessRows = [...newClientIds].map(clientId => ({ user_id: callerUserId, client_id: clientId, role: 'admin' }));
    for (let i = 0; i < accessRows.length; i += 100) {
      const batch = accessRows.slice(i, i + 100);
      const { error: accessErr } = await supaAdmin.from('user_client_access').upsert(batch, { onConflict: 'user_id,client_id', ignoreDuplicates: true });
      if (accessErr) errors.push(`user_client_access: ${accessErr.message}`);
    }
  }

  // Inactivation (only on final batch)
  if (!hasMore && !skipInactivation) {
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    await supaAdmin.from('clients').update({ active: false })
      .eq('active', true)
      .filter('metadata->>auto_created', 'eq', 'true')
      .filter('metadata->>last_seen_at', 'lt', ninetyDaysAgo);
  }

  return {
    has_more: hasMore,
    progress: {
      contacts_processed: contactsProcessed,
      contacts_unresolved: contactsUnresolved,
      clients_created: clientsCreated,
      participants_created: participantsCreated,
      participants_updated: participantsUpdated,
      next_page: hasMore ? currentPage : null,
      total_pages: totalPages,
      errors,
    },
  };
}

// ── Ingest Historical Handler ──

async function handleIngestHistorical(
  supaAdmin: any,
  apiKey: string,
  job: SyncJob,
  updateHeartbeat: () => Promise<void>,
): Promise<HandlerResult> {
  const progress = { ...(job.progress as any) };
  const startPage = (progress.next_page as number) || 1;
  const deleteClientId = (job.payload as any)?.delete_client_id;

  // Optional: delete interactions for a client before ingestion
  if (deleteClientId && startPage === 1) {
    const { error: delErr } = await supaAdmin.from('interactions').delete().eq('client_id', deleteClientId);
    if (delErr) return { has_more: false, progress, error: 'Delete failed: ' + delErr.message };
  }

  // Load bindings + participants
  const { data: bindings } = await supaAdmin.from('channel_bindings').select('id, client_id, active').eq('channel', 'gist').limit(500);
  const bindingByClientId = new Map<string, any>();
  for (const b of (bindings ?? [])) bindingByClientId.set(b.client_id, b);

  const { data: participants } = await supaAdmin.from('participants').select('id, client_id, side, identifiers').not('identifiers', 'is', null).limit(1000);
  const gistIdToParticipant = new Map<string, { participantId: string; clientId: string | null; side: string }>();
  for (const p of (participants ?? [])) {
    if (!p.identifiers) continue;
    for (const ident of p.identifiers) {
      if (ident.channel === 'gist') {
        gistIdToParticipant.set(ident.value, { participantId: p.id, clientId: p.client_id ?? null, side: p.side });
      }
    }
  }

  let messagesFetched = (progress.messages_fetched as number) || 0;
  let messagesInserted = (progress.messages_inserted as number) || 0;
  let messagesSkipped = (progress.messages_skipped as number) || 0;
  let messagesQuarantined = (progress.messages_quarantined as number) || 0;
  let conversationsFetched = (progress.conversations_fetched as number) || 0;
  const errors: string[] = [];
  let hasMore = false;
  let currentPage = startPage;
  let pagesProcessed = 0;
  let totalPagesCount = (progress.total_pages as number) || 0;

  // Incremental: skip conversations older than since_timestamp
  const sinceTs = (job.payload as any)?.since_timestamp;
  const sinceUnix = sinceTs ? Math.floor(new Date(sinceTs).getTime() / 1000) : 0;

  while (pagesProcessed < MAX_PAGES_PER_RUN) {
    const convosResponse = await gistGetWithRetry<GistConversationsResponse>(
      apiKey,
      `conversations?page=${currentPage}&per_page=20&state=all`,
    );

    const conversations = convosResponse.conversations ?? [];
    const totalPages = extractPageFromUrl(convosResponse.pages?.last);
    totalPagesCount = totalPages || totalPagesCount;
    const hasNextPage = !!convosResponse.pages?.next;

    console.log(`[process-jobs:history] Page ${currentPage}/${totalPagesCount} — ${conversations.length} convos (since=${sinceTs ?? 'full'})`);
    conversationsFetched += conversations.length;
    pagesProcessed++;

    let reachedOldData = false;
    for (const convo of conversations) {
      // Break entirely when we hit conversations older than our last sync
      if (sinceUnix > 0 && convo.updated_at < sinceUnix) {
        reachedOldData = true;
        break;
      }
      try {
        let msgPage = 1;
        let msgHasMore = true;
        const allMessages: GistMessage[] = [];

        while (msgHasMore) {
          const msgRes = await gistGetWithRetry<GistMessagesResponse>(
            apiKey,
            `conversations/${convo.id}/messages?page=${msgPage}&per_page=50`,
          );
          allMessages.push(...(msgRes.messages ?? []));
          msgHasMore = !!msgRes.pages?.next;
          msgPage++;
        }

        messagesFetched += allMessages.length;

        // Resolve client_id
        let resolvedClientId: string | null = null;
        let resolvedBindingId: string | null = null;
        const contactMsg = allMessages.find(m => m.author?.type === 'contact' || m.author?.type === 'user');
        if (contactMsg?.author?.id) {
          const info = gistIdToParticipant.get(String(contactMsg.author.id));
          if (info) {
            if (info.side === 'umode') { resolvedClientId = null; }
            else if (info.clientId) {
              resolvedClientId = info.clientId;
              resolvedBindingId = bindingByClientId.get(info.clientId)?.id ?? null;
            }
          }
        }

        if (!resolvedClientId) { messagesQuarantined += allMessages.length; await sleep(100); continue; }

        const rows = allMessages.map((msg) => {
          const isInbound = msg.is_inbound ?? (msg.author?.type === 'user' || msg.author?.type === 'contact');
          const senderSide = isInbound ? 'client' : 'umode';
          const senderGistId = msg.author?.id ? String(msg.author.id) : null;
          const senderInfo = senderGistId ? gistIdToParticipant.get(senderGistId) : undefined;
          return {
            channel: 'gist' as const,
            external_id: String(msg.id),
            client_id: resolvedClientId!,
            channel_binding_id: resolvedBindingId,
            content: msg.body ?? null,
            sender_side: senderSide,
            sender_raw: msg.author?.name ?? msg.author?.email ?? null,
            sender_participant_id: senderInfo?.participantId ?? null,
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
              .from('interactions').upsert(batch, { onConflict: 'channel,external_id' }).select('id');
            if (insertErr) errors.push(`Conv ${convo.id} batch ${i}: ${insertErr.message}`);
            else convoUpserted += (inserted ?? []).length;
          }
          messagesInserted += convoUpserted;
          messagesSkipped += Math.max(0, rows.length - convoUpserted);
        }
        await sleep(100);
      } catch (convoErr) {
        errors.push(`Conv ${convo.id}: ${convoErr instanceof Error ? convoErr.message : 'Unknown'}`);
      }
    }

    await updateHeartbeat();

    if (reachedOldData) {
      console.log(`[process-jobs:history] Reached old data at page ${currentPage}, stopping.`);
      break;
    }

    if (hasNextPage) {
      currentPage++;
      if (pagesProcessed >= MAX_PAGES_PER_RUN) { hasMore = true; break; }
    } else {
      break;
    }
  }

  return {
    has_more: hasMore,
    progress: {
      conversations_fetched: conversationsFetched,
      messages_fetched: messagesFetched,
      messages_inserted: messagesInserted,
      messages_skipped: messagesSkipped,
      messages_quarantined: messagesQuarantined,
      next_page: hasMore ? currentPage : null,
      total_pages: totalPagesCount,
      errors,
    },
  };
}

// ── Classify Batch Handler ──

const CLASSIFY_BATCH_SIZE = 20;

async function handleClassifyBatch(
  supaAdmin: any,
  job: SyncJob,
  updateHeartbeat: () => Promise<void>,
): Promise<HandlerResult> {
  const geminiKey = Deno.env.get('GEMINI_API_KEY');
  const claudeKey = Deno.env.get('CLAUDE_API_KEY');

  if (!geminiKey && !claudeKey) {
    return { has_more: false, progress: {}, error: 'Missing GEMINI_API_KEY and CLAUDE_API_KEY' };
  }

  // Fetch unclassified interactions
  const { data: rows, error: fetchErr } = await supaAdmin
    .from('interactions')
    .select('id, content, sender_side')
    .is('classified_at', null)
    .not('content', 'is', null)
    .neq('content', '')
    .gte('occurred_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
    .order('occurred_at', { ascending: false })
    .limit(CLASSIFY_BATCH_SIZE);

  if (fetchErr) {
    return { has_more: false, progress: {}, error: `Fetch error: ${fetchErr.message}` };
  }

  if (!rows || rows.length === 0) {
    console.log('[process-jobs:classify] No unclassified interactions found');
    return { has_more: false, progress: { classified: (job.progress as any)?.classified ?? 0, model_used: 'none' } };
  }

  console.log(`[process-jobs:classify] Processing ${rows.length} interactions`);

  const VALID_THEMES = [
    'integracao_erp', 'agendamento', 'permissoes', 'cobranca_followup',
    'gestao_demandas', 'workflow', 'importacao_dados', 'intermediacao',
    'bugs', 'criacao_campos', 'treinamento', 'elogio', 'governanca', 'outro',
  ] as const;

  const systemPrompt = `You are a customer interaction classifier for a B2B SaaS platform (fashion/textile industry). For each interaction, return a JSON array where each element has:
- "id": the interaction UUID (copy exactly from input)
- "theme": MUST be one of these exact slugs: ${VALID_THEMES.map(t => `"${t}"`).join(', ')}
- "theme_detail": a short description in Portuguese (max 50 chars) of the specific topic
- "tone": MUST be one of: "ok", "atencao", "alerta", "critico"
- "tone_detail": a short justification in Portuguese (max 80 chars) for the tone classification
- "sentiment": a number from -1.0 (very negative) to 1.0 (very positive)
- "is_out_of_scope": boolean, true if the message is automated/system/irrelevant (e.g. "joined the conversation", bot messages, empty messages)

CRITICAL: The "theme" field MUST be exactly one of the listed slugs. Do NOT invent new slugs.
Respond ONLY with the JSON array, no markdown or explanation.`;

  const userPrompt = JSON.stringify(rows.map((r: any) => ({ id: r.id, content: r.content, sender_side: r.sender_side })));

  let classifications: any[] | null = null;
  let modelUsed = '';

  // Try Gemini first
  if (geminiKey) {
    try {
      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: `${systemPrompt}\n\nInteractions:\n${userPrompt}` }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: 'ARRAY',
                items: {
                  type: 'OBJECT',
                  properties: {
                    id: { type: 'STRING' },
                    theme: { type: 'STRING', enum: [...VALID_THEMES] },
                    theme_detail: { type: 'STRING' },
                    tone: { type: 'STRING', enum: ['ok', 'atencao', 'alerta', 'critico'] },
                    tone_detail: { type: 'STRING' },
                    sentiment: { type: 'NUMBER' },
                    is_out_of_scope: { type: 'BOOLEAN' },
                  },
                  required: ['id', 'theme', 'tone', 'sentiment'],
                },
              },
            },
          }),
        },
      );
      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          classifications = JSON.parse(text);
          modelUsed = 'gemini-2.5-flash';
        }
      } else {
        console.error(`[process-jobs:classify] Gemini error: ${geminiRes.status} ${await geminiRes.text()}`);
      }
    } catch (err) {
      console.error(`[process-jobs:classify] Gemini exception: ${err instanceof Error ? err.message : err}`);
    }
  }

  // Fallback to Claude
  if (!classifications && claudeKey) {
    try {
      const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
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
        const claudeData = await claudeRes.json();
        const text = claudeData.content?.[0]?.text;
        if (text) {
          // Strip markdown fences if present
          const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
          classifications = JSON.parse(cleaned);
          modelUsed = 'claude-sonnet-4';
        }
      } else {
        console.error(`[process-jobs:classify] Claude error: ${claudeRes.status} ${await claudeRes.text()}`);
      }
    } catch (err) {
      console.error(`[process-jobs:classify] Claude exception: ${err instanceof Error ? err.message : err}`);
    }
  }

  if (!classifications || !Array.isArray(classifications)) {
    throw new Error('Both Gemini and Claude failed to classify interactions');
  }

  // Validate and sanitize themes — fallback invalid slugs to 'outro'
  const validThemeSet = new Set<string>(VALID_THEMES);
  for (const c of classifications) {
    if (c.theme && !validThemeSet.has(c.theme)) {
      console.warn(`[process-jobs:classify] Invalid theme "${c.theme}" for ${c.id}, falling back to "outro"`);
      c.theme = 'outro';
    }
  }

  // Update each interaction
  let classifiedCount = 0;
  const now = new Date().toISOString();

  for (const c of classifications) {
    if (!c.id) continue;
    const { error: updErr } = await supaAdmin
      .from('interactions')
      .update({
        theme: c.theme ?? null,
        theme_detail: c.theme_detail ?? null,
        tone: c.tone ?? 'ok',
        tone_detail: c.tone_detail ?? null,
        sentiment: c.sentiment ?? null,
        is_out_of_scope: c.is_out_of_scope ?? false,
        classified_at: now,
        classification_model: modelUsed,
      })
      .eq('id', c.id);
    if (updErr) {
      console.error(`[process-jobs:classify] Update error for ${c.id}: ${updErr.message}`);
    } else {
      classifiedCount++;
    }
  }

  await updateHeartbeat();

  const previousClassified = (job.progress as any)?.classified ?? 0;

  console.log(`[process-jobs:classify] Classified ${classifiedCount}/${rows.length} using ${modelUsed} (total: ${previousClassified + classifiedCount})`);

  return {
    has_more: rows.length === CLASSIFY_BATCH_SIZE,
    progress: {
      classified: previousClassified + classifiedCount,
      model_used: modelUsed,
    },
  };
}

// ── Main ──

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GIST_API_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!apiKey || !serviceKey || !supabaseUrl) {
      return new Response(JSON.stringify({ error: 'Missing env vars' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supaAdmin = createClient(supabaseUrl, serviceKey);

    // 1. Reset orphan jobs (running > 5min without heartbeat)
    const { data: orphans } = await supaAdmin
      .from('sync_jobs')
      .select('id, retry_count')
      .eq('status', 'running')
      .lt('heartbeat_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (orphans && orphans.length > 0) {
      console.log(`[process-jobs] Reset ${orphans.length} orphan job(s)`);
      for (const o of orphans) {
        await supaAdmin.from('sync_jobs').update({
          status: 'pending',
          retry_count: (o.retry_count ?? 0) + 1,
        }).eq('id', o.id);
      }
    }

    // Also handle orphans with null heartbeat_at that have been running > 5min
    await supaAdmin
      .from('sync_jobs')
      .update({ status: 'pending' })
      .eq('status', 'running')
      .is('heartbeat_at', null)
      .lt('started_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    // 2. Claim next job
    const { data: claimed, error: claimErr } = await supaAdmin.rpc('claim_next_job');
    if (claimErr) {
      console.error('[process-jobs] claim error:', claimErr.message);
      return new Response(JSON.stringify({ claimed: false, error: claimErr.message }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const job = (claimed && claimed.length > 0) ? claimed[0] as SyncJob : null;
    if (!job) {
      return new Response(JSON.stringify({ claimed: false }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`[process-jobs] Claimed job ${job.id} type=${job.type}`);

    // Heartbeat updater
    const updateHeartbeat = async () => {
      await supaAdmin.from('sync_jobs').update({ heartbeat_at: new Date().toISOString() }).eq('id', job.id);
    };

    let result: HandlerResult;

    try {
      switch (job.type) {
        case 'sync_contacts':
          result = await handleSyncContacts(supaAdmin, apiKey, job, updateHeartbeat);
          break;
        case 'ingest_historical':
          result = await handleIngestHistorical(supaAdmin, apiKey, job, updateHeartbeat);
          break;
        case 'classify_batch':
          result = await handleClassifyBatch(supaAdmin, job, updateHeartbeat);
          break;
        default:
          result = { has_more: false, progress: {}, error: `Unknown job type: ${job.type}` };
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      console.error(`[process-jobs] Handler error for job ${job.id}:`, msg);

      // Retry or fail
      const newRetry = (job.retry_count ?? 0) + 1;
      if (newRetry >= (job.max_retries ?? 3)) {
        await supaAdmin.from('sync_jobs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          progress: { ...(job.progress as any), error: msg },
          retry_count: newRetry,
        }).eq('id', job.id);
      } else {
        await supaAdmin.from('sync_jobs').update({
          status: 'pending',
          retry_count: newRetry,
          heartbeat_at: null,
          progress: { ...(job.progress as any), last_error: msg },
        }).eq('id', job.id);
      }

      return new Response(JSON.stringify({ claimed: true, job_id: job.id, error: msg }), {
        status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Update job based on result
    if (result.error) {
      const newRetry = (job.retry_count ?? 0) + 1;
      if (newRetry >= (job.max_retries ?? 3)) {
        await supaAdmin.from('sync_jobs').update({
          status: 'failed',
          completed_at: new Date().toISOString(),
          progress: result.progress,
          retry_count: newRetry,
        }).eq('id', job.id);
      } else {
        await supaAdmin.from('sync_jobs').update({
          status: 'pending',
          retry_count: newRetry,
          heartbeat_at: null,
          progress: result.progress,
        }).eq('id', job.id);
      }
    } else if (result.has_more) {
      // More work to do — back to pending, then auto-chain
      await supaAdmin.from('sync_jobs').update({
        status: 'pending',
        heartbeat_at: null,
        progress: result.progress,
      }).eq('id', job.id);

      // Auto-chain: fire-and-forget to process next batch immediately
      const selfUrl = `${supabaseUrl}/functions/v1/process-jobs`;
      fetch(selfUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}` },
        body: JSON.stringify({}),
      }).catch(() => {}); // ignore errors, pg_cron is the safety net
    } else {
      // Completed
      await supaAdmin.from('sync_jobs').update({
        status: 'completed',
        completed_at: new Date().toISOString(),
        progress: result.progress,
      }).eq('id', job.id);
    }

    return new Response(JSON.stringify({ claimed: true, job_id: job.id, result }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[process-jobs] Fatal error:', msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
