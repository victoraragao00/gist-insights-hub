

# Add Bulk Action Bar to Wizard Step 1

**File:** `src/components/GistContactWizard.tsx` (only)

## Change

Insert a bulk action bar between line 383 (`<>`) and line 384 (`<div className="space-y-3">`) with:

```text
┌──────────────────────────────────────────────────────┐
│  "42 domínios"          [Aplicar a todos: ▼ ]        │
└──────────────────────────────────────────────────────┘
```

**Select options:**
- **Ignorar todos** — sets all groups to `type: "ignore"`
- **Vincular todos (com match)** — sets groups WITH `suggested_client_id` to `type: "existing"` + their suggested ID; groups WITHOUT a match stay `type: "ignore"`
- **Criar todos** — sets all groups to `type: "new"` with `new_client_name` from `group.company ?? group.domain`

**Implementation:**
- Add a `handleBulkAction` function that loops through `discoveryData.contact_groups` and calls `updateMapping` for each
- The Select is uncontrolled (no persisted value) — it acts as a trigger, resets after applying
- "Vincular todos" explicitly skips groups without `suggested_client_id`, leaving them as `ignore`

No other files touched. No logic changes to existing functions.

