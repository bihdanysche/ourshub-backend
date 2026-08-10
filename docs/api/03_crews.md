# Crews Module API Documentation

> **Base Path:** `/crews`  
> **Security Model:** Exclusively `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. Requires active session (`access_token`).

---

## Quick Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/crews` | `@AuthRequired()` | Returns paginated list of user's crews (as owner or member) |
| `POST` | `/crews` | `@AuthRequired()` | Creates a new crew with the user as `OWNER` |
| `GET` | `/crews/invitations/:code` | `@AuthRequired()` | Previews crew info by invite UUID before joining |
| `POST` | `/crews/invitations/:code/join` | `@AuthRequired()` | Joins crew via invite UUID with optional alias |
| `GET` | `/crews/:id` | `@AuthRequired()` | Returns detailed crew info (includes `inviteCode` only for `OWNER`) |
| `GET` | `/crews/:id/members` | `@AuthRequired()` | Returns paginated list of crew members |
| `PUT` | `/crews/:crewId/members/:memberId/alias` | `@AuthRequired()` | Updates or resets local alias for a crew member |
| `DELETE` | `/crews/:crewId/members/:memberId` | `@AuthRequired()` | Kicks a member (only `OWNER`) or leaves the crew (`MEMBER`) |
| `PATCH` | `/crews/:id` | `@AuthRequired()` | Updates the crew title (only `OWNER`) |
| `DELETE` | `/crews/:id` | `@AuthRequired()` | Deletes the crew completely (only `OWNER`) |

---

## 1. System Limits & Business Rules

| Constraint | Limit | Trigger & Client Behavior |
|---|---|---|
| **Max Members Per Crew** | **15 members** | Returns `400 Bad Request` with `CREW_IS_FULL` on join or preview. |
| **Max Crews Per User** | **10 crews** | Returns `400 Bad Request` with `USER_CREWS_LIMIT_REACHED` on crew creation or join. |
| **Title Length** | **2–50 characters** | Validated on `POST /crews`. Leading/trailing whitespaces are trimmed. |
| **Alias Length** | **1–20 characters** | Optional local nickname within the crew. Trimmed automatically. `null` or empty string clears the alias. |
| **Privacy & Visibility** | Closed Access | If a user is not a member of a crew, requests to `/crews/:id`, `/crews/:id/members`, etc. return `404 Not Found` with `CREW_NOT_FOUND` to prevent leaking the existence of private groups. |
| **Invite Code Visibility** | Owner Only | The `inviteCode` is returned in `GET /crews/:id` exclusively to the `OWNER`. Regular members receive `null`. |

---

## 2. Endpoints Detail

### `GET /crews`
Returns paginated list of crews the currently authenticated user belongs to (either as `OWNER` or `MEMBER`). Ordered chronologically from oldest to newest (`createdAt ASC`).

- **Access:** `@AuthRequired()`
- **Query Parameters (`GetCrewsQueryDto`):**
  - `page` *(number, optional, default: 1, min: 1)*: Page number.
  - `limit` *(number, optional, default: 5, min: 1, max: 15)*: Elements per page.
