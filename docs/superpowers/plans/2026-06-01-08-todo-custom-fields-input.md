# Plan 08 — To-Do custom fields & NLP quick-add input

**Goal:** Ship the mockup-aligned To-Do input experience: NLP quick-add with live preview, conversational clarify, cold-start estimate modal, triangulation control, and user-defined custom fields.

**Delivered:**
- `src/lib/tasks/` — `estimate-stops`, `triangulation`, `quick-add-map`, `estimate-task`
- APIs: `POST /api/tasks/quick-add`, `GET|POST /api/tasks/fields`, `PUT /api/tasks/fields/values`, updated `POST /api/tasks/estimate`
- UI: `QuickAddBar`, `QuickAddPreview`, `ClarifyOverlay`, `EstimateModal`, `TriangulationControl`, `CustomFieldsSection`, `FieldDefComposer`
- Hooks: `useTaskFields`; extended `useTasks` with `setTriangulation`
- Tasks page rebuilt around `QuickAddBar` (replaces generic UniversalInput for task entry)
