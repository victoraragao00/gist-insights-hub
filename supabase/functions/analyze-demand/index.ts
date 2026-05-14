import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN");
if (!ALLOWED_ORIGIN) {
  console.error("[SECURITY] ALLOWED_ORIGIN env var not configured");
}
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN ?? "",
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

  if (!ALLOWED_ORIGIN) {
    return new Response(
      JSON.stringify({ error: "Server misconfiguration: ALLOWED_ORIGIN not set" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
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
    const { demand_id } = await req.json();
    if (!demand_id) {
      return new Response(JSON.stringify({ error: "demand_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // ── 1. Fetch demand ──
    const { data: demand, error: demandErr } = await adminClient
      .from("demands")
      .select("title, description, expected_result, resolution, client_id")
      .eq("id", demand_id)
      .single();

    if (demandErr || !demand) {
      return new Response(JSON.stringify({ error: "Demand not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── 2. Client documents ──
    const { data: docs } = await adminClient
      .from("client_documents")
      .select("title, description, category")
      .eq("client_id", demand.client_id)
      .limit(20);

    const docsText = docs && docs.length > 0
      ? docs.map((d) => `- [${d.category}] ${d.title}${d.description ? `: ${d.description}` : ""}`).join("\n")
      : "Nenhum documento disponível";

    // ── 3. Client rules (active) ──
    const { data: clientRules } = await adminClient
      .from("client_rules")
      .select("description")
      .eq("client_id", demand.client_id)
      .eq("active", true)
      .limit(20);

    // ── 4. Global audit rules (active) ──
    const { data: auditRules } = await adminClient
      .from("audit_rules")
      .select("metric, operator, threshold, description")
      .eq("active", true)
      .is("client_id", null)
      .limit(20);

    const rulesLines: string[] = [];
    if (clientRules && clientRules.length > 0) {
      rulesLines.push("Regras do cliente:");
      clientRules.forEach((r) => rulesLines.push(`- ${r.description}`));
    }
    if (auditRules && auditRules.length > 0) {
      rulesLines.push("Regras globais de auditoria:");
      auditRules.forEach((r) => rulesLines.push(`- ${r.metric} ${r.operator} ${r.threshold}${r.description ? ` (${r.description})` : ""}`));
    }
    const rulesText = rulesLines.length > 0 ? rulesLines.join("\n") : "Nenhuma regra disponível";

    // ── 5. Linked conversations ──
    const { data: linkedInteractions } = await adminClient
      .from("demand_interactions")
      .select("interaction_id")
      .eq("demand_id", demand_id)
      .limit(100);

    let convsText = "Nenhuma conversa vinculada";
    if (linkedInteractions && linkedInteractions.length > 0) {
      const interactionIds = linkedInteractions.map((li) => li.interaction_id);
      const { data: messages } = await adminClient
        .from("interactions")
        .select("sender_raw, sender_side, content")
        .in("id", interactionIds)
        .order("occurred_at", { ascending: true })
        .limit(100);

      if (messages && messages.length > 0) {
        const stripHtml = (html: string | null) =>
          html ? html.replace(/<[^>]*>/g, "").trim() : "";

        const formatted = messages
          .map((m) => {
            const sender = m.sender_raw || (m.sender_side === "client" ? "Cliente" : "uMode");
            const content = stripHtml(m.content);
            return content ? `${sender} (${m.sender_side ?? "?"}): ${content}` : null;
          })
          .filter(Boolean)
          .join("\n");

        if (formatted) convsText = formatted;
      }
    }

    // ── 6. Resolution history ──
    const { data: history } = await adminClient
      .from("demands")
      .select("title, resolution")
      .eq("client_id", demand.client_id)
      .not("resolution", "is", null)
      .neq("id", demand_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const historyText = history && history.length > 0
      ? history.map((h) => `- ${h.title}: ${h.resolution}`).join("\n")
      : "Sem histórico disponível";

    // ── Build prompt ──
    const systemPrompt = `Você é um especialista em CX da uMode, empresa de tecnologia para o mercado têxtil/moda.

Analise o ticket abaixo e gere uma análise estruturada em português.

## TICKET
Título: ${demand.title}
Descrição: ${demand.description ?? "Não informada"}
Resultado Esperado: ${demand.expected_result ?? "Não informado"}

## DOCUMENTOS DO CLIENTE
${docsText}

## REGRAS DE NEGÓCIO
${rulesText}

## CONVERSAS VINCULADAS
${convsText}

## HISTÓRICO DE RESOLUÇÕES ANTERIORES
${historyText}

---

Responda APENAS em JSON válido, sem markdown, sem explicações fora do JSON:
{
  "problem_summary": "Resumo claro do problema real do cliente em 2-3 linhas",
  "suggested_resolution": "Sugestão concreta de como resolver, baseada no contexto disponível, em 3-5 linhas"
}`;

    // ── Call AI (Gemini + Claude fallback) ──
    const rawContent = await callAI(
      systemPrompt,
      "Analise este ticket e gere o JSON com problem_summary e suggested_resolution."
    );

    // ── Parse JSON response ──
    let problemSummary = "";
    let suggestedResolution = "";

    try {
      const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        problemSummary = parsed.problem_summary ?? "";
        suggestedResolution = parsed.suggested_resolution ?? "";
      }
    } catch {
      console.error("Failed to parse AI JSON response");
    }

    if (!problemSummary || !suggestedResolution) {
      problemSummary = problemSummary || rawContent.slice(0, 500) || "Não foi possível gerar análise";
      suggestedResolution = suggestedResolution || "Tente novamente ou analise manualmente.";
    }

    // ── Upsert analysis ──
    const contextUsed = {
      docs_count: docs?.length ?? 0,
      rules_count: (clientRules?.length ?? 0) + (auditRules?.length ?? 0),
      conversations_count: linkedInteractions?.length ?? 0,
      history_count: history?.length ?? 0,
    };

    const { data: upserted, error: upsertErr } = await adminClient
      .from("demand_ai_analyses")
      .upsert(
        {
          demand_id,
          problem_summary: problemSummary,
          suggested_resolution: suggestedResolution,
          context_used: contextUsed,
          generated_at: new Date().toISOString(),
          created_by: userId,
        },
        { onConflict: "demand_id" }
      )
      .select("problem_summary, suggested_resolution, generated_at")
      .single();

    if (upsertErr) {
      console.error("Upsert error:", upsertErr.message);
      return new Response(JSON.stringify({ error: "Failed to save analysis" }), {
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
