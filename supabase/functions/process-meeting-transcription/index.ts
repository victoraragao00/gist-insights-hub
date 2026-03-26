import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });

  try {
    const { agenda_id, transcription } = await req.json();

    if (!agenda_id || !transcription?.trim()) {
      return new Response(
        JSON.stringify({
          error: "agenda_id e transcription são obrigatórios",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    // Call Gemini
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Você é um assistente executivo especializado em reuniões B2B de tecnologia.

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
- Retorne APENAS o JSON, sem markdown, sem blocos de código

TRANSCRIÇÃO:
${transcription}`,
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errText);
      throw new Error(`Gemini API error: ${geminiRes.status}`);
    }

    const geminiData = await geminiRes.json();
    const rawText =
      geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

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
      console.error("Gemini returned invalid format:", rawText);
      throw new Error("Gemini retornou formato inválido");
    }

    // Save to DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
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
    await supabase
      .from("meeting_homework_items")
      .delete()
      .eq("agenda_id", agenda_id)
      .is("converted_to_demand_id", null);

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
