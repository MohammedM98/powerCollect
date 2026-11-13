---
paths:
  - 'resources/js/**'
---

# Js

## Where styles go: Tailwind, gl- components, page CSS only for print
Tailwind utilities for layout and spacing; the gl- classes in resources/css/components.css for surfaces (panels, fields, buttons, tables). A page .css file only for print sheets or animation Tailwind cannot express. Inline style={{}} only for values computed at runtime (widths, brand colours, chart geometry); a fixed value is a class (use the ! modifier where it must win as an inline style did).

## Forms: Form by default, useForm for live-computed forms, useHttp for JSON
Submit pages and dialogs with Inertia's <Form>. Use useForm only when other UI reads the value before submit (live totals in PaymentModal, SplitPaymentForm) and say why in a comment. JSON helpers use useHttp (never raw fetch), and show failures through AsyncState / httpErrorMessage with a retry.
