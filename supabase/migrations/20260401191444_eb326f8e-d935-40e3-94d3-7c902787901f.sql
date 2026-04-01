ALTER TABLE public.rfis
DROP CONSTRAINT IF EXISTS rfis_demand_id_fkey;

ALTER TABLE public.rfis
ADD CONSTRAINT rfis_demand_id_fkey
FOREIGN KEY (demand_id) REFERENCES public.demands(id)
ON DELETE CASCADE;