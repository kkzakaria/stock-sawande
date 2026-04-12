/**
 * POS Checkout API Route
 * Delegates to process_checkout() RPC for atomic, idempotent checkout.
 */

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { checkoutBodySchema } from './schema'
import { z } from 'zod'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const json = await request.json()
    const body = checkoutBodySchema.parse(json)

    // Enforce cashierId = auth.uid() to prevent spoofing
    if (body.cashierId !== user.id) {
      return NextResponse.json({ error: 'Cashier id mismatch' }, { status: 403 })
    }

    const { data, error } = await supabase.rpc('process_checkout', {
      p_store_id: body.storeId,
      p_cashier_id: body.cashierId,
      p_customer_id: body.customerId,
      p_cash_session_id: body.sessionId ?? null,
      p_payment_method: body.paymentMethod,
      p_items: body.items,
      p_subtotal: body.subtotal,
      p_tax: body.tax,
      p_discount: body.discount,
      p_total: body.total,
      p_notes: body.notes,
      p_idempotency_key: body.idempotencyKey,
    })

    if (error) {
      console.error('Checkout RPC error:', error)
      const status = error.code === '42501' ? 403
                   : error.code === '23514' ? 400
                   : error.code === '23503' ? 400
                   : 500
      return NextResponse.json({ error: error.message }, { status })
    }

    const result = data as unknown as { success: boolean; sale_id: string; sale_number: string; idempotent: boolean }

    // Broadcast inventory update for multi-cashier sync
    const channel = supabase.channel(`inventory-${body.storeId}`)
    await channel.send({
      type: 'broadcast',
      event: 'inventory_updated',
      payload: {
        store_id: body.storeId,
        sale_id: result.sale_id,
        updated_at: new Date().toISOString(),
      },
    })

    return NextResponse.json({
      success: true,
      saleId: result.sale_id,
      saleNumber: result.sale_number,
      idempotent: result.idempotent,
    })
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0].message }, { status: 400 })
    }
    console.error('Checkout error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
