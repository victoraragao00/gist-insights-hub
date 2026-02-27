export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      alert_logs: {
        Row: {
          alert_rule_id: string
          id: string
          notification_sent_to: Json
          triggered_at: string
          value_at_trigger: number | null
        }
        Insert: {
          alert_rule_id: string
          id?: string
          notification_sent_to?: Json
          triggered_at?: string
          value_at_trigger?: number | null
        }
        Update: {
          alert_rule_id?: string
          id?: string
          notification_sent_to?: Json
          triggered_at?: string
          value_at_trigger?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "alert_logs_alert_rule_id_fkey"
            columns: ["alert_rule_id"]
            isOneToOne: false
            referencedRelation: "alert_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_rules: {
        Row: {
          condition_type: Database["public"]["Enums"]["condition_type"]
          conditions: Json
          cooldown_minutes: number
          created_at: string
          id: string
          is_active: boolean
          kpi_indicator_id: string
          notification_channels: Json
          user_id: string
        }
        Insert: {
          condition_type?: Database["public"]["Enums"]["condition_type"]
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kpi_indicator_id: string
          notification_channels?: Json
          user_id: string
        }
        Update: {
          condition_type?: Database["public"]["Enums"]["condition_type"]
          conditions?: Json
          cooldown_minutes?: number
          created_at?: string
          id?: string
          is_active?: boolean
          kpi_indicator_id?: string
          notification_channels?: Json
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alert_rules_kpi_indicator_id_fkey"
            columns: ["kpi_indicator_id"]
            isOneToOne: false
            referencedRelation: "kpi_indicators"
            referencedColumns: ["id"]
          },
        ]
      }
      data_sources: {
        Row: {
          data_schema: Json
          endpoint_path: string
          id: string
          integration_id: string
          is_enabled: boolean
          label: string
          last_synced_at: string | null
          sync_interval: number
        }
        Insert: {
          data_schema?: Json
          endpoint_path: string
          id?: string
          integration_id: string
          is_enabled?: boolean
          label: string
          last_synced_at?: string | null
          sync_interval?: number
        }
        Update: {
          data_schema?: Json
          endpoint_path?: string
          id?: string
          integration_id?: string
          is_enabled?: boolean
          label?: string
          last_synced_at?: string | null
          sync_interval?: number
        }
        Relationships: [
          {
            foreignKeyName: "data_sources_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "integrations"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          auth_type: Database["public"]["Enums"]["auth_type"]
          config: Json
          created_at: string
          credentials: Json
          id: string
          name: string
          platform: Database["public"]["Enums"]["platform_type"]
          status: string
          user_id: string
        }
        Insert: {
          auth_type?: Database["public"]["Enums"]["auth_type"]
          config?: Json
          created_at?: string
          credentials?: Json
          id?: string
          name: string
          platform: Database["public"]["Enums"]["platform_type"]
          status?: string
          user_id: string
        }
        Update: {
          auth_type?: Database["public"]["Enums"]["auth_type"]
          config?: Json
          created_at?: string
          credentials?: Json
          id?: string
          name?: string
          platform?: Database["public"]["Enums"]["platform_type"]
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      kpi_indicators: {
        Row: {
          chart_type: Database["public"]["Enums"]["chart_type"]
          created_at: string
          data_source_id: string | null
          filters: Json
          formula: string | null
          id: string
          metric_type: Database["public"]["Enums"]["metric_type"]
          name: string
          user_id: string
        }
        Insert: {
          chart_type?: Database["public"]["Enums"]["chart_type"]
          created_at?: string
          data_source_id?: string | null
          filters?: Json
          formula?: string | null
          id?: string
          metric_type?: Database["public"]["Enums"]["metric_type"]
          name: string
          user_id: string
        }
        Update: {
          chart_type?: Database["public"]["Enums"]["chart_type"]
          created_at?: string
          data_source_id?: string | null
          filters?: Json
          formula?: string | null
          id?: string
          metric_type?: Database["public"]["Enums"]["metric_type"]
          name?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kpi_indicators_data_source_id_fkey"
            columns: ["data_source_id"]
            isOneToOne: false
            referencedRelation: "data_sources"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      auth_type: "api_key" | "oauth" | "token"
      chart_type: "line" | "bar" | "donut" | "number"
      condition_type: "threshold" | "percentage_change" | "compound"
      metric_type: "count" | "sum" | "avg" | "percentage" | "custom"
      platform_type:
        | "gist"
        | "stripe"
        | "linear"
        | "notion"
        | "tudo1"
        | "whatsapp"
        | "slack"
        | "custom"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      auth_type: ["api_key", "oauth", "token"],
      chart_type: ["line", "bar", "donut", "number"],
      condition_type: ["threshold", "percentage_change", "compound"],
      metric_type: ["count", "sum", "avg", "percentage", "custom"],
      platform_type: [
        "gist",
        "stripe",
        "linear",
        "notion",
        "tudo1",
        "whatsapp",
        "slack",
        "custom",
      ],
    },
  },
} as const
