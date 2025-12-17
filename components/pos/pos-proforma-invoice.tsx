'use client'

/**
 * POS Proforma Invoice Component
 * Professional A4 format invoice for proformas created from POS
 * - Print: Native browser print dialog -> PDF
 * - Download: html-to-image -> PNG
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
import { Download, Printer, Loader2, ImageIcon } from 'lucide-react'
import type { POSProformaResult } from '@/lib/actions/proformas'

interface POSProformaInvoiceProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  proformaData: POSProformaResult | null
}

export function POSProformaInvoice({
  open,
  onOpenChange,
  proformaData,
}: POSProformaInvoiceProps) {
  const t = useTranslations('POS.proformaInvoice')
  const printRef = useRef<HTMLDivElement>(null)
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
    if (!printRef.current || !proformaData) return

    setLoading(true)
    setAction('download')

    try {
      const dataUrl = await toPng(printRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#ffffff',
      })

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
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  }

  const formatDateTime = (dateString: string) => {
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

  if (!proformaData) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>{t('loading')}</DialogDescription>
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
            size: A4;
            margin: 15mm;
          }
          body {
            margin: 0;
            padding: 0;
            background: white;
          }
          .no-print {
            display: none !important;
          }
          .print-container {
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
        }
      `}</style>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader className="no-print flex-shrink-0">
            <DialogTitle>{t('title')}</DialogTitle>
            <DialogDescription>
              {t('description', { number: proformaData.proforma_number })}
            </DialogDescription>
          </DialogHeader>

          {/* Print Template - Scrollable */}
          <div className="flex-1 overflow-y-auto min-h-0">
            <div
              ref={printRef}
              className="print-container bg-white p-8 mx-auto"
              style={{ width: '210mm', fontFamily: 'Arial, sans-serif' }}
            >
              {/* Header */}
              <div className="flex justify-between items-start mb-8 pb-6 border-b-2 border-gray-200">
                <div className="flex items-start gap-6">
                  {/* Logo placeholder */}
                  <div className="w-20 h-20 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center flex-shrink-0">
                    <ImageIcon className="w-8 h-8 text-gray-400" />
                  </div>

                  {/* Store Info */}
                  <div>
                    <h2 className="text-xl font-bold text-gray-800">
                      {proformaData.store.name}
                    </h2>
                    {proformaData.store.address && (
                      <p className="text-sm text-gray-600 mt-1">{proformaData.store.address}</p>
                    )}
                    {proformaData.store.phone && (
                      <p className="text-sm text-gray-600">Tél: {proformaData.store.phone}</p>
                    )}
                    {proformaData.store.email && (
                      <p className="text-sm text-gray-600">{proformaData.store.email}</p>
                    )}
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-right">
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    {t('documentTitle')}
                  </h1>
                  <p className="text-lg text-gray-600 font-mono">
                    {proformaData.proforma_number}
                  </p>
                  <div className="mt-2 inline-block px-3 py-1 bg-blue-100 text-blue-800 rounded text-sm font-semibold">
                    {t('status.sent')}
                  </div>
                </div>
              </div>

              {/* Customer & Date Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                    {t('billTo')}
                  </h3>
                  {proformaData.customer ? (
                    <div>
                      <p className="font-semibold text-gray-800">{proformaData.customer.name}</p>
                      {proformaData.customer.email && (
                        <p className="text-sm text-gray-600">{proformaData.customer.email}</p>
                      )}
                      {proformaData.customer.phone && (
                        <p className="text-sm text-gray-600">{proformaData.customer.phone}</p>
                      )}
                      {proformaData.customer.address && (
                        <p className="text-sm text-gray-600">{proformaData.customer.address}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">{t('noCustomer')}</p>
                  )}
                </div>

                <div className="text-right">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-500 uppercase">
                      {t('dateIssued')}
                    </p>
                    <p className="text-gray-800">{formatDateTime(proformaData.created_at)}</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-gray-500 uppercase">
                      {t('validUntil')}
                    </p>
                    <p className={new Date(proformaData.valid_until) < new Date() ? 'text-red-600 font-semibold' : 'text-gray-800'}>
                      {formatDate(proformaData.valid_until)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {t('columns.product')}
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-700 w-20">
                        {t('columns.qty')}
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700 w-32">
                        {t('columns.unitPrice')}
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700 w-24">
                        {t('columns.discount')}
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700 w-32">
                        {t('columns.subtotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {proformaData.items.map((item, index) => (
                      <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="border border-gray-200 px-4 py-3">
                          <div>
                            <p className="font-medium text-gray-800">
                              {item.product.name}
                            </p>
                            <p className="text-xs text-gray-500 font-mono">
                              {item.product.sku}
                            </p>
                          </div>
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-center">
                          {item.quantity}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-right">
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-right">
                          {item.discount ? formatCurrency(item.discount) : '-'}
                        </td>
                        <td className="border border-gray-200 px-4 py-3 text-right font-medium">
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-72">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">{t('totals.subtotal')}</span>
                    <span className="font-medium">{formatCurrency(proformaData.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">{t('totals.tax')}</span>
                    <span className="font-medium">{formatCurrency(proformaData.tax)}</span>
                  </div>
                  {proformaData.discount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200 text-green-600">
                      <span>{t('totals.discount')}</span>
                      <span className="font-medium">-{formatCurrency(proformaData.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-b-2 border-gray-800 text-lg font-bold">
                    <span>{t('totals.total')}</span>
                    <span>{formatCurrency(proformaData.total)}</span>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-8">
                <p className="text-sm text-yellow-800 font-medium">
                  {t('disclaimer')}
                </p>
              </div>

              {/* Footer with QR */}
              <div className="flex justify-between items-end pt-6 border-t-2 border-gray-200">
                <div className="text-xs text-gray-400">
                  <p>{t('generatedBy')}</p>
                  <p>{t('createdBy')}: {proformaData.created_by.full_name || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <QRCodeSVG
                    value={`PROFORMA:${proformaData.id}:${proformaData.proforma_number}`}
                    size={80}
                    level="M"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('scanToVerify')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
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
              variant="outline"
              className="flex-1"
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
