// =============================================================================
// types/database.ts
// =============================================================================
// Tipos do schema Supabase. Este arquivo replica a saída esperada de
// `supabase gen types typescript` aplicado contra a migration 0001_init.sql.
//
// Após o user aplicar a migration e rodar
//   `npx supabase gen types typescript --project-id <id> > types/database.ts`
// este arquivo será regenerado e pode divergir levemente em formatação.
// As regras de negócio (constraints, RLS) NÃO aparecem aqui — apenas shape.
// =============================================================================

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      tags: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          color: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          color?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          color?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      search_jobs: {
        Row: {
          id: string;
          user_id: string;
          source: Database["public"]["Enums"]["search_source"];
          input: Json;
          apify_run_id: string | null;
          status: Database["public"]["Enums"]["search_status"];
          results_count: number;
          error_message: string | null;
          created_at: string;
          finished_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: Database["public"]["Enums"]["search_source"];
          input: Json;
          apify_run_id?: string | null;
          status?: Database["public"]["Enums"]["search_status"];
          results_count?: number;
          error_message?: string | null;
          created_at?: string;
          finished_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: Database["public"]["Enums"]["search_source"];
          input?: Json;
          apify_run_id?: string | null;
          status?: Database["public"]["Enums"]["search_status"];
          results_count?: number;
          error_message?: string | null;
          created_at?: string;
          finished_at?: string | null;
        };
        Relationships: [];
      };
      leads: {
        Row: {
          id: string;
          user_id: string;
          source: Database["public"]["Enums"]["search_source"];
          source_search_job_id: string | null;
          name: string;
          category: string | null;
          city: string | null;
          state: string | null;
          country: string | null;
          phone: string | null;
          email: string | null;
          website: string | null;
          instagram_handle: string | null;
          whatsapp: string | null;
          has_website: boolean | null;
          rating: number | null;
          reviews_count: number | null;
          followers_count: number | null;
          stage: Database["public"]["Enums"]["lead_stage"];
          score: number;
          notes: string | null;
          raw: Json | null;
          enriched_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          source: Database["public"]["Enums"]["search_source"];
          source_search_job_id?: string | null;
          name: string;
          category?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          instagram_handle?: string | null;
          whatsapp?: string | null;
          has_website?: boolean | null;
          rating?: number | null;
          reviews_count?: number | null;
          followers_count?: number | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          score?: number;
          notes?: string | null;
          raw?: Json | null;
          enriched_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          source?: Database["public"]["Enums"]["search_source"];
          source_search_job_id?: string | null;
          name?: string;
          category?: string | null;
          city?: string | null;
          state?: string | null;
          country?: string | null;
          phone?: string | null;
          email?: string | null;
          website?: string | null;
          instagram_handle?: string | null;
          whatsapp?: string | null;
          has_website?: boolean | null;
          rating?: number | null;
          reviews_count?: number | null;
          followers_count?: number | null;
          stage?: Database["public"]["Enums"]["lead_stage"];
          score?: number;
          notes?: string | null;
          raw?: Json | null;
          enriched_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
        Relationships: [];
      };
      lead_messages: {
        Row: {
          id: string;
          lead_id: string;
          user_id: string;
          channel: string;
          tone: string | null;
          content: string;
          created_at: string;
          direction: Database["public"]["Enums"]["lead_message_direction"];
          status: Database["public"]["Enums"]["lead_message_status"];
          whatsapp_msg_id: string | null;
          campaign_id: string | null;
          error_message: string | null;
          ai_generated: boolean;
        };
        Insert: {
          id?: string;
          lead_id: string;
          user_id: string;
          channel: string;
          tone?: string | null;
          content: string;
          created_at?: string;
          direction?: Database["public"]["Enums"]["lead_message_direction"];
          status?: Database["public"]["Enums"]["lead_message_status"];
          whatsapp_msg_id?: string | null;
          campaign_id?: string | null;
          error_message?: string | null;
          ai_generated?: boolean;
        };
        Update: {
          id?: string;
          lead_id?: string;
          user_id?: string;
          channel?: string;
          tone?: string | null;
          content?: string;
          created_at?: string;
          direction?: Database["public"]["Enums"]["lead_message_direction"];
          status?: Database["public"]["Enums"]["lead_message_status"];
          whatsapp_msg_id?: string | null;
          campaign_id?: string | null;
          error_message?: string | null;
          ai_generated?: boolean;
        };
        Relationships: [];
      };
      whatsapp_instances: {
        Row: {
          id: string;
          user_id: string;
          evo_instance: string;
          status: Database["public"]["Enums"]["whatsapp_status"];
          phone_number: string | null;
          qr_code: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          evo_instance: string;
          status?: Database["public"]["Enums"]["whatsapp_status"];
          phone_number?: string | null;
          qr_code?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          evo_instance?: string;
          status?: Database["public"]["Enums"]["whatsapp_status"];
          phone_number?: string | null;
          qr_code?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaigns: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          // Coluna `type` (migration 0013) — distingue campaign clássica
          // de mensagem (`'message'`) das campaigns que disparam prévias
          // de site (`'site_preview'`, hook em lib/campaigns/processor.ts).
          type: "message" | "site_preview";
          mode: Database["public"]["Enums"]["campaign_mode"];
          template_text: string | null;
          ai_channel: string | null;
          ai_tone: string | null;
          ai_goal: string | null;
          status: Database["public"]["Enums"]["campaign_status"];
          total_count: number;
          sent_count: number;
          failed_count: number;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          type?: "message" | "site_preview";
          mode: Database["public"]["Enums"]["campaign_mode"];
          template_text?: string | null;
          ai_channel?: string | null;
          ai_tone?: string | null;
          ai_goal?: string | null;
          status?: Database["public"]["Enums"]["campaign_status"];
          total_count?: number;
          sent_count?: number;
          failed_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          type?: "message" | "site_preview";
          mode?: Database["public"]["Enums"]["campaign_mode"];
          template_text?: string | null;
          ai_channel?: string | null;
          ai_tone?: string | null;
          ai_goal?: string | null;
          status?: Database["public"]["Enums"]["campaign_status"];
          total_count?: number;
          sent_count?: number;
          failed_count?: number;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      campaign_targets: {
        Row: {
          campaign_id: string;
          lead_id: string;
          status: Database["public"]["Enums"]["campaign_target_status"];
          error_message: string | null;
          sent_message_id: string | null;
          created_at: string;
        };
        Insert: {
          campaign_id: string;
          lead_id: string;
          status?: Database["public"]["Enums"]["campaign_target_status"];
          error_message?: string | null;
          sent_message_id?: string | null;
          created_at?: string;
        };
        Update: {
          campaign_id?: string;
          lead_id?: string;
          status?: Database["public"]["Enums"]["campaign_target_status"];
          error_message?: string | null;
          sent_message_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      lead_sites: {
        Row: {
          id: string;
          user_id: string;
          lead_id: string;
          slug: string;
          status: Database["public"]["Enums"]["lead_site_status"];
          variables: Json;
          generation_error: string | null;
          generated_at: string | null;
          published_at: string | null;
          sent_at: string | null;
          signed_at: string | null;
          archived_at: string | null;
          view_count: number;
          last_viewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          lead_id: string;
          slug: string;
          status?: Database["public"]["Enums"]["lead_site_status"];
          variables?: Json;
          generation_error?: string | null;
          generated_at?: string | null;
          published_at?: string | null;
          sent_at?: string | null;
          signed_at?: string | null;
          archived_at?: string | null;
          view_count?: number;
          last_viewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          lead_id?: string;
          slug?: string;
          status?: Database["public"]["Enums"]["lead_site_status"];
          variables?: Json;
          generation_error?: string | null;
          generated_at?: string | null;
          published_at?: string | null;
          sent_at?: string | null;
          signed_at?: string | null;
          archived_at?: string | null;
          view_count?: number;
          last_viewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      generation_throttle: {
        Row: {
          id: string;
          user_id: string;
          attempted_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          attempted_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          attempted_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    CompositeTypes: Record<string, never>;
    Enums: {
      search_source: "google_maps" | "instagram" | "website_contact";
      search_status: "queued" | "running" | "succeeded" | "failed";
      lead_stage:
        | "new"
        | "contacted"
        | "in_conversation"
        | "qualified"
        | "closed_won"
        | "closed_lost";
      whatsapp_status:
        | "disconnected"
        | "qr_pending"
        | "connecting"
        | "connected"
        | "error";
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
      // lead_sites.status é um text com check constraint (não é um enum nativo
      // do Postgres), mas modelamos como union type pra type-safety no TS.
      lead_site_status: "draft" | "published" | "sent" | "archived";
    };
  };
}

// Helpers convenientes baseados em padrões da Supabase
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];

export type TablesInsert<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];

export type TablesUpdate<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

export type Enums<T extends keyof Database["public"]["Enums"]> =
  Database["public"]["Enums"][T];
