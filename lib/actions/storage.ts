'use server'

import { createClient } from '@/lib/supabase/server'

interface ActionResult<T = unknown> {
  success: boolean
  error?: string
  data?: T
}

/**
 * Extract the file path from a Supabase Storage public URL
 * Example: https://xxx.supabase.co/storage/v1/object/public/product-images/products/123/1234567890.jpg
 * Returns: products/123/1234567890.jpg
 */
function extractPathFromUrl(url: string): { bucket: string; path: string } | null {
  try {
    const urlObj = new URL(url)
    const pathname = urlObj.pathname

    // Match pattern: /storage/v1/object/public/{bucket}/{...path}
    const match = pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)/)
    if (match) {
      return {
        bucket: match[1],
        path: match[2],
      }
    }

    return null
  } catch {
    return null
  }
}

/**
 * Delete a file from Supabase Storage given its public URL
 */
export async function deleteStorageFile(url: string): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Extract bucket and path from URL
    const extracted = extractPathFromUrl(url)
    if (!extracted) {
      return { success: false, error: 'Invalid storage URL' }
    }

    const { bucket, path } = extracted

    // Delete the file
    const { error } = await supabase.storage.from(bucket).remove([path])

    if (error) {
      console.error('Error deleting storage file:', error)
      return { success: false, error: error.message }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete storage file error:', error)
    return { success: false, error: 'Failed to delete file' }
  }
}

/**
 * Delete multiple files from Supabase Storage
 */
export async function deleteStorageFiles(urls: string[]): Promise<ActionResult> {
  try {
    const supabase = await createClient()

    // Verify user is authenticated
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: 'Not authenticated' }
    }

    // Group files by bucket
    const filesByBucket: Record<string, string[]> = {}

    for (const url of urls) {
      const extracted = extractPathFromUrl(url)
      if (extracted) {
        if (!filesByBucket[extracted.bucket]) {
          filesByBucket[extracted.bucket] = []
        }
        filesByBucket[extracted.bucket].push(extracted.path)
      }
    }

    // Delete files from each bucket
    const errors: string[] = []

    for (const [bucket, paths] of Object.entries(filesByBucket)) {
      const { error } = await supabase.storage.from(bucket).remove(paths)
      if (error) {
        errors.push(`${bucket}: ${error.message}`)
      }
    }

    if (errors.length > 0) {
      console.error('Errors deleting storage files:', errors)
      return { success: false, error: errors.join(', ') }
    }

    return { success: true }
  } catch (error) {
    console.error('Delete storage files error:', error)
    return { success: false, error: 'Failed to delete files' }
  }
}
