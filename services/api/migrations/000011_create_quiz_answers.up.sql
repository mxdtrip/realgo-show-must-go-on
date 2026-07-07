BEGIN;

-- Запись ответа пользователя на вопрос викторины. Таблица двойного назначения:
--   1) источник правды «ответил ли пользователь» для защиты от накрутки
--      (UNIQUE (user_id, question_id) + INSERT ... ON CONFLICT DO NOTHING);
--   2) аудит: selected_option/was_correct фиксируют, что видел пользователь,
--      даже если позже у вопроса изменят correct_option.
CREATE TABLE quiz_answers (
    id              BIGSERIAL    PRIMARY KEY,
    user_id         BIGINT       NOT NULL REFERENCES users(id)          ON DELETE CASCADE,
    question_id     BIGINT       NOT NULL REFERENCES quiz_questions(id) ON DELETE CASCADE,
    selected_option INTEGER      NOT NULL,
    was_correct     BOOLEAN      NOT NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT quiz_answers_user_question_unique UNIQUE (user_id, question_id)
);

COMMENT ON COLUMN quiz_answers.selected_option IS 'Индекс выбранного пользователем варианта (0-based).';
COMMENT ON COLUMN quiz_answers.was_correct     IS 'Совпал ли selected_option с quiz_questions.correct_option в момент ответа.';

COMMIT;
