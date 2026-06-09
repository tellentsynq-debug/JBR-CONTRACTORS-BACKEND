# 🔐 Candidate Registration Security Documentation

## Overview
This document outlines all security layers implemented in the candidate OTP verification and registration system.

---

## 🛡️ Security Layers

### 1. **OTP Gating** ✅
**Purpose:** Ensure candidates verify their email via OTP before completing registration

**Implementation:**
```javascript
// In registerCandidate endpoint:
const otpGating = await securityMiddleware.validateOTPGating(supabaseAdmin, email);
if (!otpGating.valid) {
  return res.status(403).json({
    error: 'Email must be verified via OTP before registration'
  });
}
```

**Enforcement:**
- Registration API checks `email_verifications.verified = true`
- OTP must not be expired (`verified_at` exists and `expires_at > NOW()`)
- Cannot register without completing OTP verification first

---

### 2. **Origin Allowlist** ✅
**Purpose:** Restrict API access to authorized domains only

**Implementation:**
```javascript
// src/middleware/securityMiddleware.js
const ALLOWED_ORIGINS = [
  'https://jbrstaffingsolutions.com',
  'https://campaigns.jbrstaffingsolutions.com',
  'https://lovable.dev',
  'http://localhost:3000', // Dev only
  // ... more domains
];
```

**Enforcement:**
- Middleware `checkOrigin` checks `Origin` and `Referer` headers
- Production: Requests from unauthorized origins get `403 Forbidden`
- Development: Allows localhost for testing
- Server-to-server requests (no origin) are allowed

**Protected Routes:**
```
/api/candidates/send-otp
/api/candidates/verify-otp
/api/candidates/register
/api/candidates/verification-status
```

---

### 3. **Duplicate Phone Prevention** ✅
**Purpose:** Prevent same phone number registering multiple times

**Implementation:**
```javascript
// In registerCandidate endpoint:
const isDuplicatePhone = await securityMiddleware.checkDuplicatePhone(
  supabaseAdmin, 
  phone
);
if (isDuplicatePhone) {
  return res.status(400).json({
    error: 'This phone number is already registered',
    code: 'DUPLICATE_PHONE'
  });
}
```

**Enforcement:**
- Database constraint: `phone VARCHAR(20) NOT NULL UNIQUE`
- Index: `idx_candidate_registrations_phone` for fast lookup
- Only counts completed registrations (`status = 'completed'`)
- One phone = One candidate

---

### 4. **Campaign Window Enforcement** ✅
**Purpose:** Ensure registration only happens during active campaign period

**Implementation:**
```javascript
// When campaign_id provided:
const campaignValidation = await securityMiddleware.validateCampaignWindow(
  supabaseAdmin, 
  campaign_id
);
```

**Checks:**
- ✓ Campaign exists in database
- ✓ Campaign status = 'active'
- ✓ Current time < campaign.end_date
- ✓ Blocked if campaign expired or inactive

**Error Responses:**
```json
{
  "error": "Campaign not found",
  "code": "INVALID_CAMPAIGN"
}
```

---

### 5. **Service Role Hidden** ✅
**Purpose:** Ensure service role credentials never exposed to frontend

**Implementation:**
- `SUPABASE_SERVICE_KEY` stored in backend `.env` only
- Frontend uses **public key** (`VITE_SUPABASE_PUBLISHABLE_KEY`)
- Backend has separate `supabaseAdmin` client with service role
- Service role used for:
  - OTP verification (internal only)
  - Duplicate phone checks
  - Campaign validation
  - All registration logic

**Frontend Never Sees:**
```javascript
// ❌ WRONG - Never do this
const serviceKey = process.env.SUPABASE_SERVICE_KEY; // Never!

// ✅ CORRECT - Frontend uses public key only
const supabase = createClient(url, VITE_SUPABASE_PUBLISHABLE_KEY);
```

**RLS Policies:**
- All candidate registration tables have public INSERT/SELECT policies
- RLS prevents unauthorized access via frontend
- Service role on backend handles sensitive operations

---

### 6. **Private Storage Bucket** ✅
**Purpose:** Resume files not directly accessible to public

**Implementation:**
```javascript
// Resume stored with private access policy
{
  resume_url: "signed_url_or_bucket_path",
  resume_file_name: "candidate_resume_123.pdf"
}
```

**Security:**
- Bucket: `private` visibility (not public)
- Access via:
  - Signed URLs (time-limited)
  - Backend fetch with service role
  - Never expose direct bucket URLs to frontend

**Recommended Flow:**
```
Candidate uploads resume
  ↓
Backend generates signed URL (valid for 24 hours)
  ↓
Frontend displays download button with signed URL
  ↓
Expired URL cannot access file after 24 hours
```

