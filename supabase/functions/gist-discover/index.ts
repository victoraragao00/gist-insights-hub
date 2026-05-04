const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GIST_BASE = 'https://api.getgist.com';

interface GistContact {
  id: number;
  name: string | null;
  email: string | null;
  company_name: string | null;
  custom_properties?: { company_name?: string; [k: string]: unknown };
}

interface GistContactsResponse {
  contacts: GistContact[];
  pages: { total_count: number; per_page: number; page: number };
}

interface GistTeammate {
  id: number;
  name: string;
  email: string;
}

interface ContactGroup {
  // Group key: company_name when available, otherwise the email domain
  domain: string;
  company?: string;
  grouped_by: 'company_name' | 'domain';
  contacts: Array<{ id: number; name: string; email: string; company?: string }>;
  suggested_client_id?: string;
  suggested_client_name?: string;
}

async function gistGet<T>(apiKey: string, path: string, params?: Record<string, string>): Promise<T> {
  const qs = params ? '?' + new URLSearchParams(params).toString() : '';
  const res = await fetch(`${GIST_BASE}/${path}${qs}`, {
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
  });
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

    // JWT validation — identify the caller before using service_role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');

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

    // 1. Fetch ALL contacts from Gist with pagination
    const allContacts: GistContact[] = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
      const res = await gistGet<GistContactsResponse>(apiKey, 'contacts', {
        page: String(page),
        per_page: '60',
      });

      if (res.contacts && res.contacts.length > 0) {
        allContacts.push(...res.contacts);
        const totalPages = Math.ceil((res.pages?.total_count ?? 0) / 60);
        hasMore = page < totalPages;
        page++;
      } else {
        hasMore = false;
      }
    }

    // 2. Fetch ALL teammates
    const teammatesRes = await gistGet<{ teammates: GistTeammate[] } | GistTeammate[]>(apiKey, 'teammates');
    const teammates: GistTeammate[] = Array.isArray(teammatesRes)
      ? teammatesRes
      : (teammatesRes as { teammates: GistTeammate[] }).teammates ?? [];

    // 3. Group contacts by email domain
    const domainMap = new Map<string, ContactGroup>();

    for (const contact of allContacts) {
      const email = contact.email;
      if (!email || !email.includes('@')) continue;

      const domain = email.split('@')[1].toLowerCase();
      // Skip generic email providers
      const genericDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com', 'live.com', 'aol.com', 'protonmail.com', 'mail.com'];
      if (genericDomains.includes(domain)) continue;

      if (!domainMap.has(domain)) {
        domainMap.set(domain, {
          domain,
          company: contact.company_name ?? undefined,
          contacts: [],
        });
      }

      const group = domainMap.get(domain)!;
      group.contacts.push({
        id: contact.id,
        name: contact.name ?? contact.email ?? 'Sem nome',
        email: contact.email ?? '',
        company: contact.company_name ?? undefined,
      });

      if (!group.company && contact.company_name) {
        group.company = contact.company_name;
      }
    }

    // 4. Query clients table for similarity matching
    const supaAdmin = createClient(supabaseUrl, serviceKey);

    const { data: clients, error: clientsError } = await supaAdmin
      .from('clients')
      .select('id, name, slug')
      .limit(500);

    if (clientsError) {
      throw new Error('Failed to load clients: ' + clientsError.message);
    }

    const clientList = (clients ?? []) as Array<{ id: string; name: string; slug: string }>;

    // 5. Match domains to clients
    for (const [domain, group] of domainMap) {
      const domainParts = domain.replace(/\.(com|net|org|io|co|com\.br|app|dev|tech)(\..+)?$/i, '').toLowerCase();

      for (const client of clientList) {
        const nameMatch = client.name.toLowerCase().includes(domainParts) || domainParts.includes(client.name.toLowerCase().replace(/\s+/g, ''));
        const slugMatch = client.slug.toLowerCase().includes(domainParts) || domainParts.includes(client.slug.toLowerCase());

        if (nameMatch || slugMatch) {
          group.suggested_client_id = client.id;
          group.suggested_client_name = client.name;
          break;
        }
      }
    }

    const contactGroups = Array.from(domainMap.values()).sort((a, b) => b.contacts.length - a.contacts.length);

    const payload = {
      contact_groups: contactGroups,
      teammates: teammates.map((t) => ({ id: t.id, name: t.name, email: t.email })),
      total_contacts: allContacts.length,
      total_teammates: teammates.length,
    };

    return new Response(JSON.stringify(payload), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
