'use client'

/**
 * POS Proforma Invoice Component
 * Professional A4 format invoice for proformas created from POS
 * - Print: Native browser print dialog -> PDF
 * - Download: html2pdf.js -> PDF
 *
 * NOTE: Uses inline styles for PDF compatibility (html2canvas doesn't support CSS lab/oklch colors)
 */

import { useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
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

// CSS color constants for PDF compatibility
const colors = {
  white: '#ffffff',
  gray50: '#f9fafb',
  gray100: '#f3f4f6',
  gray200: '#e5e7eb',
  gray300: '#d1d5db',
  gray400: '#9ca3af',
  gray500: '#6b7280',
  gray600: '#4b5563',
  gray700: '#374151',
  gray800: '#1f2937',
  blue100: '#dbeafe',
  blue600: '#2563eb',
  blue800: '#1e40af',
  yellow50: '#fefce8',
  yellow200: '#fef08a',
  yellow800: '#854d0e',
  green600: '#16a34a',
  red600: '#dc2626',
}

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
      // Dynamic import for client-side only library
      const html2pdf = (await import('html2pdf.js')).default

      // Helper function to replace lab()/oklch() colors in cloned document
      const fixLabColors = (doc: Document) => {
        // CSS properties that may contain colors
        const colorProps = [
          'color',
          'background-color',
          'border-color',
          'border-top-color',
          'border-right-color',
          'border-bottom-color',
          'border-left-color',
          'outline-color',
          'text-decoration-color',
          'fill',
          'stroke',
        ]

        // Walk all elements and fix inline styles
        const elements = doc.querySelectorAll('*')
        elements.forEach((el) => {
          const htmlEl = el as HTMLElement
          if (htmlEl.style) {
            colorProps.forEach((prop) => {
              const value = htmlEl.style.getPropertyValue(prop)
              if (value && (value.includes('lab(') || value.includes('oklch('))) {
                // Replace with neutral gray
                htmlEl.style.setProperty(prop, '#374151')
              }
            })
          }
        })

        // Also override CSS variables at root level
        const root = doc.documentElement
        root.style.setProperty('--background', '#ffffff')
        root.style.setProperty('--foreground', '#1f2937')
        root.style.setProperty('--card', '#ffffff')
        root.style.setProperty('--card-foreground', '#1f2937')
        root.style.setProperty('--popover', '#ffffff')
        root.style.setProperty('--popover-foreground', '#1f2937')
        root.style.setProperty('--primary', '#1f2937')
        root.style.setProperty('--primary-foreground', '#f9fafb')
        root.style.setProperty('--secondary', '#f3f4f6')
        root.style.setProperty('--secondary-foreground', '#1f2937')
        root.style.setProperty('--muted', '#f3f4f6')
        root.style.setProperty('--muted-foreground', '#6b7280')
        root.style.setProperty('--accent', '#f3f4f6')
        root.style.setProperty('--accent-foreground', '#1f2937')
        root.style.setProperty('--destructive', '#ef4444')
        root.style.setProperty('--destructive-foreground', '#f9fafb')
        root.style.setProperty('--border', '#e5e7eb')
        root.style.setProperty('--input', '#e5e7eb')
        root.style.setProperty('--ring', '#1f2937')
      }

      const opt = {
        margin: 0, // No PDF margins - container handles padding
        filename: `proforma-${proformaData.proforma_number}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: {
          scale: 2,
          useCORS: true,
          backgroundColor: '#ffffff',
          logging: false,
          onclone: (clonedDoc: Document) => {
            fixLabColors(clonedDoc)
          },
        },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      }

      await html2pdf().set(opt).from(printRef.current).save()
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

  const isExpired = new Date(proformaData.valid_until) < new Date()

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
              className="print-container"
              style={{
                width: '210mm',
                margin: '0 auto',
                fontFamily: 'Arial, sans-serif',
                backgroundColor: colors.white,
                padding: '32px',
                color: colors.gray800,
                boxSizing: 'border-box',
              }}
            >
              {/* Header */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '32px',
                paddingBottom: '24px',
                borderBottom: `2px solid ${colors.gray200}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '24px' }}>
                  {/* Logo placeholder */}
                  <div style={{
                    width: '80px',
                    height: '80px',
                    backgroundColor: colors.gray100,
                    border: `2px dashed ${colors.gray300}`,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    color: colors.gray400,
                    fontSize: '12px',
                  }}>
                    LOGO
                  </div>

                  {/* Store Info */}
                  <div>
                    <h2 style={{ fontSize: '20px', fontWeight: 'bold', color: colors.gray800, margin: 0 }}>
                      {proformaData.store.name}
                    </h2>
                    {proformaData.store.address && (
                      <p style={{ fontSize: '14px', color: colors.gray600, margin: '4px 0 0 0' }}>
                        {proformaData.store.address}
                      </p>
                    )}
                    {proformaData.store.phone && (
                      <p style={{ fontSize: '14px', color: colors.gray600, margin: '2px 0 0 0' }}>
                        Tél: {proformaData.store.phone}
                      </p>
                    )}
                    {proformaData.store.email && (
                      <p style={{ fontSize: '14px', color: colors.gray600, margin: '2px 0 0 0' }}>
                        {proformaData.store.email}
                      </p>
                    )}
                  </div>
                </div>

                {/* Document Title */}
                <div style={{ textAlign: 'right' }}>
                  <h1 style={{ fontSize: '28px', fontWeight: 'bold', color: colors.gray800, margin: '0 0 8px 0' }}>
                    {t('documentTitle')}
                  </h1>
                  <p style={{ fontSize: '16px', color: colors.gray600, fontFamily: 'monospace', margin: 0 }}>
                    {proformaData.proforma_number}
                  </p>
                  <span style={{
                    display: 'inline-block',
                    marginTop: '8px',
                    padding: '4px 12px',
                    backgroundColor: colors.blue100,
                    color: colors.blue800,
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontWeight: '600',
                  }}>
                    {t('status.sent')}
                  </span>
                </div>
              </div>

              {/* Customer & Date Info */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '32px',
                marginBottom: '32px',
              }}>
                <div>
                  <h3 style={{
                    fontSize: '12px',
                    fontWeight: '600',
                    color: colors.gray500,
                    textTransform: 'uppercase',
                    margin: '0 0 8px 0',
                  }}>
                    {t('billTo')}
                  </h3>
                  {proformaData.customer ? (
                    <div>
                      <p style={{ fontWeight: '600', color: colors.gray800, margin: 0 }}>
                        {proformaData.customer.name}
                      </p>
                      {proformaData.customer.email && (
                        <p style={{ fontSize: '14px', color: colors.gray600, margin: '2px 0 0 0' }}>
                          {proformaData.customer.email}
                        </p>
                      )}
                      {proformaData.customer.phone && (
                        <p style={{ fontSize: '14px', color: colors.gray600, margin: '2px 0 0 0' }}>
                          {proformaData.customer.phone}
                        </p>
                      )}
                      {proformaData.customer.address && (
                        <p style={{ fontSize: '14px', color: colors.gray600, margin: '2px 0 0 0' }}>
                          {proformaData.customer.address}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p style={{ color: colors.gray500, fontStyle: 'italic', margin: 0 }}>
                      {t('noCustomer')}
                    </p>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ marginBottom: '16px' }}>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: colors.gray500,
                      textTransform: 'uppercase',
                      margin: 0,
                    }}>
                      {t('dateIssued')}
                    </p>
                    <p style={{ color: colors.gray800, margin: '4px 0 0 0' }}>
                      {formatDateTime(proformaData.created_at)}
                    </p>
                  </div>
                  <div>
                    <p style={{
                      fontSize: '12px',
                      fontWeight: '600',
                      color: colors.gray500,
                      textTransform: 'uppercase',
                      margin: 0,
                    }}>
                      {t('validUntil')}
                    </p>
                    <p style={{
                      color: isExpired ? colors.red600 : colors.gray800,
                      fontWeight: isExpired ? '600' : 'normal',
                      margin: '4px 0 0 0',
                    }}>
                      {formatDate(proformaData.valid_until)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Items Table */}
              <div style={{ marginBottom: '32px' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ backgroundColor: colors.gray100 }}>
                      <th style={{
                        border: `1px solid ${colors.gray200}`,
                        padding: '12px 16px',
                        textAlign: 'left',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: colors.gray700,
                      }}>
                        {t('columns.product')}
                      </th>
                      <th style={{
                        border: `1px solid ${colors.gray200}`,
                        padding: '12px 16px',
                        textAlign: 'center',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: colors.gray700,
                        width: '60px',
                      }}>
                        {t('columns.qty')}
                      </th>
                      <th style={{
                        border: `1px solid ${colors.gray200}`,
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: colors.gray700,
                        width: '120px',
                      }}>
                        {t('columns.unitPrice')}
                      </th>
                      <th style={{
                        border: `1px solid ${colors.gray200}`,
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: colors.gray700,
                        width: '90px',
                      }}>
                        {t('columns.discount')}
                      </th>
                      <th style={{
                        border: `1px solid ${colors.gray200}`,
                        padding: '12px 16px',
                        textAlign: 'right',
                        fontSize: '14px',
                        fontWeight: '600',
                        color: colors.gray700,
                        width: '120px',
                      }}>
                        {t('columns.subtotal')}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {proformaData.items.map((item, index) => (
                      <tr key={index} style={{ backgroundColor: index % 2 === 0 ? colors.white : colors.gray50 }}>
                        <td style={{ border: `1px solid ${colors.gray200}`, padding: '12px 16px' }}>
                          <div>
                            <p style={{ fontWeight: '500', color: colors.gray800, margin: 0 }}>
                              {item.product.name}
                            </p>
                            <p style={{ fontSize: '12px', color: colors.gray500, fontFamily: 'monospace', margin: '2px 0 0 0' }}>
                              {item.product.sku}
                            </p>
                          </div>
                        </td>
                        <td style={{ border: `1px solid ${colors.gray200}`, padding: '12px 16px', textAlign: 'center' }}>
                          {item.quantity}
                        </td>
                        <td style={{ border: `1px solid ${colors.gray200}`, padding: '12px 16px', textAlign: 'right' }}>
                          {formatCurrency(item.unit_price)}
                        </td>
                        <td style={{ border: `1px solid ${colors.gray200}`, padding: '12px 16px', textAlign: 'right' }}>
                          {item.discount ? formatCurrency(item.discount) : '-'}
                        </td>
                        <td style={{ border: `1px solid ${colors.gray200}`, padding: '12px 16px', textAlign: 'right', fontWeight: '500' }}>
                          {formatCurrency(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '32px' }}>
                <div style={{ width: '280px' }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.gray200}`,
                  }}>
                    <span style={{ color: colors.gray600 }}>{t('totals.subtotal')}</span>
                    <span style={{ fontWeight: '500' }}>{formatCurrency(proformaData.subtotal)}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: `1px solid ${colors.gray200}`,
                  }}>
                    <span style={{ color: colors.gray600 }}>{t('totals.tax')}</span>
                    <span style={{ fontWeight: '500' }}>{formatCurrency(proformaData.tax)}</span>
                  </div>
                  {proformaData.discount > 0 && (
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0',
                      borderBottom: `1px solid ${colors.gray200}`,
                      color: colors.green600,
                    }}>
                      <span>{t('totals.discount')}</span>
                      <span style={{ fontWeight: '500' }}>-{formatCurrency(proformaData.discount)}</span>
                    </div>
                  )}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '12px 0',
                    borderBottom: `2px solid ${colors.gray800}`,
                    fontSize: '18px',
                    fontWeight: 'bold',
                  }}>
                    <span>{t('totals.total')}</span>
                    <span>{formatCurrency(proformaData.total)}</span>
                  </div>
                </div>
              </div>

              {/* Disclaimer */}
              <div style={{
                backgroundColor: colors.yellow50,
                border: `1px solid ${colors.yellow200}`,
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '32px',
              }}>
                <p style={{ fontSize: '14px', color: colors.yellow800, fontWeight: '500', margin: 0 }}>
                  {t('disclaimer')}
                </p>
              </div>

              {/* Footer with QR */}
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-end',
                paddingTop: '24px',
                borderTop: `2px solid ${colors.gray200}`,
              }}>
                <div style={{ fontSize: '12px', color: colors.gray400 }}>
                  <p style={{ margin: 0 }}>{t('generatedBy')}</p>
                  <p style={{ margin: '4px 0 0 0' }}>{t('createdBy')}: {proformaData.created_by.full_name || 'N/A'}</p>
                </div>
                <div style={{ textAlign: 'center' }}>
                  <QRCodeSVG
                    value={`PROFORMA:${proformaData.id}:${proformaData.proforma_number}`}
                    size={80}
                    level="M"
                    bgColor={colors.white}
                    fgColor={colors.gray800}
                  />
                  <p style={{ fontSize: '12px', color: colors.gray400, margin: '4px 0 0 0' }}>{t('scanToVerify')}</p>
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
