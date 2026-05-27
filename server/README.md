# MealMate Server

Node.js + Express + TypeScript + MongoDB backend.

## Scripts

```bash
npm install         # install deps
npm run dev         # start dev server with tsx watch (http://localhost:5000)
npm run build       # compile TS -> dist/
npm start           # run compiled server
npm run lint        # ESLint
npm run typecheck   # TS check
npm test            # Jest + Supertest
npm run test:coverage
```

## Stack

- **Express 4** + **TypeScript** (strict)
- **Mongoose 8** for MongoDB
- **JWT** auth + **bcryptjs** password hashing
- **Zod** for env + request validation
- **Pino** structured logging + **morgan** access logs
- **Helmet**, **CORS**, **compression**, **express-rate-limit**
- **Jest** + **Supertest** + **mongodb-memory-server** for tests
- Centralized error handler & async wrapper

## Env

Copy `.env.example` → `.env` and fill in values.

## Health Check

`GET /api/health` → `{ success, service, env, uptime, timestamp }`
