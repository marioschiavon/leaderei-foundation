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
          country: string | null
          created_at: string
          created_by: string | null
          currency: string
          custom_fields: Json
          email: string | null
          estimated_value: number | null
          full_name: string
          id: string
          job_title: string | null
          last_contact_at: string | null
          linkedin_url: string | null
          next_followup_at: string | null
          organization_id: string
          owner_user_id: string | null
          phone: string | null
          score: number
          source_id: string | null
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
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_fields?: Json
          email?: string | null
          estimated_value?: number | null
          full_name: string
          id?: string
          job_title?: string | null
          last_contact_at?: string | null
          linkedin_url?: string | null
          next_followup_at?: string | null
          organization_id: string
          owner_user_id?: string | null
          phone?: string | null
          score?: number
          source_id?: string | null
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
          country?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          custom_fields?: Json
          email?: string | null
          estimated_value?: number | null
          full_name?: string
          id?: string
          job_title?: string | null
          last_contact_at?: string | null
          linkedin_url?: string | null
          next_followup_at?: string | null
          organization_id?: string
          owner_user_id?: string | null
          phone?: string | null
          score?: number
          source_id?: string | null
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
    }
    Enums: {
      app_role: "master_admin" | "company_admin" | "user"
      campaign_channel: "whatsapp" | "email" | "linkedin" | "sms" | "multi"
      campaign_status:
        | "draft"
        | "scheduled"
        | "running"
        | "paused"
        | "completed"
        | "archived"
      conversation_status: "open" | "pending" | "snoozed" | "closed"
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
      app_role: ["master_admin", "company_admin", "user"],
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
    },
  },
} as const
