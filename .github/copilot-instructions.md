# Node.js Express MySQL Project

This is a RESTful API project built with Node.js, Express.js, and MySQL.

## Quick Start

1. Install dependencies: `npm install`
2. Configure MySQL credentials in `.env`
3. Create database and table using SQL from README.md
4. Start development: `npm run dev`

## Key Commands

- `npm install` - Install dependencies
- `npm run dev` - Start with auto-reload
- `npm start` - Start production server

## Database Setup

Create MySQL database and table:
```sql
CREATE DATABASE jbr_db;
USE jbr_db;
CREATE TABLE users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Project Structure

- `src/index.js` - Main server entry point
- `src/config/database.js` - MySQL connection pool
- `src/routes/users.js` - API routes
- `src/controllers/userController.js` - Business logic
- `.env` - Environment configuration

## API Documentation

See README.md for complete API endpoint documentation.