- **Success Response (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": 1,
        "title": "Night City Legends",
        "avatar": "https://storage.ourshub.com/crews/1/avatar.png",
        "membersCount": 8,
        "role": "OWNER"
      },
      {
        "id": 4,
        "title": "Frontend Hackers",
        "avatar": null,
        "membersCount": 3,
        "role": "MEMBER"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 5,
      "total": 2,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```

---

### `POST /crews`
Creates a new crew. The creator is automatically added as a `CrewMember` with role `OWNER`, and a unique UUID invitation link is generated.

- **Access:** `@AuthRequired()`
- **Request Body (`CreateCrewDto`):**
  ```json
  {
    "title": "Cyber Syndicate"
  }
  ```
- **Validation Rules:**
  - `title` *(string, required)*: Length 2–50 chars, trimmed, cannot start/end with spaces or be all whitespace.
- **Success Response (`201 Created` / `200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `BAD_REQUEST` | Title validation failed (length or invalid format). |
  | `400 Bad Request` | `USER_CREWS_LIMIT_REACHED` | User is already in 10 crews (system maximum). |
  | `401 Unauthorized` | `UNAUTHORIZED` | User session is missing or invalid. |

---

### `GET /crews/invitations/:code`
Retrieves public preview information about a crew using its UUID invite code prior to joining.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `code` *(string, UUID v4, required)*: The invitation code.
- **Success Response (`200 OK`):**
  ```json
  {
    "id": 1,
    "title": "Night City Legends",
    "avatar": "https://storage.ourshub.com/crews/1/avatar.png",
    "cover": "https://storage.ourshub.com/crews/1/cover.png",
    "membersCount": 8
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `CREW_IS_FULL` | The crew already has 15 members (maximum reached). |
  | `404 Not Found` | `INVITATION_NOT_FOUND` | Invite code does not exist or was removed. |
  | `409 Conflict` | `ALREADY_MEMBER` | User is already a member of this crew. |

---

### `POST /crews/invitations/:code/join`
Joins a crew via its UUID invite code with an optional local alias.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `code` *(string, UUID v4, required)*: The invitation code.
- **Request Body (`JoinCrewDto`):**
  ```json
  {
    "alias": "Samurai"
  }
  ```
- **Validation Rules:**
  - `alias` *(string, optional)*: Max 20 chars. Trimmed.
- **Success Response (`201 Created` / `200 OK`):**
  ```json
  {
    "ok": true,
    "crewId": 1
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `CREW_IS_FULL` | Crew has reached the limit of 15 members. |
  | `400 Bad Request` | `USER_CREWS_LIMIT_REACHED` | User is already in 10 crews. |
  | `400 Bad Request` | `BAD_REQUEST` | Alias length exceeds 20 characters. |
  | `404 Not Found` | `INVITATION_NOT_FOUND` | Invite code does not exist. |
  | `409 Conflict` | `ALREADY_MEMBER` | User is already a member of this crew. |

---

### `GET /crews/:id`
Retrieves detailed information about a specific crew. Only accessible to crew members.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `id` *(number, required)*: Crew ID.
- **Success Response (`200 OK`):**
  - **For OWNER:**
    ```json
    {
      "id": 1,
      "title": "Night City Legends",
      "avatar": "https://storage.ourshub.com/crews/1/avatar.png",
      "cover": "https://storage.ourshub.com/crews/1/cover.png",
      "membersCount": 8,
      "role": "OWNER",
      "inviteCode": "3fa85f64-5717-4562-b3fc-2c963f66afa6",
      "createdAt": "2026-08-01T10:00:00.000Z"
    }
    ```
  - **For MEMBER:**
    ```json
    {
      "id": 1,
      "title": "Night City Legends",
      "avatar": "https://storage.ourshub.com/crews/1/avatar.png",
      "cover": "https://storage.ourshub.com/crews/1/cover.png",
      "membersCount": 8,
      "role": "MEMBER",
      "inviteCode": null,
      "createdAt": "2026-08-01T10:00:00.000Z"
    }
    ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |

---

### `GET /crews/:id/members`
Retrieves paginated list of members in the crew. Ordered with `OWNER` first, followed by members by join date (`joinedAt ASC`).

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `id` *(number, required)*: Crew ID.
- **Query Parameters (`GetCrewMembersQueryDto`):**
  - `page` *(number, optional, default: 1, min: 1)*: Page number.
  - `limit` *(number, optional, default: 10, min: 1, max: 50)*: Elements per page.
- **Success Response (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": 15,
        "userId": 1,
        "name": "Pavel Durov",
        "username": "durov",
        "avatar": "https://storage.ourshub.com/avatars/1.png",
        "role": "OWNER",
        "alias": "Boss",
        "joinedAt": "2026-08-01T10:00:00.000Z"
      },
      {
        "id": 22,
        "userId": 7,
        "name": "Alex Smith",
        "username": "alex_dev",
        "avatar": null,
        "role": "MEMBER",
        "alias": "Coder",
        "joinedAt": "2026-08-02T14:20:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 2,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |

---

### `PUT /crews/:crewId/members/:memberId/alias`
Assigns or clears a local alias (nickname) for a member in the crew.

- **Access:** `@AuthRequired()`
- **Permissions:**
  - `OWNER`: Can update/clear the alias of **any** member in the crew.
  - `MEMBER`: Can only update/clear their **own** alias.
- **Path Parameters:**
  - `crewId` *(number, required)*: Crew ID.
  - `memberId` *(number, required)*: ID of the `CrewMember` record.
- **Request Body (`UpdateMemberAliasDto`):**
  ```json
  {
    "alias": "Fixer"
  }
  ```
  *(Pass `null` or `""` to clear the alias)*
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `BAD_REQUEST` | Alias length exceeds 20 characters. |
  | `403 Forbidden` | `CANNOT_EDIT_OTHER_MEMBER_ALIAS` | Regular member attempted to modify another member's alias. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
  | `404 Not Found` | `MEMBER_NOT_FOUND` | Member ID not found in this crew. |

---

### `DELETE /crews/:crewId/members/:memberId`
Removes a member from the crew.

- **Access:** `@AuthRequired()`
- **Behavior & Scenarios:**
  - **Self-leave (`memberId` belongs to current user):**
    - If user is `MEMBER`: successfully leaves the crew (`{ ok: true }`).
    - If user is `OWNER`: returns `400 Bad Request` with `CANNOT_LEAVE_AS_OWNER` (owner must delete the crew).
  - **Kick (`memberId` belongs to another user):**
    - Only permitted if current user is `OWNER`. If a regular member attempts this, returns `403 Forbidden` with `ONLY_OWNER_CAN_KICK_MEMBERS`.
- **Path Parameters:**
  - `crewId` *(number, required)*: Crew ID.
  - `memberId` *(number, required)*: ID of the `CrewMember` record.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `CANNOT_LEAVE_AS_OWNER` | The crew owner cannot leave the crew without deleting it. |
  | `403 Forbidden` | `ONLY_OWNER_CAN_KICK_MEMBERS` | Only the crew owner has permission to kick other members. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |
  | `404 Not Found` | `MEMBER_NOT_FOUND` | Member ID not found in this crew. |

---

### `PATCH /crews/:id`
Updates the title of the crew.

- **Access:** `@AuthRequired()`
- **Permissions:** Only the crew `OWNER` can update the crew title.
- **Path Parameters:**
  - `id` *(number, required)*: Crew ID.
- **Request Body (`UpdateCrewDto`):**
  ```json
  {
    "title": "New Syndicate Name"
  }
  ```
- **Validation Rules:**
  - `title` *(string, required)*: Length 2–50 chars, trimmed, cannot start/end with spaces or be all whitespace.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `400 Bad Request` | `BAD_REQUEST` | Title validation failed (length or whitespace). |
  | `403 Forbidden` | `ONLY_OWNER_CAN_UPDATE_CREW` | Regular member attempted to update the crew. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |

---

### `DELETE /crews/:id`
Deletes the crew and cascades deletion to all members and invitation links.

- **Access:** `@AuthRequired()`
- **Permissions:** Only the crew `OWNER` can delete the crew.
- **Path Parameters:**
  - `id` *(number, required)*: Crew ID.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
- **Errors:**
  | Status | Error Code | Description |
  |---|---|---|
  | `403 Forbidden` | `ONLY_OWNER_CAN_DELETE_CREW` | Regular member attempted to delete the crew. |
  | `404 Not Found` | `CREW_NOT_FOUND` | Crew does not exist or user is not a member. |

---

## 3. Error Codes Dictionary (`CrewErrorCode`)

| Error Code | HTTP Status | Meaning | Recommended Client Action |
|---|---|---|---|
| `CREW_NOT_FOUND` | `404` | Crew not found or current user has no access. | Notify user that the crew does not exist or access was revoked. |
| `MEMBER_NOT_FOUND` | `404` | Member record not found in the specified crew. | Refresh member list. |
| `INVITATION_NOT_FOUND` | `404` | Invite code does not exist or is invalid. | Show invalid invitation screen. |
| `ALREADY_MEMBER` | `409` | User is already a member of this crew. | Redirect user directly to the crew page. |
| `CREW_IS_FULL` | `400` | Crew has reached the maximum of 15 members. | Inform user that the group is at full capacity. |
| `USER_CREWS_LIMIT_REACHED` | `400` | User has reached the maximum of 10 crews. | Prompt user to leave an existing crew before creating or joining a new one. |
| `ONLY_OWNER_CAN_DELETE_CREW` | `403` | Non-owner attempted to delete the crew. | Hide or disable delete crew button for non-owners. |
| `ONLY_OWNER_CAN_UPDATE_CREW` | `403` | Non-owner attempted to update the crew title. | Hide or disable edit crew title UI for non-owners. |
| `ONLY_OWNER_CAN_KICK_MEMBERS` | `403` | Non-owner attempted to kick another member. | Hide or disable kick button for non-owners. |
| `CANNOT_EDIT_OTHER_MEMBER_ALIAS` | `403` | Non-owner attempted to edit another member's alias. | Restrict alias editing UI to own user or owner role. |
| `CANNOT_LEAVE_AS_OWNER` | `400` | Owner attempted to leave the crew instead of deleting it. | Direct owner to the delete crew option. |
