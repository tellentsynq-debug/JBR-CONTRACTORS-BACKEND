-- Check and Verify Chat/Employee Setup
-- Run this in Supabase SQL Editor to verify all columns exist

-- Check candidates table structure
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'candidates' 
  AND column_name IN ('id', 'phone_number', 'registration_number')
ORDER BY ordinal_position;

-- Check if registration_number column exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'candidates' 
    AND column_name = 'registration_number'
) as registration_number_exists;

-- Check if trigger exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.triggers 
  WHERE trigger_name = 'trg_generate_registration_number'
) as trigger_exists;

-- Verify some sample registrations
SELECT 
  id,
  phone_number, 
  registration_number,
  created_at
FROM candidates
WHERE registration_number IS NOT NULL
LIMIT 5;

-- Check candidates with NULL registration_number
SELECT 
  id,
  phone_number, 
  registration_number,
  created_at
FROM candidates
WHERE phone_number IS NOT NULL 
  AND registration_number IS NULL
LIMIT 10;
