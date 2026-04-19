# Esusu Backend API

A robust Node.js/Express backend for managing microfinance rotating savings and credit associations (ROSCA). Built with TypeScript, Prisma ORM, and PostgreSQL.

## Features

- ✅ **Authentication with OTP**: Email-based OTP verification for secure registration and login
- ✅ **User Management**: User profiles with verification status and role-based access
- ✅ **Group Management**: Create and manage contribution groups
- ✅ **Contributions**: Track member contributions to groups
- ✅ **Loans**: Request and manage loans with approval workflow
- ✅ **Transactions**: Complete transaction history and audit trail
- ✅ **Security**: JWT authentication, password hashing, rate limiting, helmet protection
- ✅ **Validation**: Comprehensive input validation and error handling
- ✅ **Logging**: Structured logging with different log levels
- ✅ **Error Handling**: Centralized error handling with custom error classes

## Tech Stack

- **Runtime**: Node.js 18+
- **Language**: TypeScript 6.0+
- **Framework**: Express 5.x
- **Database**: PostgreSQL 13+
- **ORM**: Prisma 7.x
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Email**: Nodemailer
- **Utilities**: dotenv, helmet, cors, morgan

## Project Structure

```
esusu-backend/
├── src/
│   ├── config/
│   │   └── env.ts              # Environment validation
│   ├── controllers/            # HTTP request handlers
│   │   ├── auth.controller.ts
│   │   ├── group.controller.ts
│   │   ├── contribution.controller.ts
│   │   ├── loan.controller.ts
│   │   └── transaction.controller.ts
│   ├── services/               # Business logic
│   │   ├── auth.service.ts
│   │   ├── group.service.ts
│   │   ├── contribution.service.ts
│   │   ├── loan.service.ts
│   │   └── transaction.service.ts
│   ├── routes/                 # API route definitions
│   │   ├── auth.routes.ts
│   │   ├── group.routes.ts
│   │   ├── contribution.routes.ts
│   │   ├── loan.routes.ts
│   │   └── transaction.routes.ts
│   ├── middleware/             # Express middleware
│   │   ├── auth.middleware.ts  # JWT authentication
│   │   ├── error.middleware.ts # Error handling
│   │   └── rateLimit.middleware.ts # Rate limiting
│   ├── utils/                  # Helper functions
│   │   ├── prisma.ts          # Database client
│   │   ├── email.util.ts      # Email service
│   │   ├── otp.util.ts        # OTP generation
│   │   ├── logger.ts          # Structured logging
│   │   └── validation.ts      # Input validation
│   └── server.ts              # Express app setup
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── migrations/            # Database migrations
├── scripts/
│   └── check_users.ts         # Database inspection script
├── .env.example               # Environment template
├── .eslintrc.json            # ESLint configuration
├── .prettierrc.json          # Prettier configuration
├── tsconfig.json             # TypeScript configuration
├── prisma.config.ts          # Prisma configuration
├── package.json              # Dependencies
├── SETUP.md                  # Setup instructions
└── README.md                 # This file
```

## Installation

### 1. Clone and Install

```bash
cd esusu-backend
npm install
```

### 2. Set Up PostgreSQL

```bash
# macOS (Homebrew)
brew install postgresql@15
brew services start postgresql@15
createdb esusu_dev

# Linux (Ubuntu/Debian)
sudo apt-get install postgresql postgresql-contrib
sudo service postgresql start
sudo -u postgres createdb esusu_dev
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 4. Initialize Database

```bash
npm run db:reset
```

## Usage

### Development

```bash
npm run dev
```

Server runs on `http://localhost:5000`

### Production Build

```bash
npm run build
npm start
```

### Database Commands

```bash
npm run db:migrate    # Run pending migrations
npm run db:reset      # Reset database
npm run db:check      # View all users
```

### Code Quality

```bash
npm run lint          # Run ESLint
npm run lint:fix      # Fix linting issues
npm run format        # Format code with Prettier
npm run type-check    # Check TypeScript types
```

## API Endpoints

### Authentication

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Send login OTP
- `POST /api/auth/verify-otp` - Verify OTP and get JWT token
- `POST /api/auth/resend-otp` - Resend OTP
- `GET /api/auth/me` - Get authenticated user profile (requires JWT)

### Groups

- `POST /api/groups` - Create group
- `GET /api/groups` - List groups (paginated)
- `GET /api/groups/:id` - Get group details
- `POST /api/groups/:id/join` - Join group
- `POST /api/groups/:id/leave` - Leave group

