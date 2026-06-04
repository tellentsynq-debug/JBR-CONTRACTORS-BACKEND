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
```
