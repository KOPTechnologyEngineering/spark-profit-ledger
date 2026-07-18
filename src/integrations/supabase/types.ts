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
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tbl_collection_activity_logs: {
        Row: {
          action: string
          actor_id: string | null
          actor_name: string
          chase_item_id: string | null
          created_at: string
          detail: string
          id: string
          invoice_id: string | null
          metadata: Json
          user_id: string
        }
        Insert: {
          action: string
          actor_id?: string | null
          actor_name?: string
          chase_item_id?: string | null
          created_at?: string
          detail?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          user_id: string
        }
        Update: {
          action?: string
          actor_id?: string | null
          actor_name?: string
          chase_item_id?: string | null
          created_at?: string
          detail?: string
          id?: string
          invoice_id?: string | null
          metadata?: Json
          user_id?: string
        }
        Relationships: []
      }
      tbl_collection_chase_items: {
        Row: {
          assigned_to: string | null
          chase_stage: string
          created_at: string
          customer_email: string
          customer_name: string
          id: string
          invoice_id: string
          last_reminder_at: string | null
          next_reminder_at: string | null
          notes: string
          reminders_sent: number
          rule_id: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          chase_stage?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          invoice_id: string
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          notes?: string
          reminders_sent?: number
          rule_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          chase_stage?: string
          created_at?: string
          customer_email?: string
          customer_name?: string
          id?: string
          invoice_id?: string
          last_reminder_at?: string | null
          next_reminder_at?: string | null
          notes?: string
          reminders_sent?: number
          rule_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_collection_disputes: {
        Row: {
          assigned_to: string | null
          chase_item_id: string | null
          created_at: string
          customer_name: string
          description: string
          documents: Json
          id: string
          internal_notes: string
          invoice_id: string
          raised_by: string | null
          raised_by_name: string
          reason: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_to?: string | null
          chase_item_id?: string | null
          created_at?: string
          customer_name?: string
          description?: string
          documents?: Json
          id?: string
          internal_notes?: string
          invoice_id: string
          raised_by?: string | null
          raised_by_name?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_to?: string | null
          chase_item_id?: string | null
          created_at?: string
          customer_name?: string
          description?: string
          documents?: Json
          id?: string
          internal_notes?: string
          invoice_id?: string
          raised_by?: string | null
          raised_by_name?: string
          reason?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_collection_email_templates: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          subject: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          subject: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          subject?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_collection_escalations: {
        Row: {
          amount: number
          assigned_to: string | null
          chase_item_id: string | null
          created_at: string
          customer_name: string
          days_overdue: number
          due_date: string | null
          id: string
          invoice_id: string
          level: string
          reason: string
          resolution_notes: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          assigned_to?: string | null
          chase_item_id?: string | null
          created_at?: string
          customer_name?: string
          days_overdue?: number
          due_date?: string | null
          id?: string
          invoice_id: string
          level?: string
          reason?: string
          resolution_notes?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          assigned_to?: string | null
          chase_item_id?: string | null
          created_at?: string
          customer_name?: string
          days_overdue?: number
          due_date?: string | null
          id?: string
          invoice_id?: string
          level?: string
          reason?: string
          resolution_notes?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_collection_payment_promises: {
        Row: {
          amount_promised: number
          chase_item_id: string | null
          contact_person: string
          created_at: string
          customer_name: string
          id: string
          invoice_id: string
          notes: string
          promised_date: string
          reminder_date: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_promised?: number
          chase_item_id?: string | null
          contact_person?: string
          created_at?: string
          customer_name?: string
          id?: string
          invoice_id: string
          notes?: string
          promised_date: string
          reminder_date?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_promised?: number
          chase_item_id?: string | null
          contact_person?: string
          created_at?: string
          customer_name?: string
          id?: string
          invoice_id?: string
          notes?: string
          promised_date?: string
          reminder_date?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_collection_reminders: {
        Row: {
          body: string
          chase_item_id: string
          created_at: string
          delivered_at: string | null
          error: string
          failed_at: string | null
          id: string
          invoice_id: string
          message_id: string | null
          recipient_email: string
          sent_at: string
          status: string
          subject: string
          template_id: string | null
          user_id: string
        }
        Insert: {
          body?: string
          chase_item_id: string
          created_at?: string
          delivered_at?: string | null
          error?: string
          failed_at?: string | null
          id?: string
          invoice_id: string
          message_id?: string | null
          recipient_email: string
          sent_at?: string
          status?: string
          subject?: string
          template_id?: string | null
          user_id: string
        }
        Update: {
          body?: string
          chase_item_id?: string
          created_at?: string
          delivered_at?: string | null
          error?: string
          failed_at?: string | null
          id?: string
          invoice_id?: string
          message_id?: string | null
          recipient_email?: string
          sent_at?: string
          status?: string
          subject?: string
          template_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tbl_collection_rules: {
        Row: {
          created_at: string
          customer_segment: string
          description: string
          id: string
          internal_recipients: Json
          is_active: boolean
          max_amount: number | null
          min_amount: number
          name: string
          steps: Json
          stop_conditions: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_segment?: string
          description?: string
          id?: string
          internal_recipients?: Json
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          name: string
          steps?: Json
          stop_conditions?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          customer_segment?: string
          description?: string
          id?: string
          internal_recipients?: Json
          is_active?: boolean
          max_amount?: number | null
          min_amount?: number
          name?: string
          steps?: Json
          stop_conditions?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_collection_settings: {
        Row: {
          business_days_only: boolean
          created_at: string
          default_sender_email: string
          escalation_thresholds: Json
          grace_period_days: number
          id: string
          internal_recipients: Json
          max_reminders: number
          pause_on_reply: boolean
          stop_when_paid: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          business_days_only?: boolean
          created_at?: string
          default_sender_email?: string
          escalation_thresholds?: Json
          grace_period_days?: number
          id?: string
          internal_recipients?: Json
          max_reminders?: number
          pause_on_reply?: boolean
          stop_when_paid?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          business_days_only?: boolean
          created_at?: string
          default_sender_email?: string
          escalation_thresholds?: Json
          grace_period_days?: number
          id?: string
          internal_recipients?: Json
          max_reminders?: number
          pause_on_reply?: boolean
          stop_when_paid?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_invoices: {
        Row: {
          amount: number
          approver1_id: string | null
          approver1_status: string
          approver2_id: string | null
          approver2_status: string
          client: string
          created_at: string
          created_by_name: string
          discount_percentage: number | null
          due_date: string
          id: string
          invoice_number: string
          issue_date: string
          items: Json
          notes: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          approver1_id?: string | null
          approver1_status?: string
          approver2_id?: string | null
          approver2_status?: string
          client: string
          created_at?: string
          created_by_name?: string
          discount_percentage?: number | null
          due_date?: string
          id?: string
          invoice_number: string
          issue_date?: string
          items?: Json
          notes?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          approver1_id?: string | null
          approver1_status?: string
          approver2_id?: string | null
          approver2_status?: string
          client?: string
          created_at?: string
          created_by_name?: string
          discount_percentage?: number | null
          due_date?: string
          id?: string
          invoice_number?: string
          issue_date?: string
          items?: Json
          notes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          link: string
          message: string
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string
          message?: string
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          link?: string
          message?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_organizations: {
        Row: {
          address: string | null
          created_at: string
          deleted_at: string | null
          email: string | null
          id: string
          name: string
          nature_of_business: string | null
          notes: string | null
          org_type: string
          phone: string | null
          updated_at: string
          user_id: string
          vat_number: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name: string
          nature_of_business?: string | null
          notes?: string | null
          org_type?: string
          phone?: string | null
          updated_at?: string
          user_id: string
          vat_number?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string | null
          id?: string
          name?: string
          nature_of_business?: string | null
          notes?: string | null
          org_type?: string
          phone?: string | null
          updated_at?: string
          user_id?: string
          vat_number?: string | null
        }
        Relationships: []
      }
      tbl_password_reset_attempts: {
        Row: {
          attempted_at: string
          email: string
          id: string
          ip: string | null
        }
        Insert: {
          attempted_at?: string
          email: string
          id?: string
          ip?: string | null
        }
        Update: {
          attempted_at?: string
          email?: string
          id?: string
          ip?: string | null
        }
        Relationships: []
      }
      tbl_paye_employees: {
        Row: {
          created_at: string
          designation: string
          grade: string
          gross_annual: number
          gross_pay: number
          id: string
          name: string
          net_pay: number
          ni: number
          pension_employee: number
          pension_employer: number
          role: string
          tax: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          designation?: string
          grade?: string
          gross_annual?: number
          gross_pay?: number
          id?: string
          name: string
          net_pay?: number
          ni?: number
          pension_employee?: number
          pension_employer?: number
          role?: string
          tax?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          designation?: string
          grade?: string
          gross_annual?: number
          gross_pay?: number
          id?: string
          name?: string
          net_pay?: number
          ni?: number
          pension_employee?: number
          pension_employer?: number
          role?: string
          tax?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_profiles: {
        Row: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string
          designation: string
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_approver: boolean
          is_hidden: boolean
          last_login_at: string | null
          rejection_reason: string | null
          session_timeout_minutes: number
          signature_url: string
          updated_at: string
          user_id: string
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          designation?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_approver?: boolean
          is_hidden?: boolean
          last_login_at?: string | null
          rejection_reason?: string | null
          session_timeout_minutes?: number
          signature_url?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          designation?: string
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_approver?: boolean
          is_hidden?: boolean
          last_login_at?: string | null
          rejection_reason?: string | null
          session_timeout_minutes?: number
          signature_url?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      tbl_recurring_run_details: {
        Row: {
          created_at: string
          created_count: number
          id: string
          recurring_transaction_id: string
          run_log_id: string
        }
        Insert: {
          created_at?: string
          created_count?: number
          id?: string
          recurring_transaction_id: string
          run_log_id: string
        }
        Update: {
          created_at?: string
          created_count?: number
          id?: string
          recurring_transaction_id?: string
          run_log_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_recurring_run_details_recurring_transaction_id_fkey"
            columns: ["recurring_transaction_id"]
            isOneToOne: false
            referencedRelation: "tbl_recurring_transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_recurring_run_details_run_log_id_fkey"
            columns: ["run_log_id"]
            isOneToOne: false
            referencedRelation: "tbl_recurring_run_log"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_recurring_run_log: {
        Row: {
          created: number
          error: string | null
          id: string
          processed: number
          run_at: string
          triggered_by: string
        }
        Insert: {
          created?: number
          error?: string | null
          id?: string
          processed?: number
          run_at?: string
          triggered_by?: string
        }
        Update: {
          created?: number
          error?: string | null
          id?: string
          processed?: number
          run_at?: string
          triggered_by?: string
        }
        Relationships: []
      }
      tbl_recurring_transactions: {
        Row: {
          amount: number
          category: string
          created_at: string
          created_by_name: string
          description: string
          end_date: string | null
          frequency: string
          id: string
          is_active: boolean
          last_run_date: string | null
          next_run_date: string
          organization_id: string | null
          start_date: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          created_by_name?: string
          description: string
          end_date?: string | null
          frequency: string
          id?: string
          is_active?: boolean
          last_run_date?: string | null
          next_run_date: string
          organization_id?: string | null
          start_date?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          created_by_name?: string
          description?: string
          end_date?: string | null
          frequency?: string
          id?: string
          is_active?: boolean
          last_run_date?: string | null
          next_run_date?: string
          organization_id?: string | null
          start_date?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_recurring_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "tbl_organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_transactions: {
        Row: {
          amount: number
          approver1_id: string | null
          approver1_status: string
          approver2_id: string | null
          approver2_status: string
          attachments: Json
          category: string
          created_at: string
          created_by_name: string
          date: string
          description: string
          id: string
          organization_id: string | null
          recurring_transaction_id: string | null
          status: string
          type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          approver1_id?: string | null
          approver1_status?: string
          approver2_id?: string | null
          approver2_status?: string
          attachments?: Json
          category?: string
          created_at?: string
          created_by_name?: string
          date?: string
          description: string
          id?: string
          organization_id?: string | null
          recurring_transaction_id?: string | null
          status?: string
          type: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          approver1_id?: string | null
          approver1_status?: string
          approver2_id?: string | null
          approver2_status?: string
          attachments?: Json
          category?: string
          created_at?: string
          created_by_name?: string
          date?: string
          description?: string
          id?: string
          organization_id?: string | null
          recurring_transaction_id?: string | null
          status?: string
          type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "tbl_transactions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "tbl_organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tbl_transactions_recurring_transaction_id_fkey"
            columns: ["recurring_transaction_id"]
            isOneToOne: false
            referencedRelation: "tbl_recurring_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      tbl_user_approval_audit: {
        Row: {
          action: string
          actor_user_id: string | null
          created_at: string
          id: string
          reason: string | null
          target_user_id: string
        }
        Insert: {
          action: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id: string
        }
        Update: {
          action?: string
          actor_user_id?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          target_user_id?: string
        }
        Relationships: []
      }
      tbl_user_roles: {
        Row: {
          access: Database["public"]["Enums"]["access_level"]
          id: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Insert: {
          access?: Database["public"]["Enums"]["access_level"]
          id?: string
          module: Database["public"]["Enums"]["app_module"]
          user_id: string
        }
        Update: {
          access?: Database["public"]["Enums"]["access_level"]
          id?: string
          module?: Database["public"]["Enums"]["app_module"]
          user_id?: string
        }
        Relationships: []
      }
      tbl_vat_returns: {
        Row: {
          created_at: string
          deadline: string | null
          id: string
          input_vat: number
          net_vat: number
          output_vat: number
          quarter: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          deadline?: string | null
          id?: string
          input_vat?: number
          net_vat?: number
          output_vat?: number
          quarter: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          deadline?: string | null
          id?: string
          input_vat?: number
          net_vat?: number
          output_vat?: number
          quarter?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      has_module_access: {
        Args: {
          _min_access: Database["public"]["Enums"]["access_level"]
          _module: Database["public"]["Enums"]["app_module"]
          _user_id: string
        }
        Returns: boolean
      }
      is_user_admin: { Args: { _user_id: string }; Returns: boolean }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      access_level: "none" | "view" | "edit" | "admin"
      app_module:
        | "invoices"
        | "transactions"
        | "pnl"
        | "vat"
        | "paye"
        | "reports"
        | "users"
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
      access_level: ["none", "view", "edit", "admin"],
      app_module: [
        "invoices",
        "transactions",
        "pnl",
        "vat",
        "paye",
        "reports",
        "users",
      ],
    },
  },
} as const
