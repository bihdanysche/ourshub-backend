# OursHub Backend

OursHub is a backend service for a group expense sharing ("splits"), crew collaboration, posts, and media management platform. The application provides Telegram OIDC authentication, group expense tracking and settlement, post feed with media attachments, and object storage management via S3/MinIO.

---

## Technology Stack

- Framework: NestJS (TypeScript)
- Runtime & Package Manager: Bun
- Database & ORM: PostgreSQL + Prisma ORM (@prisma/adapter-pg)
- Authentication: Telegram OIDC / OAuth2 + JWT (Access/Refresh in HTTP-Only cookies) + GeoIP
- Object Storage: MinIO / AWS S3 (@aws-sdk/client-s3)
- Image Processing: Sharp (aspect ratio validation, compression, HEIC/HEIF to PNG conversion)
- API Documentation: OpenAPI (Swagger) + Scalar API Reference (@scalar/nestjs-api-reference)

---

## Project Architecture

The application follows a modular NestJS structure where business domains are isolated under `src/modules/`:

```text
src/
├── app.module.ts                   # Root application module
├── main.ts                         # Entrypoint, CORS, Helmet, OpenAPI Scalar /docs
├── common/                         # Common utilities, filters, DTOs, and configuration
│   ├── config/                     # Environment configuration and validation
│   ├── dto/pagination/             # Unified pagination DTOs
│   ├── errors/                     # Common error codes enum
│   ├── filters/                    # Global HttpExceptionFilter for { error_code } responses
│   └── utils/                      # Image processing and error parsing helpers
├── prisma/                         # PrismaService with PostgreSQL adapter
└── modules/
    ├── auth/                       # Telegram OIDC auth, user sessions, tokens, user avatars
    ├── crews/                      # Crew management (creation, invites, members, avatars/covers)
    ├── health/                     # Service health check (/health)
    ├── me/                         # Current user profile management
    ├── posts/                      # Group posts with file attachments
    ├── splits/                     # Expenses (splits), debt calculation, history, payment requests
    └── storage/                    # S3 media file streaming with HTTP Range support
```

### Key Architectural Concepts

1. Unified Error Format: All exceptions are caught by `HttpExceptionFilter` and formatted consistently as `{ error_code: "..." }`.
2. Input Validation: Input payloads are strictly validated using `class-validator` and `class-transformer`. Empty successful responses return `{ ok: true }`.
3. Media Processing: Avatar and attachment images are validated and converted via `sharp` before being written to S3. Multi-file uploads execute concurrently via `Promise.all`.

---

## API Documentation (Scalar)

Interactive OpenAPI documentation is hosted at:

http://localhost:8080/docs

The documentation is built using `@nestjs/swagger` and rendered via Scalar UI, detailing endpoints, DTO schemas, request/response models, and cookie authentication details.

---

## Getting Started

### 1. Prerequisites

- Bun (v1.0+)
- Docker and Docker Compose (for local PostgreSQL and MinIO instances)

### 2. Install Dependencies

```bash
bun install
```

### 3. Environment Variables (.env)

Create a `.env` file in the root directory with the following configuration:

```env
NODE_ENV=development
PORT=8080

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ourshub?schema=public

# JWT Secret
JWT_SECRET=super-secret-key-change-me

# Telegram OAuth2 / OIDC
TG_CLIENT_ID=your_telegram_client_id
TG_CLIENT_SECRET=your_telegram_client_secret
TG_REDIRECT_URI=http://localhost:8080/auth/telegram/callback

# Frontend URI
FRONTEND_URI=http://localhost:3000

# MinIO S3 Settings
MINIO_ENDPOINT=127.0.0.1
MINIO_PORT=9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET=ourshub
```

### 4. Run Infrastructure (PostgreSQL & MinIO)

```bash
docker-compose up -d
```

### 5. Apply Database Schema

```bash
npx prisma db push
```

### 6. Start Server

Development mode:
```bash
bun run start:dev
```

Production mode:
```bash
bun run build
bun run start:prod
```

### 7. Run Tests

```bash
bun test
```
