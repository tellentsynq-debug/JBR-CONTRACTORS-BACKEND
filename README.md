# Node.js Express MySQL API

A RESTful API built with Node.js, Express.js, and MySQL.

## Requirements

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- npm or yarn

## Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Setup MySQL Database:**
   - Create a database named `jbr_db`
   - Create a `users` table:
   ```sql
   CREATE TABLE users (
     id INT AUTO_INCREMENT PRIMARY KEY,
     name VARCHAR(100) NOT NULL,
     email VARCHAR(100) NOT NULL UNIQUE,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   ```

3. **Configure Environment Variables:**
   - Update `.env` file with your MySQL credentials:
   ```
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_password
   DB_NAME=jbr_db
   DB_PORT=3306
   PORT=3000
   NODE_ENV=development
   ```

## Running the Project

**Development Mode (with auto-restart):**
```bash
npm run dev
```

**Production Mode:**
```bash
npm start
```

The server will run on `http://localhost:3000`

## API Endpoints

### Users
- **GET** `/api/users` - Get all users
- **GET** `/api/users/:id` - Get user by ID
- **POST** `/api/users` - Create new user
- **PUT** `/api/users/:id` - Update user
- **DELETE** `/api/users/:id` - Delete user

## Example Requests

**Get all users:**
```bash
curl http://localhost:3000/api/users
```

**Create a user:**
```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{"name":"John Doe","email":"john@example.com"}'
```

**Update a user:**
```bash
curl -X PUT http://localhost:3000/api/users/1 \
  -H "Content-Type: application/json" \
  -d '{"name":"Jane Doe","email":"jane@example.com"}'
```

**Delete a user:**
```bash
curl -X DELETE http://localhost:3000/api/users/1
```

## Project Structure

```
├── src/
│   ├── config/
│   │   └── database.js      # Database connection pool
│   ├── controllers/
│   │   └── userController.js # Business logic
│   ├── routes/
│   │   └── users.js         # API routes
│   └── index.js             # Main server file
├── .env                     # Environment variables
├── .gitignore               # Git ignore rules
├── package.json             # Dependencies
└── README.md                # Documentation
```

## Technologies Used

- **Express.js** - Web framework
- **mysql2** - MySQL client
- **dotenv** - Environment variable management
- **cors** - Cross-Origin Resource Sharing
- **body-parser** - Request body parsing
- **nodemon** - Auto-restart during development
# jbr-backend-
