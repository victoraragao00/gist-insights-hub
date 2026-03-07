-- Step 3: Create new pending classify_batch job (no created_by so automated policies apply)
INSERT INTO sync_jobs (type, status, payload, progress)
VALUES ('classify_batch', 'pending', '{}', '{}');