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
import { toast } from 'sonner'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Printer, Loader2 } from 'lucide-react'
import { usePrinter } from '@/lib/hooks/use-printer'

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
  const tPrint = useTranslations('POS.print')
  const { print: thermalPrint, isConfigured } = usePrinter()

  const handlePrint = async () => {
    setAction('print')
    if (isConfigured && receiptData) {
      const toastId = toast.loading(tPrint('starting'))
      const result = await thermalPrint(receiptData)
      if (result.ok) {
        setAction(null)
        toast.success(tPrint('success'), { id: toastId })
        onOpenChange(false)
        return
      }
      toast.error(tPrint('failed'), { id: toastId })
      // Fall through to browser print as fallback — keep action='print'
    }
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
    const d = new Date(dateString)
    const pad = (n: number) => n.toString().padStart(2, '0')
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted.replace(/\s/g, ' ')} CFA`
  }

  const formatPaymentMethod = (method: string) => {
    const methods: Record<string, string> = {
      cash: 'Especes',
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
          body * {
            visibility: hidden;
          }
          .receipt-container,
          .receipt-container * {
            visibility: visible;
          }
          .receipt-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 80mm !important;
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
            border-left: 1px solid #e5e7eb !important;
            border-right: 1px solid #e5e7eb !important;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
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
              className="receipt-container bg-white px-2 py-4 mx-auto border-x border-gray-200"
              style={{ width: '80mm', fontFamily: 'monospace' }}
            >
            {/* Header */}
            <div className="text-xs text-center">
              <p className="text-sm font-bold text-center break-words">{receiptData.store.name}</p>
              {receiptData.store.address && <p>{receiptData.store.address}</p>}
              {receiptData.store.phone && <p>Tel: {receiptData.store.phone}</p>}
            </div>

            <p className="text-xs my-1">{'- '.repeat(20).trim()}</p>

            {/* Sale info */}
            <div className="text-xs">
              <p>Ticket #{receiptData.sale_number}</p>
              <p>{formatDate(receiptData.created_at)}</p>
              {receiptData.cashier.full_name && <p>Caissier: {receiptData.cashier.full_name}</p>}
            </div>

            <p className="text-xs my-1">{'- '.repeat(20).trim()}</p>

            {/* Items */}
            <div className="text-xs">
              {receiptData.sale_items.map((item, idx) => (
                <div key={idx}>
                  <div className="flex justify-between">
                    <span className="truncate flex-1 mr-1">{item.product.name} x{item.quantity}</span>
                    <span className="whitespace-nowrap">{formatCurrency(item.subtotal)}</span>
                  </div>
                  {item.discount && item.discount > 0 && (
                    <p className="pl-2">remise: -{formatCurrency(item.discount)}</p>
                  )}
                </div>
              ))}
            </div>

            <p className="text-xs my-1">{'- '.repeat(20).trim()}</p>

            {/* Totals */}
            <div className="text-xs">
              <div className="flex justify-between">
                <span>Sous-total</span>
                <span>{formatCurrency(receiptData.subtotal)}</span>
              </div>
              {receiptData.tax > 0 && (
                <div className="flex justify-between">
                  <span>TVA</span>
                  <span>{formatCurrency(receiptData.tax)}</span>
                </div>
              )}
              {receiptData.discount && receiptData.discount > 0 && (
                <div className="flex justify-between">
                  <span>Remise</span>
                  <span>-{formatCurrency(receiptData.discount)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-sm mt-0.5">
                <span>TOTAL</span>
                <span>{formatCurrency(receiptData.total)}</span>
              </div>
              <p>{formatPaymentMethod(receiptData.payment_method)}</p>
            </div>

            <p className="text-xs my-1">{'- '.repeat(20).trim()}</p>

            {/* Footer */}
            <p className="text-xs text-center">Merci !</p>

            {receiptData.notes && (
              <div className="text-xs mt-2">
                Note: {receiptData.notes}
              </div>
            )}
            </div>
          </div>

          {/* Action Buttons - Always visible */}
          <div className="no-print flex gap-2 pt-4 flex-shrink-0 border-t">
            <Button
              onClick={handlePrint}
              disabled={loading || action === 'print'}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
            >
              {action === 'print' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Printer className="mr-2 h-4 w-4" />
              )}
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
