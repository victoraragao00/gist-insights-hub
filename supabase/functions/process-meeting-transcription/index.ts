import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    // Call Lovable AI Gateway
    const aiRes = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: `Você é um assistente executivo especializado em reuniões B2B de tecnologia.

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
- Retorne APENAS o JSON, sem markdown, sem blocos de código`,
            },
            {
              role: "user",
              content: `${contextBlock}${transcription?.trim() ? `TRANSCRIÇÃO:\n${transcription}` : "Sem transcrição disponível."}`,
            },
          ],
          temperature: 0.3,
          max_tokens: 2048,
        }),
      }
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI Gateway error:", aiRes.status, errText);

      if (aiRes.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (aiRes.status === 402) {
        return new Response(
          JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos no workspace." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      throw new Error(`AI Gateway error: ${aiRes.status}`);
    }

    const aiData = await aiRes.json();
    const rawText = aiData.choices?.[0]?.message?.content ?? "";

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
        transcription,
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
