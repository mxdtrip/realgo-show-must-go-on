ALTER TABLE review_schedules
    ADD COLUMN state SMALLINT NOT NULL DEFAULT 0,
    ADD COLUMN lapses INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN last_review_at TIMESTAMP WITH TIME ZONE,
    ADD COLUMN remaining_steps INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN review_schedules.state IS 'FSRS card state: 0=New, 1=Learning, 2=Review, 3=Relearning';
COMMENT ON COLUMN review_schedules.lapses IS 'Number of times the card has been forgotten (FSRS Card.Lapses).';
COMMENT ON COLUMN review_schedules.last_review_at IS 'Timestamp of the last review (FSRS Card.LastReview).';
COMMENT ON COLUMN review_schedules.remaining_steps IS 'Remaining learning/relearning steps (FSRS Card.RemainingSteps).';
