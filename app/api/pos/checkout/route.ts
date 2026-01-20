/**
 * POS Checkout API Route
 * Processes sales transactions with inventory validation
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { TablesInsert } from '@/types/supabase'

interface CheckoutItem {
  productId: string
  inventoryId: string
  quantity: number
  price: number
  discount: number
}

interface CheckoutRequest {
  storeId: string
  cashierId: string
  customerId: string | null
  sessionId?: string | null
  items: CheckoutItem[]
  subtotal: number
  tax: number
  discount: number
  total: number
  paymentMethod: 'cash' | 'card' | 'mobile' | 'other'
  notes: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CheckoutRequest = await request.json()

    // Validate request
    if (!body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Cart is empty' }, { status: 400 })
    }

    if (!body.storeId || !body.cashierId) {
      return NextResponse.json(
        { error: 'Store and cashier information required' },
        { status: 400 }
      )
    }

    // Verify user has permission (must be assigned to the store or be admin)
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

    // Admins can process sales in any store
    // Managers and cashiers can only process sales in their assigned store
    const isAdmin = profile.role === 'admin'
    const hasStoreAccess = profile.store_id === body.storeId

    if (!isAdmin && !hasStoreAccess) {
      return NextResponse.json(
        { error: 'You are not authorized to process sales for this store' },
        { status: 403 }
      )
    }

    // Validate inventory availability and price ranges for all items
    const validationChecks = await Promise.all(
      body.items.map(async (item) => {
        // Get inventory with product info for price range
        type InventoryWithProduct = {
          quantity: number
          product_id: string
          store_id: string
          product: { price: number; min_price: number | null; max_price: number | null } | null
        }

        const { data: inventory } = await supabase
          .from('product_inventory')
          .select('quantity, product_id, store_id, product:product_templates(price, min_price, max_price)')
          .eq('id', item.inventoryId)
          .eq('store_id', body.storeId)
          .single()
          .returns<InventoryWithProduct>()

        const product = inventory?.product

        // Validate price is within allowed range
        let priceValid = true
        let priceError: string | null = null

        if (product) {
          const { price: defaultPrice, min_price, max_price } = product

          // If no min/max is set, price must match default price
          if (min_price === null && max_price === null) {
            priceValid = item.price === defaultPrice
            if (!priceValid) {
              priceError = `Price must be ${defaultPrice}`
            }
          } else {
            // Validate against min/max range
            if (min_price !== null && item.price < min_price) {
              priceValid = false
              priceError = `Price cannot be below ${min_price}`
            }
            if (max_price !== null && item.price > max_price) {
              priceValid = false
              priceError = `Price cannot exceed ${max_price}`
            }
          }
        }

        return {
          productId: item.productId,
          inventoryId: item.inventoryId,
          available: inventory?.quantity || 0,
          requested: item.quantity,
          stockValid: inventory && inventory.quantity >= item.quantity,
          priceValid,
          priceError,
          submittedPrice: item.price,
        }
      })
    )

    // Check for insufficient stock
    const insufficientStock = validationChecks.filter((check) => !check.stockValid)
    if (insufficientStock.length > 0) {
      return NextResponse.json(
        {
          error: 'Insufficient inventory',
          details: insufficientStock.map((check) => ({
            inventoryId: check.inventoryId,
            available: check.available,
            requested: check.requested,
          })),
        },
        { status: 400 }
      )
    }

    // Check for invalid prices
    const invalidPrices = validationChecks.filter((check) => !check.priceValid)
    if (invalidPrices.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid price',
          details: invalidPrices.map((check) => ({
            productId: check.productId,
            submittedPrice: check.submittedPrice,
            error: check.priceError,
          })),
        },
        { status: 400 }
      )
    }

    // Create sale record with pending status
    // Note: sale_number is auto-generated by database trigger
    type SaleInsert = Omit<TablesInsert<'sales'>, 'sale_number'>
    const saleData: SaleInsert = {
      store_id: body.storeId,
      cashier_id: body.cashierId,
      customer_id: body.customerId,
      cash_session_id: body.sessionId || null,
      subtotal: body.subtotal,
      tax: body.tax,
      discount: body.discount,
      total: body.total,
      payment_method: body.paymentMethod,
      status: 'pending',
      notes: body.notes,
    }

    const { data: sale, error: saleError } = await supabase
      .from('sales')
      .insert(saleData as TablesInsert<'sales'>)
      .select('id, sale_number')
      .single()

    if (saleError) {
      console.error('Sale creation error:', saleError)
      return NextResponse.json(
        { error: 'Failed to create sale record' },
        { status: 500 }
      )
    }

    // Create sale items
    const saleItems = body.items.map((item) => ({
      sale_id: sale.id,
      product_id: item.productId,
      inventory_id: item.inventoryId,
      quantity: item.quantity,
      unit_price: item.price,
      discount: item.discount,
      subtotal: item.price * item.quantity - item.discount,
    }))

    const { error: itemsError } = await supabase
      .from('sale_items')
      .insert(saleItems)

    if (itemsError) {
      console.error('Sale items creation error:', itemsError)

      // Rollback: delete the sale record
      await supabase.from('sales').delete().eq('id', sale.id)

      return NextResponse.json(
        { error: 'Failed to create sale items' },
        { status: 500 }
      )
    }

    // Update sale status to completed - this triggers inventory deduction
    const { error: updateError } = await supabase
      .from('sales')
      .update({ status: 'completed' })
      .eq('id', sale.id)

    if (updateError) {
      console.error('Sale completion error:', updateError)

      // Rollback: delete sale items and sale
      await supabase.from('sale_items').delete().eq('sale_id', sale.id)
      await supabase.from('sales').delete().eq('id', sale.id)

      return NextResponse.json(
        { error: 'Failed to complete sale' },
        { status: 500 }
      )
    }

    // Note: Inventory deduction happens automatically via database trigger

    // Update cash session counters if session is linked
    if (body.sessionId) {
      const { data: session } = await supabase
        .from('cash_sessions')
        .select('*')
        .eq('id', body.sessionId)
        .single()

      if (session) {
        const updateData: Record<string, number> = {
          transaction_count: (session.transaction_count || 0) + 1,
        }

        // Update the appropriate sales counter based on payment method
        switch (body.paymentMethod) {
          case 'cash':
            updateData.total_cash_sales =
              Number(session.total_cash_sales || 0) + body.total
            break
          case 'card':
            updateData.total_card_sales =
              Number(session.total_card_sales || 0) + body.total
            break
          case 'mobile':
            updateData.total_mobile_sales =
              Number(session.total_mobile_sales || 0) + body.total
            break
          default:
            updateData.total_other_sales =
              Number(session.total_other_sales || 0) + body.total
        }

        await supabase
          .from('cash_sessions')
          .update(updateData)
          .eq('id', body.sessionId)
      }
    }

    // Broadcast inventory update to other cashiers on the same store
    // This ensures multi-cashier synchronization works in local development
    const channel = supabase.channel(`inventory-${body.storeId}`)
    await channel.send({
      type: 'broadcast',
      event: 'inventory_updated',
      payload: {
        store_id: body.storeId,
        sale_id: sale.id,
        updated_at: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      saleId: sale.id,
      saleNumber: sale.sale_number,
    })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
