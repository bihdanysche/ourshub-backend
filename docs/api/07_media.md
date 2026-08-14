# Media Module API Documentation (Part 1)

> **Base Path:** `/auth` & `/crews`  
> **Security Model:** Exclusively `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. Requires active session (`access_token`).

---

## Quick Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `POST` | `/auth/me/avatar` | `@AuthRequired()` | Uploads user profile avatar (max 15MB, ratio 1:1) |
| `DELETE` | `/auth/me/avatar` | `@AuthRequired()` | Deletes user profile avatar |
| `POST` | `/crews/:crewId/avatar` | `@AuthRequired()` | Uploads crew avatar (only `OWNER`, max 20MB, ratio 1:1) |
| `POST` | `/crews/:crewId/cover` | `@AuthRequired()` | Uploads crew cover image (only `OWNER`, max 20MB, ratio 3:1) |
| `DELETE` | `/crews/:crewId/avatar` | `@AuthRequired()` | Deletes crew avatar (only `OWNER`) |
| `DELETE` | `/crews/:crewId/cover` | `@AuthRequired()` | Deletes crew cover image (only `OWNER`) |
| `POST` | `/posts/:crewId/:postId/attachments` | `@AuthRequired()` | Uploads new media attachment(s) to post (max 200MB/file, max 15/post) |
| `DELETE` | `/posts/:crewId/:postId/attachments/:attachmentId` | `@AuthRequired()` | Deletes a post media attachment (Author or Crew Owner) |
| `GET` | `/storage?k=...` | Public | Serves stored files with HTTP Range request support (`206 Partial Content`), `Accept-Ranges: bytes`, and media streaming/seeking |

---

## 1. Specifications & Rules

- **Allowed Image Formats:** `png`, `jpg`, `jpeg`, `heic` (`heif`).
- **HEIC Conversion:** Any `heic` / `heif` avatar/cover image is automatically converted to `png` format before saving to MinIO storage to ensure universal device compatibility.
- **Aspect Ratio Validation:**
  - User and Crew Avatars (`User.avatar` & `Crew.avatar`): **1:1** aspect ratio.
  - Crew Cover (`Crew.cover`): **3:1** aspect ratio.
- **Post Attachments Limits:**
  - File size: **200 MB** max per file.
  - Quantity limit: **15 attachments** max per post.
  - Media types: Any media file (photo, video, audio, etc.).
- **File Overwrites & Cleanup:**
  - Uploading a new avatar/cover automatically deletes the previous file from MinIO storage before saving the new key.
  - Deleting a post or individual attachment removes the corresponding file(s) from MinIO storage and deletes the database record.
- **Permissions:**
  - `/auth/me/avatar` operations affect the authenticated user.
  - `/crews/:crewId/*` media endpoints are restricted to the **Crew Owner**. Non-owners attempting to upload or delete crew avatars or covers will receive `403 Forbidden` (`ONLY_OWNER_CAN_UPDATE_CREW`).

---

## 2. Endpoints Detail

### `POST /auth/me/avatar`
Uploads or updates the current user's profile avatar.

- **Access:** `@AuthRequired()`
- **Content-Type:** `multipart/form-data`
- **Body Form Data:**
  - `file` *(file, required)*: Single image file (`png`, `jpg`, `jpeg`, `heic`). Max size: **15 MB**. Aspect ratio: **1:1**.
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
| `400 Bad Request` | `INVALID_IMAGE_FORMAT` | Unsupported image format or corrupted file. |
| `400 Bad Request` | `IMAGE_TOO_LARGE` | File size exceeds 15 MB limit. |
| `400 Bad Request` | `INVALID_IMAGE_ASPECT_RATIO` | Aspect ratio is not 1:1. |
| `401 Unauthorized` | `UNAUTHORIZED` / `TOKEN_EXPIRED` | User is not authenticated. |

---

### `DELETE /auth/me/avatar`
Deletes the current user's avatar image from storage and resets `User.avatar` to `null`.

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
| `401 Unauthorized` | `UNAUTHORIZED` / `TOKEN_EXPIRED` | User is not authenticated. |

---

### `POST /crews/:crewId/avatar`
Uploads or updates a crew's avatar image. Available **only to the crew owner**.

- **Access:** `@AuthRequired()` (Crew Owner)
- **Content-Type:** `multipart/form-data`
- **Body Form Data:**
  - `file` *(file, required)*: Single image file (`png`, `jpg`, `jpeg`, `heic`). Max size: **20 MB**. Aspect ratio: **1:1**.
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
| `400 Bad Request` | `INVALID_IMAGE_FORMAT` | Unsupported image format or corrupted file. |
| `400 Bad Request` | `IMAGE_TOO_LARGE` | File size exceeds 20 MB limit. |
| `400 Bad Request` | `INVALID_IMAGE_ASPECT_RATIO` | Aspect ratio is not 1:1. |
| `403 Forbidden` | `ONLY_OWNER_CAN_UPDATE_CREW` | User is not the owner of the crew. |
| `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |

---

### `POST /crews/:crewId/cover`
Uploads or updates a crew's cover image. Available **only to the crew owner**.

- **Access:** `@AuthRequired()` (Crew Owner)
- **Content-Type:** `multipart/form-data`
- **Body Form Data:**
  - `file` *(file, required)*: Single image file (`png`, `jpg`, `jpeg`, `heic`). Max size: **20 MB**. Aspect ratio: **3:1**.
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
| `400 Bad Request` | `INVALID_IMAGE_FORMAT` | Unsupported image format or corrupted file. |
| `400 Bad Request` | `IMAGE_TOO_LARGE` | File size exceeds 20 MB limit. |
| `400 Bad Request` | `INVALID_IMAGE_ASPECT_RATIO` | Aspect ratio is not 3:1. |
| `403 Forbidden` | `ONLY_OWNER_CAN_UPDATE_CREW` | User is not the owner of the crew. |
| `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |

---

### `DELETE /crews/:crewId/avatar`
Deletes a crew's avatar image from storage and resets `Crew.avatar` to `null`. Available **only to the crew owner**.

- **Access:** `@AuthRequired()` (Crew Owner)
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `403 Forbidden` | `ONLY_OWNER_CAN_UPDATE_CREW` | User is not the owner of the crew. |
| `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |

---

### `DELETE /crews/:crewId/cover`
Deletes a crew's cover image from storage and resets `Crew.cover` to `null`. Available **only to the crew owner**.

- **Access:** `@AuthRequired()` (Crew Owner)
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `403 Forbidden` | `ONLY_OWNER_CAN_UPDATE_CREW` | User is not the owner of the crew. |
| `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |

---

### `POST /posts/:crewId/:postId/attachments`
Uploads new media attachment(s) to an existing post.

- **Access:** `@AuthRequired()` (Post Author Only)
- **Content-Type:** `multipart/form-data`
- **Body Form Data:**
  - `files` *(files, required)*: One or more media files (photo, video, audio, etc.). Max **200 MB** per file. Total attachments on post must not exceed 15.
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `400 Bad Request` | `ATTACHMENT_TOO_LARGE` | Attached file exceeds 200 MB size limit. |
| `400 Bad Request` | `MAX_ATTACHMENTS_EXCEEDED` | Attempted to exceed 15 attachments limit per post. |
| `403 Forbidden` | `ONLY_AUTHOR_CAN_EDIT_POST` | User is not the author of the post. |
| `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
| `404 Not Found` | `POST_NOT_FOUND` | Post does not exist in this crew. |

---

### `DELETE /posts/:crewId/:postId/attachments/:attachmentId`
Deletes a specific attachment from a post and removes its file from storage.

- **Access:** `@AuthRequired()` (Post Author or Crew Owner)
- **Success Response (200 OK):**
  ```json
  {
    "ok": true
  }
  ```

#### Errors:
| Status | Error Code | Description |
|---|---|---|
| `403 Forbidden` | `ONLY_AUTHOR_CAN_EDIT_POST` | User is neither the post author nor crew owner. |
| `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
| `404 Not Found` | `POST_NOT_FOUND` | Post does not exist in this crew. |
| `404 Not Found` | `ATTACHMENT_NOT_FOUND` | Attachment ID not found on this post. |

---

### `GET /storage?k=...`
Serves stored media files (avatars, covers, post attachments) directly to clients with full **HTTP Range Request** support (`206 Partial Content`), enabling audio/video seeking (`audio.currentTime` / `video.currentTime`) and media streaming.

- **Access:** Public
- **Query Parameters:**
  - `k` *(string, required)*: Key of the stored file (e.g. `posts/attachments/105_uuid_file.mp4`).
- **Request Headers (Optional):**
  - `Range`: e.g. `bytes=1048576-` or `bytes=0-1023` for seeking / chunk streaming.
- **Success Response Headers:**
  - `Accept-Ranges: bytes`
  - `Content-Type`: MIME type of file (e.g., `audio/mpeg`, `video/mp4`, `image/png`).
  - `Content-Length`: Size of payload chunk in bytes.
  - `Content-Range`: e.g., `bytes 1048576-15485759/15485760` (when Range is requested).
  - `Cross-Origin-Resource-Policy: cross-origin`
- **HTTP Status Codes:**
  - `206 Partial Content`: Returned when a `Range` header was specified and content chunk is streamed.
  - `200 OK`: Returned when full file is requested without Range.
  - `416 Range Not Satisfiable`: Returned if the requested Range exceeds file bounds.
  - `404 Not Found`: Returned if `k` parameter is missing, points to an external URL, or object does not exist.


