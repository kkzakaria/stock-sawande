-- Create the product-images bucket for storing product photos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Authenticated users can upload to product-images bucket
CREATE POLICY "Authenticated users can upload product images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'product-images');

-- Policy: Authenticated users can update their uploaded files
CREATE POLICY "Authenticated users can update product images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'product-images');

-- Policy: Authenticated users can delete product images
CREATE POLICY "Authenticated users can delete product images"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'product-images');

-- Policy: Public read access for product images
CREATE POLICY "Public read access for product images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'product-images');
