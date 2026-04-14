import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Call Gemini API directly, fallback to Claude if Gemini fails */
async function callAI(systemPrompt: string, userPrompt: string, maxTokens = 2048): Promise<string> {
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
            generationConfig: { temperature: 0.3, maxOutputTokens: maxTokens },
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
        max_tokens: maxTokens,
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
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    // JWT validation
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    const supaAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: authData, error: authError } = await supaAuth.auth.getUser();
    if (authError || !authData.user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { agenda_id, transcription, objective, context_notes, next_steps } = await req.json();

    const hasContent = transcription?.trim() || objective?.trim() || context_notes?.trim() || next_steps?.trim();
    if (!agenda_id || !hasContent) {
      return new Response(
        JSON.stringify({ error: "agenda_id e pelo menos um campo de conteúdo são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build context block
    const contextParts: string[] = [];
    if (objective?.trim()) contextParts.push(`Objetivo: ${objective.trim()}`);
    if (context_notes?.trim()) contextParts.push(`Notas de Contexto: ${context_notes.trim()}`);
    if (next_steps?.trim()) contextParts.push(`Próximos Passos Previstos: ${next_steps.trim()}`);

    const contextBlock = contextParts.length > 0
      ? `CONTEXTO DA REUNIÃO:\n${contextParts.join("\n")}\n\n`
      : "";

    const systemPrompt = `Você é um assistente executivo especializado em reuniões B2B de tecnologia.

Analise a transcrição abaixo e retorne um JSON com exatamente esta estrutura (sem markdown, sem explicações):

{
  "executive_summary": "parágrafo único conciso resumindo os principais pontos discutidos e decisões tomadas",
  "homework_umode": ["item 1 de lição de casa da uMode", "item 2", ...],
  "homework_client": ["item 1 de lição de casa do cliente", "item 2", ...]
}

Regras:
- executive_summary: máximo 5 linhas, linguagem executiva, foque em decisões e próximos passos
- homework_umode: ações que a uMode precisa executar — seja específico
- homework_client: ações que o cliente precisa executar — seja específico
- Se não houver lições de casa para um lado, retorne array vazio []
- Retorne APENAS o JSON, sem markdown, sem blocos de código`;

    const userPrompt = `${contextBlock}${transcription?.trim() ? `TRANSCRIÇÃO:\n${transcription}` : "Sem transcrição disponível."}`;

    // Call AI (Gemini + Claude fallback)
    const rawText = await callAI(systemPrompt, userPrompt, 2048);

    // Parse JSON with recovery
    let parsed: {
      executive_summary: string;
      homework_umode: string[];
      homework_client: string[];
    };

    try {
      const clean = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(clean);
    } catch {
      console.error("AI returned invalid format, length:", rawText.length);
      throw new Error("IA retornou formato inválido");
    }

    // Save to DB
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Update agenda with summary
    const { error: agendaError } = await supabase
      .from("meeting_agendas")
      .update({
        executive_summary: parsed.executive_summary,
        ...(transcription?.trim() ? { transcription } : {}),
        ai_processed: true,
        ai_processed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", agenda_id);

    if (agendaError) throw agendaError;

    // Delete previous AI-generated items (never delete converted ones)
    const { error: deleteError } = await supabase
      .from("meeting_homework_items")
      .delete()
      .eq("agenda_id", agenda_id)
      .is("converted_to_demand_id", null);
    if (deleteError) throw deleteError;

    // Insert homework items
    const umodeItems = parsed.homework_umode
      .filter((d) => d.trim())
      .map((description) => ({
        agenda_id,
        description: description.trim(),
        responsible_side: "umode",
        responsible_label: "uMode",
        status: "pending",
      }));

    const clientItems = parsed.homework_client
      .filter((d) => d.trim())
      .map((description) => ({
        agenda_id,
        description: description.trim(),
        responsible_side: "client",
        responsible_label: "Cliente",
        status: "pending",
      }));

    const allItems = [...umodeItems, ...clientItems];

    if (allItems.length > 0) {
      const { error: itemsError } = await supabase
        .from("meeting_homework_items")
        .insert(allItems);

      if (itemsError) throw itemsError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        executive_summary: parsed.executive_summary,
        items_created: allItems.length,
        homework_umode_count: umodeItems.length,
        homework_client_count: clientItems.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("process-meeting-transcription error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Erro interno",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
