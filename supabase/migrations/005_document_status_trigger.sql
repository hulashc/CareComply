CREATE OR REPLACE FUNCTION update_document_status()
RETURNS trigger AS $$
BEGIN
  IF NEW.expiry_date IS NULL THEN
    NEW.status := 'green';
  ELSIF NEW.expiry_date < CURRENT_DATE THEN
    NEW.status := 'red';
  ELSIF NEW.expiry_date < CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.status := 'amber';
  ELSE
    NEW.status := 'green';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_document_status ON documents;
CREATE TRIGGER trg_document_status
  BEFORE INSERT OR UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_document_status();
