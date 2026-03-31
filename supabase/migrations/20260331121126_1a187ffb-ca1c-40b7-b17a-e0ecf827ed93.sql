ALTER TABLE public.demand_watchers
  ADD CONSTRAINT demand_watchers_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES public.user_profiles(id) ON DELETE CASCADE;