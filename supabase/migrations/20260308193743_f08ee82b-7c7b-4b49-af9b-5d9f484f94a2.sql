
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN status TEXT NOT NULL DEFAULT 'ativo';

    ALTER TABLE public.clients
      ADD CONSTRAINT clients_status_check
      CHECK (status IN ('ativo', 'inativo', 'trial'));

    -- Popular baseado no active atual
    UPDATE public.clients
    SET status = CASE
      WHEN active = true THEN 'ativo'
      WHEN active = false THEN 'inativo'
      ELSE 'ativo'
    END;
  END IF;
END $$;