---

## 📊 Rate Limiting

### Email-based Rate Limiting
```
Max 3 OTP requests per email per hour
```

### IP-based Rate Limiting
```
Max 5 registration attempts per IP per 5 minutes
```

### Database Tracking
```sql
-- Log every request for audit
registration_attempt_logs (
  ip_address,
  email,
  action: 'send_otp' | 'verify_otp' | 'register',
  success: true | false,
  created_at
)
```

---

## 🔒 Attempt Limiting

### OTP Verification Attempts
- **Max attempts:** 5
- **Reset after:** Successful verification or new OTP requested
- **Tracking:** `email_verifications.attempts`

### Response
```json
{
  "success": false,
  "error": "Invalid OTP. Please try again.",
  "attemptsRemaining": 4
}
```

---

## 📝 Audit Logging

### All Actions Logged
```sql
registration_attempt_logs table:
- IP address (for bot detection)
- Email (for user tracking)
- Action (send_otp, verify_otp, register)
- Success status
- Timestamp
```

### Access to Logs
- ✅ Backend: Full access for monitoring
- ❌ Frontend: No access
- 🔄 Automated cleanup: Delete logs older than 7 days

---

## 🚨 Security Best Practices

### For Developers
1. ✅ Never log OTP values in production
2. ✅ Use HTTPS only in production
3. ✅ Rotate GMAIL_APP_PASSWORD regularly
4. ✅ Monitor registration_attempt_logs for abuse
5. ✅ Keep Supabase RLS policies enabled

### For Deployment
1. ✅ Set `NODE_ENV=production`
2. ✅ Enable HTTPS
3. ✅ Configure ALLOWED_ORIGINS for your domain
4. ✅ Use Gmail App Password (not account password)
5. ✅ Never commit .env to git
6. ✅ Rotate secrets regularly

### For Monitoring
1. ✅ Alert on rate limit hits
2. ✅ Alert on duplicate phone attempts
3. ✅ Alert on failed campaign validation
4. ✅ Review audit logs weekly

---

## 🔍 Security Checklist

- [x] OTP expires after 10 minutes
- [x] OTP max 5 verification attempts
- [x] Email rate limited to 3 requests/hour
- [x] IP rate limited to 5 attempts/5 minutes
- [x] Campaign window enforced
- [x] Duplicate phone blocked
- [x] Origin allowlist enabled
- [x] Service role hidden from frontend
- [x] Resume storage private
- [x] All actions logged
- [x] Attempt logs auto-cleanup
- [x] RLS policies enabled
- [x] Input validation on all fields
- [x] Error messages don't leak info
- [x] HTTPS enforced in production

---

## 📱 Testing Security

### Test Origin Blocking
```bash
# Should work (allowed origin)
curl -H "Origin: https://jbrstaffingsolutions.com" \
  http://localhost:3000/api/candidates/send-otp

# Should fail in production (unauthorized origin)
curl -H "Origin: https://malicious.com" \
  http://localhost:3000/api/candidates/send-otp
```

### Test Rate Limiting
```bash
# Send 3 OTPs to same email (succeeds)
# 4th attempt should fail with 429
```

### Test Duplicate Phone
```bash
# Register with phone: +1234567890
# Try registering with same phone: Should fail
```

### Test Campaign Window
```bash
# Register with expired campaign_id: Should fail
# Register with active campaign_id: Should succeed
```

---

## 🔐 Environment Variables

**Backend .env (Never expose):**
```
SUPABASE_SERVICE_KEY=eyJ...     # Server-side only
GMAIL_USER=...
GMAIL_APP_PASSWORD=...
NODE_ENV=production
```

**Frontend .env.local (Public):**
```
VITE_SUPABASE_URL=...           # Public
VITE_SUPABASE_PUBLISHABLE_KEY=... # Public
```

---

## 📞 Incident Response

### If Rate Limited
1. Wait 1 hour for email rate limit
2. Or use different email address

### If Max Attempts Exceeded
1. Request new OTP
2. Previous attempt record cleared

### If Registration Fails
1. Check error code
2. Verify email was OTP-verified
3. Check campaign is active
4. Check phone number not duplicate

### If Origin Blocked
1. Add domain to ALLOWED_ORIGINS
2. Restart server
3. Test from new origin

---

## 🧹 Maintenance

### Weekly
- Review registration_attempt_logs
- Check for abuse patterns
- Monitor error rates

### Monthly
- Rotate Gmail app password
- Update ALLOWED_ORIGINS if needed
- Review campaign window settings

### Quarterly
- Security audit
- Penetration testing
- Update dependencies
- Review RLS policies
