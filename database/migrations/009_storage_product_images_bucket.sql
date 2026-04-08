-- ---------------------------------------------------------------------------
-- Supabase Storage setup for product images
-- ---------------------------------------------------------------------------
-- Creates public bucket: product-images
-- Grants authenticated users permission to upload/update/delete files
-- Grants public read access so image URLs can render in cards
-- ---------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'product_images_public_read'
  ) THEN
    CREATE POLICY product_images_public_read
      ON storage.objects
      FOR SELECT
      TO public
      USING (bucket_id = 'product-images');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'product_images_auth_insert'
  ) THEN
    CREATE POLICY product_images_auth_insert
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'product-images');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'product_images_auth_update'
  ) THEN
    CREATE POLICY product_images_auth_update
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (bucket_id = 'product-images')
      WITH CHECK (bucket_id = 'product-images');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'product_images_auth_delete'
  ) THEN
    CREATE POLICY product_images_auth_delete
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (bucket_id = 'product-images');
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
