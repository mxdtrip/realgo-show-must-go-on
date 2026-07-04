ALTER TABLE patterns
  DROP COLUMN IF EXISTS techniques,
  DROP COLUMN IF EXISTS recognition_symptoms,
  DROP COLUMN IF EXISTS checklist;
