# Crew Posts Module API Documentation

> **Base Path:** `/posts`  
> **Security Model:** Exclusively `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. Requires active session (`access_token`).

---

## Quick Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/posts/:crewId` | `@AuthRequired()` | Returns paginated list of posts in a crew |
| `POST` | `/posts/:crewId` | `@AuthRequired()` | Creates a new post with optional media files (`multipart/form-data`) |
| `PATCH` | `/posts/:crewId/:postId` | `@AuthRequired()` | Updates a post content/attachments (Author only, `multipart/form-data`) |
| `POST` | `/posts/:crewId/:postId/attachments` | `@AuthRequired()` | Uploads new media attachment(s) to existing post (Author only, `multipart/form-data`) |
| `DELETE` | `/posts/:crewId/:postId/attachments/:attachmentId` | `@AuthRequired()` | Deletes a specific media attachment from a post (Author or Crew Owner) |
| `DELETE` | `/posts/:crewId/:postId` | `@AuthRequired()` | Deletes a post and all its attachments (Author or Crew Owner) |

---

## 1. System Limits & Business Rules

| Constraint | Limit | Trigger & Client Behavior |
|---|---|---|
| **Content Length** | **1–1500 characters** | Validated on `POST` and `PATCH`. Must not start or end with whitespace, and cannot consist solely of spaces. |
| **Max Attachments** | **15 attachments per post** | `POST` or `PATCH` returning `400 Bad Request` with `MAX_ATTACHMENTS_EXCEEDED` if total exceeds 15. |
| **Attachment File Size** | **200 MB max per file** | Returns `400 Bad Request` with `ATTACHMENT_TOO_LARGE` if any file exceeds 200 MB. |
| **Supported Media** | **Any media file** | Supports photos, video, audio, documents under key `files` in `multipart/form-data`. |
| **Crew Access Guard** | Member Only | Users who are not members of the target crew receive `404 Not Found` with `CREW_NOT_FOUND` to prevent leaking private crew existence. |
| **Edit Authorization** | Author Only | Only the original author of the post can edit it (`PATCH`) or add attachments. Attempting to edit another user's post returns `403 Forbidden` with `ONLY_AUTHOR_CAN_EDIT_POST`. |
| **Delete Authorization** | Author or Crew Owner | A post or its attachment can be deleted by either its original author OR the crew owner (`OWNER`). |
| **Pagination Defaults** | Default: 20 per page | Default page size is 20 posts (`limit = 20`, max `50`), page 1. Ordered chronologically descending (`createdAt DESC`). |

---

## 2. Endpoints Detail

### `GET /posts/:crewId`
Returns a paginated list of posts published in the specified crew. Results are ordered newest to oldest (`createdAt DESC`). Includes author details, `attachments` array, and a `youIsAuthor` boolean flag.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
- **Query Parameters (`GetPostsQueryDto`):**
  - `page` *(number, optional, default: 1, min: 1)*: Page number.
  - `limit` *(number, optional, default: 20, min: 1, max: 50)*: Elements per page.
