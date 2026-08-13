# Auth Module API Documentation

> **Base Path:** `/auth`  
> **Security Model:** Exclusively `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. No `Authorization` header required.

---

## Quick Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/auth/telegram` | Public | Initiates Telegram OIDC PKCE flow |
| `GET` | `/auth/telegram/callback` | Public | Handles Telegram OAuth callback, registers user with `username_lower`, determines IP `location`, & issues session cookies |
| `POST` | `/auth/refresh` | Public (Cookies) | Rotates token pair and extends session (+90 days) |
| `POST` | `/auth/logout` | Public / Auth | Terminates current session and clears cookies |
| `GET` | `/auth/me` | `@AuthRequired()` | Returns current user profile |
| `POST` | `/auth/me/avatar` | `@AuthRequired()` | Uploads user avatar (multipart/form-data, max 15MB, 1:1 ratio, HEIC converted to PNG) |
| `DELETE` | `/auth/me/avatar` | `@AuthRequired()` | Removes user avatar from storage and clears database field |
| `GET` | `/auth/sessions` | `@AuthRequired()` | Lists all active sessions with `isCurrent` flag and `location` |
| `POST` | `/auth/sessions/shutdown/:id` | `@AuthRequired()` | Terminates a specific **non-current** session |
| `POST` | `/auth/sessions/shutdown-all` | `@AuthRequired()` | Terminates all sessions **except** the current one |

---

## 1. Cookie & Token Specifications

| Cookie | Lifetime | Path | Flags | Description |
|---|---|---|---|---|
| `access_token` | 10 minutes | `/` | `HttpOnly; Secure; SameSite=Lax` | Authorizes API requests (`{ sub: userId, sid: sessionId }`) |
| `refresh_token` | 90 days | `/auth` | `HttpOnly; Secure; SameSite=Lax` | Session renewal token (`{ sub: userId, sid: sessionId, type: 'refresh' }`) |
| `telegram_oauth_state` | 5 minutes | `/auth/telegram` | `HttpOnly; Secure; SameSite=Lax` | Anti-CSRF OAuth state parameter |
| `telegram_oauth_verifier` | 5 minutes | `/auth/telegram` | `HttpOnly; Secure; SameSite=Lax` | PKCE code verifier |

---

## 2. Endpoints Detail

### `GET /auth/telegram`
Starts Telegram OIDC PKCE authentication.

- **Access:** Public
- **Redirects To:** `https://oauth.telegram.org/auth?...`
- **Cookies Set:** `telegram_oauth_state`, `telegram_oauth_verifier`

#### Error Redirections (`${FRONTEND_URI}/?auth=error&code=<ERROR_CODE>`):
- `ALREADY_AUTHENTICATED` — User already has an active, unexpired session.
- `AUTH_ALREADY_IN_PROGRESS` — Another login attempt is currently in flight.

---

### `GET /auth/telegram/callback`
Processes the authorization code from Telegram, registers new users (or retrieves existing ones without overwriting modified fields), determines client geographic location from IP via offline GeoIP, creates a database session, and sets authentication cookies.

- **Access:** Public
- **Query Parameters:**
  - `code` *(string, required)*: Telegram authorization code.
  - `state` *(string, required)*: OAuth state for CSRF validation.
- **Cookies Required:** `telegram_oauth_state`, `telegram_oauth_verifier`
- **Success Redirect:** `${FRONTEND_URI}/?auth=success`
- **Cookies Set:** `access_token` (10m), `refresh_token` (90d)
- **Cookies Cleared:** `telegram_oauth_state`, `telegram_oauth_verifier`
- **Registration Behavior:**
  - `username` is saved in its original casing from Telegram `preferred_username`.
  - `username_lower` is checked for collision and saved in lowercase to enforce case-insensitive uniqueness. If already taken, both fields default to `null`.
  - Client IP is resolved via `geoip-lite` into `location` format (`"City, Country"` or `null`) and stored in the created `Session`.

#### Error Redirections (`${FRONTEND_URI}/?auth=error&code=<ERROR_CODE>`):
- `UNAUTHORIZED` — Missing `code` or `state` in query params.
- `TG_AUTH_EXPIRED` — Missing or expired temporary OAuth cookies.
- `INVALID_OAUTH_STATE` — State query parameter does not match stored cookie.
- `TELEGRAM_AUTH_FAILED` — Token exchange with Telegram API failed.
- `INVALID_TELEGRAM_ID_TOKEN` — Telegram ID Token verification/signature failed.

---

