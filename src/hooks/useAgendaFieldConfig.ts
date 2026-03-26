import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

export type FieldVisibility = "required" | "optional" | "hidden";

export interface AgendaFieldConfig {
  title: FieldVisibility;
  meeting_date: FieldVisibility;
  client_id: FieldVisibility;
  objective: FieldVisibility;
  context_notes: FieldVisibility;
  satisfaction_score: FieldVisibility;
  next_steps: FieldVisibility;
  transcription: FieldVisibility;
  location: FieldVisibility;
}

const DEFAULT_CONFIG: AgendaFieldConfig = {
  title: "required",
  meeting_date: "required",
  client_id: "required",
  objective: "required",
  context_notes: "optional",
  satisfaction_score: "required",
  next_steps: "optional",
  transcription: "optional",
  location: "optional",
};

export function useAgendaFieldConfig() {
  const { user } = useAuth();

  return useQuery<AgendaFieldConfig>({
    queryKey: ["agenda_field_config", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "agenda_required_fields")
        .maybeSingle();
      if (error) throw error;
      if (!data?.value) return DEFAULT_CONFIG;
      return { ...DEFAULT_CONFIG, ...(data.value as Partial<AgendaFieldConfig>) };
    },
  });
}
