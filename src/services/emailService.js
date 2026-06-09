const nodemailer = require('nodemailer');
require('dotenv').config();

// Check if Gmail credentials are configured
const hasGmailCredentials = process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD;

// Create transporter using Gmail SMTP (only if credentials exist)
let transporter = null;

if (hasGmailCredentials) {
  transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD // Use App Password, not regular password
    }
  });

  // Verify transporter connection
  transporter.verify((error, success) => {
    if (error) {
      console.error('❌ Email service error:', error.message);
      console.log('⚠️  Email service not configured. OTP will be logged to console only.');
      transporter = null;
    } else {
      console.log('✓ Email service ready');
    }
  });
} else {
  console.log('⚠️  Gmail credentials not configured in .env');
  console.log('   Set GMAIL_USER and GMAIL_APP_PASSWORD to enable email service');
}

/**
 * Send OTP to email
 * @param {string} email - Recipient email
 * @param {string} otp - 6-digit OTP
 * @returns {Promise<boolean>}
 */
const sendOTPEmail = async (email, otp) => {
  try {
    // If transporter not configured, log to console (dev mode)
    if (!transporter) {
      console.log(`
╔════════════════════════════════════════════════════╗
║           OTP FOR TESTING (DEV MODE)               ║
╠════════════════════════════════════════════════════╣
║ Email: ${email.padEnd(48)}║
║ OTP:   ${otp.padEnd(48)}║
║ Valid for: 10 minutes                              ║
╚════════════════════════════════════════════════════╝
      `);
      return true; // Return success for testing
    }

    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Your OTP for Candidate Registration',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
              .container { max-width: 500px; margin: 20px auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .header { text-align: center; color: #333; }
              .otp-box { background-color: #e8f5e9; border: 2px solid #4caf50; padding: 20px; text-align: center; border-radius: 5px; margin: 20px 0; }
              .otp-code { font-size: 32px; font-weight: bold; color: #4caf50; letter-spacing: 5px; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
              .warning { color: #ff9800; font-size: 14px; text-align: center; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header">
                <h2>Welcome to JBR Staffing Solutions</h2>
              </div>
              <p>Hi there,</p>
              <p>Thank you for registering. Please use the following OTP to verify your email address:</p>
              
              <div class="otp-box">
                <div class="otp-code">${otp}</div>
              </div>

              <p class="warning">⏰ This OTP will expire in 10 minutes. Do not share this code with anyone.</p>
              
              <p>If you didn't request this registration, please ignore this email.</p>
              
              <div class="footer">
                <p>JBR Staffing Solutions</p>
                <p>&copy; ${new Date().getFullYear()} All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `,
      text: `Your OTP is: ${otp}\n\nThis OTP will expire in 10 minutes.`
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ OTP email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending OTP email:', error);
    return false;
  }
};

/**
 * Send verification confirmation email
 * @param {string} email - Recipient email
 * @returns {Promise<boolean>}
 */
const sendVerificationConfirmationEmail = async (email) => {
  try {
    const mailOptions = {
      from: process.env.GMAIL_USER,
      to: email,
      subject: 'Email Verified Successfully',
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; background-color: #f4f4f4; }
              .container { max-width: 500px; margin: 20px auto; background-color: #fff; padding: 30px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
              .success { text-align: center; color: #4caf50; }
              .footer { text-align: center; color: #666; font-size: 12px; margin-top: 20px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="success">
                <h2>✓ Email Verified!</h2>
              </div>
              <p>Your email has been successfully verified. You can now proceed with your candidate registration.</p>
              <p>Thank you for choosing JBR Staffing Solutions!</p>
              
              <div class="footer">
                <p>JBR Staffing Solutions</p>
                <p>&copy; ${new Date().getFullYear()} All rights reserved.</p>
              </div>
            </div>
          </body>
        </html>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✓ Verification confirmation email sent to ${email}`);
    return true;
  } catch (error) {
    console.error('Error sending confirmation email:', error);
    return false;
  }
};

module.exports = {
  sendOTPEmail,
  sendVerificationConfirmationEmail
};
