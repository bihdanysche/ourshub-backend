# AGENTS.md

Instructions for any AI agent (Claude, Copilot, Cursor, etc.) working on this NestJS backend.
The agent must follow these rules when reading, generating, or refactoring code.

---

## 0. Before writing any code

The agent must study the current architecture first — never generate code from a generic
mental template.

1. Browse `src/modules` to see which modules already exist and how they're organized.
2. Open 2–3 modules similar to the task at hand and study:
   - file naming (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `*.dto.ts`, `*.entity.ts`, `*.enum.ts`, etc.);
   - how DTOs and validation are written (`class-validator` / `class-transformer`);
   - how the module is registered in `AppModule` or a parent module;
   - where error enums live and how they're named;
   - how dependency injection and providers are structured (interfaces, tokens, custom providers).
3. Only then implement the change. New code must be indistinguishable in style from existing code.

If the architecture is unclear or the codebase has inconsistent examples, the agent must say so
explicitly and pick the most recent/dominant pattern rather than inventing a new one.

---

## 1. Project overview & tech stack

- Framework: NestJS newest
- Language: TypeScript
- ORM / DB layer: Prisma
- Database: PostgreSQL
- Package manager: bun

Agents should not assume a stack detail (e.g. which ORM) — verify it by inspecting
`package.json` and existing module code before writing anything that depends on it.

---

## 2. Module structure

All business entities live under `src/modules/<module-name>/`.

Typical module layout:

```
src/modules/<module-name>/
  ├── <module-name>.module.ts
  ├── <module-name>.controller.ts
  ├── <module-name>.service.ts
  ├── dto/
  │     ├── create-<module-name>.dto.ts
  │     └── update-<module-name>.dto.ts
  ├── entities/            (or schemas/, depending on the ORM)
  │     └── <module-name>.entity.ts
  └── enums/
        └── <module-name>-error.enum.ts
```

Rules:

- One module = one bounded business domain. Do not mix unrelated domains in one module.
- No business logic in controllers. Controllers only accept the request, validate input via
  DTOs, and call the service.
- All logic lives in services. If a service grows too large, split it into sub-services
  instead of letting one file balloon.
- Shared code (guards, interceptors, decorators, pipes, filters, common DTOs) goes into
  `src/common/`, not copy-pasted across modules.
- Cross-module communication happens through exported providers/services, not by reaching
  into another module's internals or database models directly.

---

## 3. Error handling

### 3.1 Format

All errors are thrown as standard Nest exceptions (`UnauthorizedException`,
`BadRequestException`, `NotFoundException`, `ForbiddenException`, `ConflictException`, etc.)
with a body shaped like this:

```typescript
throw new UnauthorizedException({
  error_code: AuthErrorCode.INVALID_TELEGRAM_ID_TOKEN,
});
```

Never throw an exception with a free-text message instead of `error_code`, and never return a
raw object/string as an error.

### 3.2 Error enums

- Each module has its own error enum: `<Module>ErrorCode`, e.g. `AuthErrorCode`,
  `UserErrorCode`, `PaymentErrorCode`.
- Located at `src/modules/<module-name>/enums/<module-name>-error.enum.ts`.
- Errors that aren't tied to a specific module (e.g. `VALIDATION_ERROR`, `INTERNAL_ERROR`,
  `NOT_FOUND`) go into `CommonErrorCode` at `src/common/enums/common-error.enum.ts`.

Example:

```typescript
export enum AuthErrorCode {
  INVALID_TELEGRAM_ID_TOKEN = 'INVALID_TELEGRAM_ID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
}
```

Rules:

- Enum values are `SCREAMING_SNAKE_CASE` and match the key name (keeps the JSON readable).
- Before adding a new error code, check whether one already exists in `CommonErrorCode` or in
  the current module's enum. Don't create duplicates with different names for the same case.
- One error code = one specific cause. Don't collapse distinct failures into a generic
  `SOMETHING_WENT_WRONG` when the real reason is known.
- Use the exception class that matches the situation (`NotFoundException`, `ConflictException`,
  `ForbiddenException`, etc.) — don't wrap everything in `BadRequestException`.
- There should be a single global exception filter that ensures every error response
  (including unhandled ones) is normalized to the same `{ error_code, ... }` shape, so the
  frontend never receives an inconsistent error format.

---

## 4. Success response format

If a handler has nothing meaningful to return (e.g. `delete`, `logout`, `markAsRead`), it must
return:

```typescript
return { ok: true };
```

Not `void`, not `null`, not `undefined`, not an empty `{}`.

If a handler does return data, it returns the actual DTO/entity (or the project's standard
response wrapper, if one exists) — not `{ ok: true }` layered on top of real data.

If the project uses a global response-transform interceptor, new endpoints must go through it
too, not bypass it with a custom shape.

---

## 5. No hardcoding

- No magic strings/numbers/ids in code — use named constants, enums, or config values.
- No hardcoded URLs, tokens, secrets, API keys, chat/user ids, etc.
- Anything that differs between environments (dev/stage/prod) must come from `ConfigService`
  / `.env`, never be inlined.
- Env variables must be validated on startup (e.g. via a Joi/zod schema or Nest's
  `ConfigModule` validation) rather than read ad-hoc with `process.env.X` scattered around
  the codebase.
- User-facing message strings (if needed beyond `error_code`) belong in a dedicated
  constants/i18n layer, not inline in business logic.

---

## 6. General code quality

