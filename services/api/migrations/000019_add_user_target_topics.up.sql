-- Persist onboarding topics selected by the user. snake_case codes are the
-- canonical form (e.g. "two_pointers"); the API normalises dashes on write.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS target_topics TEXT[] NOT NULL DEFAULT '{}';
