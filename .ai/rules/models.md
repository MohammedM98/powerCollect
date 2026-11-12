---
paths:
  - 'app/Models/**'
---

# Models

## Models hold data and invariants; operations live in app/Support
Models keep columns, casts, scopes, relations and invariants only. Money and reading operations live in one class per operation under app/Support/Ledger (RecordPayment, CancelLine, TransactionActions...) and app/Support/Readings (ApproveReading, RepriceReading...). Read across branches only with ->acrossBranches(), never withoutGlobalScope(); check permissions with hasPermission(), not the starter role.
