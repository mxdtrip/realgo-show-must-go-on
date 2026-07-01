BEGIN;

ALTER TABLE extension_events DROP CONSTRAINT extension_events_event_type_check;

UPDATE extension_events
  SET event_type = 'rating_changed'
  WHERE event_type = 'sync_disabled';

-- Вернуть старые значения (примерный откат)
UPDATE extension_events
  SET event_type = 'problem_started'
  WHERE event_type = 'problem_viewed';

ALTER TABLE extension_events
  ADD CONSTRAINT extension_events_event_type_check
  CHECK (event_type IN ('problem_viewed', 'problem_started', 'problem_submitted', 'problem_solved', 'rating_changed'));

COMMIT;
