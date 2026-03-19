import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Use service role admin client (bypasses RLS for permission checks)
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller identity via anon client + JWT
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user: callerUser }, error: userErr } = await callerClient.auth.getUser();
    if (userErr || !callerUser) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin via service role (bypasses RLS — reliable)
    const { data: profile } = await adminClient
      .from("user_profiles")
      .select("global_role")
      .eq("id", callerUser.id)
      .maybeSingle();

    const { data: clientAccess } = await adminClient
      .from("user_client_access")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    const isAdmin = profile?.global_role === "admin" || clientAccess?.role === "admin";

    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem convidar usuários" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, role = "viewer", full_name } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "E-mail inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to invite
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: inviteData, error: inviteErr } = await adminClient.auth.admin.inviteUserByEmail(
      email.toLowerCase().trim(),
      {
        data: { full_name: full_name ?? null },
        redirectTo: `${req.headers.get("origin") ?? supabaseUrl}/`,
      }
    );

    if (inviteErr) {
      // If user already exists, that's okay — return a friendly message
      if (inviteErr.message?.toLowerCase().includes("already been registered")) {
        return new Response(
          JSON.stringify({ error: "Este e-mail já está cadastrado no sistema." }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw inviteErr;
    }

    // Create/update user_profile with desired role
    if (inviteData?.user?.id) {
      await adminClient.from("user_profiles").upsert(
        {
          id: inviteData.user.id,
          email: email.toLowerCase().trim(),
          full_name: full_name ?? null,
          global_role: role,
          active: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "id" }
      );
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro interno";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
