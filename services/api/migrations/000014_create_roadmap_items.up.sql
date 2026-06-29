CREATE TABLE IF NOT EXISTS roadmap_items (
    roadmap_code TEXT NOT NULL,
    pattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    position INT NOT NULL,
    PRIMARY KEY (roadmap_code, problem_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS roadmap_items_roadmap_code_position_idx
    ON roadmap_items (roadmap_code, position);
