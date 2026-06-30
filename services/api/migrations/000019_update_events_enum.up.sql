BEGIN;

-- Привести к контракту
UPDATE extension_events
  SET event_type = 'problem_viewed'
  WHERE event_type = 'problem_started';

-- Удалить старый constraint (если есть)
ALTER TABLE extension_events DROP CONSTRAINT IF EXISTS extension_events_event_type_check;

-- Добавить новый constraint
ALTER TABLE extension_events
  ADD CONSTRAINT extension_events_event_type_check
  CHECK (event_type IN ('problem_viewed', 'problem_submitted', 'problem_solved', 'rating_changed', 'sync_disabled'));

COMMIT;
