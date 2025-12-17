/**
 * Product Sync API Endpoint
 * Returns products updated since a given timestamp for delta sync
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get query parameters
    const { searchParams } = new URL(request.url)
    const storeId = searchParams.get('storeId')
    const since = searchParams.get('since')

    if (!storeId) {
      return NextResponse.json(
        { error: 'storeId is required' },
        { status: 400 }
      )
    }

    // Verify user has access to this store
    const { data: profile } = await supabase
      .from('profiles')
      .select('store_id, role')
      .eq('id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json(
        { error: 'User profile not found' },
        { status: 400 }
      )
    }

    // Admins can sync products from any store
    // Managers and cashiers can only sync from their assigned store
    const isAdmin = profile.role === 'admin'
    const hasStoreAccess = profile.store_id === storeId

    if (!isAdmin && !hasStoreAccess) {
      return NextResponse.json(
        { error: 'Unauthorized: user not assigned to this store' },
        { status: 403 }
      )
    }

    // Build query for products with inventory
    let query = supabase
      .from('product_templates')
      .select(`
        id,
        sku,
        name,
        price,
        barcode,
        image_url,
        is_active,
        updated_at,
        categories (
          id,
          name
        ),
        product_inventory!inner (
          id,
          quantity,
          store_id
        )
      `)
      .eq('is_active', true)
      .eq('product_inventory.store_id', storeId)

    // Filter by updated_at if since parameter provided
    if (since) {
      const sinceDate = new Date(since)
      if (!isNaN(sinceDate.getTime())) {
        query = query.gte('updated_at', sinceDate.toISOString())
      }
    }

    const { data: products, error } = await query.order('name')

    if (error) {
      console.error('Product sync error:', error)
      return NextResponse.json(
        { error: `Failed to fetch products: ${error.message}` },
        { status: 500 }
      )
    }

    // Transform products to expected format
    const transformedProducts = products?.map((product) => {
      const inventory = Array.isArray(product.product_inventory)
        ? product.product_inventory.find((inv: { store_id: string }) => inv.store_id === storeId)
        : product.product_inventory

      return {
        id: product.id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        barcode: product.barcode,
        image_url: product.image_url,
        category: product.categories
          ? {
              id: (product.categories as { id: string; name: string }).id,
              name: (product.categories as { id: string; name: string }).name,
            }
          : null,
        inventory: inventory
          ? {
              id: inventory.id,
              quantity: inventory.quantity,
            }
          : null,
      }
    })

    return NextResponse.json({
      products: transformedProducts || [],
      syncedAt: new Date().toISOString(),
      count: transformedProducts?.length || 0,
    })
  } catch (error) {
    console.error('Product sync error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
