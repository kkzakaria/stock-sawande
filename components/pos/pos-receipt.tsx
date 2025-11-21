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
import { QRCodeSVG } from 'qrcode.react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Printer, Share2, Loader2 } from 'lucide-react'

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
  saleId,
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

  const handleShare = async () => {
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
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
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
        <DialogContent className="max-w-md">
          <DialogHeader className="no-print">
            <DialogTitle>Ticket de vente</DialogTitle>
            <DialogDescription>
              Ticket #{saleNumber} - Imprimez, partagez ou téléchargez
            </DialogDescription>
          </DialogHeader>

          {/* Receipt Template */}
          <div
            ref={receiptRef}
            className="receipt-container bg-white p-6 mx-auto"
            style={{ width: '80mm', fontFamily: 'monospace' }}
          >
            {/* Header */}
            <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-4">
              <h1 className="text-xl font-bold mb-1">{receiptData.store.name}</h1>
              {receiptData.store.address && (
                <p className="text-xs text-gray-600">{receiptData.store.address}</p>
              )}
              {receiptData.store.phone && (
                <p className="text-xs text-gray-600">{receiptData.store.phone}</p>
              )}
            </div>

            {/* Sale Info */}
            <div className="text-xs mb-4">
              <div className="flex justify-between">
                <span>Ticket:</span>
                <span className="font-bold">{receiptData.sale_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{formatDate(receiptData.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Caissier:</span>
                <span>{receiptData.cashier.full_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span>Paiement:</span>
                <span>{formatPaymentMethod(receiptData.payment_method)}</span>
              </div>
            </div>

            {/* Items */}
            <div className="border-t-2 border-dashed border-gray-300 pt-2 mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1">Article</th>
                    <th className="text-center py-1">Qté</th>
                    <th className="text-right py-1">Prix</th>
                    <th className="text-right py-1">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {receiptData.sale_items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1">
                        <div className="font-medium">{item.product.name}</div>
                        <div className="text-gray-500">{item.product.sku}</div>
                      </td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="text-right font-medium">
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="border-t-2 border-dashed border-gray-300 pt-2 mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span>Sous-total:</span>
                <span>{formatCurrency(receiptData.subtotal)}</span>
              </div>
              {receiptData.discount && receiptData.discount > 0 && (
                <div className="flex justify-between text-sm mb-1 text-red-600">
                  <span>Remise:</span>
                  <span>-{formatCurrency(receiptData.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm mb-1">
                <span>TVA (8.75%):</span>
                <span>{formatCurrency(receiptData.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t-2 border-gray-800 pt-2 mt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(receiptData.total)}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4 border-t-2 border-dashed border-gray-300 pt-4">
              <div className="text-center">
                <QRCodeSVG
                  value={`SALE:${receiptData.id}:${receiptData.sale_number}`}
                  size={100}
                  level="M"
                />
                <p className="text-xs text-gray-500 mt-2">Scanner pour vérifier</p>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 border-t-2 border-dashed border-gray-300 pt-4">
              <p>Merci de votre visite!</p>
              <p className="mt-1">À bientôt</p>
            </div>

            {receiptData.notes && (
              <div className="mt-4 text-xs text-gray-600 italic">
                Note: {receiptData.notes}
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="no-print flex gap-2 mt-4">
            <Button
              variant="outline"
              onClick={handlePrint}
              disabled={loading}
              className="flex-1"
            >
              <Printer className="mr-2 h-4 w-4" />
              Imprimer
            </Button>
            <Button
              variant="outline"
              onClick={handleShare}
              disabled={loading}
              className="flex-1"
            >
              {loading && action === 'share' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Share2 className="mr-2 h-4 w-4" />
              )}
              Partager
            </Button>
            <Button
              variant="outline"
              onClick={handleDownload}
              disabled={loading}
              className="flex-1"
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
