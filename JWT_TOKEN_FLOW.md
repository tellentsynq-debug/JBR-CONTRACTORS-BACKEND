# JWT Token Flow Documentation

## 🔐 Authentication Flow with JWT

The OTP verification system now uses JWT (JSON Web Token) for secure authentication during candidate registration.

---

## 📋 Complete Flow

### **Step 1: Send OTP**
```bash
curl -X POST http://localhost:3000/api/candidates/send-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent successfully to your email",
  "email": "user@example.com",
  "expiresIn": 600
}
```

---

### **Step 2: Verify OTP (Get JWT Token)**
```bash
curl -X POST http://localhost:3000/api/candidates/verify-otp \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","otp":"123456"}'
```

**Response:**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "email": "user@example.com",
  "verified": true,
  "redirectUrl": "/candidate/register",
  "jwtToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresIn": 86400,
  "tokenType": "Bearer"
}
```

**🔑 Save the `jwtToken`!** You'll need it for the next step.

---

### **Step 3: Register Candidate (Using JWT Token)**

Include the JWT token in the `Authorization` header:

```bash
curl -X POST http://localhost:3000/api/candidates/register \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -d '{
    "email":"user@example.com",
    "phone":"+919876543210",
    "first_name":"John",
    "last_name":"Doe",
    "resume_url":"https://example.com/resume.pdf",
    "campaign_id":1
  }'
```

**Response:**
```json
{
  "success": true,
  "message": "Candidate registered successfully",
  "candidate": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "phone": "+919876543210",
    "first_name": "John",
    "last_name": "Doe",
    "status": "pending",
    "email_verified": true
  }
}
```

---

## 🛡️ Security Features

### **JWT Token Details**
- **Expiration:** 24 hours
- **Algorithm:** HS256
- **Content:**
  - `email`: Verified email address
  - `verificationId`: Unique verification ID
  - `type`: "email_verified"
  - `iat`: Issued at timestamp

### **Token Validation**
The `/api/candidates/register` endpoint validates:
- ✅ Token is present in `Authorization: Bearer` header
- ✅ Token signature is valid
- ✅ Token has not expired
- ✅ Token contains correct email address

---

## 🔄 JavaScript Frontend Example

```javascript
// Step 1: Send OTP
async function sendOTP(email) {
  const response = await fetch('http://localhost:3000/api/candidates/send-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email })
  });
  return await response.json();
}

// Step 2: Verify OTP and Get JWT
async function verifyOTP(email, otp) {
  const response = await fetch('http://localhost:3000/api/candidates/verify-otp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, otp })
  });
  const data = await response.json();
  
  // Save JWT token
  if (data.success) {
    localStorage.setItem('jwtToken', data.jwtToken);
    localStorage.setItem('email', data.email);
  }
  
  return data;
}

// Step 3: Register Candidate
async function registerCandidate(candidateData) {
  const jwtToken = localStorage.getItem('jwtToken');
  
  const response = await fetch('http://localhost:3000/api/candidates/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${jwtToken}`
    },
    body: JSON.stringify(candidateData)
  });
  
  return await response.json();
}

// Usage Example
async function completeRegistration() {
  // Step 1
  const otpResponse = await sendOTP('user@example.com');
  console.log('OTP sent:', otpResponse);
  
  // User enters OTP from email
  const userOTP = prompt('Enter OTP:');
  
  // Step 2
  const verifyResponse = await verifyOTP('user@example.com', userOTP);
  console.log('OTP verified:', verifyResponse);
  
  // Step 3
  const registerResponse = await registerCandidate({
    email: 'user@example.com',
    phone: '+919876543210',
    first_name: 'John',
    last_name: 'Doe',
    resume_url: 'https://example.com/resume.pdf',
    campaign_id: 1
  });
  console.log('Registration complete:', registerResponse);
}
```

---

## ⚠️ Error Handling

### **Missing JWT Token**
```json
{
  "success": false,
  "error": "Missing or invalid Authorization header",
  "code": "MISSING_TOKEN"
}
```

### **Expired JWT Token**
```json
{
  "success": false,
  "error": "JWT token has expired",
  "code": "TOKEN_EXPIRED"
}
```

### **Invalid JWT Token**
```json
{
  "success": false,
  "error": "Invalid JWT token",
  "code": "INVALID_TOKEN"
}
```

---

## 🔧 Configuration

### **.env Variables**
```env
# JWT configuration (required)
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
NODE_ENV=development
```

For production, use a strong, random secret:
```bash
# Generate a strong secret (Linux/Mac)
openssl rand -base64 32
```

---

## 📱 REST Client (Postman/Insomnia)

### **Request 1: Send OTP**
```
POST http://localhost:3000/api/candidates/send-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "campaign_id": 1
}
```

### **Request 2: Verify OTP**
```
POST http://localhost:3000/api/candidates/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otp": "123456"
}
```
**⚠️ Copy the `jwtToken` from response!**

### **Request 3: Register Candidate**
```
POST http://localhost:3000/api/candidates/register
Content-Type: application/json
Authorization: Bearer {paste_jwt_token_here}

{
  "email": "user@example.com",
  "phone": "+919876543210",
  "first_name": "John",
  "last_name": "Doe",
  "resume_url": "https://example.com/resume.pdf",
  "campaign_id": 1
}
```

---

## 🚀 Production Setup

1. **Change JWT_SECRET:**
   ```bash
   # Generate strong secret
   openssl rand -base64 32
   ```

2. **Update .env:**
   ```env
   JWT_SECRET=your-generated-random-secret
   NODE_ENV=production
   ```

3. **Use HTTPS:** Always use HTTPS in production to protect JWT tokens

4. **Token Storage:** Use secure, httpOnly cookies or localStorage (never store sensitive data with secrets in localStorage)

---

## 🔍 Troubleshooting

**Q: "Missing or invalid Authorization header"**
- A: Ensure `Authorization: Bearer {token}` is in the request header

**Q: "Invalid JWT token"**
- A: Token may be corrupted or modified. Re-verify OTP to get a new token

**Q: "Token has expired"**
- A: JWT tokens expire after 24 hours. Re-verify OTP to get a fresh token

**Q: Token works locally but not on production**
- A: Ensure `JWT_SECRET` is the same on both environments
