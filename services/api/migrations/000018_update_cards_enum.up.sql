BEGIN;

-- Обновить values в соответствии с контрактом
UPDATE cards
  SET type = 'pattern_recognition'
  WHERE type = 'concept';

-- Удалить старый constraint (если есть)
ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_type_check;

-- Добавить новый constraint
ALTER TABLE cards
  ADD CONSTRAINT cards_type_check
  CHECK (type IN ('pattern_recognition', 'algorithm_mechanics', 'edge_case'));

COMMIT;
