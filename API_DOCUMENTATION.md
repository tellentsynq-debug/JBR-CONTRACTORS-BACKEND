# API Documentation - User Authentication

## Base URL
```
https://jbrstaffingsolutions.com/api
```

---

## 1. User Signup
**Endpoint:** `POST /users/signup`

**Description:** Register a new user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe"
}
```

**Request Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| email | string | Yes | Valid email address |
| password | string | Yes | Minimum 6 characters |
| firstName | string | Yes | User's first name |
| lastName | string | Yes | User's last name |

**Success Response (201):**
```json
{
  "message": "User registered successfully",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Error Responses:**
| Status | Error | Reason |
|--------|-------|--------|
| 400 | Email, password, firstName, and lastName are required | Missing required fields |
| 400 | Invalid email format | Email format is invalid |
| 400 | Password must be at least 6 characters | Password too short |
| 400 | Email already registered | Email exists in database |
| 500 | Failed to create user | Server error |

**cURL Example:**
```bash
curl -X POST https://jbrstaffingsolutions.com/api/users/signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "securePassword123",
    "firstName": "John",
    "lastName": "Doe"
  }'
```

**JavaScript/Fetch Example:**
```javascript
const signupData = {
  email: "user@example.com",
  password: "securePassword123",
  firstName: "John",
  lastName": "Doe"
};

const response = await fetch('https://jbrstaffingsolutions.com/api/users/signup', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(signupData)
});

const data = await response.json();
console.log(data);
```

---

## 2. User Login
**Endpoint:** `POST /users/login`

**Description:** Login user with email and password.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "firstName": "John",
    "lastName": "Doe"
  }
}
```

**Error Responses:**
| Status | Error | Reason |
|--------|-------|--------|
| 400 | Email and password are required | Missing fields |
| 401 | Invalid email or password | Credentials don't match |
| 500 | Error message | Server error |

**JavaScript Example:**
```javascript
const loginData = {
  email: "user@example.com",
  password: "securePassword123"
};

const response = await fetch('https://jbrstaffingsolutions.com/api/users/login', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(loginData)
});

const { token, user } = await response.json();
localStorage.setItem('authToken', token);
```

---

## 3. Get All Users (Protected)
**Endpoint:** `GET /users`

**Headers:**
```
Authorization: Bearer {token}
```

**Success Response (200):**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "status": "active",
    "created_at": "2026-06-04T10:30:00Z"
  }
]
```

---

## 4. Get User by ID (Protected)
**Endpoint:** `GET /users/:id`

**Headers:**
```
Authorization: Bearer {token}
```

**Success Response (200):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "user@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "status": "active",
  "created_at": "2026-06-04T10:30:00Z"
}
```

---

## Authentication
All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer {JWT_TOKEN}
```

The token is valid for **24 hours**.

---

## Database Schema (Supabase)

### users table
```sql
- id (UUID, Primary Key)
- email (VARCHAR, UNIQUE)
- password (VARCHAR, hashed)
- first_name (VARCHAR)
- last_name (VARCHAR)
- status (VARCHAR)
- created_at (TIMESTAMP)
```

---

## Environment Variables Required
```
VITE_SUPABASE_URL=https://vwclmbyjkemkiumqzbxm.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_key_here
JWT_SECRET=your-secret-key
FRONTEND_URL=http://localhost:3000
```

---

# Campaign Management APIs

## Overview
Campaign management endpoints for creating, updating, and managing recruitment campaigns with auto-generated registration links.

---

## 1. Create Campaign (Protected)
**Endpoint:** `POST /campaigns`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Summer 2026 Hiring Drive",
  "start_date": "2026-06-01T00:00:00Z",
  "end_date": "2026-08-31T23:59:59Z",
  "is_active": true
}
```

**Request Parameters:**
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| name | string | Yes | Campaign name |
| start_date | ISO 8601 timestamp | Yes | Campaign start date |
| end_date | ISO 8601 timestamp | Yes | Campaign end date (must be > start_date) |
| is_active | boolean | No | Active status (default: true) |

**Success Response (201):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Summer 2026 Hiring Drive",
  "start_date": "2026-06-01T00:00:00Z",
  "end_date": "2026-08-31T23:59:59Z",
  "is_active": true,
  "link_token": "a7f2c8e1-92d4-4b3e-88f1-3c5a9d6b2e4f",
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-06-08T10:30:00Z",
  "message": "Campaign created successfully"
}
```

