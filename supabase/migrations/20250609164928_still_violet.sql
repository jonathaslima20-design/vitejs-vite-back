/*
  # Configurar Storage Buckets

  1. Bucket público para imagens
    - Avatares de usuários
    - Imagens de produtos
    - Banners promocionais

  2. Políticas de acesso
    - Upload apenas para usuários autenticados
    - Visualização pública
*/

-- Create storage bucket for public files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'public',
  'public',
  true,
  5242880, -- 5MB
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO NOTHING;

-- Storage policies for public bucket
CREATE POLICY "Anyone can view public files"
  ON storage.objects
  FOR SELECT
  TO anon, authenticated
  USING (bucket_id = 'public');

CREATE POLICY "Authenticated users can upload public files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'public');

CREATE POLICY "Users can update their own files"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'public' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'public' AND auth.uid()::text = (storage.foldername(name))[1]);