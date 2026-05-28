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
  public: {
    Tables: {
      ai_actions: {
        Row: {
          conversation_id: string | null
          cost_usd: number | null
          created_at: string
          error: string | null
          id: string
          input: Json
          kind: Database["public"]["Enums"]["ai_action_kind"]
          latency_ms: number | null
          lead_id: string | null
          model: string
          organization_id: string
          output: Json
          status: Database["public"]["Enums"]["ai_action_status"]
          tokens_input: number | null
          tokens_output: number | null
        }
        Insert: {
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          kind: Database["public"]["Enums"]["ai_action_kind"]
          latency_ms?: number | null
          lead_id?: string | null
          model: string
          organization_id: string
          output?: Json
          status?: Database["public"]["Enums"]["ai_action_status"]
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Update: {
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string
          error?: string | null
          id?: string
          input?: Json
          kind?: Database["public"]["Enums"]["ai_action_kind"]
          latency_ms?: number | null
          lead_id?: string | null
          model?: string
          organization_id?: string
          output?: Json
          status?: Database["public"]["Enums"]["ai_action_status"]
          tokens_input?: number | null
          tokens_output?: number | null
        }
        Relationships: []
      }
      api_keys: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          key_hash: string
          key_prefix: string
          last_used_at: string | null
          name: string
          organization_id: string
          revoked_at: string | null
          scopes: string[]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash: string
          key_prefix: string
          last_used_at?: string | null
          name: string
          organization_id: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          key_hash?: string
          key_prefix?: string
          last_used_at?: string | null
          name?: string
          organization_id?: string
          revoked_at?: string | null
          scopes?: string[]
          updated_at?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          actor_user_id: string | null
          after: Json | null
          before: Json | null
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          ip_address: string | null
          organization_id: string | null
          user_agent: string | null
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          after?: Json | null
          before?: Json | null
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          ip_address?: string | null
          organization_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      builder_documents: {
        Row: {
          archived_at: string | null
          campaign_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          is_published: boolean
          name: string
          organization_id: string
          published_at: string | null
          published_version: number | null
          schema: Json
          status: string
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          archived_at?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          name: string
          organization_id: string
          published_at?: string | null
          published_version?: number | null
          schema?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          archived_at?: string | null
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          is_published?: boolean
          name?: string
          organization_id?: string
          published_at?: string | null
          published_version?: number | null
          schema?: Json
          status?: string
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: []
      }
      campaign_enrollments: {
        Row: {
          campaign_id: string
          completed_at: string | null
          context: Json
          created_at: string
          current_node_id: string | null
          enrolled_at: string
          flow_definition_id: string | null
          id: string
          last_error: string | null
          lead_id: string
          next_run_at: string | null
          organization_id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          updated_at: string
        }
        Insert: {
          campaign_id: string
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_node_id?: string | null
          enrolled_at?: string
          flow_definition_id?: string | null
          id?: string
          last_error?: string | null
          lead_id: string
          next_run_at?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          completed_at?: string | null
          context?: Json
          created_at?: string
          current_node_id?: string | null
          enrolled_at?: string
          flow_definition_id?: string | null
          id?: string
          last_error?: string | null
          lead_id?: string
          next_run_at?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaign_enrollments_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_current_node_id_fkey"
            columns: ["current_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_flow_definition_id_fkey"
            columns: ["flow_definition_id"]
            isOneToOne: false
            referencedRelation: "flow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaign_enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          channel: Database["public"]["Enums"]["campaign_channel"]
          completed_at: string | null
          created_at: string
          created_by: string | null
          daily_send_limit: number | null
          description: string | null
          id: string
          name: string
          objective: string | null
          organization_id: string
          scheduled_at: string | null
          settings: Json
          started_at: string | null
          status: Database["public"]["Enums"]["campaign_status"]
          total_enrolled: number
          total_replied: number
          total_sent: number
          updated_at: string
        }
        Insert: {
          channel?: Database["public"]["Enums"]["campaign_channel"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          daily_send_limit?: number | null
          description?: string | null
          id?: string
          name: string
          objective?: string | null
          organization_id: string
          scheduled_at?: string | null
          settings?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total_enrolled?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
        }
        Update: {
          channel?: Database["public"]["Enums"]["campaign_channel"]
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          daily_send_limit?: number | null
          description?: string | null
          id?: string
          name?: string
          objective?: string | null
          organization_id?: string
          scheduled_at?: string | null
          settings?: Json
          started_at?: string | null
          status?: Database["public"]["Enums"]["campaign_status"]
          total_enrolled?: number
          total_replied?: number
          total_sent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          ai_enabled: boolean
          assigned_user_id: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at: string
          external_thread_id: string | null
          id: string
          last_message_at: string | null
          last_message_preview: string | null
          lead_id: string | null
          organization_id: string
          status: Database["public"]["Enums"]["conversation_status"]
          subject: string | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          ai_enabled?: boolean
          assigned_user_id?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id: string
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          ai_enabled?: boolean
          assigned_user_id?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          created_at?: string
          external_thread_id?: string | null
          id?: string
          last_message_at?: string | null
          last_message_preview?: string | null
          lead_id?: string | null
          organization_id?: string
          status?: Database["public"]["Enums"]["conversation_status"]
          subject?: string | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          closed_at: string | null
          created_at: string
          created_by: string | null
          currency: string
          expected_close_at: string | null
          id: string
          lead_id: string | null
          notes: string | null
          organization_id: string
          owner_user_id: string | null
          position: number
          probability: number
          stage: Database["public"]["Enums"]["deal_stage"]
          status: Database["public"]["Enums"]["deal_status"]
          title: string
          updated_at: string
          value: number | null
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_close_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id: string
          owner_user_id?: string | null
          position?: number
          probability?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          status?: Database["public"]["Enums"]["deal_status"]
          title: string
          updated_at?: string
          value?: number | null
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          expected_close_at?: string | null
          id?: string
          lead_id?: string | null
          notes?: string | null
          organization_id?: string
          owner_user_id?: string | null
          position?: number
          probability?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          status?: Database["public"]["Enums"]["deal_status"]
          title?: string
          updated_at?: string
          value?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "deals_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
        ]
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          from_email: string
          id: string
          metadata: Json
          organization_id: string | null
          provider: string
          provider_message_id: string | null
          purpose: string
          status: string
          subject: string
          template_key: string | null
          to_email: string
          triggered_by: string | null
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          from_email: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          provider?: string
          provider_message_id?: string | null
          purpose: string
          status?: string
          subject: string
          template_key?: string | null
          to_email: string
          triggered_by?: string | null
        }
        Update: {
          created_at?: string
          error_message?: string | null
          from_email?: string
          id?: string
          metadata?: Json
          organization_id?: string | null
          provider?: string
          provider_message_id?: string | null
          purpose?: string
          status?: string
          subject?: string
          template_key?: string | null
          to_email?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "email_send_log_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_definitions: {
        Row: {
          campaign_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          graph: Json
          id: string
          is_published: boolean
          name: string
          organization_id: string
          published_at: string | null
          updated_at: string
          version: number
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          graph?: Json
          id?: string
          is_published?: boolean
          name: string
          organization_id: string
          published_at?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          graph?: Json
          id?: string
          is_published?: boolean
          name?: string
          organization_id?: string
          published_at?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "flow_definitions_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_definitions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_edges: {
        Row: {
          condition_label: string | null
          config: Json
          created_at: string
          flow_definition_id: string
          id: string
          organization_id: string
          source_node_id: string
          target_node_id: string
        }
        Insert: {
          condition_label?: string | null
          config?: Json
          created_at?: string
          flow_definition_id: string
          id?: string
          organization_id: string
          source_node_id: string
          target_node_id: string
        }
        Update: {
          condition_label?: string | null
          config?: Json
          created_at?: string
          flow_definition_id?: string
          id?: string
          organization_id?: string
          source_node_id?: string
          target_node_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_edges_flow_definition_id_fkey"
            columns: ["flow_definition_id"]
            isOneToOne: false
            referencedRelation: "flow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_source_node_id_fkey"
            columns: ["source_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_edges_target_node_id_fkey"
            columns: ["target_node_id"]
            isOneToOne: false
            referencedRelation: "flow_nodes"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_nodes: {
        Row: {
          config: Json
          created_at: string
          flow_definition_id: string
          id: string
          label: string | null
          node_key: string
          organization_id: string
          position_x: number
          position_y: number
          type: Database["public"]["Enums"]["flow_node_type"]
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          flow_definition_id: string
          id?: string
          label?: string | null
          node_key: string
          organization_id: string
          position_x?: number
          position_y?: number
          type: Database["public"]["Enums"]["flow_node_type"]
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          flow_definition_id?: string
          id?: string
          label?: string | null
          node_key?: string
          organization_id?: string
          position_x?: number
          position_y?: number
          type?: Database["public"]["Enums"]["flow_node_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_nodes_flow_definition_id_fkey"
            columns: ["flow_definition_id"]
            isOneToOne: false
            referencedRelation: "flow_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_nodes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_steps: {
        Row: {
          config: Json
          created_at: string
          document_id: string
          id: string
          is_entry: boolean
          position_x: number
          position_y: number
          type: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          document_id: string
          id?: string
          is_entry?: boolean
          position_x?: number
          position_y?: number
          type: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          document_id?: string
          id?: string
          is_entry?: boolean
          position_x?: number
          position_y?: number
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_steps_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "builder_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      flow_transitions: {
        Row: {
          branch: string
          created_at: string
          document_id: string
          from_step_id: string
          id: string
          to_step_id: string
        }
        Insert: {
          branch?: string
          created_at?: string
          document_id: string
          from_step_id: string
          id?: string
          to_step_id: string
        }
        Update: {
          branch?: string
          created_at?: string
          document_id?: string
          from_step_id?: string
          id?: string
          to_step_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flow_transitions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "builder_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_transitions_from_step_id_fkey"
            columns: ["from_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flow_transitions_to_step_id_fkey"
            columns: ["to_step_id"]
            isOneToOne: false
            referencedRelation: "flow_steps"
            referencedColumns: ["id"]
          },
        ]
      }
      handoff_events: {
        Row: {
          conversation_id: string
          created_at: string
          from_mode: string
          id: string
          organization_id: string
          reason: string | null
          to_mode: string
          triggered_by: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string
          from_mode: string
          id?: string
          organization_id: string
          reason?: string | null
          to_mode: string
          triggered_by?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string
          from_mode?: string
          id?: string
          organization_id?: string
          reason?: string | null
          to_mode?: string
          triggered_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "handoff_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "handoff_events_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_credentials: {
        Row: {
          created_at: string
          id: string
          integration_id: string
          key: string
          metadata: Json
          organization_id: string
          updated_at: string
          value_encrypted: string
        }
        Insert: {
          created_at?: string
          id?: string
          integration_id: string
          key: string
          metadata?: Json
          organization_id: string
          updated_at?: string
          value_encrypted: string
        }
        Update: {
          created_at?: string
          id?: string
          integration_id?: string
          key?: string
          metadata?: Json
          organization_id?: string
          updated_at?: string
          value_encrypted?: string
        }
        Relationships: [
          {
            foreignKeyName: "integration_credentials_integration_id_fkey"
            columns: ["integration_id"]
            isOneToOne: false
            referencedRelation: "organization_integrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "integration_credentials_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      integration_providers: {
        Row: {
          category: string
          config_schema: Json
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          category: string
          config_schema?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          category?: string
          config_schema?: Json
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_chunks: {
        Row: {
          content: string
          created_at: string
          embedding: string | null
          id: string
          metadata: Json
          organization_id: string
          source_id: string
          token_count: number | null
        }
        Insert: {
          content: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          source_id: string
          token_count?: number | null
        }
        Update: {
          content?: string
          created_at?: string
          embedding?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          source_id?: string
          token_count?: number | null
        }
        Relationships: []
      }
      knowledge_sources: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: Database["public"]["Enums"]["knowledge_source_kind"]
          last_synced_at: string | null
          name: string
          organization_id: string
          settings: Json
          source_url: string | null
          status: Database["public"]["Enums"]["knowledge_source_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind: Database["public"]["Enums"]["knowledge_source_kind"]
          last_synced_at?: string | null
          name: string
          organization_id: string
          settings?: Json
          source_url?: string | null
          status?: Database["public"]["Enums"]["knowledge_source_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: Database["public"]["Enums"]["knowledge_source_kind"]
          last_synced_at?: string | null
          name?: string
          organization_id?: string
          settings?: Json
          source_url?: string | null
          status?: Database["public"]["Enums"]["knowledge_source_status"]
          updated_at?: string
        }
        Relationships: []
      }
      lead_activities: {
        Row: {
          author_user_id: string | null
          created_at: string
          description: string | null
          id: string
          lead_id: string
          organization_id: string
          payload: Json
          title: string
          type: Database["public"]["Enums"]["lead_activity_type"]
        }
        Insert: {
          author_user_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id: string
          organization_id: string
          payload?: Json
          title: string
          type: Database["public"]["Enums"]["lead_activity_type"]
        }
        Update: {
          author_user_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          lead_id?: string
          organization_id?: string
          payload?: Json
          title?: string
          type?: Database["public"]["Enums"]["lead_activity_type"]
        }
        Relationships: [
          {
            foreignKeyName: "lead_activities_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_activities_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_enrichment: {
        Row: {
          confidence: number | null
          created_at: string
          fetched_at: string
          id: string
          lead_id: string
          organization_id: string
          payload: Json
          provider: string
        }
        Insert: {
          confidence?: number | null
          created_at?: string
          fetched_at?: string
          id?: string
          lead_id: string
          organization_id: string
          payload?: Json
          provider: string
        }
        Update: {
          confidence?: number | null
          created_at?: string
          fetched_at?: string
          id?: string
          lead_id?: string
          organization_id?: string
          payload?: Json
          provider?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_enrichment_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "leads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lead_enrichment_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_sources: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          slug: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          slug: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          slug?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lead_sources_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      leads: {
        Row: {
          archived_at: string | null
          city: string | null
          company_name: string | null
          corporate_phone: string | null
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          custom_fields: Json
          department: string | null
          email: string | null
          employee_count: number | null
          enrichment_data: Json
          estimated_value: number | null
          full_name: string
          id: string
          industry: string | null
          job_title: string | null
          last_contact_at: string | null
          linkedin_url: string | null
          mobile_phone: string | null
          next_followup_at: string | null
          organization_id: string
          owner_user_id: string | null
          personal_email: string | null
          phone: string | null
          score: number
          secondary_email: string | null
          seniority: string | null
          source_id: string | null
          state: string | null
          status: Database["public"]["Enums"]["lead_status"]
          tags: string[]
          temperature: Database["public"]["Enums"]["lead_temperature"]
          updated_at: string
          website_url: string | null
        }
        Insert: {
          archived_at?: string | null
          city?: string | null
          company_name?: string | null
          corporate_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_fields?: Json
          department?: string | null
          email?: string | null
          employee_count?: number | null
          enrichment_data?: Json
          estimated_value?: number | null
          full_name: string
          id?: string
          industry?: string | null
          job_title?: string | null
          last_contact_at?: string | null
          linkedin_url?: string | null
          mobile_phone?: string | null
          next_followup_at?: string | null
          organization_id: string
          owner_user_id?: string | null
          personal_email?: string | null
          phone?: string | null
          score?: number
          secondary_email?: string | null
          seniority?: string | null
          source_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          archived_at?: string | null
          city?: string | null
          company_name?: string | null
          corporate_phone?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_fields?: Json
          department?: string | null
          email?: string | null
          employee_count?: number | null
          enrichment_data?: Json
          estimated_value?: number | null
          full_name?: string
          id?: string
          industry?: string | null
          job_title?: string | null
          last_contact_at?: string | null
          linkedin_url?: string | null
          mobile_phone?: string | null
          next_followup_at?: string | null
          organization_id?: string
          owner_user_id?: string | null
          personal_email?: string | null
          phone?: string | null
          score?: number
          secondary_email?: string | null
          seniority?: string | null
          source_id?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["lead_status"]
          tags?: string[]
          temperature?: Database["public"]["Enums"]["lead_temperature"]
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "leads_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "leads_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "lead_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachments: Json
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          conversation_id: string
          created_at: string
          delivered_at: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id: string | null
          failed_reason: string | null
          id: string
          metadata: Json
          organization_id: string
          read_at: string | null
          sender_user_id: string | null
          sent_at: string | null
          sent_by_ai: boolean
          status: Database["public"]["Enums"]["message_status"]
        }
        Insert: {
          attachments?: Json
          body?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          conversation_id: string
          created_at?: string
          delivered_at?: string | null
          direction: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          failed_reason?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          read_at?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          sent_by_ai?: boolean
          status?: Database["public"]["Enums"]["message_status"]
        }
        Update: {
          attachments?: Json
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          conversation_id?: string
          created_at?: string
          delivered_at?: string | null
          direction?: Database["public"]["Enums"]["message_direction"]
          external_message_id?: string | null
          failed_reason?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          read_at?: string | null
          sender_user_id?: string | null
          sent_at?: string | null
          sent_by_ai?: boolean
          status?: Database["public"]["Enums"]["message_status"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_integrations: {
        Row: {
          config: Json
          connected_at: string | null
          connected_by: string | null
          created_at: string
          display_name: string | null
          id: string
          last_error: string | null
          last_synced_at: string | null
          organization_id: string
          provider_id: string
          status: Database["public"]["Enums"]["integration_status"]
          updated_at: string
        }
        Insert: {
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          organization_id: string
          provider_id: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Update: {
          config?: Json
          connected_at?: string | null
          connected_by?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          last_error?: string | null
          last_synced_at?: string | null
          organization_id?: string
          provider_id?: string
          status?: Database["public"]["Enums"]["integration_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_integrations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_integrations_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "integration_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          last_sent_at: string | null
          organization_id: string
          revoked_at: string | null
          role: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          last_sent_at?: string | null
          organization_id: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          last_sent_at?: string | null
          organization_id?: string
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          invited_by: string | null
          joined_at: string
          organization_id: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          invited_by?: string | null
          joined_at?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          status?: Database["public"]["Enums"]["member_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "company_members_company_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_org_fk"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          billing_email: string | null
          country: string | null
          created_at: string
          default_locale: string
          deleted_at: string | null
          id: string
          industry: string | null
          logo_url: string | null
          max_leads: number
          max_users: number
          name: string
          owner_user_id: string | null
          slug: string
          status: Database["public"]["Enums"]["organization_status"]
          timezone: string
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          billing_email?: string | null
          country?: string | null
          created_at?: string
          default_locale?: string
          deleted_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          max_leads?: number
          max_users?: number
          name: string
          owner_user_id?: string | null
          slug: string
          status?: Database["public"]["Enums"]["organization_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          billing_email?: string | null
          country?: string | null
          created_at?: string
          default_locale?: string
          deleted_at?: string | null
          id?: string
          industry?: string | null
          logo_url?: string | null
          max_leads?: number
          max_users?: number
          name?: string
          owner_user_id?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["organization_status"]
          timezone?: string
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      outbound_messages: {
        Row: {
          attempts: number
          body: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          conversation_id: string | null
          created_at: string
          delivered_at: string | null
          external_id: string | null
          failed_reason: string | null
          id: string
          integration_id: string | null
          lead_id: string | null
          organization_id: string
          payload: Json
          scheduled_for: string
          sent_at: string | null
          status: Database["public"]["Enums"]["outbound_status"]
          to_address: string
          updated_at: string
        }
        Insert: {
          attempts?: number
          body?: string | null
          channel: Database["public"]["Enums"]["message_channel"]
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          external_id?: string | null
          failed_reason?: string | null
          id?: string
          integration_id?: string | null
          lead_id?: string | null
          organization_id: string
          payload?: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_status"]
          to_address: string
          updated_at?: string
        }
        Update: {
          attempts?: number
          body?: string | null
          channel?: Database["public"]["Enums"]["message_channel"]
          conversation_id?: string | null
          created_at?: string
          delivered_at?: string | null
          external_id?: string | null
          failed_reason?: string | null
          id?: string
          integration_id?: string | null
          lead_id?: string | null
          organization_id?: string
          payload?: Json
          scheduled_for?: string
          sent_at?: string | null
          status?: Database["public"]["Enums"]["outbound_status"]
          to_address?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_period: Database["public"]["Enums"]["billing_period"]
          created_at: string
          currency: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          is_public: boolean
          max_leads: number
          max_messages_per_month: number
          max_users: number
          name: string
          price_cents: number
          slug: string
          updated_at: string
        }
        Insert: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_leads?: number
          max_messages_per_month?: number
          max_users?: number
          name: string
          price_cents?: number
          slug: string
          updated_at?: string
        }
        Update: {
          billing_period?: Database["public"]["Enums"]["billing_period"]
          created_at?: string
          currency?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          is_public?: boolean
          max_leads?: number
          max_messages_per_month?: number
          max_users?: number
          name?: string
          price_cents?: number
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          description: string | null
          is_secret: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value_encrypted: string | null
          value_plain: Json | null
        }
        Insert: {
          description?: string | null
          is_secret?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value_encrypted?: string | null
          value_plain?: Json | null
        }
        Update: {
          description?: string | null
          is_secret?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value_encrypted?: string | null
          value_plain?: Json | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scheduled_jobs: {
        Row: {
          attempts: number
          created_at: string
          id: string
          kind: string
          last_error: string | null
          locked_at: string | null
          locked_by: string | null
          max_attempts: number
          organization_id: string | null
          payload: Json
          run_at: string
          scope: string
          status: Database["public"]["Enums"]["job_status"]
          updated_at: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          id?: string
          kind: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string | null
          payload?: Json
          run_at?: string
          scope?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Update: {
          attempts?: number
          created_at?: string
          id?: string
          kind?: string
          last_error?: string | null
          locked_at?: string | null
          locked_by?: string | null
          max_attempts?: number
          organization_id?: string | null
          payload?: Json
          run_at?: string
          scope?: string
          status?: Database["public"]["Enums"]["job_status"]
          updated_at?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_subscription_id: string | null
          id: string
          metadata: Json
          organization_id: string
          plan_id: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
        }
        Insert: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json
          organization_id: string
          plan_id: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Update: {
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_subscription_id?: string | null
          id?: string
          metadata?: Json
          organization_id?: string
          plan_id?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      usage_counters: {
        Row: {
          created_at: string
          id: string
          metric: string
          organization_id: string
          period_end: string
          period_start: string
          updated_at: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          metric: string
          organization_id: string
          period_end: string
          period_start: string
          updated_at?: string
          value?: number
        }
        Update: {
          created_at?: string
          id?: string
          metric?: string
          organization_id?: string
          period_end?: string
          period_start?: string
          updated_at?: string
          value?: number
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _platform_passphrase: { Args: never; Returns: string }
      accept_invitation: { Args: { _token: string }; Returns: string }
      get_invitation_by_token: {
        Args: { _token: string }
        Returns: {
          email: string
          expires_at: string
          id: string
          organization_id: string
          organization_name: string
          role: Database["public"]["Enums"]["app_role"]
        }[]
      }
      get_platform_plain: { Args: { _key: string }; Returns: Json }
      get_platform_secret: { Args: { _key: string }; Returns: string }
      get_user_org_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      list_org_members: {
        Args: { _org_id: string }
        Returns: {
          email: string
          full_name: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["app_role"]
          status: Database["public"]["Enums"]["member_status"]
          user_id: string
        }[]
      }
      log_email_send: {
        Args: {
          _from_email: string
          _metadata: Json
          _organization_id: string
          _purpose: string
          _subject: string
          _template_key: string
          _to_email: string
          _triggered_by: string
        }
        Returns: string
      }
      provision_user_account: {
        Args: {
          _email: string
          _full_name: string
          _org_name: string
          _user_id: string
        }
        Returns: string
      }
      set_platform_plain: {
        Args: { _key: string; _value: Json }
        Returns: undefined
      }
      set_platform_secret: {
        Args: { _key: string; _value: string }
        Returns: undefined
      }
      slugify: { Args: { _input: string }; Returns: string }
      update_email_send_status: {
        Args: {
          _error_message: string
          _id: string
          _provider_message_id: string
          _status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      ai_action_kind:
        | "reply_draft"
        | "auto_reply"
        | "classify"
        | "summarize"
        | "enrich"
        | "extract"
        | "other"
      ai_action_status: "pending" | "succeeded" | "failed"
      app_role: "master_admin" | "company_admin" | "user"
      billing_period: "monthly" | "quarterly" | "yearly"
      campaign_channel: "whatsapp" | "email" | "linkedin" | "sms" | "multi"
      campaign_status:
        | "draft"
        | "scheduled"
        | "running"
        | "paused"
        | "completed"
        | "archived"
      conversation_status: "open" | "pending" | "snoozed" | "closed"
      deal_stage:
        | "lead"
        | "qualified"
        | "proposal"
        | "negotiation"
        | "won"
        | "lost"
      deal_status: "open" | "won" | "lost"
      enrollment_status:
        | "pending"
        | "active"
        | "paused"
        | "completed"
        | "failed"
        | "cancelled"
      flow_node_type:
        | "trigger"
        | "send_message"
        | "wait"
        | "condition"
        | "action"
        | "ai_step"
        | "enrich"
        | "tag"
        | "end"
      integration_status: "disconnected" | "connected" | "error" | "pending"
      job_status: "pending" | "running" | "completed" | "failed" | "cancelled"
      knowledge_source_kind: "url" | "file" | "text" | "faq"
      knowledge_source_status: "pending" | "syncing" | "ready" | "error"
      lead_activity_type:
        | "note"
        | "status_change"
        | "email_sent"
        | "email_received"
        | "call"
        | "meeting"
        | "message_sent"
        | "message_received"
        | "enrichment"
        | "system"
      lead_status:
        | "new"
        | "contacted"
        | "qualified"
        | "proposal"
        | "won"
        | "lost"
        | "archived"
      lead_temperature: "cold" | "warm" | "hot"
      member_status: "active" | "invited" | "suspended"
      message_channel: "whatsapp" | "email" | "linkedin" | "sms" | "internal"
      message_direction: "inbound" | "outbound"
      message_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "read"
        | "failed"
      organization_status: "active" | "inactive" | "trial"
      outbound_status:
        | "queued"
        | "sending"
        | "sent"
        | "delivered"
        | "failed"
        | "cancelled"
      subscription_status:
        | "trialing"
        | "active"
        | "past_due"
        | "canceled"
        | "incomplete"
        | "paused"
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
      ai_action_kind: [
        "reply_draft",
        "auto_reply",
        "classify",
        "summarize",
        "enrich",
        "extract",
        "other",
      ],
      ai_action_status: ["pending", "succeeded", "failed"],
      app_role: ["master_admin", "company_admin", "user"],
      billing_period: ["monthly", "quarterly", "yearly"],
      campaign_channel: ["whatsapp", "email", "linkedin", "sms", "multi"],
      campaign_status: [
        "draft",
        "scheduled",
        "running",
        "paused",
        "completed",
        "archived",
      ],
      conversation_status: ["open", "pending", "snoozed", "closed"],
      deal_stage: [
        "lead",
        "qualified",
        "proposal",
        "negotiation",
        "won",
        "lost",
      ],
      deal_status: ["open", "won", "lost"],
      enrollment_status: [
        "pending",
        "active",
        "paused",
        "completed",
        "failed",
        "cancelled",
      ],
      flow_node_type: [
        "trigger",
        "send_message",
        "wait",
        "condition",
        "action",
        "ai_step",
        "enrich",
        "tag",
        "end",
      ],
      integration_status: ["disconnected", "connected", "error", "pending"],
      job_status: ["pending", "running", "completed", "failed", "cancelled"],
      knowledge_source_kind: ["url", "file", "text", "faq"],
      knowledge_source_status: ["pending", "syncing", "ready", "error"],
      lead_activity_type: [
        "note",
        "status_change",
        "email_sent",
        "email_received",
        "call",
        "meeting",
        "message_sent",
        "message_received",
        "enrichment",
        "system",
      ],
      lead_status: [
        "new",
        "contacted",
        "qualified",
        "proposal",
        "won",
        "lost",
        "archived",
      ],
      lead_temperature: ["cold", "warm", "hot"],
      member_status: ["active", "invited", "suspended"],
      message_channel: ["whatsapp", "email", "linkedin", "sms", "internal"],
      message_direction: ["inbound", "outbound"],
      message_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "read",
        "failed",
      ],
      organization_status: ["active", "inactive", "trial"],
      outbound_status: [
        "queued",
        "sending",
        "sent",
        "delivered",
        "failed",
        "cancelled",
      ],
      subscription_status: [
        "trialing",
        "active",
        "past_due",
        "canceled",
        "incomplete",
        "paused",
      ],
    },
  },
} as const
