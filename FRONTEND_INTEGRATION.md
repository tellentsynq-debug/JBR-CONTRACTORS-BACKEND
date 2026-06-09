# Frontend Integration Guide - Candidate OTP Verification

## Frontend Flow

```
┌─────────────────────────────────────────────────┐
│ Candidate Registration Form (Campaign Link)     │
├─────────────────────────────────────────────────┤
│ 1. Enter Email                                   │
│ 2. Click "Send OTP"                             │
│    └─ API: POST /api/candidates/send-otp        │
│    └─ Show: "OTP sent to your email"            │
│                                                  │
│ 3. Enter 6-digit OTP from email                 │
│ 4. Click "Verify OTP"                           │
│    └─ API: POST /api/candidates/verify-otp      │
│    └─ Show: "Email verified!"                   │
│                                                  │
│ 5. Next Step: Upload Resume                     │
│    └─ API: POST /api/candidates/upload-resume   │
│                                                  │
│ 6. Submit Candidate Form                        │
│    └─ API: POST /api/candidates/register        │
└─────────────────────────────────────────────────┘
```

---

## React Component Example

```tsx
import React, { useState } from 'react';

const CandidateRegistration = () => {
  const [step, setStep] = useState('email'); // email, otp, resume, complete
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [otpExpires, setOtpExpires] = useState(null);

  // Step 1: Send OTP
  const handleSendOTP = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch('http://localhost:3000/api/candidates/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });

      const data = await response.json();

      if (data.success) {
        setMessage('OTP sent to your email! Check spam folder too.');
        setStep('otp');
        setOtpExpires(new Date(Date.now() + 10 * 60 * 1000)); // 10 minutes
      } else {
        setError(data.error || 'Failed to send OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOTP = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('http://localhost:3000/api/candidates/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp })
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Email verified successfully!');
        setStep('resume');
      } else {
        setError(data.error || 'Failed to verify OTP');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="registration-container">
      <h2>Candidate Registration</h2>

      {/* Step 1: Email Input */}
      {step === 'email' && (
        <div className="step">
          <h3>Enter Your Email</h3>
          <input
            type="email"
            placeholder="your-email@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={loading}
          />
          <button onClick={handleSendOTP} disabled={loading}>
            {loading ? 'Sending...' : 'Send OTP'}
          </button>
        </div>
      )}

      {/* Step 2: OTP Verification */}
      {step === 'otp' && (
        <div className="step">
          <h3>Enter OTP from Email</h3>
          <p className="info">
            An OTP has been sent to <strong>{email}</strong>
          </p>
          <input
            type="text"
            placeholder="123456"
            value={otp}
            onChange={(e) => setOtp(e.target.value.slice(0, 6))}
            maxLength="6"
            disabled={loading}
          />
          {otpExpires && (
            <p className="expires">
              Expires at: {otpExpires.toLocaleTimeString()}
            </p>
          )}
          <button onClick={handleVerifyOTP} disabled={loading}>
            {loading ? 'Verifying...' : 'Verify OTP'}
          </button>
          <button onClick={() => setStep('email')} variant="secondary">
            Use Different Email
          </button>
        </div>
      )}

      {/* Step 3: Resume Upload */}
      {step === 'resume' && (
        <div className="step">
          <h3>Upload Your Resume</h3>
          <p>Email verified! Now upload your resume to complete registration.</p>
          {/* Add resume upload component here */}
        </div>
      )}

      {/* Messages */}
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
};

export default CandidateRegistration;
```

---

## Vue.js Component Example

```vue
<template>
  <div class="registration-container">
    <h2>Candidate Registration</h2>

    <!-- Email Step -->
    <div v-if="step === 'email'" class="step">
      <h3>Enter Your Email</h3>
      <input
        v-model="email"
        type="email"
        placeholder="your-email@example.com"
        :disabled="loading"
      />
      <button @click="sendOTP" :disabled="loading">
        {{ loading ? 'Sending...' : 'Send OTP' }}
      </button>
    </div>

    <!-- OTP Step -->
    <div v-if="step === 'otp'" class="step">
      <h3>Enter OTP from Email</h3>
      <p>An OTP has been sent to <strong>{{ email }}</strong></p>
      <input
        v-model="otp"
        type="text"
        placeholder="123456"
        maxlength="6"
        :disabled="loading"
      />
      <button @click="verifyOTP" :disabled="loading">
        {{ loading ? 'Verifying...' : 'Verify OTP' }}
      </button>
    </div>

    <!-- Messages -->
    <div v-if="message" class="success-message">{{ message }}</div>
    <div v-if="error" class="error-message">{{ error }}</div>
  </div>
</template>

<script>
export default {
  data() {
    return {
      step: 'email',
      email: '',
      otp: '',
      loading: false,
      message: '',
      error: ''
    };
  },
  methods: {
    async sendOTP() {
      this.loading = true;
      this.error = '';

      try {
        const response = await fetch('http://localhost:3000/api/candidates/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: this.email })
        });

        const data = await response.json();

        if (data.success) {
          this.message = 'OTP sent to your email!';
          this.step = 'otp';
        } else {
          this.error = data.error || 'Failed to send OTP';
        }
      } catch (err) {
        this.error = 'Network error. Please try again.';
      } finally {
        this.loading = false;
      }
    },

    async verifyOTP() {
      this.loading = true;
      this.error = '';

      try {
        const response = await fetch('http://localhost:3000/api/candidates/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: this.email,
            otp: this.otp
          })
        });

        const data = await response.json();

        if (data.success) {
          this.message = 'Email verified successfully!';
          this.step = 'resume';
          // Emit event to parent or navigate to next step
          this.$emit('verified', { email: this.email });
        } else {
          this.error = data.error || 'Failed to verify OTP';
        }
      } catch (err) {
        this.error = 'Network error. Please try again.';
      } finally {
        this.loading = false;
      }
    }
  }
};
</script>

<style scoped>
.registration-container {
  max-width: 400px;
  margin: 20px auto;
  padding: 20px;
  border: 1px solid #ddd;
  border-radius: 8px;
}

.step {
  margin: 20px 0;
}

input {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ccc;
  border-radius: 4px;
}

button {
  width: 100%;
  padding: 10px;
  background-color: #4caf50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.success-message {
  padding: 10px;
  background-color: #d4edda;
  color: #155724;
  border-radius: 4px;
  margin-top: 10px;
}

.error-message {
  padding: 10px;
  background-color: #f8d7da;
  color: #721c24;
  border-radius: 4px;
  margin-top: 10px;
}
</style>
```

