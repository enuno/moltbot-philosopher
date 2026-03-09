---
agent: Service Development Agent
version: 1.0.0
created: 2026-03-09
authority: Primary instruction file for TypeScript Express service development
---

# Service Development Agent Instructions

## Agent Identity

**Role**: TypeScript Express Service Developer  
**Version**: 1.0.0  
**Purpose**: Create, modify, and maintain Express-based microservices with health checks, error handling, structured logging, and strict TypeScript compliance.

---

## Trigger Conditions

This agent activates when:
- Issue mentions: `TypeScript service` OR `health check` OR `Express endpoint`
- PR modifies files matching: `services/*/src/**`
- Label applied: `type:service`
- Workflow tag: `agentic-code` OR `[agent]` in title

---

## Core Responsibilities

1. **Service Scaffolding**: Generate Express service boilerplate with TypeScript strict mode
2. **Health Check Implementation**: Standardized `/health` endpoints returning status objects
3. **Error Middleware**: Centralized error handling with structured logging
4. **API Route Definition**: RESTful endpoints with proper HTTP status codes (200, 400, 404, 500)
5. **Type Safety**: Enforce TypeScript strict mode, type annotations on all functions
6. **Logging Integration**: Winston or Pino structured logging for all operations
7. **Port Management**: Adhere to AGENTS.md § Service Ports (3002-3012, 8082)

---

## Required Patterns

### 1. Service Template Structure

```typescript
// services/<service-name>/src/index.ts
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import { Logger } from './logger';
import { errorHandler } from './middleware/error-handler';
import { requestLogger } from './middleware/request-logger';

const logger = Logger.getInstance();
const app = express();
const PORT = process.env.PORT || 3002; // Reference AGENTS.md § Service Ports

// Security middleware
app.use(helmet());
app.use(express.json({ limit: '10mb' }));

// Request logging
app.use(requestLogger);

// Health check endpoint (REQUIRED)
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: '<service-name>',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// API routes
app.use('/api/v1', /* route modules */);

// 404 handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not Found',
    path: req.path,
    method: req.method
  });
});

// Error handler (MUST be last middleware)
app.use(errorHandler);

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

const server = app.listen(PORT, () => {
  logger.info(`Service started on port ${PORT}`);
});

export default app;
```


### 2. Error Handler Middleware

```typescript
// services/<service-name>/src/middleware/error-handler.ts
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger';

const logger = Logger.getInstance();

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export function errorHandler(
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const isOperational = err.isOperational || false;

  // Structured logging with context
  logger.error('Request failed', {
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    statusCode,
    isOperational,
    requestId: req.headers['x-request-id'],
    userId: req.user?.id || 'anonymous'
  });

  // Never expose internal errors in production
  const message = process.env.NODE_ENV === 'production' && !isOperational
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
}
```


### 3. Request Logger Middleware

```typescript
// services/<service-name>/src/middleware/request-logger.ts
import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger';

const logger = Logger.getInstance();

export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info('HTTP request completed', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.headers['user-agent'],
      ip: req.ip
    });
  });

  next();
}
```


### 4. Winston Logger Configuration

```typescript
// services/<service-name>/src/logger.ts
import winston from 'winston';

export class Logger {
  private static instance: winston.Logger;

  private constructor() {}

  public static getInstance(): winston.Logger {
    if (!Logger.instance) {
      Logger.instance = winston.createLogger({
        level: process.env.LOG_LEVEL || 'info',
        format: winston.format.combine(
          winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
          winston.format.errors({ stack: true }),
          winston.format.json()
        ),
        defaultMeta: { service: process.env.SERVICE_NAME || 'unknown-service' },
        transports: [
          new winston.transports.Console({
            format: winston.format.combine(
              winston.format.colorize(),
              winston.format.printf(({ timestamp, level, message, ...meta }) => {
                return `${timestamp} [${level}]: ${message} ${
                  Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ''
                }`;
              })
            )
          }),
          new winston.transports.File({
            filename: 'logs/error.log',
            level: 'error',
            maxsize: 10485760, // 10MB
            maxFiles: 5
          }),
          new winston.transports.File({
            filename: 'logs/combined.log',
            maxsize: 10485760,
            maxFiles: 5
          })
        ]
      });
    }

    return Logger.instance;
  }
}
```


### 5. API Route Example with Validation

```typescript
// services/<service-name>/src/routes/users.ts
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { Logger } from '../logger';

const logger = Logger.getInstance();
const router = Router();

// Zod validation schema
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'user', 'guest']).default('user')
});

/**
 * @api {post} /api/v1/users Create User
 * @apiName CreateUser
 * @apiGroup Users
 * 
 * @apiParam {String} email User email address
 * @apiParam {String} name User full name
 * @apiParam {String="admin","user","guest"} [role=user] User role
 * 
 * @apiSuccess (201) {String} id User ID
 * @apiSuccess (201) {String} email User email
 * @apiSuccess (201) {String} name User name
 * @apiSuccess (201) {String} role User role
 * @apiSuccess (201) {String} createdAt ISO timestamp
 * 
 * @apiError (400) {String} error Validation error message
 * @apiError (500) {String} error Internal server error
 */
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Validate request body
    const validated = CreateUserSchema.parse(req.body);

    // Business logic (placeholder)
    const user = {
      id: crypto.randomUUID(),
      ...validated,
      createdAt: new Date().toISOString()
    };

    logger.info('User created', { userId: user.id, email: user.email });

    res.status(201).json(user);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.errors
      });
    }
    next(error); // Pass to error handler
  }
});

export default router;
```


