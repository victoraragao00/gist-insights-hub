const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface MappingItem {
  contact_id: number;
  contact_name: string;
  contact_email: string;
  mapping_type: 'existing' | 'new';
  existing_client_id?: string;
  new_client_name?: string;
  domain: string;
}

interface TeammateItem {
  teammate_id: number;
  name: string;
  email: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const supabaseUrl = Deno.env.get('SUPABASE_URL');

    if (!serviceKey || !supabaseUrl) {
      return new Response(JSON.stringify({ error: 'Missing environment variables' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Extract caller user_id from JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const token = authHeader.replace('Bearer ', '');
    let callerUserId: string | null = null;
    if (token) {
      try {
        const payloadB64 = token.split('.')[1];
        const payload = JSON.parse(atob(payloadB64));
        callerUserId = payload.sub ?? null;
      } catch {
        console.warn('Could not decode JWT');
      }
    }

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2');
    const supaAdmin = createClient(supabaseUrl, serviceKey);

    const body = await req.json() as { mappings: MappingItem[]; teammates: TeammateItem[] };
    const { mappings, teammates } = body;

    let clientsCreated = 0;
    let participantsUpserted = 0;
    let channelBindingsCreated = 0;

    // Track new clients by domain → client_id
    const domainClientMap = new Map<string, string>();

    // 1. Create new clients for "new" mappings (deduplicate by domain)
    const newDomains = new Map<string, string>();
    for (const m of mappings) {
      if (m.mapping_type === 'new' && m.new_client_name && !newDomains.has(m.domain)) {
        newDomains.set(m.domain, m.new_client_name);
      }
    }

    for (const [domain, clientName] of newDomains) {
      const slug = clientName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
      const { data: newClient, error: insertError } = await supaAdmin
        .from('clients')
        .upsert({ name: clientName, slug }, { onConflict: 'slug' })
        .select('id')
        .single();

      if (insertError) {
        console.error(`Failed to create client ${clientName}:`, insertError.message);
        continue;
      }

      domainClientMap.set(domain, newClient.id);
      clientsCreated++;

      // Grant caller access to new client
      if (callerUserId) {
        await supaAdmin.from('user_client_access').upsert({
          user_id: callerUserId,
          client_id: newClient.id,
          role: 'admin',
        }, { onConflict: 'user_id,client_id', ignoreDuplicates: true });
      }
    }

    // 2. Grant access to existing clients the caller maps to (if not already granted)
    if (callerUserId) {
      const existingClientIds = new Set<string>();
      for (const m of mappings) {
        if (m.mapping_type === 'existing' && m.existing_client_id) {
          existingClientIds.add(m.existing_client_id);
        }
      }
      for (const clientId of existingClientIds) {
        const { data: hasAccess } = await supaAdmin
          .from('user_client_access')
          .select('id')
          .eq('user_id', callerUserId)
          .eq('client_id', clientId)
          .limit(1);

        if (!hasAccess || hasAccess.length === 0) {
          await supaAdmin.from('user_client_access').upsert({
            user_id: callerUserId,
            client_id: clientId,
            role: 'admin',
          }, { onConflict: 'user_id,client_id', ignoreDuplicates: true });
        }
      }
    }

    // 3. Upsert contacts as participants
    for (const m of mappings) {
      let clientId: string | undefined;

      if (m.mapping_type === 'existing') {
        clientId = m.existing_client_id;
      } else if (m.mapping_type === 'new') {
        clientId = domainClientMap.get(m.domain);
      }

      if (!clientId) continue;

      const gistIdentifier = JSON.stringify([{ channel: 'gist', value: String(m.contact_id) }]);

      const { data: existing, error: lookupError } = await supaAdmin
        .from('participants')
        .select('id')
        .filter('identifiers', 'cs', gistIdentifier)
        .limit(1);

      if (lookupError) {
        console.error(`Lookup error for contact ${m.contact_id}:`, lookupError.message);
        continue;
      }

      if (existing && existing.length > 0) {
        const { error: updateError } = await supaAdmin
          .from('participants')
          .update({ name: m.contact_name, client_id: clientId, active: true })
          .eq('id', existing[0].id);

        if (updateError) {
          console.error(`Update error for participant ${existing[0].id}:`, updateError.message);
        }
      } else {
        const { error: insertError } = await supaAdmin
          .from('participants')
          .insert({
            name: m.contact_name,
            side: 'client',
            client_id: clientId,
            identifiers: [{ channel: 'gist', value: String(m.contact_id) }],
          });

        if (insertError) {
          console.error(`Insert error for contact ${m.contact_id}:`, insertError.message);
          continue;
        }
      }

      participantsUpserted++;
    }

    // 4. Upsert teammates as participants (side = 'umode', client_id = null)
    for (const t of teammates) {
      const gistIdentifier = JSON.stringify([{ channel: 'gist', value: String(t.teammate_id) }]);

      const { data: existing, error: lookupError } = await supaAdmin
        .from('participants')
        .select('id')
        .filter('identifiers', 'cs', gistIdentifier)
        .limit(1);

      if (lookupError) {
        console.error(`Teammate lookup error ${t.teammate_id}:`, lookupError.message);
        continue;
      }

      if (existing && existing.length > 0) {
        await supaAdmin
          .from('participants')
          .update({ name: t.name, active: true })
          .eq('id', existing[0].id);
      } else {
        const { error: insertError } = await supaAdmin
          .from('participants')
          .insert({
            name: t.name,
            side: 'umode',
            client_id: null,
            identifiers: [{ channel: 'gist', value: String(t.teammate_id) }],
          });

        if (insertError) {
          console.error(`Teammate insert error ${t.teammate_id}:`, insertError.message);
          continue;
        }
      }

      participantsUpserted++;
    }

    // 5. Create channel_bindings for each client that has gist contacts
    const clientsWithGist = new Set<string>();
    for (const m of mappings) {
      const cid = m.mapping_type === 'existing' ? m.existing_client_id : domainClientMap.get(m.domain);
      if (cid) clientsWithGist.add(cid);
    }

    for (const clientId of clientsWithGist) {
      const { data: existingBinding, error: bindLookupError } = await supaAdmin
        .from('channel_bindings')
        .select('id')
        .eq('client_id', clientId)
        .eq('channel', 'gist')
        .limit(1);

      if (bindLookupError) {
        console.error(`Binding lookup error for client ${clientId}:`, bindLookupError.message);
        continue;
      }

      if (existingBinding && existingBinding.length > 0) continue;

      const { error: bindInsertError } = await supaAdmin
        .from('channel_bindings')
        .upsert({
          client_id: clientId,
          channel: 'gist',
          channel_identifier: 'gist-workspace',
          label: 'Gist',
        }, { onConflict: 'client_id,channel', ignoreDuplicates: true });

      if (bindInsertError) {
        console.error(`Binding upsert error for client ${clientId}:`, bindInsertError.message);
        continue;
      }

      channelBindingsCreated++;
    }

    return new Response(
      JSON.stringify({
        clients_created: clientsCreated,
        participants_upserted: participantsUpserted,
        channel_bindings_created: channelBindingsCreated,
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
