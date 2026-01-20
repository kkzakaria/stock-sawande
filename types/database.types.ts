export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
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
      business_settings: {
        Row: {
          created_at: string
          description: string | null
          id: string
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          key: string
          updated_at?: string
          updated_by?: string | null
          value: Json
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: [
          {
            foreignKeyName: "business_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "business_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_sessions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          cashier_id: string
          closed_at: string | null
          closing_amount: number | null
          closing_notes: string | null
          created_at: string
          discrepancy: number | null
          expected_closing_amount: number | null
          id: string
          locked_at: string | null
          locked_by: string | null
          opened_at: string
          opening_amount: number
          opening_notes: string | null
          requires_approval: boolean | null
          status: Database["public"]["Enums"]["cash_session_status"]
          store_id: string
          total_card_sales: number
          total_cash_sales: number
          total_mobile_sales: number
          total_other_sales: number
          transaction_count: number
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          cashier_id: string
          closed_at?: string | null
          closing_amount?: number | null
          closing_notes?: string | null
          created_at?: string
          discrepancy?: number | null
          expected_closing_amount?: number | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          opened_at?: string
          opening_amount?: number
          opening_notes?: string | null
          requires_approval?: boolean | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          store_id: string
          total_card_sales?: number
          total_cash_sales?: number
          total_mobile_sales?: number
          total_other_sales?: number
          transaction_count?: number
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          cashier_id?: string
          closed_at?: string | null
          closing_amount?: number | null
          closing_notes?: string | null
          created_at?: string
          discrepancy?: number | null
          expected_closing_amount?: number | null
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          opened_at?: string
          opening_amount?: number
          opening_notes?: string | null
          requires_approval?: boolean | null
          status?: Database["public"]["Enums"]["cash_session_status"]
          store_id?: string
          total_card_sales?: number
          total_cash_sales?: number
          total_mobile_sales?: number
          total_other_sales?: number
          transaction_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_sessions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_locked_by_fkey"
            columns: ["locked_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_sessions_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          phone: string | null
          total_purchases: number | null
          total_spent: number | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          phone?: string | null
          total_purchases?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          phone?: string | null
          total_purchases?: number | null
          total_spent?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      manager_pins: {
        Row: {
          created_at: string
          id: string
          pin_hash: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          pin_hash: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          pin_hash?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "manager_pins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "manager_pins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_inventory: {
        Row: {
          created_at: string
          id: string
          product_id: string
          quantity: number
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          product_id: string
          quantity?: number
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          product_id?: string
          quantity?: number
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_aggregated"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_inventory"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "product_inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      product_templates: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          max_price: number | null
          min_price: number | null
          min_stock_level: number | null
          name: string
          price: number
          sku: string
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_price?: number | null
          min_price?: number | null
          min_stock_level?: number | null
          name: string
          price: number
          sku: string
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          max_price?: number | null
          min_price?: number | null
          min_stock_level?: number | null
          name?: string
          price?: number
          sku?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products_backup_old: {
        Row: {
          barcode: string | null
          category_id: string | null
          cost: number | null
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_active: boolean | null
          min_stock_level: number | null
          name: string
          price: number
          quantity: number
          sku: string
          store_id: string | null
          updated_at: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_stock_level?: number | null
          name: string
          price: number
          quantity?: number
          sku: string
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          cost?: number | null
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_active?: boolean | null
          min_stock_level?: number | null
          name?: string
          price?: number
          quantity?: number
          sku?: string
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          deleted_at: string | null
          email: string
          full_name: string | null
          id: string
          preferred_language: string | null
          role: Database["public"]["Enums"]["user_role"]
          store_id: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email: string
          full_name?: string | null
          id: string
          preferred_language?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          deleted_at?: string | null
          email?: string
          full_name?: string | null
          id?: string
          preferred_language?: string | null
          role?: Database["public"]["Enums"]["user_role"]
          store_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      proforma_items: {
        Row: {
          created_at: string
          discount: number | null
          id: string
          notes: string | null
          product_id: string
          proforma_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number | null
          id?: string
          notes?: string | null
          product_id: string
          proforma_id: string
          quantity: number
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount?: number | null
          id?: string
          notes?: string | null
          product_id?: string
          proforma_id?: string
          quantity?: number
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "proforma_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proforma_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_aggregated"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "proforma_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_inventory"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "proforma_items_proforma_id_fkey"
            columns: ["proforma_id"]
            isOneToOne: false
            referencedRelation: "proformas"
            referencedColumns: ["id"]
          },
        ]
      }
      proformas: {
        Row: {
          accepted_at: string | null
          converted_at: string | null
          converted_sale_id: string | null
          created_at: string
          created_by: string
          customer_id: string | null
          discount: number | null
          id: string
          notes: string | null
          proforma_number: string
          rejected_at: string | null
          rejection_reason: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["proforma_status"]
          store_id: string
          subtotal: number
          tax: number
          terms: string | null
          total: number
          updated_at: string
          valid_until: string | null
        }
        Insert: {
          accepted_at?: string | null
          converted_at?: string | null
          converted_sale_id?: string | null
          created_at?: string
          created_by: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          proforma_number: string
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proforma_status"]
          store_id: string
          subtotal: number
          tax?: number
          terms?: string | null
          total: number
          updated_at?: string
          valid_until?: string | null
        }
        Update: {
          accepted_at?: string | null
          converted_at?: string | null
          converted_sale_id?: string | null
          created_at?: string
          created_by?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          proforma_number?: string
          rejected_at?: string | null
          rejection_reason?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["proforma_status"]
          store_id?: string
          subtotal?: number
          tax?: number
          terms?: string | null
          total?: number
          updated_at?: string
          valid_until?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "proformas_converted_sale_id_fkey"
            columns: ["converted_sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "proformas_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      sale_items: {
        Row: {
          created_at: string
          discount: number | null
          id: string
          inventory_id: string
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Insert: {
          created_at?: string
          discount?: number | null
          id?: string
          inventory_id: string
          product_id: string
          quantity: number
          sale_id: string
          subtotal: number
          unit_price: number
        }
        Update: {
          created_at?: string
          discount?: number | null
          id?: string
          inventory_id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          subtotal?: number
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["inventory_id"]
          },
          {
            foreignKeyName: "sale_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "products_with_inventory"
            referencedColumns: ["inventory_id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_aggregated"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_inventory"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          cash_session_id: string | null
          cashier_id: string
          created_at: string
          customer_id: string | null
          discount: number | null
          id: string
          notes: string | null
          payment_method: string
          payment_reference: string | null
          refund_reason: string | null
          refunded_at: string | null
          sale_number: string
          status: string
          store_id: string
          subtotal: number
          tax: number
          total: number
          updated_at: string
        }
        Insert: {
          cash_session_id?: string | null
          cashier_id: string
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          payment_method: string
          payment_reference?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          sale_number: string
          status?: string
          store_id: string
          subtotal: number
          tax?: number
          total: number
          updated_at?: string
        }
        Update: {
          cash_session_id?: string | null
          cashier_id?: string
          created_at?: string
          customer_id?: string | null
          discount?: number | null
          id?: string
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          refund_reason?: string | null
          refunded_at?: string | null
          sale_number?: string
          status?: string
          store_id?: string
          subtotal?: number
          tax?: number
          total?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_cash_session_id_fkey"
            columns: ["cash_session_id"]
            isOneToOne: false
            referencedRelation: "cash_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          id: string
          inventory_id: string | null
          new_quantity: number
          notes: string | null
          previous_quantity: number
          product_id: string
          quantity: number
          reference: string | null
          store_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          inventory_id?: string | null
          new_quantity: number
          notes?: string | null
          previous_quantity: number
          product_id: string
          quantity: number
          reference?: string | null
          store_id: string
          type: Database["public"]["Enums"]["stock_movement_type"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          inventory_id?: string | null
          new_quantity?: number
          notes?: string | null
          previous_quantity?: number
          product_id?: string
          quantity?: number
          reference?: string | null
          store_id?: string
          type?: Database["public"]["Enums"]["stock_movement_type"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "inventory_summary"
            referencedColumns: ["inventory_id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "product_inventory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_inventory_id_fkey"
            columns: ["inventory_id"]
            isOneToOne: false
            referencedRelation: "products_with_inventory"
            referencedColumns: ["inventory_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_aggregated"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_inventory"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "stock_movements_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      stores: {
        Row: {
          address: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      user_stores: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          store_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          store_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          store_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_stores_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_stores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      active_profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string | null
          full_name: string | null
          id: string | null
          role: Database["public"]["Enums"]["user_role"] | null
          store_id: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          store_id?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string | null
          full_name?: string | null
          id?: string | null
          role?: Database["public"]["Enums"]["user_role"] | null
          store_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      cashier_performance_summary: {
        Row: {
          avg_transaction: number | null
          cashier_email: string | null
          cashier_id: string | null
          cashier_name: string | null
          refund_count: number | null
          sale_date: string | null
          store_id: string | null
          store_name: string | null
          total_sales: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "active_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_cashier_id_fkey"
            columns: ["cashier_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_sales_summary: {
        Row: {
          avg_transaction: number | null
          refund_amount: number | null
          refund_count: number | null
          sale_date: string | null
          store_id: string | null
          store_name: string | null
          total_discount: number | null
          total_revenue: number | null
          total_tax: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_summary: {
        Row: {
          category_name: string | null
          inventory_id: string | null
          min_stock_level: number | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          sku: string | null
          stock_status: string | null
          stock_value: number | null
          store_id: string | null
          store_name: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_aggregated"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "product_inventory_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_inventory"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "product_inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_method_summary: {
        Row: {
          payment_method: string | null
          sale_date: string | null
          store_id: string | null
          total_amount: number | null
          transaction_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
      products_aggregated: {
        Row: {
          barcode: string | null
          category_description: string | null
          category_id: string | null
          category_name: string | null
          cost: number | null
          created_at: string | null
          description: string | null
          image_url: string | null
          is_active: boolean | null
          max_price: number | null
          min_price: number | null
          min_stock_level: number | null
          name: string | null
          price: number | null
          sku: string | null
          store_count: number | null
          template_id: string | null
          total_quantity: number | null
          updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      products_with_inventory: {
        Row: {
          barcode: string | null
          category_description: string | null
          category_id: string | null
          category_name: string | null
          cost: number | null
          description: string | null
          image_url: string | null
          inventory_created_at: string | null
          inventory_id: string | null
          inventory_updated_at: string | null
          is_active: boolean | null
          max_price: number | null
          min_price: number | null
          min_stock_level: number | null
          name: string | null
          price: number | null
          quantity: number | null
          sku: string | null
          store_address: string | null
          store_id: string | null
          store_name: string | null
          template_created_at: string | null
          template_id: string | null
          template_updated_at: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_inventory_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_templates_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      top_products_summary: {
        Row: {
          avg_price: number | null
          category_name: string | null
          product_id: string | null
          product_name: string | null
          sale_date: string | null
          sku: string | null
          store_id: string | null
          total_revenue: number | null
          units_sold: number | null
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "product_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_aggregated"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products_with_inventory"
            referencedColumns: ["template_id"]
          },
          {
            foreignKeyName: "sales_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "stores"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      change_user_role: {
        Args: { new_role: string; user_email: string }
        Returns: undefined
      }
      generate_proforma_number: {
        Args: { store_uuid: string }
        Returns: string
      }
      generate_sale_number: { Args: { store_uuid: string }; Returns: string }
      get_all_products_aggregated: {
        Args: never
        Returns: {
          barcode: string
          category_id: string
          category_name: string
          cost: number
          created_at: string
          description: string
          image_url: string
          is_active: boolean
          min_stock_level: number
          name: string
          price: number
          sku: string
          store_count: number
          template_id: string
          total_quantity: number
          updated_at: string
        }[]
      }
      get_cashier_performance: {
        Args: { p_date_from?: string; p_date_to?: string; p_store_id?: string }
        Returns: {
          avg_transaction: number
          cashier_email: string
          cashier_id: string
          cashier_name: string
          refund_count: number
          store_id: string
          store_name: string
          total_sales: number
          transaction_count: number
        }[]
      }
      get_current_user_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_current_user_store_id: { Args: never; Returns: string }
      get_dashboard_metrics: {
        Args: { p_date_from?: string; p_date_to?: string; p_store_id?: string }
        Returns: Json
      }
      get_inventory_report: {
        Args: { p_store_id?: string }
        Returns: {
          category_name: string
          inventory_id: string
          min_stock_level: number
          product_id: string
          product_name: string
          quantity: number
          sku: string
          stock_status: string
          stock_value: number
          store_id: string
          store_name: string
        }[]
      }
      get_low_stock_alerts: {
        Args: { p_store_id?: string }
        Returns: {
          inventory_id: string
          min_stock_level: number
          product_id: string
          product_name: string
          quantity: number
          sku: string
          stock_status: string
          store_id: string
          store_name: string
        }[]
      }
      get_low_stock_products: {
        Args: never
        Returns: {
          min_stock_level: number
          name: string
          quantity: number
          sku: string
          stock_deficit: number
          store_id: string
          store_name: string
          template_id: string
        }[]
      }
      get_payment_breakdown: {
        Args: { p_date_from?: string; p_date_to?: string; p_store_id?: string }
        Returns: {
          payment_method: string
          percentage: number
          total_amount: number
          transaction_count: number
        }[]
      }
      get_products_by_store: {
        Args: { p_store_id: string }
        Returns: {
          barcode: string
          category_id: string
          category_name: string
          cost: number
          description: string
          image_url: string
          inventory_id: string
          is_active: boolean
          max_price: number
          min_price: number
          min_stock_level: number
          name: string
          price: number
          quantity: number
          sku: string
          template_id: string
        }[]
      }
      get_products_with_totals: {
        Args: { p_store_id: string }
        Returns: {
          barcode: string
          category_id: string
          category_name: string
          cost: number
          created_at: string
          description: string
          image_url: string
          inventory_id: string
          is_active: boolean
          min_stock_level: number
          my_quantity: number
          name: string
          price: number
          sku: string
          store_count: number
          store_id: string
          store_name: string
          template_id: string
          total_quantity: number
          updated_at: string
        }[]
      }
      get_sales_trend: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_group_by?: string
          p_store_id?: string
        }
        Returns: {
          avg_transaction: number
          period: string
          period_start: string
          refund_count: number
          total_revenue: number
          transaction_count: number
        }[]
      }
      get_store_comparison: {
        Args: { p_date_from?: string; p_date_to?: string }
        Returns: {
          avg_transaction: number
          refund_count: number
          refund_rate: number
          store_id: string
          store_name: string
          total_revenue: number
          transaction_count: number
        }[]
      }
      get_stores_by_product: {
        Args: { p_product_id: string }
        Returns: {
          inventory_id: string
          quantity: number
          store_address: string
          store_id: string
          store_name: string
        }[]
      }
      get_top_products: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_limit?: number
          p_store_id?: string
        }
        Returns: {
          avg_price: number
          category_name: string
          product_id: string
          product_name: string
          sku: string
          total_revenue: number
          units_sold: number
        }[]
      }
      get_user_assigned_stores: {
        Args: { p_user_id: string }
        Returns: {
          address: string
          email: string
          is_default: boolean
          phone: string
          store_id: string
          store_name: string
        }[]
      }
      is_user_active: { Args: { check_user_id: string }; Returns: boolean }
      restore_deleted_user: { Args: { target_user_id: string }; Returns: Json }
      soft_delete_user: { Args: { target_user_id: string }; Returns: Json }
      update_expired_proformas: { Args: never; Returns: number }
      user_has_pin: { Args: { user_uuid: string }; Returns: boolean }
    }
    Enums: {
      cash_session_status: "open" | "closed" | "locked"
      proforma_status:
        | "draft"
        | "sent"
        | "accepted"
        | "rejected"
        | "converted"
        | "expired"
      stock_movement_type:
        | "purchase"
        | "sale"
        | "adjustment"
        | "transfer"
        | "return"
        | "damage"
        | "loss"
      user_role: "admin" | "manager" | "cashier"
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
    Enums: {
      cash_session_status: ["open", "closed", "locked"],
      proforma_status: [
        "draft",
        "sent",
        "accepted",
        "rejected",
        "converted",
        "expired",
      ],
      stock_movement_type: [
        "purchase",
        "sale",
        "adjustment",
        "transfer",
        "return",
        "damage",
        "loss",
      ],
      user_role: ["admin", "manager", "cashier"],
    },
  },
} as const

