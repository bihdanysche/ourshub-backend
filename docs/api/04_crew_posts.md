# Crew Posts Module API Documentation

> **Base Path:** `/posts`  
> **Security Model:** Exclusively `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. Requires active session (`access_token`).

---

## Quick Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/posts/:crewId` | `@AuthRequired()` | Returns paginated list of posts in a crew |
| `POST` | `/posts/:crewId` | `@AuthRequired()` | Creates a new post in a crew (`multipart/form-data`) |
| `PATCH` | `/posts/:crewId/:postId` | `@AuthRequired()` | Updates a post in a crew (Author only, `multipart/form-data`) |
| `DELETE` | `/posts/:crewId/:postId` | `@AuthRequired()` | Deletes a post in a crew (Author or Crew Owner) |

---

## 1. System Limits & Business Rules

| Constraint | Limit | Trigger & Client Behavior |
|---|---|---|
| **Content Length** | **1–1500 characters** | Validated on `POST` and `PATCH`. Must not start or end with whitespace, and cannot consist solely of spaces. |
| **Crew Access Guard** | Member Only | Users who are not members of the target crew receive `404 Not Found` with `CREW_NOT_FOUND` to prevent leaking private crew existence. |
| **Edit Authorization** | Author Only | Only the original author of the post can edit it (`PATCH`). Attempting to edit another user's post returns `403 Forbidden` with `ONLY_AUTHOR_CAN_EDIT_POST`. |
| **Delete Authorization** | Author or Crew Owner | A post can be deleted (`DELETE`) by either its original author OR the owner (`OWNER`) of the crew. Other members receive `403 Forbidden` with `ONLY_AUTHOR_OR_OWNER_CAN_DELETE_POST`. |
| **Pagination Defaults** | Default: 20 per page | Default page size is 20 posts (`limit = 20`, max `50`), page 1. Ordered chronologically descending (`createdAt DESC`). |
| **Multipart Requirement** | `multipart/form-data` | `POST` and `PATCH` accept `multipart/form-data` payloads (for upcoming media upload features). |

---

## 2. Endpoints Detail

### `GET /posts/:crewId`
Returns a paginated list of posts published in the specified crew. Results are ordered newest to oldest (`createdAt DESC`). Includes author profile details (name, username, avatar, and crew-local `alias`) and a `youIsAuthor` boolean flag.

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
        "content": "Check out our new strategy for tonight!",
        "youIsAuthor": true,
        "author": {
          "id": 1,
          "username": "cyberpunk",
          "name": "Valerie",
          "alias": "V",
          "avatar": "https://storage.ourshub.com/avatars/1.png"
        },
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
Creates a new post in the specified crew.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
- **Request Body (`multipart/form-data`):**
  - `content` *(string, required)*: Post text (1–1500 chars).
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
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member of the crew. |

---

### `PATCH /posts/:crewId/:postId`
Updates an existing post in the crew. Only the author of the post can update it.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
  - `postId` *(number, required)*: ID of the post.
- **Request Body (`multipart/form-data`):**
  - `content` *(string, required)*: Updated post text (1–1500 chars).
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
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |
  | `403 Forbidden` | `ONLY_AUTHOR_CAN_EDIT_POST` | User is not the author of the post. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
  | `404 Not Found` | `POST_NOT_FOUND` | Post does not exist in this crew. |

---

### `DELETE /posts/:crewId/:postId`
Deletes a post from the crew. Can be deleted by either the author of the post OR the crew owner.

- **Access:** `@AuthRequired()`
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
