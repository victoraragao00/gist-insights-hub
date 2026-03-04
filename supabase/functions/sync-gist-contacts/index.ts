const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GIST_BASE = 'https://api.getgist.com';

const GENERIC_DOMAINS = new Set([
  'gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com',
  'live.com', 'uol.com.br', 'bol.com.br', 'terra.com.br', 'proton.me',
  'protonmail.com', 'aol.com', 'mail.com',
]);

const TWO_YEARS_MS = 2 * 365.25 * 24 * 60 * 60 * 1000;

interface GistContact {
  id: number;
  name: string;
  email: string;
  last_seen_at: number | string | null;
  custom_properties?: { company_name?: string; [k: string]: unknown };
  segments?: string[];
  tags?: string[];
}

interface GistContactsResponse {
  contacts: GistContact[];
  pages: { next?: string; page: number; per_page: number; total_pages: number; total_count: number };
}

interface SyncResult {
  contacts_processed: number;
  contacts_unresolved: number;
  clients_created: number;
  clients_updated: number;
  clients_inactivated: number;
  participants_created: number;
  participants_updated: number;
  errors: string[];
}

interface ClientRecord {
  id: string;
  name: string;
  slug: string;
  metadata: Record<string, unknown> | null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

async function gistGet<T>(apiKey: string, url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
  if (res.status === 429) throw { retryable: true, status: 429 };
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gist ${res.status}: ${text.substring(0, 200)}`);
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
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supaAdmin = createClient(supabaseUrl, serviceKey);

    // Auth: extract caller user_id
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supaAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supaAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const callerUserId = claimsData.claims.sub as string;

    // 1. Pre-load all clients
    const clientsBySlug = new Map<string, ClientRecord>();
    const { data: existingClients } = await supaAdmin
      .from('clients').select('id, name, slug, metadata').limit(2000);
    for (const c of (existingClients ?? []) as ClientRecord[]) {
      clientsBySlug.set(c.slug, c);
    }

    const result: SyncResult = {
      contacts_processed: 0,
      contacts_unresolved: 0,
      clients_created: 0,
      clients_updated: 0,
      clients_inactivated: 0,
      participants_created: 0,
      participants_updated: 0,
      errors: [],
    };

    const clientLastSeen = new Map<string, Date>(); // client_id → most recent last_seen_at
    const newClientIds = new Set<string>(); // track newly created clients for user_client_access

    // Helper: find or create client by slug
    async function findOrCreateClient(name: string, slug: string): Promise<ClientRecord> {
      const existing = clientsBySlug.get(slug);
      if (existing) {
        result.clients_updated++;
        return existing;
      }

      const { data: inserted, error: insertErr } = await supaAdmin
        .from('clients')
        .upsert({
          name,
          slug,
          active: true,
          metadata: { auto_created: true, source: 'gist_sync' },
        }, { onConflict: 'slug' })
        .select('id, name, slug, metadata')
        .single();

      if (insertErr) throw new Error(`Client upsert failed for ${slug}: ${insertErr.message}`);

      const record = inserted as ClientRecord;
      clientsBySlug.set(slug, record);
      newClientIds.add(record.id);
      result.clients_created++;
      return record;
    }

    // Helper: upsert participant
    async function upsertParticipant(contact: GistContact, clientId: string | null) {
      const gistIdStr = String(contact.id);
      const identifierFilter = JSON.stringify([{ channel: 'gist', value: gistIdStr }]);

      const { data: existing } = await supaAdmin
        .from('participants')
        .select('id')
        .filter('identifiers', 'cs', identifierFilter)
        .limit(1);

      const participantName = contact.name || contact.email || `Gist #${contact.id}`;

      if (existing && existing.length > 0) {
        await supaAdmin
          .from('participants')
          .update({ name: participantName })
          .eq('id', existing[0].id);
        result.participants_updated++;
      } else {
        const { error: insErr } = await supaAdmin
          .from('participants')
          .insert({
            name: participantName,
            side: 'client',
            client_id: clientId,
            identifiers: [{ channel: 'gist', value: gistIdStr }],
            active: true,
          });
        if (insErr) {
          result.errors.push(`Participant insert ${gistIdStr}: ${insErr.message}`);
        } else {
          result.participants_created++;
        }
      }
    }

    // 2. Paginate ALL Gist contacts
    let nextUrl: string | null = `${GIST_BASE}/contacts?order_by=last_seen_at&order=desc&per_page=60&page=1`;
    const cutoffDate = new Date(Date.now() - TWO_YEARS_MS);

