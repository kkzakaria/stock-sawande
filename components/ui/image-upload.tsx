'use client'

import {
  useState,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
  useEffect,
} from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '@/components/ui/dialog'
import { ImageIcon, Upload, X, Loader2, ZoomIn } from 'lucide-react'
import { OptimizedImage } from '@/components/ui/optimized-image'

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB
const DEFAULT_ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']

export interface ImageUploadRef {
  uploadFile: (bucket: string, path: string) => Promise<string | null>
  hasFile: () => boolean
  clear: () => void
}

interface ImageUploadProps {
  value?: string | null
  onFileSelect?: (file: File | null) => void
  onValueChange?: (url: string) => void
  maxSize?: number
  acceptedTypes?: string[]
  disabled?: boolean
  className?: string
}

export const ImageUpload = forwardRef<ImageUploadRef, ImageUploadProps>(
  (
    {
      value,
      onFileSelect,
      onValueChange,
      maxSize = DEFAULT_MAX_SIZE,
      acceptedTypes = DEFAULT_ACCEPTED_TYPES,
      disabled = false,
      className,
    },
    ref
  ) => {
    const t = useTranslations('ImageUpload')
    const fileInputRef = useRef<HTMLInputElement>(null)
    const [file, setFile] = useState<File | null>(null)
    const [previewUrl, setPreviewUrl] = useState<string | null>(null)
    const [isDragging, setIsDragging] = useState(false)
    const [isUploading, setIsUploading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [isPreviewOpen, setIsPreviewOpen] = useState(false)

    // Cleanup preview URL on unmount
    useEffect(() => {
      return () => {
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl)
        }
      }
    }, [previewUrl])

    const validateFile = useCallback(
      (file: File): string | null => {
        if (!acceptedTypes.includes(file.type)) {
          return t('errors.invalidType')
        }
        if (file.size > maxSize) {
          return t('errors.tooLarge', { maxSize: Math.round(maxSize / 1024 / 1024) })
        }
        return null
      },
      [acceptedTypes, maxSize, t]
    )

    const handleFile = useCallback(
      (selectedFile: File | null) => {
        setError(null)

        if (!selectedFile) {
          // Clear file
          if (previewUrl && previewUrl.startsWith('blob:')) {
            URL.revokeObjectURL(previewUrl)
          }
          setFile(null)
          setPreviewUrl(null)
          onFileSelect?.(null)
          return
        }

        const validationError = validateFile(selectedFile)
        if (validationError) {
          setError(validationError)
          return
        }

        // Revoke previous preview URL if exists
        if (previewUrl && previewUrl.startsWith('blob:')) {
          URL.revokeObjectURL(previewUrl)
        }

        // Create new preview URL
        const newPreviewUrl = URL.createObjectURL(selectedFile)
        setFile(selectedFile)
        setPreviewUrl(newPreviewUrl)
        onFileSelect?.(selectedFile)
      },
      [previewUrl, validateFile, onFileSelect]
    )

    const handleDragOver = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        if (!disabled) {
          setIsDragging(true)
        }
      },
      [disabled]
    )

    const handleDragLeave = useCallback((e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
    }, [])

    const handleDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault()
        e.stopPropagation()
        setIsDragging(false)

        if (disabled) return

        const droppedFile = e.dataTransfer.files[0]
        if (droppedFile) {
          handleFile(droppedFile)
        }
      },
      [disabled, handleFile]
    )

    const handleInputChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0] || null
        handleFile(selectedFile)
        // Reset input so the same file can be selected again
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      },
      [handleFile]
    )

    const handleClick = useCallback(() => {
      if (!disabled) {
        fileInputRef.current?.click()
      }
    }, [disabled])

    const handleRemove = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation()
        handleFile(null)
        // If there was an existing value (URL), clear it
        onValueChange?.('')
      },
      [handleFile, onValueChange]
    )

    const handleOpenPreview = useCallback((e: React.MouseEvent) => {
      e.stopPropagation()
      setIsPreviewOpen(true)
    }, [])

    // Expose upload method to parent
    useImperativeHandle(
      ref,
      () => ({
        uploadFile: async (bucket: string, path: string): Promise<string | null> => {
          if (!file) return null

          setIsUploading(true)
          setError(null)

          try {
            // Create form data
            const formData = new FormData()
            formData.append('file', file)
            formData.append('bucket', bucket)
            formData.append('path', path)

            // Upload via API route (converts to AVIF)
            const response = await fetch('/api/upload-image', {
              method: 'POST',
              body: formData,
            })

            const result = await response.json()

            if (!result.success) {
              console.error('Upload error:', result.error)
              setError(t('errors.uploadFailed'))
              return null
            }

            // Clear the pending file after successful upload
            setFile(null)
            onFileSelect?.(null)
            onValueChange?.(result.url)

            return result.url
          } catch (err) {
            console.error('Upload error:', err)
            setError(t('errors.uploadFailed'))
            return null
          } finally {
            setIsUploading(false)
          }
        },
        hasFile: () => !!file,
        clear: () => {
          handleFile(null)
        },
      }),
      [file, t, onFileSelect, onValueChange, handleFile]
    )

    // Determine what to display
    const displayUrl = previewUrl || value

    return (
      <>
        <div className={cn('space-y-2', className)}>
          <div
            onClick={handleClick}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={cn(
              'relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors cursor-pointer',
              isDragging && 'border-primary bg-primary/5',
              !isDragging && !disabled && 'border-muted-foreground/25 hover:border-primary/50',
              disabled && 'cursor-not-allowed opacity-50',
              displayUrl && 'p-4'
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept={acceptedTypes.join(',')}
              onChange={handleInputChange}
              disabled={disabled || isUploading}
              className="hidden"
            />

            {isUploading ? (
              <div className="flex flex-col items-center gap-2 py-4">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{t('uploading')}</span>
              </div>
            ) : displayUrl ? (
              <div className="flex items-center gap-4">
                {/* Thumbnail */}
                <div className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-md border bg-muted">
                  <OptimizedImage
                    src={displayUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                    unoptimized={displayUrl.startsWith('blob:')}
                  />
                </div>

                {/* Actions and info */}
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-8"
                      onClick={handleOpenPreview}
                    >
                      <ZoomIn className="mr-1.5 h-3.5 w-3.5" />
                      {t('viewFull')}
                    </Button>
                    {!disabled && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-8 border-destructive/50 text-destructive hover:bg-destructive hover:text-white hover:border-destructive"
                        onClick={handleRemove}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" />
                        {t('remove')}
                      </Button>
                    )}
                  </div>
                  {file && (
                    <p className="text-xs text-muted-foreground">
                      {t('pendingUpload')}
                    </p>
                  )}
                  {!disabled && (
                    <p className="text-xs text-muted-foreground">
                      {t('clickToChange')}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <div className="rounded-full bg-muted p-3">
                  {isDragging ? (
                    <Upload className="h-6 w-6 text-primary" />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium">{t('dragDrop')}</p>
                  <p className="text-xs text-muted-foreground">{t('or')}</p>
                  <p className="text-xs text-primary underline">{t('clickToSelect')}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {t('maxSize', { maxSize: Math.round(maxSize / 1024 / 1024) })}
                </p>
              </div>
            )}
          </div>

          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </div>

        {/* Full-size preview dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
          <DialogContent className="max-w-[90vw] max-h-[90vh] w-fit p-2 overflow-hidden">
            <DialogTitle className="sr-only">{t('previewTitle')}</DialogTitle>
            {displayUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={displayUrl}
                alt="Full preview"
                className="max-w-full max-h-[85vh] object-contain"
              />
            )}
          </DialogContent>
        </Dialog>
      </>
    )
  }
)

ImageUpload.displayName = 'ImageUpload'
