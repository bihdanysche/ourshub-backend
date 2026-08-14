# Crew Splits Module API Documentation

> **Base Path:** `/splits`  
> **Security Model:** Exclusively `HttpOnly`, `Secure`, `SameSite=Lax` Cookies. Requires active session (`access_token`).  
> **Expense Requests API:** See [`docs/api/06_splits_requests.md`](file:///home/Loq/Стільниця/OursHub/ourshub-backend/docs/api/06_splits_requests.md) for expense requests endpoints.

---

## Quick Reference

| Method | Endpoint | Access | Purpose |
|---|---|---|---|
| `GET` | `/splits/all/:crewId` | `@AuthRequired()` | Returns paginated summary list of splits in a crew (where user is member or crew owner) |
| `POST` | `/splits/create/:crewId` | `@AuthRequired()` | Creates a new split with one or more expenses and member allocations |
| `GET` | `/splits/:splitId` | `@AuthRequired()` | Returns detailed split info with expenses, spenders, and member statuses |
| `PATCH` | `/splits/:splitId` | `@AuthRequired()` | Updates title and description of a split and its expenses (Split members & Crew owner) |
| `DELETE` | `/splits/:splitId/archive` | `@AuthRequired()` | Archives a split (Split members & Crew owner) |
| `PUT` | `/splits/:splitId/:expenseId/pay-off` | `@AuthRequired()` | Records a debt payment for an expense (Spender only) |
| `PUT` | `/splits/:splitId/:expenseId/increase` | `@AuthRequired()` | Increases debt amount for a member in an expense (Spender only) |
| `GET` | `/splits/:splitId/history` | `@AuthRequired()` | Returns paginated pay/increase audit history for a split |
| `POST` | `/splits/:splitId/add-expense` | `@AuthRequired()` | Adds new expenses to an active split |
| `POST` | `/splits/:splitId/:expenseId/add-members` | `@AuthRequired()` | Adds new members to an expense (Spender only) |
| `DELETE` | `/splits/:splitId/:expenseId` | `@AuthRequired()` | Deletes an expense from a split (Spender only, minimum 1 expense remains) |
| `DELETE` | `/splits/:splitId/:expenseId/remove-members` | `@AuthRequired()` | Removes members from an expense (Spender only, minimum 2 members remain) |

---

## 1. System Limits & Business Rules

| Constraint | Limit | Trigger & Client Behavior |
|---|---|---|
| **Title Length** | **2–30 characters** | Validated on `Split` and `SplitExpense` title fields. Trimmed, cannot start/end with spaces or be space-only. |
| **Description Length** | **1–1000 characters** | Validated on optional `desc` fields. Trimmed, cannot start/end with spaces. |
| **History Message Length**| **1–50 characters** | Validated on optional `msg` fields in `pay-off` and `increase`. |
| **Expenses Per Split** | **1–10 expenses** | A split must have at least 1 expense and at most 10 expenses. |
| **Members Per Expense** | **Minimum 2 members** | Each expense must have at least 2 members (the `spender` + at least 1 debtor). `spender` is automatically included with initial `paid = mustPay`. |
| **Money Precision** | **2 decimal places** | Amounts are rounded to 2 decimal places (`Math.round(val * 100) / 100`). |
| **Archived Mutability** | Read-Only | Archived splits (`archived = true`) reject all mutating requests (`PATCH`, `PUT`, `POST`, `DELETE`) with `400 Bad Request` (`SPLIT_IS_ARCHIVED`). Reading details and history remains allowed for split members. |
| **Auto-Archiving** | Automatic | When a `pay-off` results in all members across all expenses having `paid >= mustPay`, the split is automatically archived. |
| **Spender Authorization** | Spender Only | Only the designated `spender` of an expense can modify its payments, increase debts, add/remove members, or delete the expense. Attempts by non-spenders return `403 Forbidden` (`ONLY_SPENDER_CAN_MODIFY`). |
| **Unpaid Debt Leave Guard** | Active Debt Lock | Members with unresolved debts or uncollected spender balances in active splits cannot leave or be kicked from the crew (`CANNOT_LEAVE_WITH_UNPAID_SPLITS` / `CANNOT_KICK_MEMBER_WITH_UNPAID_SPLITS`). |

---

## 2. Endpoints Detail

### `GET /splits/all/:crewId`
Returns a paginated list of splits in the specified crew. Non-owners only see splits where they are a member of at least one expense. Crew `OWNER` receives all splits in the crew. `totalPaid` and `totalMustPay` calculate the full total sums across all members and expenses of the split.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
- **Query Parameters (`GetSplitsQueryDto`):**
  - `page` *(number, optional, default: 1)*: Page number.
  - `limit` *(number, optional, default: 10, max: 50)*: Items per page.
  - `isArchived` *(boolean, optional, default: false)*: `true` to view archived splits, `false` for active splits.
- **Success Response (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": 12,
        "title": "Weekend Trip",
        "archived": false,
        "createdAt": "2026-08-11T12:00:00.000Z",
        "authors": [
          {
            "id": 1,
            "name": "Valerie",
            "alias": "V",
            "username": "cyberpunk",
            "avatar": "https://storage.ourshub.com/avatars/1.png"
          }
        ],
        "totalPaid": 150,
        "totalMustPay": 300
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```

---

### `POST /splits/create/:crewId`
Creates a new split with expenses and initial member allocations.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `crewId` *(number, required)*: ID of the crew.
- **Request Body (`CreateSplitDto`):**
  ```json
  {
    "title": "Party",
    "desc": "Cool party expenses",
    "expenses": [
      {
        "title": "Drinks",
        "desc": "Soda and juice",
        "spender": 1,
        "members": [
          { "user": 1, "paid": 100, "mustPay": 100 },
          { "user": 2, "paid": 0, "mustPay": 50 }
        ]
      }
    ]
  }
  ```
- **Success Response (`201 Created` / `200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `GET /splits/:splitId`
Retrieves detailed information about a split, including all expenses, spenders, and member payment statuses.

- **Access:** `@AuthRequired()`
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
- **Success Response (`200 OK`):**
  ```json
  {
    "id": 12,
    "title": "Party",
    "desc": "Cool party expenses",
    "archived": false,
    "requestsCount": 1,
    "createdAt": "2026-08-11T12:00:00.000Z",
    "expenses": [
      {
        "id": 33,
        "title": "Drinks",
        "desc": "Soda and juice",
        "spender": {
          "id": 1,
          "name": "Valerie",
          "alias": "V",
          "username": "cyberpunk",
          "avatar": "https://storage.ourshub.com/avatars/1.png"
        },
        "members": [
          {
            "user": {
              "id": 2,
              "name": "Johnny",
              "alias": "Silverhand",
              "username": "rockerboy",
              "avatar": null
            },
            "paid": 0,
            "mustPay": 50
          }
        ]
      }
    ]
  }
  ```

---

### `PATCH /splits/:splitId`
Updates the title and/or description of a split and its expenses.

- **Access:** `@AuthRequired()` (Split members or Crew Owner)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
- **Request Body (`UpdateSplitDto`):**
  ```json
  {
    "title": "Updated Party Title",
    "expenses": [
      {
        "id": 33,
        "title": "Beverages & Drinks"
      }
    ]
  }
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `DELETE /splits/:splitId/archive`
Archives an active split.

- **Access:** `@AuthRequired()` (Split members or Crew Owner)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `PUT /splits/:splitId/:expenseId/pay-off`
Records a payment against a member's debt in an expense. Can only be invoked by the expense `spender`.

- **Access:** `@AuthRequired()` (Expense Spender only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
- **Request Body (`Array<PayOffItemDto>`):**
  ```json
  [
    {
      "user": 2,
      "amount": 25.5,
      "msg": "Transferred via Card"
    }
  ]
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `PUT /splits/:splitId/:expenseId/increase`
Increases a member's `mustPay` debt in an expense. Can only be invoked by the expense `spender`.

- **Access:** `@AuthRequired()` (Expense Spender only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
- **Request Body (`Array<IncreaseItemDto>`):**
  ```json
  [
    {
      "user": 2,
      "amount": 10,
      "msg": "Added extra tip share"
    }
  ]
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `GET /splits/:splitId/history`
Returns paginated payment and debt increase audit history for a split. Each history item contains `procByRequest` (`true` if created via an accepted `ExpenseRequest`, `false` if entered manually by spender).

- **Access:** `@AuthRequired()` (Split members or Crew Owner)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
- **Query Parameters (`GetSplitHistoryQueryDto`):**
  - `page` *(number, optional, default: 1)*: Page number.
  - `limit` *(number, optional, default: 10, max: 50)*: Items per page.
  - `q` *(string, optional)*: Search filter by history message (`msg`).
  - `userId` *(number, optional)*: Filter history by target user ID.
- **Success Response (`200 OK`):**
  ```json
  {
    "items": [
      {
        "id": 1,
        "type": "PAY",
        "user": {
          "id": 2,
          "name": "Johnny",
          "alias": "Silverhand",
          "username": "rockerboy",
          "avatar": null
        },
        "amount": 25.5,
        "expenseTitle": "Beverages & Drinks",
        "splitTitle": "Updated Party Title",
        "msg": "Transferred via Card",
        "procByRequest": true,
        "createdAt": "2026-08-11T12:30:00.000Z"
      }
    ],
    "meta": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
  ```

---

### `POST /splits/:splitId/add-expense`
Adds new expenses to an active split.

- **Access:** `@AuthRequired()` (Split members or Crew Owner)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
- **Request Body (`AddExpenseDto` or `Array<CreateSplitExpenseDto>`):**
  ```json
  [
    {
      "title": "Pizza",
      "desc": "2x Large Pepperoni",
      "spender": 1,
      "members": [
        { "user": 1, "paid": 40, "mustPay": 20 },
        { "user": 2, "paid": 0, "mustPay": 20 }
      ]
    }
  ]
  ```
- **Success Response (`201 Created` / `200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `POST /splits/:splitId/:expenseId/add-members`
Adds new members to an existing expense. Can only be invoked by the expense `spender`.

- **Access:** `@AuthRequired()` (Expense Spender only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
- **Request Body (`AddExpenseMembersDto` or `Array<CreateSplitExpenseMemberDto>`):**
  ```json
  [
    {
      "user": 3,
      "paid": 0,
      "mustPay": 20
    }
  ]
  ```
- **Success Response (`201 Created` / `200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `DELETE /splits/:splitId/:expenseId`
Deletes an expense from a split. Minimum 1 expense must remain in the split. Can only be invoked by the expense `spender`.

- **Access:** `@AuthRequired()` (Expense Spender only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```

---

### `DELETE /splits/:splitId/:expenseId/remove-members`
Removes members from an expense. Cannot remove the `spender`. Minimum 2 members must remain in the expense. Can only be invoked by the expense `spender`.

- **Access:** `@AuthRequired()` (Expense Spender only)
- **Path Parameters:**
  - `splitId` *(number, required)*: ID of the split.
  - `expenseId` *(number, required)*: ID of the expense.
- **Request Body (`RemoveExpenseMembersDto` or `Array<number>`):**
  ```json
  [3]
  ```
- **Success Response (`200 OK`):**
  ```json
  {
    "ok": true
  }
  ```
