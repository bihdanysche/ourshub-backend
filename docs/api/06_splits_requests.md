# Splits Requests API Documentation

> **Base Path:** `/splits`  
> **Security Model:** Exclusively `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. Requires active session (`access_token`).

---

## Quick Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/splits/:splitId/expense-requests` | `@AuthRequired()` | Returns paginated list of pending expense requests in a split |
| `POST` | `/splits/:splitId/:expenseId/expense-request` | `@AuthRequired()` | Submits a debt payment request from debtor to expense spender |
| `DELETE` | `/splits/:splitId/:expenseId/:expenseRequestId` | `@AuthRequired()` | Cancels own expense request (Request author only) |
| `DELETE` | `/splits/:splitId/:expenseId/:expenseRequestId/decline` | `@AuthRequired()` | Declines an expense request (Expense Spender only) |
| `POST` | `/splits/:splitId/:expenseId/:expenseRequestId/accept` | `@AuthRequired()` | Accepts request, records debt payment, and creates history with `procByRequest: true` (Spender only) |

---

## 1. Business Rules & Constraints

| Constraint | Limit / Rule | Client Behavior & Trigger |
|---|---|---|
| **Max Request Amount** | `(mustPay - paid) - (pendingRequestsSum)` | The requested `amount` cannot exceed the user's remaining unpaid debt minus their active pending requests for that expense. |
| **Min Amount** | `> 0` | `amount` must be greater than 0 (`Min(0.01)`). Rounded to 2 decimal places. |
| **Optional Message (`msg`)** | **1–50 characters** | Optional note attached to request. Saved in `ExpensePayHistory` upon acceptance. |
| **Archived Mutability** | Read-Only | Requests on archived splits (`archived = true`) reject all mutating calls (`POST`, `DELETE`, `accept`, `decline`) with `400 Bad Request` (`SPLIT_IS_ARCHIVED`). Reading requests remains permitted for split members. |
| **Spender Exclusions** | Non-Spender Only | Spenders cannot create expense requests to their own expenses (`CANNOT_REQUEST_OWN_EXPENSE`). |

---

## 2. Endpoints Detail

### `GET /splits/:splitId/expense-requests`
Retrieves a paginated list of expense requests within a split for users involved as debtor or spender.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
- **Query Parameters (`GetExpenseRequestsQueryDto`):**
  - `page` *(number, optional, default: 1)*: Page number.
  - `limit` *(number, optional, default: 15, max: 50)*: Items per page.
  - `userId` *(number, optional)*: Filter requests submitted by a specific user.
  - `role` *(string, optional, enum: `as_spender` \| `as_user` \| `all`, default: `all`)*: Filter requests where caller is expense spender, requesting debtor, or both.
- **Success Response (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": 1,
        "amount": 25.5,
        "msg": "Transferred via Card",
        "createdAt": "2026-08-12T15:00:00.000Z",
        "user": {
          "id": 2,
          "name": "Johnny",
          "alias": "Silverhand",
          "username": "rockerboy",
          "avatar": null
        },
        "expense": {
          "id": 33,
          "title": "Drinks",
          "spender": {
            "id": 1,
            "name": "Valerie",
            "alias": "V",
            "username": "cyberpunk",
            "avatar": "https://storage.ourshub.com/avatars/1.png"
          }
        },
        "split": {
          "id": 12,
          "title": "Party"
        }
      }
    ],
    "meta": {
      "page": 1,
      "limit": 15,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```

---

### `POST /splits/:splitId/:expenseId/expense-request`
Submits a new payment request from a debtor to the expense spender.

- **Access:** `@AuthRequired()` (Debtor member of expense only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
- **Request Body (`CreateExpenseRequestDto`):**
  ```json
  {
    "amount": 25.5,
    "msg": "Transferred via Card"
  }
  ```
- **Success Response (`201 Created` / `200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `DELETE /splits/:splitId/:expenseId/:expenseRequestId`
Cancels an active expense request. Can only be invoked by the user who created the request.

- **Access:** `@AuthRequired()` (Request author only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
  - `expenseRequestId` *(number, required)*: ID of the expense request.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `DELETE /splits/:splitId/:expenseId/:expenseRequestId/decline`
Declines an expense request. Can only be invoked by the expense `spender`.

- **Access:** `@AuthRequired()` (Expense Spender only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
  - `expenseRequestId` *(number, required)*: ID of the expense request.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `POST /splits/:splitId/:expenseId/:expenseRequestId/accept`
Accepts an expense request. Records debt payment (`paid += amount`), deletes request, creates `ExpensePayHistory` with `procByRequest = true`, and auto-archives split if all debts are resolved. Can only be invoked by the expense `spender`.

- **Access:** `@AuthRequired()` (Expense Spender only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
  - `expenseRequestId` *(number, required)*: ID of the expense request.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
