-- Migration: Add registration_number column to candidates table
-- This stores a registration number in format: JBR + last 5 digits of phone_number

ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50) UNIQUE;

-- Create a function to generate registration number
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    -- Extract last 5 digits from phone number and format as JBR-XXXXX
    NEW.registration_number := 'JBR-' || SUBSTRING(NEW.phone_number, -5);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically generate registration_number
DROP TRIGGER IF EXISTS trg_generate_registration_number ON candidates;
CREATE TRIGGER trg_generate_registration_number
BEFORE INSERT OR UPDATE ON candidates
FOR EACH ROW
EXECUTE FUNCTION generate_registration_number();

-- Update existing records with registration numbers
UPDATE candidates 
SET registration_number = 'JBR-' || SUBSTRING(phone_number, -5)
WHERE registration_number IS NULL 
  AND phone_number IS NOT NULL;

-- Add comment
COMMENT ON COLUMN candidates.registration_number IS 'Registration number in format JBR-XXXXX where XXXXX are last 5 digits of phone number';
