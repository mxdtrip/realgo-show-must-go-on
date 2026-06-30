BEGIN;

ALTER TABLE extension_events DROP CONSTRAINT extension_events_event_type_check;

-- Вернуть старые значения (примерный откат)
UPDATE extension_events
  SET event_type = 'problem_started'
  WHERE event_type = 'problem_viewed';

UPDATE extension_events
  SET event_type = 'problem_submitted'
  WHERE event_type = 'problem_solved';

COMMIT;