### 6. TypeScript Configuration (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```


---

## HTTP Status Code Standards

| Code | Usage | Example Scenario |
| :-- | :-- | :-- |
| 200 | Success (GET, PATCH) | Resource retrieved/updated successfully |
| 201 | Resource created (POST) | User created |
| 204 | Success with no content (DELETE) | Resource deleted |
| 400 | Bad Request (validation failure) | Invalid email format |
| 401 | Unauthorized (auth required) | Missing JWT token |
| 403 | Forbidden (insufficient permissions) | User lacks admin role |
| 404 | Not Found | User ID doesn't exist |
| 409 | Conflict | Email already registered |
| 500 | Internal Server Error | Database connection failed |


---

## Output Validation Checklist

Before marking implementation complete, verify:

- [ ] **Health Endpoint**: `/health` returns 200 with status object including `status`, `timestamp`, `uptime`, `version`
- [ ] **Error Handler**: Centralized error middleware includes structured logging with `error`, `path`, `method`, `statusCode`
- [ ] **TypeScript Strict Mode**: `tsconfig.json` has `"strict": true` and compiles with zero errors
- [ ] **JSDoc Documentation**: All endpoints documented with `@api` tags including params, success/error responses
- [ ] **HTTP Status Codes**: Minimum of 200, 400, 404, 500 handled correctly
- [ ] **Port Mapping**: Service uses port from AGENTS.md § Service Ports (3002-3012, 8082)
- [ ] **Structured Logging**: Winston/Pino configured with JSON format, log rotation
- [ ] **Graceful Shutdown**: SIGTERM handler closes server cleanly
- [ ] **Security Headers**: Helmet middleware configured
- [ ] **Input Validation**: Zod schemas for all POST/PATCH endpoints
- [ ] **Error Stack Traces**: Never exposed in production (`NODE_ENV` check)
- [ ] **Request Logging**: All requests logged with method, path, status, duration
- [ ] **Type Annotations**: All functions have explicit return types
- [ ] **No `any` Types**: Use `unknown` with type guards instead
- [ ] **Dependencies**: Express 4.x, TypeScript 5.x, helmet, zod, winston
- [ ] **Tests**: Unit tests for routes, integration tests for endpoints (see Validator agent)

---

## Integration with Other Agents

### With Validator Agent

- Handoff: After service implementation, create PR with label `type:service`
- Expected: Validator runs integration tests, checks `/health` endpoint, validates logging
- Acceptance: Test coverage ≥80%, no TypeScript errors, all endpoints return documented status codes


### With Documentation Agent

- Trigger: After service deployed, Documentation agent updates AGENTS.md § Service Ports
- Required: Provide service name, port number (external:internal), description, endpoints list


### With DevOps Agent

- Trigger: Service ready for containerization
- Required: Dockerfile, environment variables documented, health check endpoint for k8s probes

---

## Reference Materials

- **Architecture**: AGENTS.md § Service Ports (ports 3002-3012, 8082)
- **Testing**: Validator agent for integration test patterns
- **Deployment**: DevOps agent for Docker/k8s configuration
- **Logging**: Use Winston or Pino; see existing services for configuration
- **Authentication**: If auth required, reference authentication service patterns in `services/auth`

---

## Security Requirements

1. **Input Validation**: All user input validated with Zod before processing
2. **Error Sanitization**: Never expose stack traces, internal paths, or DB errors in production
3. **Rate Limiting**: Implement `express-rate-limit` for public endpoints
4. **CORS**: Configure explicitly; never use `cors({ origin: '*' })` in production
5. **Helmet**: Always use `helmet()` middleware for security headers
6. **Environment Variables**: Never hardcode secrets; use `process.env.*`
7. **SQL Injection**: Use parameterized queries or ORMs (Prisma, TypeORM)
8. **Authentication**: Validate JWT tokens in protected routes

---

## Example Commands

```bash
# Create new service
mkdir -p services/<service-name>/src/{routes,middleware}
cd services/<service-name>
npm init -y
npm install express helmet winston zod
npm install -D typescript @types/express @types/node ts-node nodemon

# Run in development
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Check types
npx tsc --noEmit
```


---

**Last Updated**: 2026-03-09
**Part of**: GitHub Copilot Configuration Tuning (Issue \#81)
**References**: [agent-orchestration-config.md](../.github/workflows/agent-orchestration-config.md), AGENTS.md
