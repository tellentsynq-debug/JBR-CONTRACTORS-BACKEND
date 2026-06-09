# Candidate OTP Email Verification API

## Overview
This is a complete OTP (One-Time Password) based email verification system for candidate registration. Candidates receive a 6-digit OTP via email, verify it, and then can proceed with their registration.

## 📋 Features

✅ **6-digit OTP Generation** - Secure random OTP  
✅ **Email Delivery** - Gmail SMTP integration  
✅ **10-minute Expiry** - OTP expires after 10 minutes  
✅ **Rate Limiting** - Max 3 OTP requests per hour per email  
✅ **Attempt Limiting** - Max 5 verification attempts  
✅ **Duplicate Check** - Resends OTP if already requested  
✅ **Supabase Integration** - Stores OTP & verification data  
✅ **HTML Email Templates** - Professional formatted emails  

---

## 🗄️ Database Setup

### Step 1: Create Tables in Supabase
Run the SQL script in [database/otp_tables.sql](../database/otp_tables.sql) in your Supabase SQL Editor:

**Tables Created:**
- `email_verifications` - Stores OTP and verification status
- `otp_request_logs` - Logs for rate limiting
- `candidate_registrations` - Candidate data (optional)

### Step 2: Enable Row Level Security (RLS)
All tables have RLS policies configured for public access (signup doesn't require authentication).

---

## ⚙️ Environment Setup

### Gmail SMTP Configuration

1. **Enable 2-Factor Authentication** on your Gmail account
   - Go to: https://myaccount.google.com/security

2. **Create App Password**
   - Go to: https://myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your OS)
   - Copy the 16-character password

3. **Update .env file**
```env
GMAIL_USER=your-gmail@gmail.com
GMAIL_APP_PASSWORD=your-16-character-app-password
```

### Verify Email Service
The email service will verify on server startup:
```
✓ Email service ready
```

---

## 📡 API Endpoints

### 1. Send OTP
**Endpoint:** `POST /api/candidates/send-otp`

**Request:**
```json
{
  "email": "candidate@example.com"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "OTP sent successfully to your email",
  "email": "candidate@example.com",
  "expiresIn": 600
}
```

**Response (Error - Rate Limited):**
```json
{
  "success": false,
  "error": "Too many OTP requests. Please try again after 1 hour.",
  "retryAfter": 3600
}
```

**Response (Error - Invalid Email):**
```json
{
  "success": false,
  "error": "Invalid email format"
}
```

---

### 2. Verify OTP
**Endpoint:** `POST /api/candidates/verify-otp`

**Request:**
```json
{
  "email": "candidate@example.com",
  "otp": "123456"
}
```

**Response (Success):**
```json
{
  "success": true,
  "message": "Email verified successfully",
  "email": "candidate@example.com",
  "verified": true,
  "redirectUrl": "/candidate/register"
}
```

**Response (Error - Invalid OTP):**
```json
{
  "success": false,
  "error": "Invalid OTP. Please try again.",
  "attemptsRemaining": 4
}
```

**Response (Error - OTP Expired):**
```json
{
  "success": false,
  "error": "OTP has expired. Please request a new OTP."
}
```

**Response (Error - Max Attempts):**
```json
{
  "success": false,
  "error": "Maximum OTP attempts exceeded. Please request a new OTP."
}
```

---

### 3. Get Verification Status
**Endpoint:** `GET /api/candidates/verification-status/:email`

**Response:**
```json
{
  "success": true,
  "email": "candidate@example.com",
  "verified": true,
  "verifiedAt": "2024-06-09T10:30:00Z"
}
```

---

## 🧪 Testing with Postman

### Test 1: Send OTP
1. **Method:** POST
2. **URL:** `http://localhost:3000/api/candidates/send-otp`
3. **Body (JSON):**
```json
{
  "email": "your-email@example.com"
}
```
4. **Click Send** → Check your email for OTP

### Test 2: Verify OTP
1. **Method:** POST
2. **URL:** `http://localhost:3000/api/candidates/verify-otp`
3. **Body (JSON):**
```json
{
  "email": "your-email@example.com",
  "otp": "123456"  // Replace with OTP from email
}
```
4. **Click Send** → Should receive "Email verified successfully"

### Test 3: Check Verification Status
1. **Method:** GET
2. **URL:** `http://localhost:3000/api/candidates/verification-status/your-email@example.com`
3. **Click Send** → Shows current verification status

---

## 📁 Project Structure

```
src/
├── controllers/
│   └── candidateController.js          # OTP logic
├── routes/
│   └── candidates.js                   # Route definitions
├── services/
│   └── emailService.js                 # Gmail SMTP setup
└── config/
    └── database.js                     # Supabase clients

database/
└── otp_tables.sql                      # SQL schema
```

---

## 🔍 Key Features Explained

### Rate Limiting
```javascript
// Max 3 OTP requests per hour per email
const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
// Fetches count of requests in last hour
```

### OTP Generation
```javascript
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
  // Returns 6-digit number like "234567"
};
```

### Expiry Management
```javascript
const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
// If now > expiresAt, OTP is invalid
```

### Attempt Tracking
```javascript
// Max 5 attempts to verify OTP
if (verification.attempts >= 5) {
  // Return error: "Maximum OTP attempts exceeded"
}
```

---

## 🚀 Workflow

```
Candidate Flow:
1. Candidate enters email on registration form
2. Frontend calls: POST /api/candidates/send-otp
3. Backend:
   - ✓ Validates email format
   - ✓ Checks rate limit (max 3/hour)
   - ✓ Generates 6-digit OTP
   - ✓ Stores in email_verifications table
   - ✓ Sends OTP via Gmail
4. Candidate receives OTP in email
5. Candidate enters OTP in form
6. Frontend calls: POST /api/candidates/verify-otp
7. Backend:
   - ✓ Validates OTP exists for email
   - ✓ Checks if expired
   - ✓ Checks attempt limit
   - ✓ Verifies OTP matches
   - ✓ Updates verified=true
   - ✓ Sends confirmation email
8. Frontend redirects to resume upload page
```

---

## 📧 Email Templates

### OTP Email
- Professional HTML formatting
- 6-digit OTP displayed prominently
- 10-minute expiry warning
- Brand styling

### Verification Confirmation Email
- Success message
- Next steps guidance
- Brand footer

---

## ⚠️ Security Considerations

1. **OTP Secrecy:** OTP is only sent via email, not via SMS
2. **Expiry:** OTP expires after 10 minutes
3. **Attempt Limit:** Only 5 attempts to prevent brute force
4. **Rate Limit:** Max 3 requests per hour per email
5. **RLS:** Supabase RLS policies restrict unauthorized access
6. **Input Validation:** Email format validated
7. **App Password:** Gmail uses app-specific password, not account password

---

## 🔧 Troubleshooting

### Email not sending?
- ✓ Check GMAIL_USER and GMAIL_APP_PASSWORD in .env
- ✓ Verify 2FA is enabled on Gmail
- ✓ Ensure App Password is generated correctly
- ✓ Check email service logs in terminal

### OTP expired?
- ✓ Resend OTP (creates new one)
- ✓ Default expiry: 10 minutes

### Rate limit hit?
- ✓ Wait 1 hour before requesting new OTP
- ✓ Or use different email address

### OTP not matching?
- ✓ Copy-paste OTP carefully
- ✓ Check email spam folder
- ✓ Resend if expired

---

## 📝 Future Enhancements

- [ ] SMS OTP as fallback
- [ ] Resend OTP timer UI
- [ ] OTP auto-fill from email
- [ ] Analytics dashboard
- [ ] OTP templates customization
- [ ] Multi-language support
- [ ] WhatsApp OTP integration

---

## 📞 Support

For issues or questions:
1. Check server logs for errors
2. Verify database tables exist
3. Check .env configuration
4. Ensure Supabase connection is active
5. Test with Postman first before frontend integration
