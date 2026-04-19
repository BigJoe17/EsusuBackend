# Esusu Backend - Setup Guide

## Prerequisites
- Node.js 18+ and npm
- PostgreSQL 13+ (running locally or remote)
- Git

## Installation Steps

### 1. Install Dependencies
```bash
npm install
```

### 2. Set Up PostgreSQL
Make sure PostgreSQL is running on your machine:

**macOS (using Homebrew):**
```bash
# Install PostgreSQL
brew install postgresql@15

# Start PostgreSQL service
brew services start postgresql@15

# Create database
createdb esusu_dev
```

**Linux (Ubuntu/Debian):**
```bash
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres createdb esusu_dev
```

**Windows:**
- Download and install from https://www.postgresql.org/download/windows/
- PostgreSQL typically starts automatically

### 3. Environment Configuration
The `.env` file has been created with development defaults. Update if needed:
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/esusu_dev"
```

### 4. Initialize Database
```bash
npx prisma migrate reset --force
```

### 5. Start Development Server
```bash
npm run dev
```

The server will start on `http://localhost:5000`

## Available Scripts

- `npm run dev` — Start development server with auto-reload
- `npm run build` — Build TypeScript to JavaScript
- `npm start` — Start production server
- `npm run db:check` — Check users in database
- `npm test` — Run tests (coming soon)

## API Testing

### Register User
```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "password123",
    "name": "John Doe"
  }'
```

### Test Endpoint
```bash
curl http://localhost:5000/api/test
```

## Database Connection Issues?

If you get `Can't reach database server` error:

1. Verify PostgreSQL is running: `psql -U postgres`
2. Check connection string in `.env`
3. Ensure database `esusu_dev` exists: `psql -U postgres -l`
4. Reset database: `npx prisma migrate reset --force`

## Project Structure

```
src/
├── server.ts           # Express app entry point
├── controllers/        # HTTP request handlers
├── services/          # Business logic
├── routes/            # API route definitions
├── middleware/        # Auth, error handling
└── utils/             # Helpers (email, OTP, DB)
prisma/
├── schema.prisma      # Database schema
└── migrations/        # Database migrations
```

## Security Checklist

- [ ] Change JWT_SECRET in production
- [ ] Configure real SMTP credentials
- [ ] Enable HTTPS in production
- [ ] Set NODE_ENV=production
- [ ] Use environment variables for all secrets
- [ ] Run `npm audit` regularly
- [ ] Add rate limiting for public endpoints
- [ ] Implement CORS properly

## Next Steps

1. Configure email service for OTP delivery
2. Set up API documentation (Swagger)
3. Add comprehensive tests
4. Implement monitoring and logging
5. Add Docker support for deployment