**Error Responses:**
| Status | Error | Reason |
|--------|-------|--------|
| 400 | Campaign name, start date, and end date are required | Missing required fields |
| 400 | End date must be after start date | Invalid date range |
| 401 | No token provided | Missing JWT token |
| 401 | Invalid or expired token | Invalid JWT token |
| 500 | Error message | Server error |

---

## 2. Get All Campaigns (Protected)
**Endpoint:** `GET /campaigns`

**Headers:**
```
Authorization: Bearer {token}
```

**Success Response (200):**
```json
[
  {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "Summer 2026 Hiring Drive",
    "start_date": "2026-06-01T00:00:00Z",
    "end_date": "2026-08-31T23:59:59Z",
    "is_active": true,
    "link_token": "a7f2c8e1-92d4-4b3e-88f1-3c5a9d6b2e4f",
    "created_by": "550e8400-e29b-41d4-a716-446655440000",
    "created_at": "2026-06-08T10:30:00Z",
    "updated_at": "2026-06-08T10:30:00Z"
  }
]
```

---

## 3. Get Campaign by ID (Protected)
**Endpoint:** `GET /campaigns/:id`

**Headers:**
```
Authorization: Bearer {token}
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Campaign ID |

**Success Response (200):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Summer 2026 Hiring Drive",
  "start_date": "2026-06-01T00:00:00Z",
  "end_date": "2026-08-31T23:59:59Z",
  "is_active": true,
  "link_token": "a7f2c8e1-92d4-4b3e-88f1-3c5a9d6b2e4f",
  "created_by": "550e8400-e29b-41d4-a716-446655440000",
  "created_at": "2026-06-08T10:30:00Z",
  "updated_at": "2026-06-08T10:30:00Z"
}
```

**Error Responses:**
| Status | Error | Reason |
|--------|-------|--------|
| 404 | Campaign not found | Campaign ID doesn't exist |
| 401 | Invalid or expired token | Invalid JWT token |

---

## 4. Get Campaign Registration Link (Protected)
**Endpoint:** `GET /campaigns/:id/link`

**Headers:**
```
Authorization: Bearer {token}
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Campaign ID |

**Description:** Retrieve the registration link for employees to join the campaign.

**Success Response (200):**
```json
{
  "campaign_id": "123e4567-e89b-12d3-a456-426614174000",
  "campaign_name": "Summer 2026 Hiring Drive",
  "registration_link": "http://localhost:3000/employee_register?token=a7f2c8e1-92d4-4b3e-88f1-3c5a9d6b2e4f",
  "token": "a7f2c8e1-92d4-4b3e-88f1-3c5a9d6b2e4f"
}
```

**Error Responses:**
| Status | Error | Reason |
|--------|-------|--------|
| 404 | Campaign not found | Campaign ID doesn't exist |
| 400 | Campaign is not active | Campaign is inactive |
| 401 | Invalid or expired token | Invalid JWT token |

---

## 5. Update Campaign (Protected)
**Endpoint:** `PUT /campaigns/:id`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "name": "Updated Campaign Name",
  "start_date": "2026-06-15T00:00:00Z",
  "end_date": "2026-09-15T23:59:59Z",
  "is_active": false
}
```

