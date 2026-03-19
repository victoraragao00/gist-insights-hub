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
      app_settings: {
        Row: {
          key: string
          updated_at: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: Json
        }
        Relationships: []
      }
      audit_alerts: {
        Row: {
          client_id: string | null
          created_at: string | null
          delivered_at: string | null
          delivery_status: string | null
          id: string
          message: string
          metric_value: number
          read: boolean
          rule_id: string
          threshold: number
        }
        Insert: {
          client_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          id?: string
          message: string
          metric_value: number
          read?: boolean
          rule_id: string
          threshold: number
        }
        Update: {
          client_id?: string | null
          created_at?: string | null
          delivered_at?: string | null
          delivery_status?: string | null
          id?: string
          message?: string
          metric_value?: number
          read?: boolean
          rule_id?: string
          threshold?: number
        }
        Relationships: [
          {
            foreignKeyName: "audit_alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_alerts_rule_id_fkey"
            columns: ["rule_id"]
            isOneToOne: false
            referencedRelation: "audit_rules"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_rules: {
        Row: {
          active: boolean | null
          alert_channel: Database["public"]["Enums"]["alert_channel"] | null
          alert_recipients: Json
          client_id: string | null
          cooldown_hours: number | null
          created_at: string | null
          description: string | null
          id: string
          metric: string
          name: string
          operator: string
          threshold: number
          window_hours: number | null
        }
        Insert: {
          active?: boolean | null
          alert_channel?: Database["public"]["Enums"]["alert_channel"] | null
          alert_recipients?: Json
          client_id?: string | null
          cooldown_hours?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          metric: string
          name: string
          operator: string
          threshold: number
          window_hours?: number | null
        }
        Update: {
          active?: boolean | null
          alert_channel?: Database["public"]["Enums"]["alert_channel"] | null
          alert_recipients?: Json
          client_id?: string | null
          cooldown_hours?: number | null
          created_at?: string | null
          description?: string | null
          id?: string
          metric?: string
          name?: string
          operator?: string
          threshold?: number
          window_hours?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_rules_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_bindings: {
        Row: {
          active: boolean | null
          channel: Database["public"]["Enums"]["channel_type"]
          channel_identifier: string
          client_id: string
          config: Json | null
          created_at: string | null
          id: string
          label: string | null
        }
        Insert: {
          active?: boolean | null
          channel: Database["public"]["Enums"]["channel_type"]
          channel_identifier: string
          client_id: string
          config?: Json | null
          created_at?: string | null
          id?: string
          label?: string | null
        }
        Update: {
          active?: boolean | null
          channel?: Database["public"]["Enums"]["channel_type"]
          channel_identifier?: string
          client_id?: string
          config?: Json | null
          created_at?: string | null
          id?: string
          label?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "channel_bindings_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      client_priority_config: {
        Row: {
          active: boolean
          client_id: string
          id: string
          recurrence_threshold_users: number
          recurrence_window_days: number
          tier: Database["public"]["Enums"]["client_tier"]
          updated_at: string
          weight_multiplier: number
        }
        Insert: {
          active?: boolean
          client_id: string
          id?: string
          recurrence_threshold_users?: number
          recurrence_window_days?: number
          tier: Database["public"]["Enums"]["client_tier"]
          updated_at?: string
          weight_multiplier?: number
        }
        Update: {
          active?: boolean
          client_id?: string
          id?: string
          recurrence_threshold_users?: number
          recurrence_window_days?: number
          tier?: Database["public"]["Enums"]["client_tier"]
          updated_at?: string
          weight_multiplier?: number
        }
        Relationships: [
          {
            foreignKeyName: "client_priority_config_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          active: boolean | null
          created_at: string | null
          id: string
          metadata: Json | null
          name: string
          slug: string
          status: string
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          name: string
          slug: string
          status?: string
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          id?: string
          metadata?: Json | null
          name?: string
          slug?: string
          status?: string
        }
        Relationships: []
      }
      demand_activities: {
        Row: {
          created_at: string | null
          created_by: string | null
          demand_id: string
          description: string
          event_type: Database["public"]["Enums"]["demand_event_type"]
          from_value: string | null
          id: string
          to_value: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          demand_id: string
          description: string
          event_type: Database["public"]["Enums"]["demand_event_type"]
          from_value?: string | null
          id?: string
          to_value?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          demand_id?: string
          description?: string
          event_type?: Database["public"]["Enums"]["demand_event_type"]
          from_value?: string | null
          id?: string
          to_value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "demand_activities_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_areas: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          id: string
          name: string
          position: number
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          position?: number
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      demand_assignees: {
        Row: {
          active: boolean | null
          created_at: string | null
          email: string | null
          id: string
          name: string
          role: string | null
        }
        Insert: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          name: string
          role?: string | null
        }
        Update: {
          active?: boolean | null
          created_at?: string | null
          email?: string | null
          id?: string
          name?: string
          role?: string | null
        }
        Relationships: []
      }
      demand_attachments: {
        Row: {
          created_at: string | null
          created_by: string | null
          demand_id: string
          filename: string | null
          id: string
          mime_type: string | null
          size_bytes: number | null
          type: string
          url: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          demand_id: string
          filename?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          type: string
          url: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          demand_id?: string
          filename?: string | null
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          type?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_attachments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_client_tokens: {
        Row: {
          active: boolean | null
          client_id: string
          created_at: string | null
          created_by: string | null
          id: string
          token: string
        }
        Insert: {
          active?: boolean | null
          client_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          token?: string
        }
        Update: {
          active?: boolean | null
          client_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_client_tokens_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_comments: {
        Row: {
          content: string
          created_at: string | null
          created_by: string | null
          demand_id: string
          edited: boolean | null
          edited_at: string | null
          id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          created_by?: string | null
          demand_id: string
          edited?: boolean | null
          edited_at?: string | null
          id?: string
        }
        Update: {
          content?: string
          created_at?: string | null
          created_by?: string | null
          demand_id?: string
          edited?: boolean | null
          edited_at?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_comments_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_interactions: {
        Row: {
          created_at: string | null
          created_by: string | null
          demand_id: string
          id: string
          interaction_id: string
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          demand_id: string
          id?: string
          interaction_id: string
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          demand_id?: string
          id?: string
          interaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_interactions_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demand_interactions_interaction_id_fkey"
            columns: ["interaction_id"]
            isOneToOne: false
            referencedRelation: "interactions"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_notifications: {
        Row: {
          created_at: string | null
          demand_id: string | null
          id: string
          message: string
          read: boolean | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          demand_id?: string | null
          id?: string
          message: string
          read?: boolean | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          demand_id?: string | null
          id?: string
          message?: string
          read?: boolean | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_notifications_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demand_types: {
        Row: {
          active: boolean | null
          color: string | null
          created_at: string | null
          icon: string | null
          id: string
          name: string
          position: number
        }
        Insert: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name: string
          position?: number
        }
        Update: {
          active?: boolean | null
          color?: string | null
          created_at?: string | null
          icon?: string | null
          id?: string
          name?: string
          position?: number
        }
        Relationships: []
      }
      demand_watchers: {
        Row: {
          created_at: string | null
          demand_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          demand_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          demand_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "demand_watchers_demand_id_fkey"
            columns: ["demand_id"]
            isOneToOne: false
            referencedRelation: "demands"
            referencedColumns: ["id"]
          },
        ]
      }
      demands: {
        Row: {
          actual_effort: string | null
          area_id: string | null
          assignee: string | null
          assignee_id: string | null
          blocked_at: string | null
          blocked_by: string | null
          blocker_reason: string | null
          cancellation_reason: string | null
          client_id: string
          column_id: string
          created_at: string | null
          created_by: string | null
          demand_type_id: string
          description: string | null
          estimated_effort: string | null
          expected_result: string | null
          finished_at: string | null
          id: string
          is_blocked: boolean | null
          last_updated: string | null
          notes: string | null
          position: number
          priority: Database["public"]["Enums"]["demand_priority"]
          rfi_url: string | null
          started_at: string | null
          title: string
        }
        Insert: {
          actual_effort?: string | null
          area_id?: string | null
          assignee?: string | null
          assignee_id?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocker_reason?: string | null
          cancellation_reason?: string | null
          client_id: string
          column_id: string
          created_at?: string | null
          created_by?: string | null
          demand_type_id: string
          description?: string | null
          estimated_effort?: string | null
          expected_result?: string | null
          finished_at?: string | null
          id?: string
          is_blocked?: boolean | null
          last_updated?: string | null
          notes?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["demand_priority"]
          rfi_url?: string | null
          started_at?: string | null
          title: string
        }
        Update: {
          actual_effort?: string | null
          area_id?: string | null
          assignee?: string | null
          assignee_id?: string | null
          blocked_at?: string | null
          blocked_by?: string | null
          blocker_reason?: string | null
          cancellation_reason?: string | null
          client_id?: string
          column_id?: string
          created_at?: string | null
          created_by?: string | null
          demand_type_id?: string
          description?: string | null
          estimated_effort?: string | null
          expected_result?: string | null
          finished_at?: string | null
          id?: string
          is_blocked?: boolean | null
          last_updated?: string | null
          notes?: string | null
          position?: number
          priority?: Database["public"]["Enums"]["demand_priority"]
          rfi_url?: string | null
          started_at?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "demands_area_id_fkey"
            columns: ["area_id"]
            isOneToOne: false
            referencedRelation: "demand_areas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "demand_assignees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "ticket_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "demands_demand_type_id_fkey"
            columns: ["demand_type_id"]
            isOneToOne: false
            referencedRelation: "demand_types"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          attachments: Json | null
          channel: Database["public"]["Enums"]["channel_type"]
          channel_binding_id: string | null
          classification_model: string | null
          classified_at: string | null
          client_id: string
          content: string | null
          conversation_id: string | null
          created_at: string | null
          external_id: string | null
          id: string
          ingested_at: string | null
          interaction_type:
            | Database["public"]["Enums"]["interaction_type"]
            | null
          is_out_of_scope: boolean | null
          occurred_at: string
          raw_payload: Json | null
          search_vector: unknown
          sender_participant_id: string | null
          sender_raw: string | null
          sender_side: string | null
          sentiment: number | null
          theme: string | null
          theme_detail: string | null
          tone: Database["public"]["Enums"]["tone_severity"] | null
          tone_detail: string | null
        }
        Insert: {
          attachments?: Json | null
          channel: Database["public"]["Enums"]["channel_type"]
          channel_binding_id?: string | null
          classification_model?: string | null
          classified_at?: string | null
          client_id: string
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          ingested_at?: string | null
          interaction_type?:
            | Database["public"]["Enums"]["interaction_type"]
            | null
          is_out_of_scope?: boolean | null
          occurred_at: string
          raw_payload?: Json | null
          search_vector?: unknown
          sender_participant_id?: string | null
          sender_raw?: string | null
          sender_side?: string | null
          sentiment?: number | null
          theme?: string | null
          theme_detail?: string | null
          tone?: Database["public"]["Enums"]["tone_severity"] | null
          tone_detail?: string | null
        }
        Update: {
          attachments?: Json | null
          channel?: Database["public"]["Enums"]["channel_type"]
          channel_binding_id?: string | null
          classification_model?: string | null
          classified_at?: string | null
          client_id?: string
          content?: string | null
          conversation_id?: string | null
          created_at?: string | null
          external_id?: string | null
          id?: string
          ingested_at?: string | null
          interaction_type?:
            | Database["public"]["Enums"]["interaction_type"]
            | null
          is_out_of_scope?: boolean | null
          occurred_at?: string
          raw_payload?: Json | null
          search_vector?: unknown
          sender_participant_id?: string | null
          sender_raw?: string | null
          sender_side?: string | null
          sentiment?: number | null
          theme?: string | null
          theme_detail?: string | null
          tone?: Database["public"]["Enums"]["tone_severity"] | null
          tone_detail?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interactions_channel_binding_id_fkey"
            columns: ["channel_binding_id"]
            isOneToOne: false
            referencedRelation: "channel_bindings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_sender_participant_id_fkey"
            columns: ["sender_participant_id"]
            isOneToOne: false
            referencedRelation: "participants"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          active: boolean | null
          client_id: string | null
          created_at: string | null
          id: string
          identifiers: Json | null
          name: string
          role: string | null
          side: string
        }
        Insert: {
          active?: boolean | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          identifiers?: Json | null
          name: string
          role?: string | null
          side: string
        }
        Update: {
          active?: boolean | null
          client_id?: string | null
          created_at?: string | null
          id?: string
          identifiers?: Json | null
          name?: string
          role?: string | null
          side?: string
        }
        Relationships: [
          {
            foreignKeyName: "participants_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      priority_scores: {
        Row: {
          calculated_at: string
          client_id: string
          id: string
          patterns: Json
          score: number
        }
        Insert: {
          calculated_at?: string
          client_id: string
          id?: string
          patterns?: Json
          score?: number
        }
        Update: {
          calculated_at?: string
          client_id?: string
          id?: string
          patterns?: Json
          score?: number
        }
        Relationships: [
          {
            foreignKeyName: "priority_scores_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: true
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_jobs: {
        Row: {
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          heartbeat_at: string | null
          id: string
          max_retries: number | null
          payload: Json | null
          progress: Json | null
          retry_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          type: Database["public"]["Enums"]["job_type"]
        }
        Insert: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          heartbeat_at?: string | null
          id?: string
          max_retries?: number | null
          payload?: Json | null
          progress?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          type: Database["public"]["Enums"]["job_type"]
        }
        Update: {
          client_id?: string | null
          completed_at?: string | null
          created_at?: string | null
          created_by?: string | null
          heartbeat_at?: string | null
          id?: string
          max_retries?: number | null
          payload?: Json | null
          progress?: Json | null
          retry_count?: number | null
          started_at?: string | null
          status?: Database["public"]["Enums"]["job_status"] | null
          type?: Database["public"]["Enums"]["job_type"]
        }
        Relationships: [
          {
            foreignKeyName: "sync_jobs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ticket_columns: {
        Row: {
          color: string | null
          created_at: string | null
          id: string
          name: string
          position: number
          triggers_finished_at: boolean | null
          triggers_started_at: boolean | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          id?: string
          name: string
          position: number
          triggers_finished_at?: boolean | null
          triggers_started_at?: boolean | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          id?: string
          name?: string
          position?: number
          triggers_finished_at?: boolean | null
          triggers_started_at?: boolean | null
        }
        Relationships: []
      }
      user_client_access: {
        Row: {
          client_id: string
          created_at: string | null
          id: string
          role: string | null
          user_id: string
        }
        Insert: {
          client_id: string
          created_at?: string | null
          id?: string
          role?: string | null
          user_id: string
        }
        Update: {
          client_id?: string
          created_at?: string | null
          id?: string
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_client_access_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      audit_alerts_summary: {
        Args: { p_user_id: string }
        Returns: {
          alerts: Json
          total_alerts_30d: number
          unread_count: number
        }[]
      }
      claim_next_job: {
        Args: never
        Returns: {
          client_id: string | null
          completed_at: string | null
          created_at: string | null
          created_by: string | null
          heartbeat_at: string | null
          id: string
          max_retries: number | null
          payload: Json | null
          progress: Json | null
          retry_count: number | null
          started_at: string | null
          status: Database["public"]["Enums"]["job_status"] | null
          type: Database["public"]["Enums"]["job_type"]
        }[]
        SetofOptions: {
          from: "*"
          to: "sync_jobs"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      client_stats_30d: {
        Args: { _user_id: string }
        Returns: {
          client_id: string
          dominant_tone: string
          health_pct: number
          last_contact: string
          total_30d: number
        }[]
      }
      client_tone_trend_7d: {
        Args: { p_client_id: string; p_user_id: string }
        Returns: {
          alerta: number
          atencao: number
          critico: number
          day: string
          ok: number
        }[]
      }
      create_job_if_none_active: {
        Args: {
          _created_by: string
          _payload?: Json
          _type: Database["public"]["Enums"]["job_type"]
        }
        Returns: {
          already_running: boolean
          job_id: string
        }[]
      }
      deactivate_stale_clients: { Args: { _days: number }; Returns: number }
      get_client_conversations: {
        Args: { p_client_id: string }
        Returns: {
          conversation_id: string
          first_message_at: string
          last_content: string
          last_message_at: string
          message_count: number
          sender_side: string
        }[]
      }
      get_client_public_demands: { Args: { p_token: string }; Returns: Json }
      get_demand_analytics: {
        Args: { p_client_id?: string; p_days?: number }
        Returns: Json
      }
      global_stats_30d: {
        Args: { p_user_id: string }
        Returns: {
          last_calculated_at: string
          monthly_tone_evolution: Json
          pct_alerta: number
          pct_critico: number
          top_themes: Json
          total_clients_monitored: number
          total_interactions_30d: number
        }[]
      }
      search_interactions: {
        Args: {
          p_client_id?: string
          p_limit?: number
          p_offset?: number
          p_query: string
          p_tone?: string
          p_user_id: string
        }
        Returns: {
          body: string
          client_name: string
          id: string
          occurred_at: string
          sender_raw: string
          sender_side: string
          theme: string
          tone: string
          total_count: number
        }[]
      }
      user_accessible_client_ids: {
        Args: { _user_id: string }
        Returns: string[]
      }
    }
    Enums: {
      alert_channel: "email" | "whatsapp" | "both"
      channel_type:
        | "gist"
        | "discord"
        | "whatsapp"
        | "email"
        | "transcription_gemini"
        | "transcription_tactiq"
        | "manual"
      client_tier: "azzas" | "enterprise" | "medium" | "small"
      demand_event_type:
        | "created"
        | "moved"
        | "assigned"
        | "blocked"
        | "unblocked"
        | "edited"
        | "cancelled"
        | "linked_interaction"
        | "commented"
      demand_priority: "low" | "medium" | "high" | "urgent"
      interaction_type: "text" | "audio" | "image" | "file" | "system"
      job_status: "pending" | "running" | "completed" | "failed" | "cancelled"
      job_type:
        | "sync_contacts"
        | "ingest_historical"
        | "classify_batch"
        | "transcribe_audio"
      tone_severity: "ok" | "atencao" | "alerta" | "critico"
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
      alert_channel: ["email", "whatsapp", "both"],
      channel_type: [
        "gist",
        "discord",
        "whatsapp",
        "email",
        "transcription_gemini",
        "transcription_tactiq",
        "manual",
      ],
      client_tier: ["azzas", "enterprise", "medium", "small"],
      demand_event_type: [
        "created",
        "moved",
        "assigned",
        "blocked",
        "unblocked",
        "edited",
        "cancelled",
        "linked_interaction",
        "commented",
      ],
      demand_priority: ["low", "medium", "high", "urgent"],
      interaction_type: ["text", "audio", "image", "file", "system"],
      job_status: ["pending", "running", "completed", "failed", "cancelled"],
      job_type: [
        "sync_contacts",
        "ingest_historical",
        "classify_batch",
        "transcribe_audio",
      ],
      tone_severity: ["ok", "atencao", "alerta", "critico"],
    },
  },
} as const
