import type { ReceiptData } from '@/components/pos/pos-receipt'
import type { PrinterConfig } from '@/lib/printing/types'
import { DEFAULT_PRINTER_CONFIG } from '@/lib/printing/types'

export const sampleReceiptData: ReceiptData = {
  id: 'sale-1',
  sale_number: 'V-000123',
  subtotal: 12000,
  tax: 0,
  discount: null,
  total: 12000,
  payment_method: 'cash',
  created_at: '2026-05-12T19:00:00.000Z',
  notes: null,
  store: {
    name: 'Sawandé Boutique',
    address: 'Cocody, Abidjan',
    phone: '+225 07 00 00 00',
  },
  cashier: { full_name: 'Aïcha Koné' },
  sale_items: [
    {
      product: { name: 'Café arabica 250g', sku: 'COF-250' },
      quantity: 2,
      unit_price: 3000,
      subtotal: 6000,
      discount: null,
    },
    {
      product: { name: 'Sucre raffiné 1kg', sku: 'SUC-1KG' },
      quantity: 3,
      unit_price: 2000,
      subtotal: 6000,
      discount: 500,
    },
  ],
}

export const config80mm: PrinterConfig = {
  ...DEFAULT_PRINTER_CONFIG,
  enabled: true,
  width: 80,
  usb: { vendorId: 0x04b8, productId: 0x0202 },
}

export const config58mm: PrinterConfig = {
  ...DEFAULT_PRINTER_CONFIG,
  enabled: true,
  width: 58,
  usb: { vendorId: 0x04b8, productId: 0x0202 },
}
