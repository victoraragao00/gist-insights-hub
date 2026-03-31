
CREATE OR REPLACE FUNCTION public.generate_rfi_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  seq bigint;
BEGIN
  seq := nextval('rfi_number_seq');
  NEW.rfi_seq_number := seq;
  NEW.rfi_number := 'RFI-' || lpad(seq::text, 4, '0');
  RETURN NEW;
END;
$$;
