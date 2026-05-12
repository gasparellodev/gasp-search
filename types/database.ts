// =============================================================================
// types/database.ts
// =============================================================================
// Fonte canônica: gerado pelo Supabase MCP `generate_typescript_types`
// contra o projeto `pvazzozzqwwshgacmafv` (Phase 6 / issue #138c).
//
// ⚠️ NÃO editar manualmente. Para regenerar:
//
//   1. (Local)  `npm run gen:types`               (precisa `supabase start`).
//   2. (Remoto) `npm run gen:types:remote` com `SUPABASE_PROJECT_REF` no env.
//   3. (MCP)    Invocar `plugin-supabase-supabase.generate_typescript_types`
//               com `project_id` do projeto Supabase e colar o output aqui.
//
// Tightening manual aplicado sobre o output do gerador (cada um documentado
// inline com comentário):
//   - `campaigns.type`, `consent_logs.action`, `lead_sites.status` mantêm
//     a union canônica (Postgres usa `text` + check constraint, não enum).
//   - `consent_logs.ip`, `lead_form_submissions.consent_ip` mantêm
//     `string | null` (cliente Supabase v2 serializa `inet` como texto).
//   - `lead_sites.variables.Insert` mantém `?` (NOT NULL + default
//     `'{}'::jsonb` na migration 0010; gerador não detecta defaults).
//
// O type-level test em `tests/unit/types/database.test.ts` defende o shape
// e quebra o build se este arquivo divergir do contrato esperado pelo
// código de feature.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      campaign_targets: {
        Row: {
          campaign_id: string;
          created_at: string;
          error_message: string | null;
          lead_id: string;
          sent_message_id: string | null;
          status: Database["public"]["Enums"]["campaign_target_status"];
        };
        Insert: {
          campaign_id: string;
          created_at?: string;
          error_message?: string | null;
          lead_id: string;
          sent_message_id?: string | null;
          status?: Database["public"]["Enums"]["campaign_target_status"];
        };
        Update: {
          campaign_id?: string;
          created_at?: string;
          error_message?: string | null;
          lead_id?: string;
          sent_message_id?: string | null;
          status?: Database["public"]["Enums"]["campaign_target_status"];
        };
        Relationships: [
          {
            foreignKeyName: "campaign_targets_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_targets_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "campaign_targets_sent_message_id_fkey";
            columns: ["sent_message_id"];
            isOneToOne: false;
            referencedRelation: "lead_messages";
            referencedColumns: ["id"];
          },
        ];
      };
      campaigns: {
        Row: {
          ai_channel: string | null;
          ai_goal: string | null;
          ai_tone: string | null;
          completed_at: string | null;
          created_at: string;
          failed_count: number;
          id: string;
          mode: Database["public"]["Enums"]["campaign_mode"];
          name: string;
          sent_count: number;
          started_at: string | null;
          status: Database["public"]["Enums"]["campaign_status"];
          template_text: string | null;
          total_count: number;
          // Coluna `type` (migration 0013) — distingue campaign clássica de
          // mensagem (`'message'`) das campaigns que disparam prévias de
          // site (`'site_preview'`, hook em lib/campaigns/processor.ts).
          // Supabase typegen entrega `string` porque a coluna é `text` +
          // check constraint; mantemos a union pra type-safety no TS.
          type: "message" | "site_preview";
          updated_at: string;
          user_id: string;
        };
        Insert: {
          ai_channel?: string | null;
          ai_goal?: string | null;
          ai_tone?: string | null;
          completed_at?: string | null;
          created_at?: string;
          failed_count?: number;
          id?: string;
          mode: Database["public"]["Enums"]["campaign_mode"];
          name: string;
          sent_count?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["campaign_status"];
          template_text?: string | null;
          total_count?: number;
          type?: "message" | "site_preview";
          updated_at?: string;
          user_id: string;
        };
        Update: {
          ai_channel?: string | null;
          ai_goal?: string | null;
          ai_tone?: string | null;
          completed_at?: string | null;
          created_at?: string;
          failed_count?: number;
          id?: string;
          mode?: Database["public"]["Enums"]["campaign_mode"];
          name?: string;
          sent_count?: number;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["campaign_status"];
          template_text?: string | null;
          total_count?: number;
          type?: "message" | "site_preview";
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      consent_logs: {
        Row: {
          // `action` é `text` no banco com check constraint; mantemos a union
          // PT-BR canônica do banner LGPD (sincronizada com
          // `lib/lgpd/consent-state.ts:ConsentAction`).
          action: "accept_all" | "accept_selected" | "reject";
          categories: Json;
          consent_text: string;
          created_at: string;
          id: string;
          // `inet` no Postgres; cliente Supabase v2 serializa como texto.
          // Mantemos `string | null` (com inserts `null` para anônimo) —
          // narrowing canônico em `lib/lgpd/consent-audit.ts:LogConsentInput`.
          ip: string | null;
          timestamp: string;
          user_agent: string | null;
          user_id: string | null;
          version: string;
        };
        Insert: {
          action: "accept_all" | "accept_selected" | "reject";
          categories: Json;
          consent_text: string;
          created_at?: string;
          id?: string;
          ip?: string | null;
          timestamp: string;
          user_agent?: string | null;
          user_id?: string | null;
          version: string;
        };
        Update: {
          action?: "accept_all" | "accept_selected" | "reject";
          categories?: Json;
          consent_text?: string;
          created_at?: string;
          id?: string;
          ip?: string | null;
          timestamp?: string;
          user_agent?: string | null;
          user_id?: string | null;
          version?: string;
        };
        Relationships: [];
      };
      generation_throttle: {
        Row: {
          attempted_at: string;
          id: string;
          user_id: string;
        };
        Insert: {
          attempted_at?: string;
          id?: string;
          user_id: string;
        };
        Update: {
          attempted_at?: string;
          id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      lead_form_submissions: {
        Row: {
          // `inet` no Postgres → `string | null` no TS (mesma motivação que
          // `consent_logs.ip`); coletado pelo handler `/api/sites/form` (#H3).
          consent_ip: string | null;
          consent_text: string;
          consent_timestamp: string;
          consent_user_agent: string | null;
          created_at: string;
          email: string;
          id: string;
          lead_site_id: string;
          message: string | null;
          model: string | null;
          name: string;
          phone: string;
          user_id: string;
        };
        Insert: {
          consent_ip?: string | null;
          consent_text: string;
          consent_timestamp?: string;
          consent_user_agent?: string | null;
          created_at?: string;
          email: string;
          id?: string;
          lead_site_id: string;
          message?: string | null;
          model?: string | null;
          name: string;
          phone: string;
          user_id: string;
        };
        Update: {
          consent_ip?: string | null;
          consent_text?: string;
          consent_timestamp?: string;
          consent_user_agent?: string | null;
          created_at?: string;
          email?: string;
          id?: string;
          lead_site_id?: string;
          message?: string | null;
          model?: string | null;
          name?: string;
          phone?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_form_submissions_lead_site_id_fkey";
            columns: ["lead_site_id"];
            isOneToOne: false;
            referencedRelation: "lead_sites";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_messages: {
        Row: {
          ai_generated: boolean;
          campaign_id: string | null;
          channel: string;
          content: string;
          created_at: string;
          direction: Database["public"]["Enums"]["lead_message_direction"];
          error_message: string | null;
          id: string;
          lead_id: string;
          status: Database["public"]["Enums"]["lead_message_status"];
          tone: string | null;
          user_id: string;
          whatsapp_msg_id: string | null;
        };
        Insert: {
          ai_generated?: boolean;
          campaign_id?: string | null;
          channel: string;
          content: string;
          created_at?: string;
          direction?: Database["public"]["Enums"]["lead_message_direction"];
          error_message?: string | null;
          id?: string;
          lead_id: string;
          status?: Database["public"]["Enums"]["lead_message_status"];
          tone?: string | null;
          user_id: string;
          whatsapp_msg_id?: string | null;
        };
        Update: {
          ai_generated?: boolean;
          campaign_id?: string | null;
          channel?: string;
          content?: string;
          created_at?: string;
          direction?: Database["public"]["Enums"]["lead_message_direction"];
          error_message?: string | null;
          id?: string;
          lead_id?: string;
          status?: Database["public"]["Enums"]["lead_message_status"];
          tone?: string | null;
          user_id?: string;
          whatsapp_msg_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_messages_campaign_id_fkey";
            columns: ["campaign_id"];
            isOneToOne: false;
            referencedRelation: "campaigns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_messages_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_sites: {
        Row: {
          archived_at: string | null;
          created_at: string;
          generated_at: string | null;
          generation_error: string | null;
          id: string;
          last_viewed_at: string | null;
          lead_id: string;
          published_at: string | null;
          sent_at: string | null;
          signed_at: string | null;
          slug: string;
          // `status` é `text` + check constraint, não enum nativo. Mantemos a
          // union em `Enums<"lead_site_status">` (modelada no `Enums` abaixo).
          status: Database["public"]["Enums"]["lead_site_status"];
          updated_at: string;
          user_id: string;
          variables: Json;
          view_count: number;
          visual_identity: Json | null;
        };
        Insert: {
          archived_at?: string | null;
          created_at?: string;
          generated_at?: string | null;
          generation_error?: string | null;
          id?: string;
          last_viewed_at?: string | null;
          lead_id: string;
          published_at?: string | null;
          sent_at?: string | null;
          signed_at?: string | null;
          slug: string;
          status?: Database["public"]["Enums"]["lead_site_status"];
          updated_at?: string;
          user_id: string;
          // `variables` é NOT NULL no banco mas tem `default '{}'::jsonb`
          // (migration 0010 `lead_sites`); o Supabase typegen marca como
          // obrigatório porque não detecta defaults JSONB. Mantemos `?` aqui
          // para refletir o contrato real de insert (caller pode omitir).
          variables?: Json;
          view_count?: number;
          visual_identity?: Json | null;
        };
        Update: {
          archived_at?: string | null;
          created_at?: string;
          generated_at?: string | null;
          generation_error?: string | null;
          id?: string;
          last_viewed_at?: string | null;
          lead_id?: string;
          published_at?: string | null;
          sent_at?: string | null;
          signed_at?: string | null;
          slug?: string;
          status?: Database["public"]["Enums"]["lead_site_status"];
          updated_at?: string;
          user_id?: string;
          variables?: Json;
          view_count?: number;
          visual_identity?: Json | null;
        };
        Relationships: [
          {
            foreignKeyName: "lead_sites_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
        ];
      };
      lead_tags: {
        Row: {
          lead_id: string;
          tag_id: string;
        };
        Insert: {
          lead_id: string;
          tag_id: string;
        };
        Update: {
          lead_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "lead_tags_lead_id_fkey";
            columns: ["lead_id"];
            isOneToOne: false;
            referencedRelation: "leads";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "lead_tags_tag_id_fkey";
            columns: ["tag_id"];
            isOneToOne: false;
            referencedRelation: "tags";
            referencedColumns: ["id"];
          },
        ];
      };
      leads: {
        Row: {
          category: string | null;
          city: string | null;
          country: string | null;
          created_at: string;
          email: string | null;
          enriched_at: string | null;
          followers_count: number | null;
          has_website: boolean | null;
          id: string;
          instagram_handle: string | null;
          name: string;
          notes: string | null;
          phone: string | null;
          rating: number | null;
          raw: Json | null;
          reviews_count: number | null;
          score: number;
          source: Database["public"]["Enums"]["search_source"];
          source_search_job_id: string | null;
          stage: Database["public"]["Enums"]["lead_stage"];
          state: string | null;
          updated_at: string;
          user_id: string;
          website: string | null;
          whatsapp: string | null;
        };
        Insert: {
          category?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          enriched_at?: string | null;
          followers_count?: number | null;
          has_website?: boolean | null;
          id?: string;
          instagram_handle?: string | null;
          name: string;
          notes?: string | null;
          phone?: string | null;
          rating?: number | null;
          raw?: Json | null;
          reviews_count?: number | null;
          score?: number;
          source: Database["public"]["Enums"]["search_source"];
          source_search_job_id?: string | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          state?: string | null;
          updated_at?: string;
          user_id: string;
          website?: string | null;
          whatsapp?: string | null;
        };
        Update: {
          category?: string | null;
          city?: string | null;
          country?: string | null;
          created_at?: string;
          email?: string | null;
          enriched_at?: string | null;
          followers_count?: number | null;
          has_website?: boolean | null;
          id?: string;
          instagram_handle?: string | null;
          name?: string;
          notes?: string | null;
          phone?: string | null;
          rating?: number | null;
          raw?: Json | null;
          reviews_count?: number | null;
          score?: number;
          source?: Database["public"]["Enums"]["search_source"];
          source_search_job_id?: string | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          state?: string | null;
          updated_at?: string;
          user_id?: string;
          website?: string | null;
          whatsapp?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "leads_source_search_job_id_fkey";
            columns: ["source_search_job_id"];
            isOneToOne: false;
            referencedRelation: "search_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          full_name: string | null;
          id: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          full_name?: string | null;
          id?: string;
        };
        Relationships: [];
      };
      search_jobs: {
        Row: {
          apify_run_id: string | null;
          created_at: string;
          error_message: string | null;
          finished_at: string | null;
          id: string;
          input: Json;
          results_count: number;
          source: Database["public"]["Enums"]["search_source"];
          status: Database["public"]["Enums"]["search_status"];
          user_id: string;
        };
        Insert: {
          apify_run_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          input: Json;
          results_count?: number;
          source: Database["public"]["Enums"]["search_source"];
          status?: Database["public"]["Enums"]["search_status"];
          user_id: string;
        };
        Update: {
          apify_run_id?: string | null;
          created_at?: string;
          error_message?: string | null;
          finished_at?: string | null;
          id?: string;
          input?: Json;
          results_count?: number;
          source?: Database["public"]["Enums"]["search_source"];
          status?: Database["public"]["Enums"]["search_status"];
          user_id?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          color: string;
          created_at: string;
          id: string;
          name: string;
          user_id: string;
        };
        Insert: {
          color?: string;
          created_at?: string;
          id?: string;
          name: string;
          user_id: string;
        };
        Update: {
          color?: string;
          created_at?: string;
          id?: string;
          name?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      whatsapp_instances: {
        Row: {
          created_at: string;
          evo_instance: string;
          evo_instance_v2: string;
          id: string;
          last_seen_at: string | null;
          phone_number: string | null;
          qr_code: string | null;
          status: Database["public"]["Enums"]["whatsapp_status"];
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          evo_instance: string;
          evo_instance_v2: string;
          id?: string;
          last_seen_at?: string | null;
          phone_number?: string | null;
          qr_code?: string | null;
          status?: Database["public"]["Enums"]["whatsapp_status"];
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          evo_instance?: string;
          evo_instance_v2?: string;
          id?: string;
          last_seen_at?: string | null;
          phone_number?: string | null;
          qr_code?: string | null;
          status?: Database["public"]["Enums"]["whatsapp_status"];
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      __migrate_site_variables_v1_to_v2: {
        Args: { v1: Json };
        Returns: Json;
      };
    };
    Enums: {
      campaign_mode: "template" | "ai_per_lead";
      campaign_status:
        | "draft"
        | "running"
        | "completed"
        | "failed"
        | "cancelled";
      campaign_target_status: "pending" | "sent" | "failed" | "skipped";
      lead_message_direction: "outbound" | "inbound";
      lead_message_status:
        | "queued"
        | "sent"
        | "delivered"
        | "read"
        | "failed";
      lead_stage:
        | "new"
        | "contacted"
        | "in_conversation"
        | "qualified"
        | "closed_won"
        | "closed_lost";
      search_source: "google_maps" | "instagram" | "website_contact";
      search_status: "queued" | "running" | "succeeded" | "failed";
      whatsapp_status:
        | "disconnected"
        | "qr_pending"
        | "connecting"
        | "connected"
        | "error";
      // `lead_sites.status` é `text` + check constraint, não enum nativo do
      // Postgres. Modelado aqui como union para type-safety no TS.
      lead_site_status: "draft" | "published" | "sent" | "archived";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      campaign_mode: ["template", "ai_per_lead"],
      campaign_status: [
        "draft",
        "running",
        "completed",
        "failed",
        "cancelled",
      ],
      campaign_target_status: ["pending", "sent", "failed", "skipped"],
      lead_message_direction: ["outbound", "inbound"],
      lead_message_status: ["queued", "sent", "delivered", "read", "failed"],
      lead_stage: [
        "new",
        "contacted",
        "in_conversation",
        "qualified",
        "closed_won",
        "closed_lost",
      ],
      search_source: ["google_maps", "instagram", "website_contact"],
      search_status: ["queued", "running", "succeeded", "failed"],
      whatsapp_status: [
        "disconnected",
        "qr_pending",
        "connecting",
        "connected",
        "error",
      ],
      lead_site_status: ["draft", "published", "sent", "archived"],
    },
  },
} as const;