**Success Response (200):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "name": "Updated Campaign Name",
  "start_date": "2026-06-15T00:00:00Z",
  "end_date": "2026-09-15T23:59:59Z",
  "is_active": false,
  "updated_at": "2026-06-08T11:45:00Z",
  "message": "Campaign updated successfully"
}
```

**Error Responses:**
| Status | Error | Reason |
|--------|-------|--------|
| 404 | Campaign not found | Campaign ID doesn't exist |
| 400 | End date must be after start date | Invalid date range |
| 401 | Invalid or expired token | Invalid JWT token |

---

## 6. Activate Campaign (Protected)
**Endpoint:** `PATCH /campaigns/:id/activate`

**Headers:**
```
Authorization: Bearer {token}
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Campaign ID |

**Success Response (200):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "is_active": true,
  "message": "Campaign activated successfully"
}
```

---

## 7. Deactivate Campaign (Protected)
**Endpoint:** `PATCH /campaigns/:id/deactivate`

**Headers:**
```
Authorization: Bearer {token}
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Campaign ID |

**Success Response (200):**
```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "is_active": false,
  "message": "Campaign deactivated successfully"
}
```

---

## 8. Delete Campaign (Protected)
**Endpoint:** `DELETE /campaigns/:id`

**Headers:**
```
Authorization: Bearer {token}
```

**URL Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| id | UUID | Campaign ID |

**Success Response (200):**
```json
{
  "message": "Campaign deleted successfully"
}
```

**Error Responses:**
| Status | Error | Reason |
|--------|-------|--------|
| 404 | Campaign not found | Campaign ID doesn't exist |
| 401 | Invalid or expired token | Invalid JWT token |

---

## Database Schema (Supabase)

### campaigns table
```sql
- id (UUID, Primary Key)
- name (VARCHAR)
- start_date (TIMESTAMP)
- end_date (TIMESTAMP)
- is_active (BOOLEAN, default: true)
- link_token (UUID, UNIQUE) - Auto-generated for registration links
- created_by (UUID, Foreign Key -> users.id)
- created_at (TIMESTAMP, auto-set)
- updated_at (TIMESTAMP, auto-update on changes)
```

### Sample SQL for Supabase

```sql
-- Create campaigns table
CREATE TABLE campaigns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  is_active BOOLEAN DEFAULT true,
  link_token UUID DEFAULT uuid_generate_v4() UNIQUE NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index on link_token for faster lookups
CREATE INDEX idx_campaigns_link_token ON campaigns(link_token);

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_campaign_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_campaigns_timestamp
BEFORE UPDATE ON campaigns
FOR EACH ROW
EXECUTE FUNCTION update_campaign_timestamp();

-- RLS Policy: Authenticated users can insert/update campaigns
CREATE POLICY campaign_insert_authenticated ON campaigns FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY campaign_update_authenticated ON campaigns FOR UPDATE
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY campaign_delete_authenticated ON campaigns FOR DELETE
  USING (auth.role() = 'authenticated');

CREATE POLICY campaign_select_authenticated ON campaigns FOR SELECT
  USING (auth.role() = 'authenticated');
```

---

## JavaScript/Fetch Examples

### Create Campaign
```javascript
const token = localStorage.getItem('authToken');

const campaignData = {
  name: "Summer 2026 Hiring Drive",
  start_date: "2026-06-01T00:00:00Z",
  end_date: "2026-08-31T23:59:59Z",
  is_active: true
};

const response = await fetch('http://localhost:5000/api/campaigns', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(campaignData)
});

const campaign = await response.json();
console.log(campaign);
```

### Get Campaign Link
```javascript
const campaignId = '123e4567-e89b-12d3-a456-426614174000';
const token = localStorage.getItem('authToken');

const response = await fetch(`http://localhost:5000/api/campaigns/${campaignId}/link`, {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const { registration_link } = await response.json();
console.log(`Share this link: ${registration_link}`);
```

---

## cURL Examples

### Create Campaign
```bash
curl -X POST http://localhost:5000/api/campaigns \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Summer 2026 Hiring Drive",
    "start_date": "2026-06-01T00:00:00Z",
    "end_date": "2026-08-31T23:59:59Z",
    "is_active": true
  }'
```

### Get Campaign Link
```bash
curl -X GET http://localhost:5000/api/campaigns/123e4567-e89b-12d3-a456-426614174000/link \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```
