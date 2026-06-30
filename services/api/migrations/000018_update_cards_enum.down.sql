BEGIN;

ALTER TABLE cards DROP CONSTRAINT cards_type_check;

ALTER TABLE cards
  ADD CONSTRAINT cards_type_check
  CHECK (type IN ('problem', 'pattern', 'concept'));

UPDATE cards
  SET type = 'concept'
  WHERE type = 'pattern_recognition';

COMMIT;
