---
paths:
  - 'app/Http/Controllers/**'
---

# Controllers

## Controllers validate, authorize, call one class, respond
A controller action validates through a Form Request (no inline $request->validate()), authorizes, calls one class under app/Support (a page, query or action class beside its domain) and returns the response. No queries beyond a simple findOrFail, no private helper methods, no traits in app/Http/Concerns. Keep each controller under 250 lines (ControllerValidationConventionTest enforces this).
