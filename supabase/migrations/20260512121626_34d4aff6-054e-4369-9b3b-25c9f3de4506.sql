ALTER TABLE public.blocker_types
  ADD COLUMN IF NOT EXISTS requires_reason boolean NOT NULL DEFAULT false;

INSERT INTO public.blocker_types (name, color, icon, position, active, requires_reason)
SELECT 'Outro', '#6B7280', '✏️', COALESCE((SELECT MAX(position) FROM public.blocker_types), 0) + 1, true, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.blocker_types WHERE lower(name) = 'outro'
);

UPDATE public.blocker_types SET requires_reason = true WHERE lower(name) = 'outro';