'use client'

/**
 * POS Proforma Receipt Component
 * Lightweight HTML-based proforma receipt with Print and Download functionality
 * Similar to pos-receipt.tsx but for proformas (quotes)
 */

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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
import { Download, Printer, Loader2 } from 'lucide-react'
import type { POSProformaResult } from '@/lib/actions/proformas'

interface POSProformaReceiptProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proformaData: POSProformaResult | null
}

export function POSProformaReceipt({
  open,
  onOpenChange,
  proformaData,
}: POSProformaReceiptProps) {
  const t = useTranslations('POS.proformaReceipt')
  const receiptRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'print' | 'download' | null>(null)

  const handlePrint = () => {
    setAction('print')
    setTimeout(() => {
      window.print()
      setAction(null)
    }, 100)
  }

  const handleDownload = async () => {
    if (!receiptRef.current || !proformaData) return

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
      a.download = `proforma-${proformaData.proforma_number}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading proforma:', error)
      alert('Erreur lors du téléchargement de la proforma')
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

  const formatDateShort = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  // Format number without currency symbol (for table cells)
  const formatAmount = (amount: number) => {
    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount)
  }

  if (!proformaData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>Chargement...</DialogDescription>
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
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>
              {t('description', { number: proformaData.proforma_number })}
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
            <div className="text-center mb-4 border-b-2 border-dashed border-gray-300 pb-4">
              <h1 className="text-xl font-bold mb-1">{proformaData.store.name}</h1>
              {proformaData.store.address && (
                <p className="text-xs text-gray-600">{proformaData.store.address}</p>
              )}
              {proformaData.store.phone && (
                <p className="text-xs text-gray-600">{proformaData.store.phone}</p>
              )}
            </div>

            {/* Proforma Badge */}
            <div className="text-center mb-4">
              <span className="inline-block bg-blue-100 text-blue-800 text-sm font-semibold px-3 py-1 rounded">
                PROFORMA
              </span>
            </div>

            {/* Proforma Info */}
            <div className="text-xs mb-4">
              <div className="flex justify-between">
                <span>N°:</span>
                <span className="font-bold">{proformaData.proforma_number}</span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span>{formatDate(proformaData.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span>Créé par:</span>
                <span>{proformaData.created_by.full_name || 'N/A'}</span>
              </div>
              <div className="flex justify-between font-semibold text-blue-700">
                <span>{t('validUntil')}:</span>
                <span>{formatDateShort(proformaData.valid_until)}</span>
              </div>
            </div>

            {/* Items */}
            <div className="border-t-2 border-dashed border-gray-300 pt-2 mb-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="text-left py-1">Article</th>
                    <th className="text-center py-1">Qté</th>
                    <th className="text-right py-1">Prix ($)</th>
                    <th className="text-right py-1">Total ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {proformaData.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-200">
                      <td className="py-1">
                        <div className="font-medium">{item.product.name}</div>
                        <div className="text-gray-500">{item.product.sku}</div>
                      </td>
                      <td className="text-center">{item.quantity}</td>
                      <td className="text-right">{formatAmount(item.unit_price)}</td>
                      <td className="text-right font-medium">
                        {formatAmount(item.subtotal)}
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
                <span>{formatCurrency(proformaData.subtotal)}</span>
              </div>
              {proformaData.discount && proformaData.discount > 0 && (
                <div className="flex justify-between text-sm mb-1 text-red-600">
                  <span>Remise:</span>
                  <span>-{formatCurrency(proformaData.discount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm mb-1">
                <span>TVA (8.75%):</span>
                <span>{formatCurrency(proformaData.tax)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold border-t-2 border-gray-800 pt-2 mt-2">
                <span>TOTAL:</span>
                <span>{formatCurrency(proformaData.total)}</span>
              </div>
            </div>

            {/* QR Code */}
            <div className="flex justify-center mb-4 border-t-2 border-dashed border-gray-300 pt-4">
              <div className="text-center">
                <QRCodeSVG
                  value={`PROFORMA:${proformaData.id}:${proformaData.proforma_number}`}
                  size={100}
                  level="M"
                />
                <p className="text-xs text-gray-500 mt-2">Scanner pour vérifier</p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="text-center text-xs text-gray-600 bg-yellow-50 border border-yellow-200 rounded p-2 mb-4">
              <p className="font-semibold">{t('disclaimer')}</p>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-gray-500 border-t-2 border-dashed border-gray-300 pt-4">
              <p>Merci de votre confiance!</p>
              <p className="mt-1">À bientôt</p>
            </div>
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
              {t('print')}
            </Button>
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
              {t('download')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
