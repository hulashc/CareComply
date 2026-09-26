INSERT INTO storage.buckets (id, name, public)
VALUES ('form-files', 'form-files', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read form files"
ON storage.objects FOR SELECT
USING (bucket_id = 'form-files');

CREATE POLICY "Anyone can upload form files"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'form-files');
