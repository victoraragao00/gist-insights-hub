

## Fix: Gist Card Layout

The Gist card is cramped — it's constrained to the same 1-column width as the "Em breve" cards, but it contains 4 action buttons in a 2x2 grid. The button text gets truncated.

**Change in `src/pages/SettingsPage.tsx`:**

- Make the Gist card span 2 columns (`sm:col-span-2`) when connected, giving the buttons enough room
- Keep single column span when disconnected (same size as other cards)
- This matches the visual weight — connected cards with actions deserve more space

Single edit, ~1 line change on line 121.

