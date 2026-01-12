'use client'

/**
 * POS Receipt Component
 * Lightweight HTML-based receipt with Print and Share functionality
 * - Print: Native browser print dialog → PDF
 * - Share: html-to-image → PNG → Web Share API (WhatsApp, Telegram, etc.)
 * - Download: Fallback for browsers without Web Share API
 */

import { useRef, useState } from 'react'
import { toPng } from 'html-to-image'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Printer, Loader2 } from 'lucide-react'

export interface ReceiptItem {
  product: {
    name: string
    sku: string
  }
  quantity: number
  unit_price: number
  subtotal: number
  discount: number | null
}

export interface ReceiptData {
  id: string
  sale_number: string
  subtotal: number
  tax: number
  discount: number | null
  total: number
  payment_method: string
  created_at: string
  notes: string | null
  store: {
    name: string
    address: string | null
    phone: string | null
  }
  cashier: {
    full_name: string | null
  }
  sale_items: ReceiptItem[]
}

interface POSReceiptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  saleId: string
  saleNumber: string
  receiptData: ReceiptData | null
}

export function POSReceipt({
  open,
  onOpenChange,
  saleId: _saleId,
  saleNumber,
  receiptData,
}: POSReceiptProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'print' | 'share' | 'download' | null>(null)

  const handlePrint = () => {
    setAction('print')
    setTimeout(() => {
      window.print()
      setAction(null)
    }, 100)
  }

  const _handleShare = async () => {
    if (!receiptRef.current) return

    setLoading(true)
    setAction('share')

    try {
      // Convert HTML to PNG data URL
      const dataUrl = await toPng(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 2,
      })

      // Convert data URL to Blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      const file = new File([blob], `ticket-${saleNumber}.png`, {
        type: 'image/png'
      })

      // Try Web Share API (mobile)
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: `Ticket #${saleNumber}`,
          text: `Ticket de caisse - ${receiptData?.store.name}`,
          files: [file],
        })
      } else {
        // Fallback: Download
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ticket-${saleNumber}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (error) {
      console.error('Error sharing receipt:', error)
      alert('Erreur lors du partage du ticket')
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  const handleDownload = async () => {
    if (!receiptRef.current) return

    setLoading(true)
    setAction('download')

    try {
      // Convert HTML to PNG data URL
      const dataUrl = await toPng(receiptRef.current, {
        quality: 0.95,
        pixelRatio: 2,
      })

      // Convert data URL to Blob
      const response = await fetch(dataUrl)
      const blob = await response.blob()

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `ticket-${saleNumber}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading receipt:', error)
      alert('Erreur lors du téléchargement du ticket')
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      cash: 'Espèces',
      card: 'Carte bancaire',
      mobile: 'Paiement mobile',
      other: 'Autre',
    }
    return methods[method] || method
  }

  if (!receiptData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ticket de vente</DialogTitle>
            <DialogDescription>Chargement du ticket...</DialogDescription>
          </DialogHeader>
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <>
      <style>{`
        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .receipt-container {
            width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="no-print flex-shrink-0">
            <DialogTitle>Ticket de vente</DialogTitle>
            <DialogDescription>
              Ticket #{saleNumber} - Imprimez, partagez ou téléchargez
            </DialogDescription>
          </DialogHeader>

          {/* Receipt Template - Scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div
              ref={receiptRef}
              className="receipt-container bg-white p-6 mx-auto"
              style={{ width: '80mm', fontFamily: 'monospace' }}
            >
            {/* Header */}
            <div className="text-center mb-2 border-b border-dashed border-gray-300 pb-2">
              <h1 className="text-base font-bold">{receiptData.store.name}</h1>
              <p className="text-xs text-gray-600">#{receiptData.sale_number} • {formatDate(receiptData.created_at)}</p>
            </div>

            {/* Items - Compact format */}
            <div className="text-xs mb-2">
              {receiptData.sale_items.map((item, idx) => (
                <div key={idx} className="flex justify-between py-0.5">
                  <span className="truncate flex-1 mr-2">
                    {item.product.name} × {item.quantity}
                  </span>
                  <span className="font-medium whitespace-nowrap">
                    {formatCurrency(item.subtotal)}
                  </span>
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="border-t border-dashed border-gray-300 pt-2">
              <div className="flex justify-between text-sm font-bold">
                <span>TOTAL</span>
                <span>{formatCurrency(receiptData.total)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">{formatPaymentMethod(receiptData.payment_method)}</p>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-400 mt-2 pt-2 border-t border-dashed border-gray-300">
              Merci!
            </div>

            {receiptData.notes && (
              <div className="mt-4 text-xs text-gray-600 italic">
                Note: {receiptData.notes}
              </div>
            )}
            </div>
          </div>

          {/* Action Buttons - Always visible */}
          <div className="no-print flex gap-2 pt-4 flex-shrink-0 border-t">
            <Button
              onClick={handlePrint}
              disabled={loading}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
            {/* TODO: Activer après intégration WhatsApp/Telegram API
            <Button
              onClick={handleShare}
              disabled={loading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              {loading && action === 'share' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              Partager
            </Button>
            */}
            <Button
              onClick={handleDownload}
              disabled={loading}
              className="flex-1 bg-purple-600 hover:bg-purple-700 text-white"
            >
              {loading && action === 'download' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              Télécharger
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
