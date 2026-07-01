BEGIN;

-- Удалить старые constraints, привязанные к прежней семантике type.
ALTER TABLE cards
  DROP CONSTRAINT IF EXISTS cards_type_check,
  DROP CONSTRAINT IF EXISTS card_type_target_check;

-- Обновить values в соответствии с контрактом.
-- Старые значения описывали source target, новые — тип учебной карточки.
UPDATE cards
  SET type = CASE
    WHEN type IN ('concept', 'pattern') THEN 'pattern_recognition'
    WHEN type = 'problem' THEN 'algorithm_mechanics'
    ELSE type
  END
  WHERE type IN ('concept', 'pattern', 'problem');

-- Добавить новый constraint.
ALTER TABLE cards
  ADD CONSTRAINT cards_type_check
  CHECK (type IN ('pattern_recognition', 'algorithm_mechanics', 'edge_case'));

COMMIT;
