# Registration Number NULL Issue - Fix Guide

## Problem
Registration number is showing as NULL when you create an employee and then fetch it.

## Root Causes
1. The `registration_number` column doesn't exist in database
2. The database trigger isn't set up
3. The phone_number is NULL when creating employee

## Step-by-Step Fix

### Step 1: Verify Database Column
Go to Supabase SQL Editor and run:
```sql
-- Check if registration_number column exists
SELECT EXISTS (
  SELECT 1 FROM information_schema.columns 
  WHERE table_name = 'candidates' 
    AND column_name = 'registration_number'
) as exists;
```

**If result is FALSE**, proceed to Step 2.

### Step 2: Create Column (if missing)
Run this SQL in Supabase SQL Editor:

```sql
-- Add registration_number column
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50) UNIQUE;

-- Create function to generate registration number
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    NEW.registration_number := 'JBR-' || SUBSTRING(NEW.phone_number, -5);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
DROP TRIGGER IF EXISTS trg_generate_registration_number ON candidates;
CREATE TRIGGER trg_generate_registration_number
BEFORE INSERT OR UPDATE ON candidates
FOR EACH ROW
EXECUTE FUNCTION generate_registration_number();

-- Update existing records
UPDATE candidates 
SET registration_number = 'JBR-' || SUBSTRING(phone_number, -5)
WHERE registration_number IS NULL 
  AND phone_number IS NOT NULL;
```

### Step 3: Verify Backend Code
Ensure you have the latest code:
```bash
cd /your/project/path
git pull origin main
```

The backend now automatically generates registration_number if missing:
- File: `src/utils/registrationUtils.js`
- Applied to: CREATE, GET, UPDATE operations

### Step 4: Test

**Create Employee:**
```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone_number": "+1-234-567-8901",
    "job_category_id": 1
  }'
```

**Expected Response:**
```json
{
  "success": true,
  "id": "employee-uuid",
  "phone_number": "+1-234-567-8901",
  "registration_number": "JBR-08901",
  "first_name": "John",
  "last_name": "Doe",
  "message": "Employee created successfully"
}
```

**Fetch Employee:**
```bash
curl -X GET http://localhost:3000/api/employees/employee-uuid \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response includes `registration_number`:**
```json
{
  "id": "employee-uuid",
  "first_name": "John",
  "last_name": "Doe",
  "phone_number": "+1-234-567-8901",
  "registration_number": "JBR-08901",
  ...
}
```

## Troubleshooting

### Still NULL after create?
1. Check if phone_number is NOT NULL in request
2. Run database verification query: `database/verify_schema.sql`
3. Check server logs for errors

### Database trigger not firing?
1. Verify trigger exists: 
```sql
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trg_generate_registration_number';
```

2. If missing, re-run the CREATE TRIGGER statement from Step 2

### Column doesn't exist?
Run the full migration:
```sql
-- From: database/migrations/003_add_registration_number_to_candidates.sql
```

## Backend Fallback

Even if database trigger doesn't work, the backend will generate registration_number automatically:
- **Function:** `generateRegistrationNumber(phoneNumber)` in `registrationUtils.js`
- **Format:** `JBR-` + last 5 digits of phone
- **Applied to:** All API responses (CREATE, READ, UPDATE)

## Files Related to This Fix
- `database/migrations/003_add_registration_number_to_candidates.sql` - Migration
- `src/utils/registrationUtils.js` - Backend generation utility
- `src/controllers/employeeController.js` - Updated to apply formatting
- `database/verify_schema.sql` - Verification queries

## Quick Checklist
- [ ] Column exists in database
- [ ] Trigger is set up
- [ ] Backend code is latest (git pull)
- [ ] phone_number is being sent in request
- [ ] Tested CREATE and GET endpoints
- [ ] registration_number appears in responses
