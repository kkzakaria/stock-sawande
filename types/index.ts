/**
 * Common Application Types
 */

import { Database } from './supabase'

// Utility type for database tables
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

// User roles for the application
export type UserRole = 'admin' | 'manager' | 'cashier'

// User profile type (extends Supabase auth.users)
export interface UserProfile {
  id: string
  email: string
  role: UserRole
  store_id?: string
  created_at: string
  updated_at: string
}

// Common status types
export type Status = 'active' | 'inactive' | 'archived'

// API response wrapper
export interface ApiResponse<T = unknown> {
  data?: T
  error?: {
    message: string
    code?: string
  }
  success: boolean
}

// Pagination types
export interface PaginationParams {
  page: number
  limit: number
  orderBy?: string
  order?: 'asc' | 'desc'
}

export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Re-export Database type
export type { Database }
