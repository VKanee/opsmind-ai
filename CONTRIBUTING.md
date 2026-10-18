# Contributing

## Workflow

1. Create a branch from `main`.
2. Keep changes scoped to one behavior.
3. Add tests for policy, retrieval, access control, or lifecycle changes.
4. Run the full validation suite.
5. Open a pull request with validation evidence and risk notes.

## Local Validation

```powershell
.\scripts\test.ps1
```

## Engineering Rules

- Enforce authorization on the server.
- Do not let model output bypass deterministic policy.
- Cite retrieved evidence for AI claims.
- Keep approval and audit transitions transactional.
- Treat knowledge documents and model output as untrusted input.
- Do not commit secrets, customer data, or provider keys.
