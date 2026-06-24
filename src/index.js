const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to Node.js Express MySQL API' });
});

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const campaignRoutes = require('./routes/campaigns');
const employeeRoutes = require('./routes/employees');
const employeeJobMobileRoutes = require('./routes/employeeJobMobile');
const jobIndustryRoutes = require('./routes/jobIndustries');
const jobCategoryRoutes = require('./routes/jobCategories');
const superAdminRoutes = require('./routes/superAdmins');
const adminRoutes = require('./routes/admins');
const candidateRoutes = require('./routes/candidates');
const groupRoutes = require('./routes/groups');
const provinceRoutes = require('./routes/provinces');
const cityRoutes = require('./routes/cities');
const dashboardRoutes = require('./routes/dashboard');
const masterReportRoutes = require('./routes/masterReport');
const chatRoutes = require('./routes/chat');
const warehouseRoutes = require('./routes/warehouses');

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/employee-job-mobile', employeeJobMobileRoutes);
app.use('/api/job-industries', jobIndustryRoutes);
app.use('/api/job-categories', jobCategoryRoutes);
app.use('/api/super-admins', superAdminRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/provinces', provinceRoutes);
app.use('/api/cities', cityRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/master-report', masterReportRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/warehouses', warehouseRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
