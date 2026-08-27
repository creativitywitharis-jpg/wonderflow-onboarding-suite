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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      admin_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          category: string
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name: string
          category: string
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          category?: string
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_audit_log_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_memory: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          text: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          text: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_memory_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_memory_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_usage: {
        Row: {
          count: number
          org_id: string
          period: string
          updated_at: string
        }
        Insert: {
          count?: number
          org_id: string
          period: string
          updated_at?: string
        }
        Update: {
          count?: number
          org_id?: string
          period?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_usage_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_executions: {
        Row: {
          automation_id: string | null
          automation_name: string
          created_at: string
          detail: string | null
          duration_ms: number | null
          event: string
          id: string
          ok: boolean
          org_id: string
        }
        Insert: {
          automation_id?: string | null
          automation_name: string
          created_at?: string
          detail?: string | null
          duration_ms?: number | null
          event: string
          id?: string
          ok?: boolean
          org_id: string
        }
        Update: {
          automation_id?: string | null
          automation_name?: string
          created_at?: string
          detail?: string | null
          duration_ms?: number | null
          event?: string
          id?: string
          ok?: boolean
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_executions_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_executions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      automation_runs: {
        Row: {
          automation_id: string
          created_at: string
          event: string
          id: string
          note: string | null
          org_id: string
          payload: Json
          resolved_at: string | null
          resolved_by: string | null
          resume_at: string
          status: string
          step_index: number
          updated_at: string
        }
        Insert: {
          automation_id: string
          created_at?: string
          event: string
          id?: string
          note?: string | null
          org_id: string
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          resume_at: string
          status?: string
          step_index?: number
          updated_at?: string
        }
        Update: {
          automation_id?: string
          created_at?: string
          event?: string
          id?: string
          note?: string | null
          org_id?: string
          payload?: Json
          resolved_at?: string | null
          resolved_by?: string | null
          resume_at?: string
          status?: string
          step_index?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automation_runs_automation_id_fkey"
            columns: ["automation_id"]
            isOneToOne: false
            referencedRelation: "automations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automation_runs_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      automations: {
        Row: {
          action: string | null
          action_config: Json
          action_key: string
          created_at: string
          created_by: string | null
          enabled: boolean
          id: string
          last_run: string | null
          name: string
          org_id: string
          runs: number
          steps: Json | null
          trigger: string | null
          trigger_key: string
          updated_at: string
        }
        Insert: {
          action?: string | null
          action_config?: Json
          action_key?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_run?: string | null
          name: string
          org_id: string
          runs?: number
          steps?: Json | null
          trigger?: string | null
          trigger_key?: string
          updated_at?: string
        }
        Update: {
          action?: string | null
          action_config?: Json
          action_key?: string
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          id?: string
          last_run?: string | null
          name?: string
          org_id?: string
          runs?: number
          steps?: Json | null
          trigger?: string | null
          trigger_key?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "automations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "automations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          audience: string | null
          budget: number
          channel: string
          click_rate: number
          created_at: string
          created_by: string | null
          id: string
          name: string
          open_rate: number
          org_id: string
          roi: number
          sent: number
          status: string
          updated_at: string
        }
        Insert: {
          audience?: string | null
          budget?: number
          channel?: string
          click_rate?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          open_rate?: number
          org_id: string
          roi?: number
          sent?: number
          status?: string
          updated_at?: string
        }
        Update: {
          audience?: string | null
          budget?: number
          channel?: string
          click_rate?: number
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          open_rate?: number
          org_id?: string
          roi?: number
          sent?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "campaigns_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      connections: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          org_id: string
          provider: string
          status: string
          updated_at: string
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          org_id: string
          provider: string
          status?: string
          updated_at?: string
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          org_id?: string
          provider?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "connections_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "connections_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          category: string | null
          created_at: string
          created_by: string | null
          id: string
          lessons: number
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lessons?: number
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          lessons?: number
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          company: string | null
          created_at: string
          email: string | null
          health: number
          id: string
          ltv: number
          name: string
          orders: number
          org_id: string
          sentiment: string
          since: string | null
          tags: string[]
          tier: string
        }
        Insert: {
          company?: string | null
          created_at?: string
          email?: string | null
          health?: number
          id?: string
          ltv?: number
          name: string
          orders?: number
          org_id: string
          sentiment?: string
          since?: string | null
          tags?: string[]
          tier?: string
        }
        Update: {
          company?: string | null
          created_at?: string
          email?: string | null
          health?: number
          id?: string
          ltv?: number
          name?: string
          orders?: number
          org_id?: string
          sentiment?: string
          since?: string | null
          tags?: string[]
          tier?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      decisions: {
        Row: {
          created_at: string
          created_by: string | null
          decided_at: string
          id: string
          impact: string | null
          org_id: string
          result: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          decided_at?: string
          id?: string
          impact?: string | null
          org_id: string
          result?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          decided_at?: string
          id?: string
          impact?: string | null
          org_id?: string
          result?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decisions_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decisions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      employees: {
        Row: {
          created_at: string
          created_by: string | null
          department: string | null
          email: string | null
          id: string
          location: string | null
          name: string
          org_id: string
          phone: string | null
          role: string | null
          since: string | null
          skills: string[]
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name: string
          org_id: string
          phone?: string | null
          role?: string | null
          since?: string | null
          skills?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          department?: string | null
          email?: string | null
          id?: string
          location?: string | null
          name?: string
          org_id?: string
          phone?: string | null
          role?: string | null
          since?: string | null
          skills?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "employees_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "employees_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      expenses: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          notes: string | null
          org_id: string
          status: string
          supplier_id: string | null
          updated_at: string
          vendor: string | null
        }
        Insert: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          org_id: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          notes?: string | null
          org_id?: string
          status?: string
          supplier_id?: string | null
          updated_at?: string
          vendor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "expenses_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      help_messages: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role: string
          text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          text?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "help_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "help_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      initiatives: {
        Row: {
          created_at: string
          created_by: string | null
          effort: number
          id: string
          impact: number
          org_id: string
          status: string
          steps: Json
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          effort?: number
          id?: string
          impact?: number
          org_id: string
          status?: string
          steps?: Json
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          effort?: number
          id?: string
          impact?: number
          org_id?: string
          status?: string
          steps?: Json
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "initiatives_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "initiatives_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      interactions: {
        Row: {
          body: string
          channel: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          org_id: string
        }
        Insert: {
          body: string
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          org_id: string
        }
        Update: {
          body?: string
          channel?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "interactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interactions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          id: string
          invited_by: string | null
          org_id: string
          role: string
          title: string | null
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          id?: string
          invited_by?: string | null
          org_id: string
          role?: string
          title?: string | null
          token?: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: string
          title?: string | null
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount: number
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          due_date: string | null
          id: string
          issue_date: string
          items: Json
          notes: string | null
          number: string | null
          org_id: string
          paid_at: string | null
          status: string
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          number?: string | null
          org_id: string
          paid_at?: string | null
          status?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Update: {
          amount?: number
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          due_date?: string | null
          id?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          number?: string | null
          org_id?: string
          paid_at?: string | null
          status?: string
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      loyalty_settings: {
        Row: {
          created_at: string
          enabled: boolean
          grades: Json
          org_id: string
          points_per_dollar: number
          repeat: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          grades?: Json
          org_id: string
          points_per_dollar?: number
          repeat?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          grades?: Json
          org_id?: string
          points_per_dollar?: number
          repeat?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "loyalty_settings_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          id: string
          org_id: string
          role: string
          status: string
          title: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          org_id: string
          role?: string
          status?: string
          title?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          org_id?: string
          role?: string
          status?: string
          title?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          channel: string | null
          city: string | null
          created_at: string
          created_by: string | null
          customer_id: string | null
          customer_name: string | null
          eta: string | null
          id: string
          item_count: number
          items: Json
          notes: string | null
          number: string | null
          org_id: string
          priority: string
          status: string
          total: number
          updated_at: string
        }
        Insert: {
          channel?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          eta?: string | null
          id?: string
          item_count?: number
          items?: Json
          notes?: string | null
          number?: string | null
          org_id: string
          priority?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Update: {
          channel?: string | null
          city?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          customer_name?: string | null
          eta?: string | null
          id?: string
          item_count?: number
          items?: Json
          notes?: string | null
          number?: string | null
          org_id?: string
          priority?: string
          status?: string
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          ai_model: string
          created_at: string
          created_by: string | null
          currency: string
          enabled_modules: string[]
          health_score: number
          id: string
          industry: string | null
          ingest_key: string | null
          name: string
          plan: string
          slug: string | null
          timezone: string
        }
        Insert: {
          ai_model?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          enabled_modules?: string[]
          health_score?: number
          id?: string
          industry?: string | null
          ingest_key?: string | null
          name: string
          plan?: string
          slug?: string | null
          timezone?: string
        }
        Update: {
          ai_model?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          enabled_modules?: string[]
          health_score?: number
          id?: string
          industry?: string | null
          ingest_key?: string | null
          name?: string
          plan?: string
          slug?: string | null
          timezone?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          category: string | null
          cost: number
          created_at: string
          created_by: string | null
          id: string
          incoming: number
          name: string
          org_id: string
          price: number
          reorder_point: number
          sku: string | null
          stock: number
          updated_at: string
        }
        Insert: {
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          incoming?: number
          name: string
          org_id: string
          price?: number
          reorder_point?: number
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Update: {
          category?: string | null
          cost?: number
          created_at?: string
          created_by?: string | null
          id?: string
          incoming?: number
          name?: string
          org_id?: string
          price?: number
          reorder_point?: number
          sku?: string | null
          stock?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      purchase_orders: {
        Row: {
          created_at: string
          created_by: string | null
          eta: string | null
          id: string
          items: number
          notes: string | null
          number: string | null
          org_id: string
          status: string
          supplier_id: string | null
          supplier_name: string | null
          total: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          eta?: string | null
          id?: string
          items?: number
          notes?: string | null
          number?: string | null
          org_id: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          eta?: string | null
          id?: string
          items?: number
          notes?: string | null
          number?: string | null
          org_id?: string
          status?: string
          supplier_id?: string | null
          supplier_name?: string | null
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "purchase_orders_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      reward_codes: {
        Row: {
          code: string
          created_at: string
          customer_id: string
          customer_name: string | null
          grade: string
          id: string
          issued_at: string
          org_id: string
          points_at_issue: number
          status: string
          threshold: number
          used_at: string | null
          value: number
        }
        Insert: {
          code: string
          created_at?: string
          customer_id: string
          customer_name?: string | null
          grade: string
          id?: string
          issued_at?: string
          org_id: string
          points_at_issue?: number
          status?: string
          threshold: number
          used_at?: string | null
          value?: number
        }
        Update: {
          code?: string
          created_at?: string
          customer_id?: string
          customer_name?: string | null
          grade?: string
          id?: string
          issued_at?: string
          org_id?: string
          points_at_issue?: number
          status?: string
          threshold?: number
          used_at?: string | null
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "reward_codes_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reward_codes_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          day: string
          employee_id: string
          end_time: string | null
          id: string
          is_off: boolean
          org_id: string
          start_time: string | null
          updated_at: string
        }
        Insert: {
          day: string
          employee_id: string
          end_time?: string | null
          id?: string
          is_off?: boolean
          org_id: string
          start_time?: string | null
          updated_at?: string
        }
        Update: {
          day?: string
          employee_id?: string
          end_time?: string | null
          id?: string
          is_off?: boolean
          org_id?: string
          start_time?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "shifts_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          org_id: string
          plan: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          org_id?: string
          plan?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          category: string | null
          contact_name: string | null
          country: string | null
          created_at: string
          created_by: string | null
          email: string | null
          id: string
          lead_time_days: number
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          price_index: number
          rating: number
          spend: number
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_time_days?: number
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          price_index?: number
          rating?: number
          spend?: number
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          contact_name?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          email?: string | null
          id?: string
          lead_time_days?: number
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          price_index?: number
          rating?: number
          spend?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "suppliers_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assignee_id: string | null
          assignee_name: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          due_date: string | null
          id: string
          notes: string | null
          org_id: string
          priority: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          assignee_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          org_id: string
          priority?: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          assignee_name?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          due_date?: string | null
          id?: string
          notes?: string | null
          org_id?: string
          priority?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assignee_id_fkey"
            columns: ["assignee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channel_members: {
        Row: {
          channel_id: string
          employee_id: string
          id: string
          org_id: string
        }
        Insert: {
          channel_id: string
          employee_id: string
          id?: string
          org_id: string
        }
        Update: {
          channel_id?: string
          employee_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_members_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channel_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channels: {
        Row: {
          all_members: boolean
          created_at: string
          id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          all_members?: boolean
          created_at?: string
          id?: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          all_members?: boolean
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channels_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      team_posts: {
        Row: {
          author_id: string | null
          author_name: string
          body: string
          channel: string
          channel_id: string | null
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          author_id?: string | null
          author_name?: string
          body: string
          channel?: string
          channel_id?: string | null
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          author_id?: string | null
          author_name?: string
          body?: string
          channel?: string
          channel_id?: string | null
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_posts_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_posts_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      training_progress: {
        Row: {
          assigned_at: string
          completed: boolean
          completed_at: string | null
          course_id: string
          employee_id: string
          id: string
          org_id: string
        }
        Insert: {
          assigned_at?: string
          completed?: boolean
          completed_at?: string | null
          course_id: string
          employee_id: string
          id?: string
          org_id: string
        }
        Update: {
          assigned_at?: string
          completed?: boolean
          completed_at?: string | null
          course_id?: string
          employee_id?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "training_progress_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "training_progress_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          name: string | null
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          name?: string | null
          source?: string | null
        }
        Relationships: []
      }
      webhook_endpoints: {
        Row: {
          created_at: string
          created_by: string | null
          enabled: boolean
          events: string[]
          failures: number
          id: string
          last_delivery: string | null
          last_status: number | null
          org_id: string
          secret: string
          updated_at: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          events?: string[]
          failures?: number
          id?: string
          last_delivery?: string | null
          last_status?: number | null
          org_id: string
          secret: string
          updated_at?: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          enabled?: boolean
          events?: string[]
          failures?: number
          id?: string
          last_delivery?: string | null
          last_status?: number | null
          org_id?: string
          secret?: string
          updated_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "webhook_endpoints_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "webhook_endpoints_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      adjust_stock: { Args: { p_delta: number; p_id: string }; Returns: number }
      has_org_role:
        | {
            Args: { _org_id: string; _roles: string[]; _user_id: string }
            Returns: boolean
          }
        | { Args: { org: string; roles: string[] }; Returns: boolean }
      increment_ai_usage: {
        Args: { p_org: string; p_period: string }
        Returns: number
      }
      is_org_member:
        | { Args: { _org_id: string; _user_id: string }; Returns: boolean }
        | { Args: { org: string }; Returns: boolean }
      leave_organization: { Args: { p_org_id: string }; Returns: undefined }
      shares_org: { Args: { other: string }; Returns: boolean }
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
  public: {
    Enums: {},
  },
} as const