- Match the existing project style exactly (naming, formatting, import order) — treat
  neighboring files as the source of truth, not general TypeScript conventions.
- Strict typing: avoid `any` unless truly unavoidable, no `@ts-ignore`/`@ts-expect-error`
  without a comment explaining why.
- Input validation via DTOs + `class-validator`/`class-transformer`, never manual checks
  buried in a service.
- Don't duplicate logic — if similar code exists elsewhere, extract it into `common` or a
  shared service instead of copy-pasting.
- Naming conventions:
  - Classes (modules, services, controllers) — `PascalCase`; files — `kebab-case`.
  - Error enums — `<Module>ErrorCode`.
  - DTOs — `CreateXDto`, `UpdateXDto`, `XResponseDto`.
  - Interfaces — no Hungarian `I` prefix unless the project already uses one.
- Keep dependency injection explicit — inject via constructor, avoid manual instantiation
  (`new SomeService()`).
- Async code: always `async/await`, no mixing with raw `.then()` chains; every promise is
  awaited or explicitly handled (no floating promises — enable/respect
  `@typescript-eslint/no-floating-promises`).
- No redundant, unnecessary, or obvious code comments — write clean, self-explanatory code
  without narrative line-by-line commentary.

---

## 7. Database & migrations

- Never edit the database schema by hand in production — all schema changes go through
  migrations generated by the project's ORM/migration tool.
- Never write raw SQL in a service when the ORM's query builder/repository API covers the
  case — raw queries are a deliberate exception, not a default.
- Every migration must be reversible (`up`/`down`) unless there's a documented reason it
  can't be.
- Do not put business logic inside database entities/models beyond simple computed getters.

---

## 8. API contracts & documentation

- Every new/changed endpoint must be reflected in Swagger/OpenAPI decorators
  (`@ApiOperation`, `@ApiResponse`, `@ApiProperty` on DTOs, etc.) if the project uses
  `@nestjs/swagger`.
- DTOs are the single source of truth for the request/response shape — don't return raw
  ORM entities directly if the project has a convention of mapping to response DTOs.
- Breaking changes to an existing endpoint's contract must be called out explicitly, not
  silently shipped.

---

## 9. Security

- Never log secrets, tokens, passwords, or full PII (mask/redact before logging).
- Every endpoint must have an explicit auth/guard decision — either it's protected by a
  guard, or it's deliberately public (and that should be obvious from the code, e.g.
  `@Public()` decorator if the project has one), never "protected by omission."
- Validate and sanitize all external input — never trust client-supplied IDs, roles, or
  flags without checking ownership/permissions server-side.
- Use parameterized queries / the ORM's escaping — never string-concatenate user input into
  a query.
- Rate-limit or guard sensitive endpoints (auth, password reset, etc.) if the project has a
  throttling module — reuse it, don't reinvent it per module.

---

## 10. Logging & observability

- Use the project's existing logger (Nest's `Logger`, or a wrapped logger like `pino`/`winston`
  if one is configured) — no stray `console.log`.
- Log at the right level: `error` for failures that need attention, `warn` for recoverable
  issues, `log`/`info` for normal flow, `debug` for verbose diagnostics.
- Include enough context in logs (module, method, relevant id) to trace an issue, but never
  log full request bodies containing sensitive data.

---

## 11. Testing

- New business logic in services should be covered by unit tests (`*.spec.ts`), following
  the existing test structure/mocking style in the project.
- Critical flows (auth, payments, etc.) should have e2e coverage if the project already has
  an e2e test setup (`test/*.e2e-spec.ts`).
- Don't delete or weaken existing tests to make a change pass — fix the underlying issue.
- Mock external services/APIs in tests; never call real third-party services from tests.

---

## 12. Git & workflow conventions

- Commit messages follow the project's existing convention (e.g. Conventional Commits:
  `feat:`, `fix:`, `refactor:`, `chore:`) if one is already in use — check recent `git log`.
- One logical change per commit/PR where practical; don't bundle unrelated refactors with a
  feature.
- Don't reformat/touch unrelated files "in passing" — keep diffs focused and reviewable.
- Run lint/typecheck/tests locally (or via the project's scripts, e.g. `npm run lint`,
  `npm run test`, `npm run build`) before considering a task done.

---

## 13. Things the agent must never do

- Never invent an architecture pattern not already present in the codebase without flagging
  it as a new pattern and explaining why.
- Never silently swallow errors (empty `catch {}`) — either handle, rethrow with an
  `error_code`, or log and rethrow.
- Never bypass DTO validation "just for this one endpoint."
- Never commit secrets, `.env` files, or credentials.
- Never introduce a new dependency without checking if an equivalent one is already used in
  the project.
- Never leave unnecessary, obvious, or verbose code comments.

---

## 14. Pre-submit checklist

- [ ] I studied existing modules in `src/modules` before writing code.
- [ ] Errors are thrown via `HttpException` subclasses with `{ error_code }`, using an
      existing or newly added `<Module>ErrorCode` / `CommonErrorCode`.
- [ ] Empty responses return `{ ok: true }`.
- [ ] No hardcoded strings, numbers, ids, URLs, or secrets.
- [ ] File/folder structure and style match the rest of the project.
- [ ] Any new error enum doesn't duplicate an existing code.
- [ ] New/changed endpoints have Swagger decorators and DTOs.
- [ ] Sensitive data isn't logged.
- [ ] Relevant tests were added or updated.
- [ ] Lint, typecheck, and tests pass locally.