- **Success Response (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": 105,
        "content": "Check out our new strategy video!",
        "youIsAuthor": true,
        "author": {
          "id": 1,
          "username": "cyberpunk",
          "name": "Valerie",
          "alias": "V",
          "avatar": "storage/users/avatars/1_uuid.png"
        },
        "attachments": [
          {
            "id": 12,
            "key": "posts/attachments/105_uuid_strategy.mp4",
            "name": "strategy.mp4",
            "mimeType": "video/mp4",
            "size": 15485760,
            "createdAt": "2026-08-11T12:00:00.000Z"
          }
        ],
        "createdAt": "2026-08-11T12:00:00.000Z",
        "updatedAt": "2026-08-11T12:00:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member of the crew. |

---

### `POST /posts/:crewId`
Creates a new post in the specified crew with optional media attachments.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
- **Content-Type:** `multipart/form-data`
- **Request Form Data:**
  - `content` *(string, required)*: Post text (1–1500 chars).
  - `files` *(files, optional)*: Up to 15 media files (photo, video, audio, etc.). Max **200 MB** per file.
- **Success Response (`201 Created` / `200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `BAD_REQUEST` | Content fails length or whitespace constraints. |
  | `400 Bad Request` | `ATTACHMENT_TOO_LARGE` | Any attached file exceeds 200 MB size limit. |
  | `400 Bad Request` | `MAX_ATTACHMENTS_EXCEEDED` | Attempted to attach more than 15 files. |
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member of the crew. |

---

### `PATCH /posts/:crewId/:postId`
Updates an existing post. Allows updating text content, attaching new files, or removing specific existing attachments. Only the post author can perform this action.

- **Access:** `@AuthRequired()` (Author Only)
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
  - `postId` *(number, required)*: ID of the post.
- **Content-Type:** `multipart/form-data`
- **Request Form Data:**
  - `content` *(string, required)*: Updated post text (1–1500 chars).
  - `files` *(files, optional)*: New media files to attach.
  - `removeAttachmentIds` *(JSON string or CSV array, optional)*: Attachment IDs to delete, e.g. `"[12, 13]"` or `"12,13"`.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `BAD_REQUEST` | Content fails length or whitespace constraints. |
  | `400 Bad Request` | `ATTACHMENT_TOO_LARGE` | Any attached file exceeds 200 MB size limit. |
  | `400 Bad Request` | `MAX_ATTACHMENTS_EXCEEDED` | Combined remaining and new attachments exceed 15 files limit. |
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |
  | `403 Forbidden` | `ONLY_AUTHOR_CAN_EDIT_POST` | User is not the author of the post. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
  | `404 Not Found` | `POST_NOT_FOUND` | Post does not exist in this crew. |

---

### `POST /posts/:crewId/:postId/attachments`
Uploads new media attachment(s) to an existing post. Only the post author can add attachments.

- **Access:** `@AuthRequired()` (Author Only)
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
  - `postId` *(number, required)*: ID of the post.
- **Content-Type:** `multipart/form-data`
- **Request Form Data:**
  - `files` *(files, required)*: Media files to attach. Max **200 MB** per file. Total attachments on post must not exceed 15.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `ATTACHMENT_TOO_LARGE` | File size exceeds 200 MB limit. |
  | `400 Bad Request` | `MAX_ATTACHMENTS_EXCEEDED` | Upload would cause post to exceed 15 total attachments. |
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |
  | `403 Forbidden` | `ONLY_AUTHOR_CAN_EDIT_POST` | User is not the author of the post. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
  | `404 Not Found` | `POST_NOT_FOUND` | Post does not exist in this crew. |

---

### `DELETE /posts/:crewId/:postId/attachments/:attachmentId`
Deletes a specific attachment from a post and removes its file from MinIO storage.

- **Access:** `@AuthRequired()` (Author or Crew Owner)
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
  - `postId` *(number, required)*: ID of the post.
  - `attachmentId` *(number, required)*: ID of the attachment.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |
  | `403 Forbidden` | `ONLY_AUTHOR_CAN_EDIT_POST` | User is neither the post author nor crew owner. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
  | `404 Not Found` | `POST_NOT_FOUND` | Post does not exist in this crew. |
  | `404 Not Found` | `ATTACHMENT_NOT_FOUND` | Attachment ID not found on this post. |

---

### `DELETE /posts/:crewId/:postId`
Deletes a post and all associated media attachments from MinIO storage.

- **Access:** `@AuthRequired()` (Author or Crew Owner)
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
  - `postId` *(number, required)*: ID of the post.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |
  | `403 Forbidden` | `ONLY_AUTHOR_OR_OWNER_CAN_DELETE_POST` | User is neither the post author nor crew owner. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
  | `404 Not Found` | `POST_NOT_FOUND` | Post does not exist in this crew. |

---

## 3. Error Codes Dictionary (`PostErrorCode`)

| Error Code | HTTP Status | Meaning | Recommended Client Action |
|---|---|---|---|
| `CREW_NOT_FOUND` | `404` | Crew not found or current user is not a member. | Redirect or notify user that crew access is denied. |
| `POST_NOT_FOUND` | `404` | Target post not found in specified crew. | Refresh post list. |
| `ONLY_AUTHOR_CAN_EDIT_POST` | `403` | Non-author attempted to edit post content or attachments. | Disable edit option for non-author posts. |
| `ONLY_AUTHOR_OR_OWNER_CAN_DELETE_POST` | `403` | User is neither post author nor crew owner. | Hide delete post button. |
| `ATTACHMENT_TOO_LARGE` | `400` | Attached file exceeds size limit (200 MB). | Inform user to upload files under 200 MB. |
| `MAX_ATTACHMENTS_EXCEEDED` | `400` | Attempted to attach more than 15 files to a post. | Prompt user to remove some attachments first. |
| `ATTACHMENT_NOT_FOUND` | `404` | Attachment record not found on this post. | Refresh post attachments list. |
