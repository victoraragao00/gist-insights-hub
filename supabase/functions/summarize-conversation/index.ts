import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/** Call Gemini API directly, fallback to Claude if Gemini fails */
async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const claudeKey = Deno.env.get("CLAUDE_API_KEY");

  if (!geminiKey && !claudeKey) {
    throw new Error("Neither GEMINI_API_KEY nor CLAUDE_API_KEY configured");
  }

  // Try Gemini first
  if (geminiKey) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [
              { role: "user", parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] },
            ],
            generationConfig: { temperature: 0.3, maxOutputTokens: 1024 },
          }),
          signal: AbortSignal.timeout(55000),
        }
      );
      if (res.ok) {
        const data = await res.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        if (text) return text;
      }
      console.error("Gemini error:", res.status);
    } catch (e) {
      console.error("Gemini call failed:", e instanceof Error ? e.message : "unknown");
    }
  }

  // Fallback to Claude
  if (claudeKey) {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": claudeKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
      signal: AbortSignal.timeout(45000),
    });
    if (!res.ok) {
      const errText = await res.text();
      console.error("Claude error:", res.status, errText.slice(0, 200));
      throw new Error(`Claude API error: ${res.status}`);
    }
    const data = await res.json();
    return data?.content?.[0]?.text ?? "";
  }

  throw new Error("All AI providers failed");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = user.id;

    // ── Input ──
    const { demand_id, conversation_id } = await req.json();
    if (!demand_id || !conversation_id) {
      return new Response(JSON.stringify({ error: "demand_id and conversation_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Validar acesso do usuário à demand (userClient respeita RLS) ──
    const { data: demandCheck, error: demandAccessErr } = await userClient
      .from("demands")
      .select("id")
      .eq("id", demand_id)
      .single();

    if (demandAccessErr || !demandCheck) {
      return new Response(JSON.stringify({ error: "Access denied or demand not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch messages using service role ──
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: messages, error: msgErr } = await adminClient
      .from("interactions")
      .select("sender_raw, sender_side, content, occurred_at")
      .eq("conversation_id", conversation_id)
      .order("occurred_at", { ascending: true })
      .limit(200);

    if (msgErr) {
      console.error("Error fetching messages:", msgErr.message);
      return new Response(JSON.stringify({ error: "Failed to fetch messages" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!messages || messages.length === 0) {
      return new Response(JSON.stringify({ error: "No messages found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Strip HTML & format ──
    const stripHtml = (html: string | null) =>
      html ? html.replace(/<[^>]*>/g, "").trim() : "";

    const formatted = messages
      .map((m) => {
        const sender = m.sender_raw || (m.sender_side === "client" ? "Cliente" : "uMode");
        const content = stripHtml(m.content);
        return content ? `${sender}: ${content}` : null;
      })
      .filter(Boolean)
      .join("\n");

    if (!formatted) {
      return new Response(JSON.stringify({ error: "No text content in messages" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Call AI (Gemini + Claude fallback) ──
    const systemPrompt = `Você é um analista de CX da uMode, empresa de tecnologia para o mercado têxtil/moda.
Analise a conversa entre a uMode e um cliente e gere um resumo estruturado em português com:

1. **Problema/Solicitação:** O que o cliente trouxe ou pediu
2. **Encaminhamento dado:** Como a uMode respondeu ou encaminhou
3. **Status final:** Se foi resolvido, pendente ou sem resposta

Seja direto e objetivo. Máximo 4 linhas por item.`;

    const summary = await callAI(systemPrompt, `Resuma esta conversa:\n${formatted}`);

    if (!summary) {
      return new Response(JSON.stringify({ error: "Empty AI response" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Upsert summary ──
    const { data: upserted, error: upsertErr } = await adminClient
      .from("demand_conversation_summaries")
      .upsert(
        {
          demand_id,
          conversation_id,
          summary,
          generated_at: new Date().toISOString(),
          created_by: userId,
        },
        { onConflict: "demand_id,conversation_id" }
      )
      .select("summary, generated_at")
      .single();

    if (upsertErr) {
      console.error("Upsert error:", upsertErr.message);
      return new Response(JSON.stringify({ error: "Failed to save summary" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(upserted), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err instanceof Error ? err.message : "unknown");
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
