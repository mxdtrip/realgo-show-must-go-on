BEGIN;

-- One-time repair: collapse duplicate global source identities without
-- cascading away review history. Each duplicate is merged into the oldest
-- card sequentially, so 3+ duplicates converge safely as well.
DO $$
DECLARE
    duplicate_card RECORD;
BEGIN
    FOR duplicate_card IN
        SELECT c.id AS duplicate_id, canonical.canonical_id
        FROM cards c
        JOIN LATERAL (
            SELECT MIN(c2.id) AS canonical_id
            FROM cards c2
            WHERE c2.user_id IS NULL AND c2.source = c.source
        ) canonical ON TRUE
        WHERE c.user_id IS NULL
          AND c.source IS NOT NULL
          AND c.id > canonical.canonical_id
        ORDER BY c.id
    LOOP
        -- Attempts are append-only history and have no uniqueness conflict.
        UPDATE review_attempts
        SET card_id = duplicate_card.canonical_id
        WHERE card_id = duplicate_card.duplicate_id;

        -- If the same user reviewed both copies, preserve the newest FSRS
        -- state while accumulating counters onto the canonical schedule.
        UPDATE review_schedules kept
        SET next_review_at = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.next_review_at ELSE kept.next_review_at END,
            interval_days = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.interval_days ELSE kept.interval_days END,
            ease = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.ease ELSE kept.ease END,
            stability = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.stability ELSE kept.stability END,
            difficulty = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.difficulty ELSE kept.difficulty END,
            last_rating = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.last_rating ELSE kept.last_rating END,
            algorithm = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.algorithm ELSE kept.algorithm END,
            state = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.state ELSE kept.state END,
            remaining_steps = CASE WHEN
                COALESCE(duplicate_rs.last_review_at, duplicate_rs.updated_at, duplicate_rs.created_at)
                > COALESCE(kept.last_review_at, kept.updated_at, kept.created_at)
            THEN duplicate_rs.remaining_steps ELSE kept.remaining_steps END,
            review_count = COALESCE(kept.review_count, 0) + COALESCE(duplicate_rs.review_count, 0),
            lapses = kept.lapses + duplicate_rs.lapses,
            last_review_at = GREATEST(kept.last_review_at, duplicate_rs.last_review_at),
            created_at = LEAST(kept.created_at, duplicate_rs.created_at),
            updated_at = GREATEST(kept.updated_at, duplicate_rs.updated_at)
        FROM review_schedules duplicate_rs
        WHERE duplicate_rs.card_id = duplicate_card.duplicate_id
          AND kept.card_id = duplicate_card.canonical_id
          AND kept.user_id = duplicate_rs.user_id;

        -- Conflicting schedules have now been merged; schedules that exist
        -- only on the duplicate can be moved directly to the canonical card.
        DELETE FROM review_schedules duplicate_rs
        USING review_schedules kept
        WHERE duplicate_rs.card_id = duplicate_card.duplicate_id
          AND kept.card_id = duplicate_card.canonical_id
          AND kept.user_id = duplicate_rs.user_id;

        UPDATE review_schedules
        SET card_id = duplicate_card.canonical_id
        WHERE card_id = duplicate_card.duplicate_id;

        DELETE FROM cards WHERE id = duplicate_card.duplicate_id;
    END LOOP;
END $$;

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