### Contributions

- `POST /api/contributions` - Record contribution
- `GET /api/contributions/user` - Get user contributions
- `GET /api/contributions/group/:groupId` - Get group contributions

### Loans

- `POST /api/loans/request` - Request loan
- `GET /api/loans/user` - Get user loans
- `POST /api/loans/:id/approve` - Approve loan (admin)

### Transactions

- `GET /api/transactions` - Get transactions (paginated)

### Health

- `GET /api/health` - Health check
- `GET /api/test` - Test endpoint

## Authentication

All protected endpoints require JWT token in `Authorization` header:

```bash
Authorization: Bearer <jwt_token>
```

Token expires in 7 days. OTP verification is required on every login for enhanced security.

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "error": "Error message",
  "errors": [
    {
      "field": "email",
      "message": "Invalid email format"
    }
  ]
}
```

### Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (authentication required)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

## Validation

Input validation is performed on all endpoints:

- **Email**: Valid email format
- **Password**: Min 8 chars, uppercase, number, special character
- **OTP**: 6-digit code
- **Amount**: Must be positive number
- **User Input**: Type checking, length validation

## Security Features

- ✅ Helmet for HTTP headers
- ✅ CORS protection
- ✅ Rate limiting (global and per-endpoint)
- ✅ JWT authentication
- ✅ Password hashing with bcrypt (salt rounds: 12)
- ✅ OTP expiry (configurable, default 10 minutes)
- ✅ Input validation
- ✅ Payload size limit (10KB)
- ✅ Environment validation on startup
- ✅ Error details hidden in production

## Logging

The application uses structured logging with levels:

- `debug` - Detailed debug information
- `info` - General informational messages
- `warn` - Warning messages
- `error` - Error messages

Set log level via `LOG_LEVEL` environment variable (default: "info")

```typescript
import { logger } from "./utils/logger";

logger.info("User registered", { email, userId });
logger.warn("Invalid login attempt", { email });
logger.error("Database error", error);
```

## Database Schema

### Models

- **User** - User accounts with verification status
- **OtpCode** - OTP codes for verification
- **Group** - Contribution groups
- **GroupMember** - Group membership records
- **Contribution** - Member contributions
- **Loan** - Loan requests
- **Transaction** - Transaction history

### Relationships

- User → Groups (creator)
- User → GroupMembers → Groups
- User → Contributions → Groups
- User → Loans
- User → Transactions

## Environment Variables

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/esusu_dev

# JWT
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# SMTP (Email)
SMTP_HOST=smtp.ethereal.email
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
SMTP_FROM=Esusu Digital <noreply@esusu.com>

# Application
PORT=5000
NODE_ENV=development
LOG_LEVEL=debug

# OTP
OTP_EXPIRY_MINUTES=10

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
CORS_ORIGIN=*
```

## Performance & Optimization

- Database connection pooling via Prisma
- Indexed fields for fast queries
- Efficient ORM queries with select/include
- Request payload size limiting
- Cascading deletes for data integrity
- Graceful shutdown handling

## Testing

Testing framework coming soon. For now, use curl or Postman.

### Example: Register User

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "Secure123!",
    "name": "John Doe"
  }'
```

## Troubleshooting

### Can't reach database
1. Ensure PostgreSQL is running: `pg_isrunning`
2. Check connection string in `.env`
3. Verify database exists: `psql -U postgres -l`
4. Reset with: `npm run db:reset`

### Migration failed
```bash
npx prisma migrate reset --force
```

### Port already in use
```bash
# Change PORT in .env or kill process:
lsof -i :5000
kill -9 <PID>
```

## Contributing

1. Follow TypeScript best practices
2. Use `npm run lint:fix` before committing
3. Add comments for complex logic
4. Write clear commit messages
5. Test endpoints thoroughly

## License

ISC

## Support

For issues or questions, please create an issue in the repository.

## Deployment

### Environment Variables (Production)

```env
NODE_ENV=production
JWT_SECRET=<strong-random-secret>
DATABASE_URL=<production-db-url>
SMTP_USER=<real-smtp-user>
SMTP_PASS=<real-smtp-password>
```

### Build for Production

```bash
npm run build
NODE_ENV=production npm start
```

### Docker Support (Coming Soon)

Docker configuration will be added for easier deployment.

---

**Last Updated**: April 19, 2026
