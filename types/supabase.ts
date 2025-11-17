/**
 * Supabase Database Types
 *
 * This file will be auto-generated from the database schema.
 * To generate types, run:
 *
 * npx supabase gen types typescript --local > types/supabase.ts
 *
 * Or for remote database:
 * npx supabase gen types typescript --project-id "your-project-ref" > types/supabase.ts
 */

// Placeholder type until database schema is created
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {}
    Views: {}
    Functions: {}
    Enums: {}
    CompositeTypes: {}
  }
}