### `POST /auth/refresh`
Performs **full token rotation** (reissues both `access_token` and `refresh_token`) and extends session expiry by 90 days.

- **Access:** Public (Reads cookies)
- **Cookies Required:** `refresh_token`
- **Cookies Optional:** `access_token`
- **Rules:**
  1. If `access_token` is still valid and unexpired → **Fails with `400 Bad Request`** (`ACCESS_TOKEN_NOT_EXPIRED`). Refresh must only be called when the access token has expired.
  2. If `refresh_token` is missing, expired, or session not found in DB → Clears auth cookies and **Fails with `401 Unauthorized`**.
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `ACCESS_TOKEN_NOT_EXPIRED` | Access token is still valid. Wait until expiry or 401 before refreshing. |
| `401 Unauthorized` | `REFRESH_TOKEN_REQUIRED` | `refresh_token` cookie is absent. |
| `401 Unauthorized` | `INVALID_REFRESH_TOKEN` | Refresh token signature is invalid or payload malformed. |
| `401 Unauthorized` | `SESSION_EXPIRED` | Session does not exist in DB or has reached expiration. |

---

### `POST /auth/logout`
Terminates the current session from the database and clears authentication cookies.

- **Access:** Public / Authenticated
- **Cookies:** `access_token` or `refresh_token`
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```
- **Cookies Cleared:** `access_token`, `refresh_token`

---

### `GET /auth/me`
Retrieves the profile of the authenticated user.

- **Access:** `@AuthRequired()`
- **Cookies Required:** `access_token`
- **Success Response (200 OK):**
  ```json
  {
    "id": 1,
    "username": "durov",
    "name": "Pavel Durov",
    "avatar": "https://example.com/avatar.jpg"
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `401 Unauthorized` | `UNAUTHORIZED` | No `access_token` cookie provided. |
| `401 Unauthorized` | `TOKEN_EXPIRED` | Access token has expired. |
| `401 Unauthorized` | `INVALID_ACCESS_TOKEN` | Token is corrupted or signature is invalid. |
| `401 Unauthorized` | `SESSION_EXPIRED` | Session expired or was deleted from database. |

---

### `POST /auth/me/avatar`
Uploads or updates the current user's profile avatar image. Replaces and deletes any previously uploaded avatar from MinIO storage.

- **Access:** `@AuthRequired()`
- **Content-Type:** `multipart/form-data`
- **Body Form Data:**
  - `file` *(file, required)*: Single image file (`png`, `jpg`, `jpeg`, `heic`). Maximum size **15 MB**. Aspect ratio must be **1:1**. HEIC images are automatically converted to PNG format before saving.
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `IMAGE_REQUIRED` | No file attached in `multipart/form-data`. |
| `400 Bad Request` | `INVALID_IMAGE_FORMAT` | Unsupported file format (not PNG/JPG/JPEG/HEIC) or corrupted file. |
| `400 Bad Request` | `IMAGE_TOO_LARGE` | File size exceeds 15 MB limit. |
| `400 Bad Request` | `INVALID_IMAGE_ASPECT_RATIO` | Image aspect ratio is not 1:1. |
| `401 Unauthorized` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `SESSION_EXPIRED` | User not authenticated. |

---

### `DELETE /auth/me/avatar`
Deletes the current user's avatar image from MinIO storage and resets the `User.avatar` field in the database to `null`.

- **Access:** `@AuthRequired()`
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `401 Unauthorized` | `UNAUTHORIZED` / `TOKEN_EXPIRED` / `SESSION_EXPIRED` | User not authenticated. |

---

### `GET /auth/sessions`
Returns a list of all active sessions for the current user, sorted by last activity (`lastUsedAt` descending), including geolocation determined from client IP.

- **Access:** `@AuthRequired()`
- **Cookies Required:** `access_token`
- **Success Response (200 OK):**
  ```json
  [
    {
      "id": 42,
      "ip": "188.163.10.5",
      "agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      "location": "Kyiv, UA",
      "createdAt": "2026-08-09T12:00:00.000Z",
      "lastUsedAt": "2026-08-09T15:30:00.000Z",
      "expiresAt": "2026-11-07T12:00:00.000Z",
      "isCurrent": true
    },
    {
      "id": 39,
      "ip": "91.200.45.12",
      "agent": "Telegram-Android/10.2.0",
      "location": "Lviv, UA",
      "createdAt": "2026-08-01T09:15:00.000Z",
      "lastUsedAt": "2026-08-08T18:20:00.000Z",
      "expiresAt": "2026-10-30T09:15:00.000Z",
      "isCurrent": false
    },
    {
      "id": 35,
      "ip": "127.0.0.1",
      "agent": "PostmanRuntime/7.39.0",
      "location": null,
      "createdAt": "2026-07-20T10:00:00.000Z",
      "lastUsedAt": "2026-07-20T10:00:00.000Z",
      "expiresAt": "2026-10-18T10:00:00.000Z",
      "isCurrent": false
    }
  ]
  ```

---

### `POST /auth/sessions/shutdown/:id`
Terminates a specific session belonging to the authenticated user.

- **Access:** `@AuthRequired()`
- **URL Parameters:**
  - `id` *(integer, required)*: ID of the session to terminate.
- **Constraint:** **The current active session cannot be terminated via this endpoint.** To end the current session, the client must use `POST /auth/logout`.
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `CANNOT_SHUTDOWN_CURRENT_SESSION` | Cannot shut down the current session via this route. Use `/auth/logout`. |
| `404 Not Found` | `SESSION_NOT_FOUND` | Session does not exist or belongs to another user. |

---

### `POST /auth/sessions/shutdown-all`
Terminates all sessions of the user **except** the current active session.

- **Access:** `@AuthRequired()`
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

---

## 3. Error Codes Dictionary (`AuthErrorCode`)

All API error responses follow the standard format:
```json
{
  "error_code": "ERROR_NAME"
}
```

| Error Code | Status | Meaning | Recommended Client Action |
|---|---|---|---|
| `ALREADY_AUTHENTICATED` | `302` | User is already logged in with an active session. | Redirect to application dashboard. |
| `AUTH_ALREADY_IN_PROGRESS` | `302` | OAuth attempt already in flight. | Wait or restart login flow. |
| `TG_AUTH_EXPIRED` | `302` | Temporary OAuth state/verifier expired. | Restart Telegram login flow. |
| `INVALID_OAUTH_STATE` | `302` | OAuth state parameter mismatch. | Security warning; restart login flow. |
| `TELEGRAM_AUTH_FAILED` | `302` | Code exchange with Telegram API failed. | Display failure message to user; allow retry. |
| `INVALID_TELEGRAM_ID_TOKEN` | `302` | Telegram ID token verification failed. | Restart login flow. |
| `ACCESS_TOKEN_NOT_EXPIRED` | `400` | Attempted token refresh while access token is still valid. | Do not poll refresh; only refresh upon receiving 401 on API calls. |
| `CANNOT_SHUTDOWN_CURRENT_SESSION` | `400` | Attempted to shut down current session via `/shutdown/:id`. | Call `/auth/logout` instead to terminate current session. |
| `REFRESH_TOKEN_REQUIRED` | `401` | No `refresh_token` cookie provided. | Redirect to login page. |
| `INVALID_REFRESH_TOKEN` | `401` | Refresh token is invalid or forged. | Clear client state and redirect to login. |
| `TOKEN_EXPIRED` | `401` | Access token has expired. | Call `/auth/refresh` to obtain a fresh token pair. |
| `INVALID_ACCESS_TOKEN` | `401` | Access token signature is invalid or corrupted. | Clear client state and redirect to login. |
| `SESSION_EXPIRED` | `401` | Session expired or deleted from database. | Redirect to login page. |
| `SESSION_NOT_FOUND` | `404` | Target session not found or unauthorized. | Re-fetch `/auth/sessions` list. |
| `IMAGE_REQUIRED` | `400` | No image file was attached in `multipart/form-data`. | Attach a valid image file under key `file`. |
| `INVALID_IMAGE_FORMAT` | `400` | Unsupported file format (only `png`, `jpg`, `jpeg`, `heic` allowed). | Choose a supported image file format. |
| `IMAGE_TOO_LARGE` | `400` | Attached file exceeds size limit (15 MB). | Compress image or select a smaller file. |
| `INVALID_IMAGE_ASPECT_RATIO` | `400` | Image aspect ratio is not 1:1. | Crop image to a 1:1 square aspect ratio before upload. |

---

## 4. Developer Decorators

Use these decorators in backend controllers:

```typescript
// Enforce authentication on route
@Get('dashboard')
@AuthRequired()
getDashboard(@CurrentUser() user: UserEntity, @CurrentSession() session: SessionEntity) {
  return { userId: user.id, sessionId: session.id };
}

// Optional authentication (populates req.user if token is present, continues as guest if not)
@Get('feed')
@OptionalAuth()
getFeed(@CurrentUser() user?: UserEntity | null) {
  return { personalized: Boolean(user) };
}
```