---

## Plain JavaScript/HTML Example

```html
<!DOCTYPE html>
<html>
<head>
  <title>Candidate Registration</title>
  <style>
    body { font-family: Arial, sans-serif; }
    .container { max-width: 400px; margin: 50px auto; padding: 20px; border: 1px solid #ddd; }
    input { width: 100%; padding: 10px; margin: 10px 0; }
    button { width: 100%; padding: 10px; background: #4caf50; color: white; border: none; }
    .success { color: green; padding: 10px; background: #f0f0f0; }
    .error { color: red; padding: 10px; background: #f0f0f0; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Candidate Registration</h2>

    <!-- Email Step -->
    <div id="emailStep">
      <h3>Enter Your Email</h3>
      <input type="email" id="email" placeholder="your-email@example.com" />
      <button onclick="sendOTP()">Send OTP</button>
    </div>

    <!-- OTP Step (hidden initially) -->
    <div id="otpStep" style="display:none;">
      <h3>Enter OTP from Email</h3>
      <p id="emailDisplay"></p>
      <input type="text" id="otp" placeholder="123456" maxlength="6" />
      <button onclick="verifyOTP()">Verify OTP</button>
      <button onclick="resetEmail()">Use Different Email</button>
    </div>

    <div id="message"></div>
  </div>

  <script>
    let email = '';

    async function sendOTP() {
      email = document.getElementById('email').value;
      
      if (!email) {
        showError('Please enter your email');
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/api/candidates/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (data.success) {
          showSuccess('OTP sent to your email!');
          document.getElementById('emailStep').style.display = 'none';
          document.getElementById('otpStep').style.display = 'block';
          document.getElementById('emailDisplay').textContent = `OTP sent to: ${email}`;
        } else {
          showError(data.error || 'Failed to send OTP');
        }
      } catch (error) {
        showError('Network error. Please try again.');
      }
    }

    async function verifyOTP() {
      const otp = document.getElementById('otp').value;

      if (!otp || otp.length !== 6) {
        showError('Please enter a 6-digit OTP');
        return;
      }

      try {
        const response = await fetch('http://localhost:3000/api/candidates/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, otp })
        });

        const data = await response.json();

        if (data.success) {
          showSuccess('Email verified! Redirecting...');
          setTimeout(() => {
            // Redirect to next step or show next form
            window.location.href = '/candidate/resume-upload';
          }, 2000);
        } else {
          showError(data.error || 'Failed to verify OTP');
        }
      } catch (error) {
        showError('Network error. Please try again.');
      }
    }

    function resetEmail() {
      document.getElementById('emailStep').style.display = 'block';
      document.getElementById('otpStep').style.display = 'none';
      document.getElementById('email').value = '';
      document.getElementById('otp').value = '';
      document.getElementById('message').innerHTML = '';
    }

    function showSuccess(msg) {
      document.getElementById('message').innerHTML = `<div class="success">${msg}</div>`;
    }

    function showError(msg) {
      document.getElementById('message').innerHTML = `<div class="error">${msg}</div>`;
    }
  </script>
</body>
</html>
```

---

## Key Integration Points

### 1. Environment Variables
Set your API base URL:
```javascript
const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3000';
```

### 2. Error Handling
```javascript
// Handle specific error cases
if (response.status === 429) {
  // Rate limited - show "try again later"
}
if (response.status === 400) {
  // Validation error - show specific message
}
```

### 3. Loading States
Always show loading indicator:
- Send OTP button: "Sending..."
- Verify OTP button: "Verifying..."

### 4. OTP Input
- Accept only 6 digits
- Auto-focus input
- Clear error on new input

### 5. Success Handling
After verification:
- Store email in session/context
- Proceed to next step (resume upload)
- Or redirect based on campaign link

---

## Testing Checklist

- [ ] Email input validation
- [ ] OTP sends successfully
- [ ] OTP arrives in email
- [ ] OTP verification works
- [ ] Invalid OTP shows error
- [ ] Expired OTP handled
- [ ] Rate limit respected
- [ ] Resend OTP functionality
- [ ] Loading states show
- [ ] Error messages clear
- [ ] Next step proceeds after verification
