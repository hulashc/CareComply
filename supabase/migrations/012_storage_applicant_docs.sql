INSERT INTO storage.buckets (id, name, public)
VALUES ('applicant-documents', 'applicant-documents', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can read applicant documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'applicant-documents');

CREATE POLICY "Anyone can upload applicant documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'applicant-documents');
