-- Promover admins em user_profiles
UPDATE public.user_profiles
SET global_role = 'admin', updated_at = now()
WHERE email IN (
  'joao.risoleo@umode.com.br',
  'juliana.ferre@umode.com.br',
  'victor.aragao@umode.com.br'
);