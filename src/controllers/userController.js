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

/**
 * @interface SignupRequest
 * @property {string} email - User email address
 * @property {string} password - User password (min 6 characters)
 * @property {string} firstName - User's first name
 * @property {string} lastName - User's last name
 */

// Signup user with email and password
exports.signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Validation
    if (!email || !password || !firstName || !lastName) {
      return res.status(400).json({ 
        error: 'Email, password, firstName, and lastName are required' 
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ 
        error: 'Invalid email format' 
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({ 
        error: 'Password must be at least 6 characters' 
      });
    }

    // Check if email already exists in profiles
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .single();

    if (existingUser) {
      return res.status(400).json({ error: 'Email already registered' });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user in database
    const { data: newUser, error: createError } = await supabase
      .from('profiles')
      .insert([{
        email,
        password: hashedPassword,
        first_name: firstName,
        last_name: lastName,
        is_active: true,
        created_at: new Date().toISOString()
      }])
      .select();

    if (createError) {
      console.error('Supabase Insert Error:', {
        message: createError.message,
        code: createError.code,
        details: createError.details,
        hint: createError.hint
      });
      return res.status(500).json({ 
        error: 'Failed to create user',
        details: createError.message 
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: newUser[0].id, email, role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.status(201).json({ 
      message: 'User registered successfully',
      user: {
        id: newUser[0].id,
        email: newUser[0].email,
        firstName: newUser[0].first_name,
        lastName: newUser[0].last_name
      },
      token
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: error.message });
  }
};


// Login user with email and password
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({ 
        error: 'Email and password are required' 
      });
    }

    // Get user from database
    const { data: user, error: queryError } = await supabase
      .from('profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (queryError || !user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Verify password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: 'user' },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: error.message });
  }
};


// Get all users
exports.getAllUsers = async (req, res) => {
  try {
    const { data: users, error } = await supabase
      .from('profiles')
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
      .from('profiles')
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
      .from('profiles')
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
      .from('profiles')
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
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
    
    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};
