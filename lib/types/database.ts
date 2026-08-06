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
    PostgrestVersion: "14.5"
  }
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          acted_at: string
          action: string
          actor_id: string
          after: Json | null
          before: Json | null
          entity_id: string
          entity_type: string
          id: number
          note: string | null
        }
        Insert: {
          acted_at?: string
          action: string
          actor_id: string
          after?: Json | null
          before?: Json | null
          entity_id: string
          entity_type: string
          id?: number
          note?: string | null
        }
        Update: {
          acted_at?: string
          action?: string
          actor_id?: string
          after?: Json | null
          before?: Json | null
          entity_id?: string
          entity_type?: string
          id?: number
          note?: string | null
        }
        Relationships: []
      }
      admin_profiles: {
        Row: {
          display_name: string | null
          role: string
          user_id: string
        }
        Insert: {
          display_name?: string | null
          role?: string
          user_id: string
        }
        Update: {
          display_name?: string | null
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      app_settings: {
        Row: {
          current_term: string | null
          dues_one_term_cents: number
          dues_two_term_cents: number
          id: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          current_term?: string | null
          dues_one_term_cents?: number
          dues_two_term_cents?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          current_term?: string | null
          dues_one_term_cents?: number
          dues_two_term_cents?: number
          id?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      attendance: {
        Row: {
          event_id: string | null
          id: string
          member_id: string | null
          normalized_eid: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          source: string
          status: string
          submitted_at: string
          submitted_eid: string
          submitted_email: string
          submitted_name: string
          updated_at: string
        }
        Insert: {
          event_id?: string | null
          id?: string
          member_id?: string | null
          normalized_eid?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          submitted_at?: string
          submitted_eid: string
          submitted_email: string
          submitted_name: string
          updated_at?: string
        }
        Update: {
          event_id?: string | null
          id?: string
          member_id?: string | null
          normalized_eid?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          source?: string
          status?: string
          submitted_at?: string
          submitted_eid?: string
          submitted_email?: string
          submitted_name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      checkin_throttle: {
        Row: {
          id: number
          ip_hash: string
          submitted_at: string
        }
        Insert: {
          id?: never
          ip_hash: string
          submitted_at?: string
        }
        Update: {
          id?: never
          ip_hash?: string
          submitted_at?: string
        }
        Relationships: []
      }
      dues_payments: {
        Row: {
          amount_cents: number
          covered_terms: string[] | null
          id: string
          import_batch_id: string
          imported_at: string
          imported_by: string
          member_id: string | null
          normalized_eid: string | null
          note: string | null
          paid_at: string
          payer_handle: string | null
          payer_name: string | null
          start_term: string
          submitted_eid: string | null
          terms_covered: number | null
          updated_at: string
          venmo_txn_id: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_cents: number
          covered_terms?: string[] | null
          id?: string
          import_batch_id: string
          imported_at?: string
          imported_by: string
          member_id?: string | null
          normalized_eid?: string | null
          note?: string | null
          paid_at: string
          payer_handle?: string | null
          payer_name?: string | null
          start_term?: string
          submitted_eid?: string | null
          terms_covered?: number | null
          updated_at?: string
          venmo_txn_id: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_cents?: number
          covered_terms?: string[] | null
          id?: string
          import_batch_id?: string
          imported_at?: string
          imported_by?: string
          member_id?: string | null
          normalized_eid?: string | null
          note?: string | null
          paid_at?: string
          payer_handle?: string | null
          payer_name?: string | null
          start_term?: string
          submitted_eid?: string | null
          terms_covered?: number | null
          updated_at?: string
          venmo_txn_id?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dues_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dues_payments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          category: string | null
          checkin_closes_at: string | null
          checkin_opens_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          location: string | null
          points: number
          series_id: string | null
          starts_at: string
          status: string
          term: string | null
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at: string
          id?: string
          location?: string | null
          points?: number
          series_id?: string | null
          starts_at: string
          status?: string
          term?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          checkin_closes_at?: string | null
          checkin_opens_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string
          id?: string
          location?: string | null
          points?: number
          series_id?: string | null
          starts_at?: string
          status?: string
          term?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      member_field_definitions: {
        Row: {
          archived_at: string | null
          created_at: string
          created_by: string | null
          editable_inline: boolean
          id: string
          key: string
          kind: string
          label: string
          options: string[]
          show_in_directory: boolean
          sort_order: number
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          editable_inline?: boolean
          id?: string
          key: string
          kind?: string
          label: string
          options: string[]
          show_in_directory?: boolean
          sort_order?: number
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          created_by?: string | null
          editable_inline?: boolean
          id?: string
          key?: string
          kind?: string
          label?: string
          options?: string[]
          show_in_directory?: boolean
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      members: {
        Row: {
          active: boolean
          custom_fields: Json
          eid: string
          email: string
          full_name: string
          id: string
          joined_at: string
          normalized_eid: string | null
          notes: string | null
          source: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          custom_fields?: Json
          eid: string
          email: string
          full_name: string
          id?: string
          joined_at?: string
          normalized_eid?: string | null
          notes?: string | null
          source?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          custom_fields?: Json
          eid?: string
          email?: string
          full_name?: string
          id?: string
          joined_at?: string
          normalized_eid?: string | null
          notes?: string | null
          source?: string
          updated_at?: string
        }
        Relationships: []
      }
      point_adjustments: {
        Row: {
          awarded_at: string
          awarded_by: string
          category: string
          event_id: string | null
          id: string
          member_id: string
          points: number
          reason: string
          term: string
          void_reason: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          awarded_at?: string
          awarded_by: string
          category?: string
          event_id?: string | null
          id?: string
          member_id: string
          points: number
          reason: string
          term?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          awarded_at?: string
          awarded_by?: string
          category?: string
          event_id?: string | null
          id?: string
          member_id?: string
          points?: number
          reason?: string
          term?: string
          void_reason?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "point_adjustments_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_adjustments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "leaderboard"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_adjustments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "member_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_adjustments_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      leaderboard: {
        Row: {
          full_name: string | null
          id: string | null
          total_points: number | null
        }
        Relationships: []
      }
      member_directory: {
        Row: {
          active: boolean | null
          attendance_points: number | null
          attendance_rate: number | null
          bonus_points: number | null
          custom_fields: Json | null
          dues_paid_current_term: boolean | null
          eid: string | null
          email: string | null
          events_attended: number | null
          events_possible: number | null
          full_name: string | null
          id: string | null
          joined_at: string | null
          last_seen_at: string | null
          notes: string | null
          pending_count: number | null
          source: string | null
          total_points: number | null
          updated_at: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      current_term: { Args: never; Returns: string }
      nearby_events: {
        Args: { ts?: string; window_hours?: number }
        Returns: {
          ends_at: string
          event_id: string
          gap: string
          starts_at: string
          title: string
        }[]
      }
      next_term: { Args: { t: string }; Returns: string }
      open_event_at: {
        Args: { ts?: string }
        Returns: {
          category: string | null
          checkin_closes_at: string | null
          checkin_opens_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string
          id: string
          location: string | null
          points: number
          series_id: string | null
          starts_at: string
          status: string
          term: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      term_at_index: { Args: { i: number }; Returns: string }
      term_index: { Args: { t: string }; Returns: number }
      term_of: { Args: { ts: string }; Returns: string }
      terms_from: { Args: { n: number; start: string }; Returns: string[] }
      valid_field_options: { Args: { options: string[] }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const

