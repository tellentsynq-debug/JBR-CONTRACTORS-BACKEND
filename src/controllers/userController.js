const supabase = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Generate OTP and send SMS
const sendOTP = async (phoneNumber) => {
  try {
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Check OTP request logs
    const { data: logData } = await supabase
      .from('otp_request_logs')
      .select('otp_count, created_at')
      .eq('phone_number', phoneNumber)
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .single();

    if (logData && logData.otp_count >= 5) {
      return { success: false, error: 'Maximum OTP requests reached. Try again tomorrow.' };
    }

    // Send OTP via MSG91
    await axios.get('https://api.msg91.com/api/sendotp.php', {
      params: {
        authkey: process.env.MSG91_AUTH_KEY,
        mobile: phoneNumber,
        message: `Your JBR verification OTP is ${otp}. Valid for ${process.env.MSG91_OTP_VALIDITY / 60} minutes.`,
        sender: process.env.MSG91_SENDER_ID
      }
    });

    // Store OTP in database
    const { error: otpError } = await supabase
      .from('otp_verification')
      .upsert({
        phone_number: phoneNumber,
        otp_code: otp,
        is_verified: false,
        attempts: 0,
        created_at: new Date().toISOString()
      });

    if (otpError) throw otpError;

    // Update request logs
    if (logData) {
      await supabase
        .from('otp_request_logs')
        .update({ otp_count: logData.otp_count + 1 })
        .eq('phone_number', phoneNumber);
    } else {
      await supabase
        .from('otp_request_logs')
        .insert([
          {
            phone_number: phoneNumber,
            otp_count: 1,
            created_at: new Date().toISOString()
          }
        ]);
    }

    return { success: true, message: 'OTP sent successfully' };
  } catch (error) {
    console.error('Error sending OTP:', error);
    return { success: false, error: 'Failed to send OTP' };
  }
};

// Signup user
exports.signup = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Validation
    if (!phoneNumber) {
      return res.status(400).json({ 
        error: 'Phone number is required' 
      });
    }

    // Validate phone number format (Indian)
    if (!/^[6-9]\d{9}$/.test(phoneNumber)) {
      return res.status(400).json({ 
        error: 'Invalid Indian phone number' 
      });
    }

    // Check if phone already exists in users
    const { data: existingUser } = await supabase
      .from('users')
      .select('phone_number')
      .eq('phone_number', phoneNumber)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Phone number already registered' });
    }

    // Send OTP
    const otpResult = await sendOTP(phoneNumber);

    if (!otpResult.success) {
      return res.status(400).json({ error: otpResult.error });
    }

    res.status(200).json({ 
      message: 'OTP sent successfully',
      phoneNumber
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


// Verify OTP and Login
exports.login = async (req, res) => {
  try {
    const { phoneNumber, otp } = req.body;

    // Validation
    if (!phoneNumber || !otp) {
      return res.status(400).json({ 
        error: 'Phone number and OTP are required' 
      });
    }

    // Get OTP record from database
    const { data: otpRecord } = await supabase
      .from('otp_verification')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    if (!otpRecord) {
      return res.status(401).json({ error: 'OTP not found or expired' });
    }

    // Check if OTP has expired (10 minutes)
    const otpAge = (Date.now() - new Date(otpRecord.created_at).getTime()) / 1000 / 60;
    if (otpAge > parseInt(process.env.MSG91_OTP_VALIDITY) / 60) {
      return res.status(401).json({ error: 'OTP expired' });
    }

    // Check attempts
    if (otpRecord.attempts >= 3) {
      return res.status(401).json({ error: 'Maximum OTP attempts exceeded' });
    }

    // Verify OTP
    if (otpRecord.otp_code !== otp) {
      // Increment attempts
      await supabase
        .from('otp_verification')
        .update({ attempts: otpRecord.attempts + 1 })
        .eq('phone_number', phoneNumber);
      
      return res.status(401).json({ error: 'Invalid OTP' });
    }

    // Mark OTP as verified
    await supabase
      .from('otp_verification')
      .update({ is_verified: true })
      .eq('phone_number', phoneNumber);

    // Check if user exists
    const { data: user } = await supabase
      .from('users')
      .select('*')
      .eq('phone_number', phoneNumber)
      .single();

    let userId;
    if (user) {
      userId = user.id;
    } else {
      // Create new user with phone number
      const { data: newUser, error: insertError } = await supabase
        .from('users')
        .insert([{ phone_number: phoneNumber }])
        .select('id');

      if (insertError) throw insertError;
      userId = newUser[0].id;
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: userId, phoneNumber: phoneNumber },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: userId,
        phoneNumber: phoneNumber
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};


// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('users')
      .select('*');

    if (error) throw error;
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Get user by ID
exports.getUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Create user
exports.createUser = async (req, res) => {
  try {
    const { firstName, lastName, email, phoneNumber } = req.body;
    
    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }
    
    const { data: user, error } = await supabase
      .from('users')
      .insert([{ 
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_number: phoneNumber
      }])
      .select('id');

    if (error) throw error;
    
    res.status(201).json({ 
      id: user[0].id, 
      firstName, 
      lastName, 
      email,
      phoneNumber 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Update user
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstName, lastName, email, phoneNumber } = req.body;
    
    const { error } = await supabase
      .from('users')
      .update({
        first_name: firstName,
        last_name: lastName,
        email: email,
        phone_number: phoneNumber
      })
      .eq('id', id);

    if (error) throw error;
    
    res.json({ id, firstName, lastName, email, phoneNumber });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// Delete user
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('users')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
