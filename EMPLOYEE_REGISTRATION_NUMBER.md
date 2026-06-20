# Employee Registration Number Feature

## Overview
Every employee/candidate now has a unique registration number in the format: **JBR-XXXXX** where XXXXX are the last 5 digits of their phone number.

## API Response Example

### GET /api/employees
```json
{
  "data": [
    {
      "id": "employee-uuid",
      "first_name": "John",
      "last_name": "Doe",
      "email": "john@example.com",
      "phone_number": "+1-234-567-8901",
      "registration_number": "JBR-08901",
      "gender": "male",
      "verification_status": "verified",
      "created_at": "2026-06-20T10:00:00Z",
      ...
    }
  ],
  "pagination": {
    "limit": 10,
    "offset": 0,
    "total": 100
  }
}
```

### GET /api/employees/:id
```json
{
  "id": "employee-uuid",
  "first_name": "John",
  "last_name": "Doe",
  "email": "john@example.com",
  "phone_number": "+1-234-567-8901",
  "registration_number": "JBR-08901",
  "gender": "male",
  "verification_status": "verified",
  "created_at": "2026-06-20T10:00:00Z",
  ...
}
```

## How It Works

### Generation Logic
The registration number is generated from the last 5 digits of the phone number:
- Phone: `+1-234-567-8901` → Registration: `JBR-08901`
- Phone: `+92-321-1234567` → Registration: `JBR-34567`
- Phone: `123` → Registration: `JBR-00123` (padded with zeros)

### Database Setup

A new column `registration_number` has been added to the `candidates` table:
- **Column Name:** `registration_number`
- **Data Type:** `VARCHAR(50)`
- **Constraint:** `UNIQUE`
- **Default:** Generated automatically

#### SQL Migration
Run this in Supabase SQL Editor:
```sql
ALTER TABLE candidates 
ADD COLUMN IF NOT EXISTS registration_number VARCHAR(50) UNIQUE;

-- Auto-generation trigger
CREATE OR REPLACE FUNCTION generate_registration_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.phone_number IS NOT NULL THEN
    NEW.registration_number := 'JBR-' || SUBSTRING(NEW.phone_number, -5);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_generate_registration_number ON candidates;
CREATE TRIGGER trg_generate_registration_number
BEFORE INSERT OR UPDATE ON candidates
FOR EACH ROW
EXECUTE FUNCTION generate_registration_number();
```

### Backend Fallback

If the database trigger doesn't work for any reason, the backend has a fallback utility:
- File: `src/utils/registrationUtils.js`
- Function: `generateRegistrationNumber(phoneNumber)`
- Auto-applied to all API responses

## API Endpoints

All these endpoints now include `registration_number`:

| Endpoint | Method | Returns |
|----------|--------|---------|
| `/api/employees` | GET | List of employees with registration numbers |
| `/api/employees/:id` | GET | Single employee with registration number |
| `/api/employees/campaign/:campaign_id` | GET | Employees by campaign with registration numbers |
| `/api/employees` | POST | New employee with auto-generated registration number |
| `/api/employees/:id` | PUT | Updated employee with registration number |

## Example Requests

### Get all employees
```bash
curl -X GET http://localhost:3000/api/employees \
  -H "Authorization: Bearer {token}"
```

### Get employee by ID
```bash
curl -X GET http://localhost:3000/api/employees/abc-123-def \
  -H "Authorization: Bearer {token}"
```

### Create employee
```bash
curl -X POST http://localhost:3000/api/employees \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john@example.com",
    "phone_number": "+1-234-567-8901",
    "job_category_id": 1
  }'
```

Response will include:
```json
{
  "success": true,
  "id": "new-employee-id",
  "phone_number": "+1-234-567-8901",
  "registration_number": "JBR-08901",
  "message": "Employee created successfully"
}
```

## Database Files
- Migration: `database/migrations/003_add_registration_number_to_candidates.sql`
- Utility: `src/utils/registrationUtils.js`

## Files Modified
- ✅ `src/controllers/employeeController.js` - Added registration_number to all queries
- ✅ `src/utils/registrationUtils.js` - Created registration number utility
- ✅ `database/migrations/003_add_registration_number_to_candidates.sql` - Migration file