    while (nextUrl) {
      let contactsRes: GistContactsResponse;
      try {
        contactsRes = await gistGet<GistContactsResponse>(apiKey, nextUrl);
      } catch (err: unknown) {
        if (err && typeof err === 'object' && 'retryable' in err) {
          await sleep(2000);
          contactsRes = await gistGet<GistContactsResponse>(apiKey, nextUrl);
        } else {
          throw err;
        }
      }

      const contacts = contactsRes.contacts ?? [];
      if (contacts.length === 0) break;

      // Check if last contact on page is too old
      const lastContact = contacts[contacts.length - 1];
      const lastSeen = parseLastSeen(lastContact.last_seen_at);
      if (lastSeen && lastSeen < cutoffDate) {
        // Process this page but stop after
        await processContacts(contacts, clientLastSeen, result);
        break;
      }

      await processContacts(contacts, clientLastSeen, result);

      // Next page
      if (contactsRes.pages?.next) {
        nextUrl = contactsRes.pages.next.startsWith('http')
          ? contactsRes.pages.next
          : `${GIST_BASE}${contactsRes.pages.next}`;
      } else if (contactsRes.pages.page < contactsRes.pages.total_pages) {
        nextUrl = `${GIST_BASE}/contacts?order_by=last_seen_at&order=desc&per_page=60&page=${contactsRes.pages.page + 1}`;
      } else {
        nextUrl = null;
      }

      await sleep(150);
    }

    // Process contacts helper (defined inline to share closure)
    async function processContacts(
      contacts: GistContact[],
      clientLastSeen: Map<string, Date>,
      result: SyncResult,
    ) {
      for (const contact of contacts) {
        try {
          result.contacts_processed++;
          const contactLastSeen = parseLastSeen(contact.last_seen_at);

          // Resolve company
          let companyName: string | null = null;
          let slug: string | null = null;

          // P1: custom_properties.company_name
          const cpCompany = contact.custom_properties?.company_name;
          if (cpCompany && typeof cpCompany === 'string' && cpCompany.trim()) {
            companyName = cpCompany.trim();
            slug = toSlug(companyName);
          }

          // P2: email domain
          if (!slug && contact.email?.includes('@')) {
            const domain = contact.email.split('@')[1].toLowerCase();
            if (!GENERIC_DOMAINS.has(domain)) {
              // Try matching existing client by slug similarity
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
              if (!matched) {
                companyName = domain;
                slug = toSlug(domain);
              }
            }
          }

          // P3: unresolvable
          if (!slug) {
            result.contacts_unresolved++;
            await upsertParticipant(contact, null);
            continue;
          }

          // Find or create client
          const client = await findOrCreateClient(companyName!, slug);

          // Track last_seen_at per client
          if (contactLastSeen) {
            const current = clientLastSeen.get(client.id);
            if (!current || contactLastSeen > current) {
              clientLastSeen.set(client.id, contactLastSeen);
            }
          }

          // Upsert participant
          await upsertParticipant(contact, client.id);
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          result.errors.push(`Contact ${contact.id}: ${msg}`);
        }
      }
    }

    // Post-loop: update clients.metadata.last_seen_at
    for (const [clientId, lastSeen] of clientLastSeen) {
      try {
        const client = [...clientsBySlug.values()].find(c => c.id === clientId);
        const existingMeta = (client?.metadata ?? {}) as Record<string, unknown>;
        await supaAdmin
          .from('clients')
          .update({ metadata: { ...existingMeta, last_seen_at: lastSeen.toISOString() } })
          .eq('id', clientId);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        result.errors.push(`Update metadata ${clientId}: ${msg}`);
      }
    }

    // Grant user_client_access for new clients
    if (newClientIds.size > 0) {
      const accessRows = [...newClientIds].map(clientId => ({
        user_id: callerUserId,
        client_id: clientId,
        role: 'admin',
      }));

      // Batch in chunks of 100
      for (let i = 0; i < accessRows.length; i += 100) {
        const batch = accessRows.slice(i, i + 100);
        const { error: accessErr } = await supaAdmin
          .from('user_client_access')
          .upsert(batch, { onConflict: 'user_id,client_id', ignoreDuplicates: true });
        if (accessErr) {
          result.errors.push(`user_client_access: ${accessErr.message}`);
        }
      }
    }

    // Inactivate auto-created clients not seen in >90 days
    const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { data: inactivated, error: inactErr } = await supaAdmin
      .from('clients')
      .update({ active: false })
      .eq('active', true)
      .filter('metadata->>auto_created', 'eq', 'true')
      .filter('metadata->>last_seen_at', 'lt', ninetyDaysAgo)
      .select('id');

    if (inactErr) {
      result.errors.push(`Inactivation: ${inactErr.message}`);
    } else {
      result.clients_inactivated = (inactivated ?? []).length;
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
