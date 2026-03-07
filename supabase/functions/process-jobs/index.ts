const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GIST_BASE = 'https://api.getgist.com';
const MAX_PAGES_PER_RUN = 5;
const MAX_BATCHES_PER_JOB = 50; // 50 × 20 = 1,000 interactions per job

// ── JSON parse with truncation recovery ──

function parseWithRecovery(text: string): any[] {
  try {
    return JSON.parse(text);
  } catch (_firstErr) {
    // Gemini sometimes truncates the JSON array — try to recover
    const lastBrace = text.lastIndexOf('}');
    if (lastBrace > 0) {
      const recovered = text.substring(0, lastBrace + 1) + ']';
      try {
        const result = JSON.parse(recovered);
        if (Array.isArray(result)) {
          console.warn(`[parseWithRecovery] Recovered ${result.length} items from truncated JSON`);
          return result;
        }
      } catch (_recoveryErr) {
        // fall through
      }
    }
    throw new Error(`JSON parse failed and recovery unsuccessful. First 200 chars: ${text.substring(0, 200)}`);
  }
}

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
            conversation_id: convo.id ? String(convo.id) : null,
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

// ── Classify Batch Handler (conversation-level) ──

const CLASSIFY_CONV_BATCH_SIZE = 10; // 10 conversations per batch

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

  // Auto-chain limit
  const previousProgress = job.progress as Record<string, unknown>;
  const batchesProcessed = ((previousProgress?.batches_processed as number) ?? 0) + 1;
  if (batchesProcessed > MAX_BATCHES_PER_JOB) {
    console.log(`[process-jobs:classify] Hit MAX_BATCHES_PER_JOB (${MAX_BATCHES_PER_JOB}), letting cron create a new job.`);
    return { has_more: false, progress: { ...previousProgress, batches_processed: batchesProcessed - 1 } };
  }

  // 1. Find conversations that have unclassified messages
  const { data: convRows, error: convErr } = await supaAdmin
    .from('interactions')
    .select('conversation_id')
    .is('classified_at', null)
    .not('content', 'is', null)
    .neq('content', '')
    .not('conversation_id', 'is', null)
    .gte('occurred_at', new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString())
    .order('occurred_at', { ascending: false })
    .limit(200);

  if (convErr) {
    return { has_more: false, progress: {}, error: `Fetch error: ${convErr.message}` };
  }

  const distinctConvIds = [...new Set((convRows ?? []).map((r: { conversation_id: string }) => r.conversation_id).filter(Boolean))];
  const batchConvIds = distinctConvIds.slice(0, CLASSIFY_CONV_BATCH_SIZE);

  if (batchConvIds.length === 0) {
    console.log('[process-jobs:classify] No unclassified conversations found');
    return { has_more: false, progress: { classified: (previousProgress?.classified as number) ?? 0, model_used: 'none' } };
  }

  console.log(`[process-jobs:classify] Processing ${batchConvIds.length} conversations (batch ${batchesProcessed}/${MAX_BATCHES_PER_JOB})`);

  // 2. Fetch all messages for these conversations
  const { data: allMessages, error: msgErr } = await supaAdmin
    .from('interactions')
    .select('id, content, sender_side, occurred_at, conversation_id')
    .in('conversation_id', batchConvIds)
    .not('content', 'is', null)
    .order('occurred_at', { ascending: true });

  if (msgErr) {
    return { has_more: false, progress: {}, error: `Messages fetch error: ${msgErr.message}` };
  }

  // Group by conversation
  const conversations = new Map<string, Array<{ id: string; content: string; sender_side: string; occurred_at: string; conversation_id: string }>>();
  for (const msg of (allMessages ?? [])) {
    if (!conversations.has(msg.conversation_id)) conversations.set(msg.conversation_id, []);
    conversations.get(msg.conversation_id)!.push(msg);
  }

  // 3. Build prompt
  const VALID_THEMES = [
    'integracao_erp', 'agendamento', 'permissoes', 'cobranca_followup',
    'gestao_demandas', 'workflow', 'importacao_dados', 'intermediacao',
    'bugs', 'criacao_campos', 'treinamento', 'elogio', 'governanca', 'outro',
  ] as const;

  const systemPrompt = `Você é um classificador especializado de conversas de suporte B2B para a uMode Tecnologia — plataforma PLM/gestão de coleções para marcas de moda e têxtil do Brasil (clientes como Grupo Soma, Reserva, NK Store, Caedu).

Seu trabalho é analisar conversas entre clientes e o time de suporte uMode e retornar uma classificação estruturada em JSON.

---

## CONTEXTO DO PRODUTO E RELAÇÃO

- uMode é um SaaS B2B. Os usuários são profissionais de moda (estilistas, analistas, coordenadores de coleção) — não são desenvolvedores.
- O canal principal de suporte é chat assíncrono (Gist). As conversas são em português brasileiro, com erros de digitação e linguagem informal.
- A relação é comercial e de longo prazo. Pressão por prazo é comum e legítima — o negócio de moda tem calendários rígidos (coleções, faturamento, OP).
- O time uMode responde de forma cordial, usa emojis, e frequentemente diz "vou verificar" antes de resolver.

---

## FORMATO DE ENTRADA

Você receberá um array de conversas. Cada conversa tem:
- conversation_id: string identificadora
- messages: array de mensagens com { sender: "client" | "umode", content: string, timestamp: ISO8601 }

As mensagens estão em ordem cronológica.

---

## FORMATO DE SAÍDA

Retorne um JSON array com um objeto por conversa:

[
  {
    "conversation_id": "string",
    "theme": "slug_do_tema",
    "theme_detail": "descrição de 1 linha do assunto específico",
    "tone": "ok | atencao | alerta | critico",
    "tone_detail": "justificativa de 1 linha baseada em evidência textual",
    "sentiment": número de -1.0 a 1.0,
    "is_out_of_scope": boolean
  }
]

---

## TEMAS VÁLIDOS E CRITÉRIOS DE DESAMBIGUAÇÃO

Use exatamente um dos slugs abaixo. Quando a conversa tiver múltiplos temas, escolha o predominante (maior volume de troca ou maior impacto operacional).

**integracao_erp**
Sincronização de dados entre uMode e ERP (Linx, SAP, etc): produtos, materiais, cores, variantes, rotas, fornecedores, referências, ordens de produção.
→ USE quando o problema é: dado existe em um sistema mas não aparece no outro; forçar fila de integração; erro de integração parcial.

**bugs**
Funcionalidade da plataforma uMode não opera como esperado: página não carrega, filtro trava, fotos não exibem, relatório não gera, campo some, ação não salva.
→ USE quando: algo que funcionava parou de funcionar, ou o comportamento é claramente diferente do esperado pelo produto.
→ NÃO CONFUNDA com integracao_erp (problema de sincronização com ERP externo) nem com permissoes (acesso bloqueado por configuração).

**permissoes**
Usuário não consegue acessar o sistema, uma tela, ou um campo — por motivo de configuração de perfil, ausência de cadastro, e-mail de confirmação, ou restrição de permissão.
→ USE quando: "não estou cadastrado", "não recebi e-mail de confirmação", "não tenho permissão para integrar", "preciso de perfil com acesso a X".
→ NÃO CONFUNDA com bugs (funcionalidade quebrada) nem com criacao_campos (criação de nova regra de negócio).

**criacao_campos**
Cliente solicita criação ou alteração de campos, opções, composições, famílias, categorias, perfis de permissão ou qualquer configuração de estrutura de dados na plataforma.
→ USE quando: "quero cadastrar uma nova opção em um campo", "criar nova família de produto", "criar composição de custos", "travar campo para determinados usuários".

**treinamento**
Cliente tem dúvida sobre como usar uma funcionalidade existente que opera normalmente.
→ USE quando: "onde encontro X", "como faço Y", "não sei usar Z".

**gestao_demandas**
Solicitações de execução de ações operacionais pelo time uMode: forçar geração de mapa, processar lote, executar rotina manual, acompanhar entrega de demanda já aberta.

**governanca**
Comunicações sobre processos, políticas ou mudanças da plataforma: novo fluxo de login, avisos de manutenção, horário de atendimento, instruções de onboarding.

**agendamento**
Marcação de reunião, treinamento, call de alinhamento.

**cobranca_followup**
Assuntos financeiros, contratos, renovação, inadimplência.

**workflow**
Dúvidas ou problemas relacionados ao fluxo de aprovação, status de produto, etapas de coleção dentro da plataforma.

**importacao_dados**
Importação em massa de dados via planilha ou arquivo externo para dentro da uMode.

**intermediacao**
Suporte intermediando entre cliente e terceiro (TI do cliente, fornecedor, outro sistema).

**elogio**
Conversa predominantemente positiva, feedback de satisfação sem demanda técnica.

**outro**
Use apenas quando nenhum dos anteriores se aplica com clareza.

---

## CLASSIFICAÇÃO DE TOM

O tom representa a qualidade da comunicação interpessoal na conversa — não a gravidade técnica do problema. Um bug crítico de negócio pode ter tom "ok" se o cliente se comunicar de forma respeitosa.

### Regra fundamental
Avalie o ARCO COMPLETO da conversa, não mensagens isoladas. Uma mensagem carregada no meio da conversa pode ser contextualizada por um encerramento cordial. O tom predominante ao longo do tempo é o que conta.

### ok
A comunicação é profissional, colaborativa e respeitosa de ambos os lados.
- SINAIS PRESENTES: saudações ("bom dia", "oi"), agradecimentos ("obrigada", "boa"), encerramento positivo, linguagem de pedido ("poderia verificar", "consegue me ajudar").
- SINAIS AUSENTES: cobrança direta, linguagem imperativa, frustração explícita.
- INCLUI: urgência operacional legítima com tom cortês. Exemplo: "preciso liberar esse produto para o motorista retirar" com tom educado = ok.
- INCLUI: múltiplas solicitações do mesmo tipo (forçar integração repetidamente) quando feitas de forma cordial.
- INCLUI: conversas que terminam com "obrigada" ou "deu certo" mesmo que tenham tido um problema real no meio.

### atencao
Há sinais de impaciência, pressão ou urgência que começam a afetar o tom, mas sem agressividade ou desrespeito.
- SINAIS PRESENTES: "preciso disso com urgência", "já faz um tempo", "consegue me dar um retorno", uso de caps lock pontual, follow-up após demora sem resposta.
- SINAIS AUSENTES: desqualificação do trabalho do time, ultimatos, linguagem agressiva.
- NOTA: cliente que manda "????" após silêncio prolongado = atencao, não alerta.
- NOTA: urgência legítima ("já estou de férias e preciso resolver hoje") = atencao se sem agressividade.

### alerta
Agressividade passiva, desqualificação do trabalho, ultimatos ou linguagem que pressiona além do razoável.
- SINAIS PRESENTES: "vocês nunca resolvem", "isso está acontecendo desde ontem e foi resolvido temporariamente", ultimatos ("não vou trabalhar mais amanhã por causa disso"), cobrança direta de responsabilidade.
- SINAIS AUSENTES: ofensas diretas, ataques pessoais.
- DISTINGUIR DE CRITICO: se o cliente ainda demonstra consciência do tom ("me desculpa", "não quero ser grossa"), é alerta, não crítico.

### critico
Ofensas diretas, ameaças, linguagem abusiva, ataque pessoal ao atendente.
- SINAIS PRESENTES: xingamentos, ameaças de cancelamento com tom agressivo, desrespeito nominalmente direcionado a uma pessoa.
- NOTA IMPORTANTE: frustração com pedido de desculpas NÃO é crítico. Exemplo: "desculpa não quero ser grossa, mas já mandei explicando, enviei vídeo..." = alerta, não crítico. O autocorretivo é evidência de autocontrole.
- CRITICO é raro. Se você está em dúvida entre alerta e critico, escolha alerta.

---

## SENTIMENTO (-1.0 a 1.0)

Representa o estado emocional geral da conversa, ponderando início, meio e fim.

- 0.8 a 1.0: Conversa positiva, cliente satisfeito, problema resolvido com louvor.
- 0.4 a 0.7: Conversa funcional, resolvida, encerramento positivo.
- 0.0 a 0.3: Neutro; problema relatado, sem sinal claro de satisfação ou insatisfação.
- -0.1 a -0.3: Leve insatisfação; demora, problema não totalmente resolvido.
- -0.4 a -0.6: Frustração clara; problema persistente, múltiplos follow-ups, sem resolução no período da conversa.
- -0.7 a -1.0: Reserve para conversas com linguagem muito negativa, tom alerta/crítico, sem resolução.

REGRA: Conversas que terminam com "obrigada", "deu certo", "boa!" não devem ter sentimento abaixo de 0.3, mesmo que o problema tenha levado tempo para resolver.
REGRA: Não force sentimento negativo apenas porque o tema é técnico ou há muitas mensagens.

---

## REGRAS DE CALIBRAÇÃO ANTI-VIÉS

Estas regras corrigem erros sistemáticos. Aplique-as ativamente:

Regra 1 — Urgência ≠ Agressão: Pressão de prazo operacional (motorista, faturamento, OP, férias terminando) com linguagem cortês = tom "ok". A urgência é do negócio, não uma agressão ao atendente.

Regra 2 — Volume ≠ Pressão Adversarial: 10 solicitações de forçar integração em uma semana, todas feitas com "bom dia" e "obrigada", = tom "ok". Frequência de contato reflete necessidade operacional, não hostilidade.

Regra 3 — Persistência por Não-Resolução ≠ Cobrança Agressiva: Cliente que retorna após 2 dias sem resposta dizendo "Oi, notícias da Regata Grass?" = tom "ok" ou no máximo "atencao". Não é alerta.

Regra 4 — Encerramento Positivo Ancora o Tom: Se a conversa termina com agradecimento, "deu certo" ou emoji positivo, o tom máximo é "atencao", mesmo que o meio tenha sido tenso. Encerramento positivo é o sinal mais forte do estado real da relação.

Regra 5 — Autocorretivo Bloqueia "Critico": Se o cliente diz "não quero ser grossa", "me desculpa a sinceridade", "desculpa a pressão" — isso é evidência de autocontrole. Teto = alerta.

Regra 6 — Caps Lock Pontual ≠ Agressão: Uma mensagem em caps ("ELA DISSE QUE TEM SIM") sem contexto hostil é ênfase, não agressão. Caps lock generalizado ao longo da conversa pode indicar atencao.

Regra 7 — Tema: Funcionalidade Quebrada = bugs: Se algo que funcionava parou de funcionar, ou a plataforma exibe comportamento inesperado, classifique como bugs — mesmo que o cliente não use essa palavra. Não use permissoes nem integracao_erp para isso.

Regra 8 — Tema Predominante, Não Primeiro: Se a conversa começa com um tema e migra para outro mais relevante, classifique pelo tema com mais volume ou maior impacto operacional discutido.

---

## PROCESSO DE CLASSIFICAÇÃO

Para cada conversa, siga esta sequência mental:

1. LEIA TUDO em ordem cronológica antes de classificar.
2. IDENTIFIQUE o tema principal (o que mais consumiu a conversa).
3. AVALIE o arco emocional: como começa, como evolui, como termina.
4. APLIQUE as regras anti-viés antes de finalizar o tom.
5. CALIBRE o sentimento com base no encerramento, não apenas no pico de tensão.
6. VERIFIQUE: Se você está classificando "alerta" ou "critico", consiga citar a frase exata que justifica isso. Se não conseguir, rebaixe para "atencao".

---

Retorne apenas o JSON array. Sem texto adicional, sem markdown, sem explicações fora do JSON.`;

  const conversationPayload = Array.from(conversations.entries()).map(([convId, msgs]) => ({
    conversation_id: convId,
    messages: msgs.map(m => ({
      sender: m.sender_side,
      content: m.content,
      timestamp: m.occurred_at,
    })),
  }));

  const userPrompt = JSON.stringify(conversationPayload);

  let classifications: Array<{ conversation_id: string; theme?: string; theme_detail?: string; tone?: string; tone_detail?: string; sentiment?: number; is_out_of_scope?: boolean }> | null = null;
  let modelUsed = '';
  let fallbackReason: string | null = null;

  // Try Gemini first
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
                    theme: { type: 'STRING', enum: [...VALID_THEMES] },
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
        const geminiData = await geminiRes.json();
        const candidate = geminiData.candidates?.[0];
        const finishReason = candidate?.finishReason;
        const safetyRatings = candidate?.safetyRatings;

        console.log(`[process-jobs:classify] Gemini finishReason=${finishReason}, safetyRatings=${JSON.stringify(safetyRatings ?? [])}`);

        if (finishReason === 'SAFETY') {
          console.warn(`[process-jobs:classify] Gemini blocked by safety filter. Marking batch with defaults.`);
          classifications = batchConvIds.map((convId: string) => ({
            conversation_id: convId,
            theme: 'outro',
            theme_detail: 'Bloqueado por filtro de segurança',
            tone: 'ok',
            tone_detail: 'Classificação padrão (safety filter)',
            sentiment: 0,
            is_out_of_scope: true,
          }));
          modelUsed = 'gemini-safety-default';
        } else {
          const text = candidate?.content?.parts?.[0]?.text;
          if (text) {
            classifications = parseWithRecovery(text);
            modelUsed = 'gemini-2.5-pro';
            console.log(`[process-jobs:classify] Gemini returned ${classifications?.length ?? 0} classifications`);
          } else {
            console.warn(`[process-jobs:classify] Gemini returned no text. Candidate: ${JSON.stringify(candidate)}`);
          }
        }
      } else {
        const errBody = await geminiRes.text();
        fallbackReason = `gemini_http_${geminiRes.status}`;
        console.error(`[process-jobs:classify] Gemini HTTP ${geminiRes.status}: ${errBody.substring(0, 500)}`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      fallbackReason = msg.includes('timed out') ? 'gemini_timeout' : `gemini_exception: ${msg.substring(0, 100)}`;
      console.error(`[process-jobs:classify] Gemini exception: ${msg}`);
    }
  }

  // Fallback to Claude
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
        const claudeData = await claudeRes.json();
        const text = claudeData.content?.[0]?.text;
        if (text) {
          const cleaned = text.replace(/^```json?\s*/i, '').replace(/\s*```$/i, '').trim();
          classifications = parseWithRecovery(cleaned);
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
    throw new Error('Both Gemini and Claude failed to classify conversations');
  }

  // Filter: keep only classifications for conversation_ids we requested
  classifications = classifications.filter((c) => c.conversation_id && batchConvIds.includes(c.conversation_id));

  // Validate and sanitize themes
  const validThemeSet = new Set<string>(VALID_THEMES);
  for (const c of classifications) {
    if (c.theme && !validThemeSet.has(c.theme)) {
      console.warn(`[process-jobs:classify] Invalid theme "${c.theme}" for conv ${c.conversation_id}, falling back to "outro"`);
      c.theme = 'outro';
    }
  }

  // 6. Propagate classification to all messages in each conversation
  let classifiedCount = 0;
  const now = new Date().toISOString();

  for (const c of classifications) {
    if (!c.conversation_id) continue;
    const convMsgs = conversations.get(c.conversation_id);
    if (!convMsgs) continue;

    const msgIds = convMsgs.map((m) => m.id);

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
      .in('id', msgIds);

    if (updErr) {
      console.error(`[process-jobs:classify] Update error for conv ${c.conversation_id}: ${updErr.message}`);
    } else {
      classifiedCount += convMsgs.length;
    }
  }

  await updateHeartbeat();

  const previousClassified = (previousProgress?.classified as number) ?? 0;

  console.log(`[process-jobs:classify] Classified ${classifiedCount} msgs across ${classifications.length} conversations using ${modelUsed} (total: ${previousClassified + classifiedCount})`);

  // Track fallback stats cumulatively
  const prevFallbacks = (previousProgress?.fallback_reasons as Record<string, number>) ?? {};
  if (fallbackReason) {
    prevFallbacks[fallbackReason] = (prevFallbacks[fallbackReason] ?? 0) + 1;
  }

  return {
    has_more: distinctConvIds.length > CLASSIFY_CONV_BATCH_SIZE,
    progress: {
      classified: previousClassified + classifiedCount,
      conversations_processed: ((previousProgress?.conversations_processed as number) ?? 0) + batchConvIds.length,
      batches_processed: batchesProcessed,
      model_used: modelUsed,
      ...(fallbackReason ? { last_fallback_reason: fallbackReason } : {}),
      fallback_reasons: prevFallbacks,
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
