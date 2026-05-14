CREATE INDEX IF NOT EXISTS idx_user_client_access_user_id ON public.user_client_access(user_id);
CREATE INDEX IF NOT EXISTS idx_user_client_access_client_id ON public.user_client_access(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_client_access_unique ON public.user_client_access(user_id, client_id);