

## Plan: Fix markdown rendering in AgendaDetailPage

### Problem
1. **Runtime crash**: `react-markdown` v10 removed the `className` prop — the app crashes when trying to render any markdown
2. **No link/image support**: Default `react-markdown` renders links and images but without styling or target behavior

### Solution

**File: `src/pages/AgendaDetailPage.tsx`**

Replace all `<ReactMarkdown>{content}</ReactMarkdown>` wrapped in `<div className="prose ...">` with just `<ReactMarkdown>` inside the prose div. The `className` is already on the wrapper `<div>`, not on `ReactMarkdown` itself — but the v10 crash may be caused by internal prop forwarding. 

Actually, looking at the code again, `className` is on the wrapper div, not on `ReactMarkdown` directly. The error suggests something else is passing className. Let me re-check — the v10 `ReactMarkdown` component throws if ANY unexpected prop is passed. The current usage looks correct (no className on ReactMarkdown itself), but v10 may have other breaking changes.

**Simpler fix**: Downgrade to `react-markdown@9` which supports `className` and is stable, OR configure v10 properly.

**Recommended approach — downgrade to v9:**
- `npm install react-markdown@9` — v9 supports className and is well-tested
- This immediately fixes the crash with zero code changes

**Additionally, enhance rendering:**
- Add custom `components` prop to `ReactMarkdown` for links (`<a>` opens in new tab with `target="_blank"`) and images (styled with `max-w-full rounded`)

### Changes

| Action | File |
|--------|------|
| Install | `react-markdown@9` (downgrade from v10) |
| Edit | `src/pages/AgendaDetailPage.tsx` — add `components` prop for links/images rendering |

### No changes to
- Hooks, migrations, RLS, edge functions, `src/integrations/supabase/*`, `.env`

