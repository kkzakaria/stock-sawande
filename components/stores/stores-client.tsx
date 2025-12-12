'use client'

import { StoresDataTable } from './stores-data-table'

interface Store {
  id: string
  name: string
  address: string | null
  phone: string | null
  email: string | null
  created_at: string
  updated_at: string
}

interface StoresClientProps {
  stores: Store[]
}

export function StoresClient({ stores }: StoresClientProps) {
  return <StoresDataTable stores={stores} />
}
