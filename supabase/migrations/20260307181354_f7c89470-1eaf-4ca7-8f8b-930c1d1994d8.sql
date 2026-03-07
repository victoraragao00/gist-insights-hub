-- Issue #11: Add conversation_id column, backfill, and index

-- Step 1: Add column
ALTER TABLE interactions ADD COLUMN IF NOT EXISTS conversation_id TEXT;

-- Step 2: Backfill from raw_payload
UPDATE interactions
SET conversation_id = raw_payload->>'conversation_id'
WHERE raw_payload->>'conversation_id' IS NOT NULL
  AND conversation_id IS NULL;

-- Step 3: Index for efficient GROUP BY and lookups
CREATE INDEX IF NOT EXISTS idx_interactions_conversation_id
  ON interactions(conversation_id);