BEGIN;

-- Практика подпаттернов: пользователь собирает личный набор «активных»
-- подпаттернов (patterns.kind='subpattern'), по которым гоняется карточная
-- practice-сессия и строится страница прогресса.
CREATE TABLE user_practice_patterns (
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    added_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, pattern_id)
);

-- Подсказки ассистента до сих пор логировались без привязки к задаче, из-за
-- чего «сколько подсказок потрачено на задачу» было невосстановимо. Колонка
-- заполняется с этого момента; у старых строк остаётся NULL.
ALTER TABLE ai_request_logs
    ADD COLUMN problem_id BIGINT REFERENCES problems(id) ON DELETE SET NULL;

CREATE INDEX ai_request_logs_hint_count_idx
    ON ai_request_logs (user_id, problem_id)
    WHERE feature = 'assistant_hint' AND status = 'success';

COMMIT;
