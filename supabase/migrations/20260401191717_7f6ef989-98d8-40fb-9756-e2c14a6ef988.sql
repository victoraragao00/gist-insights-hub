ALTER TABLE public.meeting_homework_items
DROP CONSTRAINT IF EXISTS meeting_homework_items_converted_to_demand_id_fkey;

ALTER TABLE public.meeting_homework_items
ADD CONSTRAINT meeting_homework_items_converted_to_demand_id_fkey
FOREIGN KEY (converted_to_demand_id) REFERENCES public.demands(id)
ON DELETE SET NULL;