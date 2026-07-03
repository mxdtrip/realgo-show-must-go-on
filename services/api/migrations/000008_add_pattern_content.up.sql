ALTER TABLE patterns
  ADD COLUMN IF NOT EXISTS techniques           TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS recognition_symptoms TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS checklist            TEXT[] NOT NULL DEFAULT '{}';
