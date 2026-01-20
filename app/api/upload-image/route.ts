import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import sharp from 'sharp'

// Supported input formats
const SUPPORTED_FORMATS = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']

interface UploadResponse {
  success: boolean
  url?: string
  error?: string
}

export async function POST(request: NextRequest): Promise<NextResponse<UploadResponse>> {
  try {
    const supabase = await createClient()

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ success: false, error: 'Not authenticated' }, { status: 401 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const bucket = formData.get('bucket') as string | null
    const path = formData.get('path') as string | null

    if (!file || !bucket || !path) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: file, bucket, path' },
        { status: 400 }
      )
    }

    // Validate file type
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Unsupported file format' },
        { status: 400 }
      )
    }

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const inputBuffer = Buffer.from(arrayBuffer)

    // Process image with Sharp
    let sharpInstance = sharp(inputBuffer)

    // Get image metadata to check if we need to resize
    const metadata = await sharpInstance.metadata()

    // Resize if image is too large (max 2000px on longest side)
    const MAX_DIMENSION = 2000
    if (metadata.width && metadata.height) {
      const maxSide = Math.max(metadata.width, metadata.height)
      if (maxSide > MAX_DIMENSION) {
        sharpInstance = sharpInstance.resize(MAX_DIMENSION, MAX_DIMENSION, {
          fit: 'inside',
          withoutEnlargement: true,
        })
      }
    }

    // Convert to AVIF format (Next.js handles browser compatibility at render time)
    const outputBuffer = await sharpInstance
      .avif({
        quality: 75,
        effort: 4, // Balance between speed and compression (0-9)
      })
      .toBuffer()

    // Generate unique filename
    const filename = `${path}/${Date.now()}.avif`

    // Upload to Supabase Storage
    const { data, error: uploadError } = await supabase.storage.from(bucket).upload(filename, outputBuffer, {
      contentType: 'image/avif',
      cacheControl: '31536000', // 1 year cache
      upsert: false,
    })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return NextResponse.json({ success: false, error: uploadError.message }, { status: 500 })
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(data.path)

    return NextResponse.json({ success: true, url: publicUrl })
  } catch (error) {
    console.error('Image upload error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process and upload image' },
      { status: 500 }
    )
  }
}
