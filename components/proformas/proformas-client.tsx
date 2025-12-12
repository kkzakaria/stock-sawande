'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Plus, FileText } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { ProformasDataTable } from './proformas-data-table'
import { getProformas, type ProformaWithDetails } from '@/lib/actions/proformas'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

interface ProformasClientProps {
  userStoreId?: string | null
  userRole: 'admin' | 'manager' | 'cashier'
  userId: string
}

export function ProformasClient({ userStoreId, userRole, userId }: ProformasClientProps) {
  const t = useTranslations('Proformas')
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [proformas, setProformas] = useState<ProformaWithDetails[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const supabase = createClient()

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  // Debounce timer ref for realtime updates
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Fetch proformas data
  const fetchProformas = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const result = await getProformas({
        sortBy: 'created_at',
        sortOrder: 'desc',
        page: 1,
        limit: 1000, // Fetch all for client-side filtering
      })

      if (result.success && result.data) {
        setProformas(result.data.proformas)
      } else {
        setError(result.error || 'Failed to load proformas')
        toast.error(result.error || 'Failed to load proformas')
      }
    } catch (err) {
      console.error('Error fetching proformas:', err)
      setError('An unexpected error occurred')
      toast.error('An unexpected error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Fetch proformas on mount
  useEffect(() => {
    fetchProformas()
  }, [fetchProformas])

  // Real-time subscription for proformas updates
  useEffect(() => {
    // Debounced refresh function
    const debouncedRefresh = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      debounceTimerRef.current = setTimeout(() => {
        fetchProformas()
      }, 500) // 500ms delay to batch multiple changes
    }

    // Determine filter for realtime subscription based on role
    let realtimeFilter: string | undefined
    if (userRole === 'cashier') {
      // Cashiers only see their own proformas
      realtimeFilter = `created_by=eq.${userId}`
    } else if (userRole === 'manager' && userStoreId) {
      // Managers see their store's proformas
      realtimeFilter = `store_id=eq.${userStoreId}`
    }

    // Subscribe to proformas changes
    const channel = supabase
      .channel('proformas-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proformas',
          filter: realtimeFilter,
        },
        () => {
          debouncedRefresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'proformas',
          filter: realtimeFilter,
        },
        () => {
          debouncedRefresh()
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'proformas',
          filter: realtimeFilter,
        },
        () => {
          debouncedRefresh()
        }
      )
      .subscribe()

    // Cleanup on unmount
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current)
      }
      supabase.removeChannel(channel)
    }
  }, [supabase, userStoreId, userRole, userId, fetchProformas])

  // Handle refresh
  const handleRefresh = useCallback(() => {
    fetchProformas()
  }, [fetchProformas])

  // Prevent hydration mismatch - render loading state on server
  if (!mounted) {
    return (
      <div className="space-y-4">
        <div className="flex h-[400px] items-center justify-center">
          <div className="text-muted-foreground">Loading...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-6 w-6" />
          <h1 className="text-2xl font-bold">{t('title')}</h1>
        </div>
        <Button onClick={() => router.push('/proformas/new')}>
          <Plus className="mr-2 h-4 w-4" />
          {t('createNew')}
        </Button>
      </div>

      {/* Error State */}
      {error && !isLoading && (
        <div className="rounded-md bg-destructive/10 p-4 text-center text-destructive">
          {error}
        </div>
      )}

      {/* Proformas Table */}
      <ProformasDataTable
        proformas={proformas}
        isLoading={isLoading}
        onRefresh={handleRefresh}
      />
    </div>
  )
}
