# AGENTS.md

## General Rules

- Always inspect the existing code before making changes.
- Follow existing project patterns and conventions.
- Prefer simple solutions over complex ones.
- Do not over-engineer.
- Do not create abstractions without a clear need.
- Do not refactor unrelated code.
- Keep changes minimal and focused.
- Do not change existing behavior unless explicitly requested.

## TypeScript

- Use strict typing.
- Avoid `any`.
- Avoid unnecessary type assertions.
- Reuse existing types instead of creating duplicates.
- Prefer type inference when the type is obvious.
- Keep types close to their usage when appropriate.
- Don't use magic strings

## Code Quality

- Write readable and maintainable code.
- Keep functions small and focused.
- Avoid deeply nested logic.
- Prefer early returns.
- Avoid duplicated logic.
- Remove unused code.
- Do not leave dead code or commented-out old implementations.

## Project Consistency

- Match the existing code style.
- Do not introduce new patterns without a reason.
- Do not add unnecessary dependencies.
- Do not change formatting manually.
- Follow existing naming conventions.

## Error Handling

- Handle errors explicitly.
- Do not silently ignore errors.
- Do not hide problems with workarounds.
- Fix the root cause instead of adding temporary patches.

The API must always return errors in a unified format:

```json
{
	"error_code": "SOME_ERROR"
}
```

### Rules

- Never expose validation details, stack traces, or internal exception messages.
- DTO validation failures must always return:
  ```json
  {
  	"error_code": "BAD_REQUEST"
  }
  ```
- Field-level validation is the responsibility of the client. The server should not indicate which field is invalid or why.
- Business logic errors should throw the appropriate application exception with the corresponding `error_code`.
- If a specific error code already exists for the situation, use it instead of `BAD_REQUEST`.
- Every error response must contain only the `error_code` field unless explicitly specified otherwise.

### Example

```ts
if (!user) {
	throw new NotFoundException({
		error_code: "USER_NOT_FOUND",
	});
}

if (!group) {
	throw new NotFoundException({
		error_code: "GROUP_NOT_FOUND",
	});
}
```

DTO validation example:

```json
{
	"error_code": "BAD_REQUEST"
}
```

## Comments

- Avoid comments that only describe obvious code.
- Add comments only when explaining non-obvious decisions or complex logic.

## Changes

Before creating new code:

- Check if similar functionality already exists.
- Reuse existing utilities and components when possible.
- Place code in the appropriate location.

When modifying existing code:

- Understand how the current implementation works first.
- Avoid unnecessary rewrites.
- Preserve existing behavior.

## Refactoring

- Refactor only when it improves the current task.
- Do not rewrite working code without a clear reason.
- Do not optimize prematurely.

## AI Behavior

- Do not make assumptions about missing requirements.
- Ask for clarification when the expected behavior is unclear.
- Explain important architectural decisions before making large changes.
- After changes, summarize what was modified.
- Mention potential issues or things that need verification.

## Priority

The priority order is:

1. Correctness
2. Maintainability
3. Simplicity
4. Performance optimization
5. Code style improvements
