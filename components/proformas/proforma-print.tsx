'use client'

/**
 * Proforma Print Component
 * Print-friendly proforma document with Print and Download functionality
 * - Print: Native browser print dialog -> PDF
 * - Download: html-to-image -> PNG
 */

import { useRef, useState, useEffect } from 'react'
import { toPng } from 'html-to-image'
import { QRCodeSVG } from 'qrcode.react'
import { format } from 'date-fns'
import { fr, enUS } from 'date-fns/locale'
import { useLocale, useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Download, Printer, Loader2 } from 'lucide-react'
import { getProformaDetail, type ProformaWithDetails, type ProformaItemWithProduct } from '@/lib/actions/proformas'

interface ProformaPrintProps {
  proforma: ProformaWithDetails | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ProformaPrint({
  proforma,
  open,
  onOpenChange,
}: ProformaPrintProps) {
  const t = useTranslations('Proformas')
  const locale = useLocale()
  const dateLocale = locale === 'fr' ? fr : enUS

  const printRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(false)
  const [action, setAction] = useState<'print' | 'download' | null>(null)
  const [items, setItems] = useState<ProformaItemWithProduct[]>([])
  const [itemsLoading, setItemsLoading] = useState(false)

  useEffect(() => {
    async function fetchItems() {
      if (!proforma || !open) return

      setItemsLoading(true)
      const result = await getProformaDetail(proforma.id)

      if (result.success && result.data) {
        setItems(result.data.items)
      }

      setItemsLoading(false)
    }

    fetchItems()
  }, [proforma, open])

  const handlePrint = () => {
    setAction('print')
    setTimeout(() => {
      window.print()
      setAction(null)
    }, 100)
  }

  const handleDownload = async () => {
    if (!printRef.current) return

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
      a.download = `proforma-${proforma?.proforma_number || 'export'}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Error downloading proforma:', error)
    } finally {
      setLoading(false)
      setAction(null)
    }
  }

  if (!proforma) return null

  const formatCurrency = (amount: number) => {
    const formatted = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
    return `${formatted} CFA`
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd MMMM yyyy', { locale: dateLocale })
  }

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      draft: t('status.draft'),
      sent: t('status.sent'),
      accepted: t('status.accepted'),
      rejected: t('status.rejected'),
      converted: t('status.converted'),
      expired: t('status.expired'),
    }
    return labels[status] || status
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
            <DialogTitle>{t('print.title')}</DialogTitle>
            <DialogDescription>
              {t('print.description', { number: proforma.proforma_number })}
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
                <div>
                  <h1 className="text-3xl font-bold text-gray-800 mb-2">
                    {t('print.proformaInvoice')}
                  </h1>
                  <p className="text-lg text-gray-600 font-mono">
                    {proforma.proforma_number}
                  </p>
                  <div className="mt-2 inline-block px-3 py-1 bg-gray-100 rounded text-sm">
                    {getStatusLabel(proforma.status)}
                  </div>
                </div>

                {/* Company Info */}
                <div className="text-right">
                  <h2 className="text-xl font-bold text-gray-800">
                    {proforma.store?.name || 'Store'}
                  </h2>
                </div>
              </div>

              {/* Customer & Date Info */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div>
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                    {t('print.billTo')}
                  </h3>
                  {proforma.customer ? (
                    <div>
                      <p className="font-semibold text-gray-800">{proforma.customer.name}</p>
                      {proforma.customer.email && (
                        <p className="text-sm text-gray-600">{proforma.customer.email}</p>
                      )}
                      {proforma.customer.phone && (
                        <p className="text-sm text-gray-600">{proforma.customer.phone}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-gray-500 italic">{t('print.noCustomer')}</p>
                  )}
                </div>

                <div className="text-right">
                  <div className="mb-4">
                    <p className="text-sm font-semibold text-gray-500 uppercase">
                      {t('print.dateIssued')}
                    </p>
                    <p className="text-gray-800">{formatDate(proforma.created_at)}</p>
                  </div>
                  {proforma.valid_until && (
                    <div>
                      <p className="text-sm font-semibold text-gray-500 uppercase">
                        {t('print.validUntil')}
                      </p>
                      <p className={new Date(proforma.valid_until) < new Date() ? 'text-red-600' : 'text-gray-800'}>
                        {formatDate(proforma.valid_until)}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <div className="mb-8">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-gray-100">
                      <th className="border border-gray-200 px-4 py-3 text-left text-sm font-semibold text-gray-700">
                        {t('itemColumns.product')}
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-700 w-24">
                        {t('itemColumns.qty')}
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700 w-32">
                        {t('itemColumns.unitPrice')}
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700 w-24">
                        {t('itemColumns.discount')}
                      </th>
                      <th className="border border-gray-200 px-4 py-3 text-right text-sm font-semibold text-gray-700 w-32">
                        {t('itemColumns.subtotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {itemsLoading ? (
                      <tr>
                        <td colSpan={5} className="border border-gray-200 px-4 py-8 text-center">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                        </td>
                      </tr>
                    ) : items.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="border border-gray-200 px-4 py-8 text-center text-gray-500">
                          {t('detail.noItems')}
                        </td>
                      </tr>
                    ) : (
                      items.map((item, index) => (
                        <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                          <td className="border border-gray-200 px-4 py-3">
                            <div>
                              <p className="font-medium text-gray-800">
                                {item.product?.name || 'Unknown Product'}
                              </p>
                              <p className="text-xs text-gray-500 font-mono">
                                {item.product?.sku || '-'}
                              </p>
                              {item.notes && (
                                <p className="text-xs text-gray-400 mt-1 italic">
                                  {item.notes}
                                </p>
                              )}
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
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="flex justify-end mb-8">
                <div className="w-72">
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">{t('totals.subtotal')}</span>
                    <span className="font-medium">{formatCurrency(proforma.subtotal)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-200">
                    <span className="text-gray-600">{t('totals.tax')}</span>
                    <span className="font-medium">{formatCurrency(proforma.tax)}</span>
                  </div>
                  {proforma.discount && proforma.discount > 0 && (
                    <div className="flex justify-between py-2 border-b border-gray-200 text-green-600">
                      <span>{t('totals.discount')}</span>
                      <span className="font-medium">-{formatCurrency(proforma.discount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-3 border-b-2 border-gray-800 text-lg font-bold">
                    <span>{t('totals.total')}</span>
                    <span>{formatCurrency(proforma.total)}</span>
                  </div>
                </div>
              </div>

              {/* Terms & Notes */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                {proforma.terms && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                      {t('print.termsConditions')}
                    </h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {proforma.terms}
                    </p>
                  </div>
                )}
                {proforma.notes && (
                  <div>
                    <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">
                      {t('print.notes')}
                    </h3>
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {proforma.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Footer with QR */}
              <div className="flex justify-between items-end pt-6 border-t-2 border-gray-200">
                <div className="text-xs text-gray-400">
                  <p>{t('print.generatedBy')} QGK Stock</p>
                  <p>{t('print.createdBy')}: {proforma.created_by?.full_name || proforma.created_by?.email || 'N/A'}</p>
                </div>
                <div className="text-center">
                  <QRCodeSVG
                    value={`PROFORMA:${proforma.id}:${proforma.proforma_number}`}
                    size={80}
                    level="M"
                  />
                  <p className="text-xs text-gray-400 mt-1">{t('print.scanToVerify')}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="no-print flex gap-2 pt-4 flex-shrink-0 border-t">
            <Button
              onClick={handlePrint}
              disabled={loading || itemsLoading}
              className="flex-1"
            >
              <Printer className="mr-2 h-4 w-4" />
              {t('print.printButton')}
            </Button>
            <Button
              onClick={handleDownload}
              disabled={loading || itemsLoading}
              variant="outline"
              className="flex-1"
            >
              {loading && action === 'download' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Download className="mr-2 h-4 w-4" />
              )}
              {t('print.downloadButton')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
