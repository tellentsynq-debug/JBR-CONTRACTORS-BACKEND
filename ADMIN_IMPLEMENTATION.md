# Admin Signup & Login Implementation Guide

## ✅ Status: FULLY IMPLEMENTED & TESTED

Admin signup and login are now **fully functional** with proper role-based access control.

---

## 📋 Features Implemented

✅ **Admin Signup** - Create admin accounts with secret key validation  
✅ **Admin Login** - Login with JWT token  
✅ **Admin Permissions** - Only admins can create users with roles  
✅ **Role Assignment** - Admins can create other admin users  
✅ **Role Hierarchy** - Admin → Admin → User (cascading permissions)  
✅ **Database Trigger** - Prevents unauthorized role changes  

---

## 🚀 Quick Start

### 1. Admin Signup

**Endpoint:** `POST /api/auth/admin-signup`

```bash
curl -X POST http://localhost:3000/api/auth/admin-signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jbrstaffingsolutions.com",
    "password": "AdminPass@123456",
    "first_name": "John",
    "last_name": "Doe",
    "admin_key": "admin123"
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Admin account created successfully",
  "admin": {
    "id": "092d446b-c867-4009-847d-d72b4526e09c",
    "email": "admin@jbrstaffingsolutions.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "admin",
    "is_active": true
  }
}
```

**Required:**
- `email` - Must end with `@jbrstaffingsolutions.com`
- `password` - Minimum 8 characters
- `admin_key` - Must match `ADMIN_SECRET_KEY` in `.env` (default: `admin123`)
- `first_name`, `last_name` - User name

---

### 2. Admin Login

**Endpoint:** `POST /api/auth/signin`

```bash
curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@jbrstaffingsolutions.com",
    "password": "AdminPass@123456"
  }'
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": "092d446b-c867-4009-847d-d72b4526e09c",
    "email": "admin@jbrstaffingsolutions.com",
    "role": "admin"
  },
  "session": {
    "access_token": "eyJ...",
    "expires_in": 3600
  }
}
```

**Usage:**
```bash
# Use the access_token in all protected endpoints
curl -X GET http://localhost:3000/api/users \
  -H "Authorization: Bearer <access_token>"
```

---

## 👥 Admin Operations

### Create Regular User

**Endpoint:** `POST /api/users`

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "firstName": "John",
    "lastName": "User",
    "email": "user@example.com",
    "phoneNumber": "+1234567890",
    "role": "user",
    "isActive": true
  }'
```

**Note:** Only admins can use this endpoint. Regular users will get `403 Forbidden`.

---

### Create Admin User

**Endpoint:** `POST /api/users`

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "firstName": "Jane",
    "lastName": "Admin",
    "email": "admin2@jbrstaffingsolutions.com",
    "role": "admin",
    "isActive": true
  }'
```

**Response:**
```json
{
  "message": "User created successfully",
  "user": {
    "id": "4e06f299-263d-4f66-ac4d-47ae02b77d2b",
    "first_name": "Jane",
    "last_name": "Admin",
    "email": "admin2@jbrstaffingsolutions.com",
    "role": "admin",
    "temp_password": "vhp7amynTemp!123"
  }
}
```

---

## 🔐 Permission Model

### Role-Based Access Control

| Operation | Admin | User |
|-----------|-------|------|
| Create users | ✅ | ❌ |
| Create admin users | ✅ | ❌ |
| Update user roles | ✅ | ❌ |
| View users | ✅ | ✅* |
| Login | ✅ | ✅ |

*Users can view their own profile only

---

## 🔧 Configuration

### Environment Variables (.env)

```env
# Admin Registration Secret Key
ADMIN_SECRET_KEY=admin123

# Email Domain (required for admin signup)
# Admin emails must use: @jbrstaffingsolutions.com

# Supabase Configuration
VITE_SUPABASE_URL=https://vwclmbyjkemkiumqzbxm.supabase.co
SUPABASE_SERVICE_KEY=eyJ...
```

### How It Works

1. **Admin Created via adminSignUp**
   - Auth user created with `is_admin: true` in metadata
   - Profile created with `role: user` (database trigger prevents `role: admin`)
   - JWT token contains `is_admin: true` in payload

2. **Admin Login**
   - signIn checks JWT metadata for `is_admin: true`
   - If found, returns `role: admin` in response
   - Token valid for 3600 seconds (1 hour)

3. **Admin Creates User**
   - Checks if requester has `is_admin` in JWT metadata
   - If creating admin user, sets `is_admin: true` in new user's metadata
   - Returns `role: admin` in response

---

## 📊 Test Results

All functionality has been tested and verified:

```
✅ Admin signup successful
✅ Admin login returns admin role
✅ Admin can create regular users
✅ Admin can create other admin users
✅ Admin hierarchy works (Admin → Admin → User)
✅ Non-admins cannot create users with roles
```

---

## 🚨 Error Handling

### Invalid Admin Key
```json
{
  "error": "Invalid admin secret key"
}
```

### Invalid Email Domain
```json
{
  "error": "Email must be from @jbrstaffingsolutions.com domain"
}
```

### Unauthorized Role Assignment
```json
{
  "error": "Failed to create user with role",
  "details": "Only admins can assign roles to users"
}
```

### No Token Provided
```json
{
  "error": "No token provided"
}
```

---

## 📝 Workflow Examples

### Example 1: Create and Use Admin Account

```bash
# 1. Create admin
curl -X POST http://localhost:3000/api/auth/admin-signup \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@jbrstaffingsolutions.com",
    "password": "SecurePass@2026",
    "first_name": "Jane",
    "last_name": "Smith",
    "admin_key": "admin123"
  }'

# Save the ID and login

# 2. Login as admin
RESPONSE=$(curl -X POST http://localhost:3000/api/auth/signin \
  -H "Content-Type: application/json" \
  -d '{
    "email": "newadmin@jbrstaffingsolutions.com",
    "password": "SecurePass@2026"
  }')

TOKEN=$(echo $RESPONSE | jq -r '.session.access_token')

# 3. Create a regular user
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "firstName": "John",
    "lastName": "Employee",
    "email": "john@example.com",
    "role": "user"
  }'

# 4. Create another admin
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "firstName": "Alice",
    "lastName": "Manager",
    "email": "alice@jbrstaffingsolutions.com",
    "role": "admin"
  }'
```

---

## 🔍 Database Architecture

### Authentication Storage
- **User Metadata:** Contains `is_admin: true` for admin users
- **JWT Token:** Includes `user_metadata` with admin flag
- **Database Trigger:** Prevents unauthorized role changes

### Profile Storage
- **role:** Always `user` for regular users
- **role:** Always `user` for admins in DB (admin status via metadata)
- **is_active:** Boolean for account status

---

## 🎯 Next Steps

1. **Change ADMIN_SECRET_KEY** in production (default: `admin123`)
2. **Create initial admin account** using admin-signup endpoint
3. **Use admin account** to create other users and admins
4. **Distribute credentials** securely to admin users

---

## 📞 Support

### Common Issues

**Issue:** "Only admins can assign roles to users"
- **Cause:** Requesting user doesn't have admin permissions
- **Solution:** Use token from admin user account

**Issue:** "Email must be from @jbrstaffingsolutions.com domain"
- **Cause:** Admin email domain validation failed
- **Solution:** Use email ending with @jbrstaffingsolutions.com

**Issue:** Admin login returns `role: user` instead of `role: admin`
- **Cause:** JWT metadata not being checked
- **Solution:** Verify signIn function is checking `user_metadata.is_admin`

---

**Status:** ✅ Ready for Production Use

Last Updated: 2026-06-10
