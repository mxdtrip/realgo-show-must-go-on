BEGIN;

-- One-time repair: collapse pre-existing duplicate `source` values among
-- global (user_id IS NULL) cards, keeping the oldest row. review_schedules
-- and review_attempts reference cards.id ON DELETE CASCADE, so the newer
-- duplicate is dropped rather than the row existing review history points
-- at. Mirrors the one-time repair already run ad hoc by seed_cards.py's
-- upsert(), generalized here to all sources so the index below can be added.
DELETE FROM cards a
USING cards b
WHERE a.user_id IS NULL AND b.user_id IS NULL
  AND a.source IS NOT NULL AND b.source IS NOT NULL
  AND a.source = b.source
  AND a.id > b.id;

-- Single canonical identity for every global card: seed content
-- (source = "{manifest_code}:{key}") and AI-generated cards
-- (source = "ai:{platform}:{slug}:{type}", see UpsertGeneratedCard) now
-- converge on the same partial unique index. Deliberately keyed on
-- `source`, NOT (problem_id, type): seed manifests may legitimately define
-- 2+ cards of the same type for one problem, each with a distinct key.
CREATE UNIQUE INDEX cards_source_global_unique_idx
    ON cards (source)
    WHERE user_id IS NULL AND source IS NOT NULL;

-- Superseded by cards_source_global_unique_idx now that AI-generated cards
-- carry a `source` too. Keeping both partial unique indexes around would
-- let a prompt-version bump race between them (ON CONFLICT can only target
-- one), so AI card upserts converge on source instead.
DROP INDEX cards_ai_global_unique_idx;

COMMIT;
