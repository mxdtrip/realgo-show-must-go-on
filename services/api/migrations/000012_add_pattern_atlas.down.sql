BEGIN;

-- Cards created with the new subpattern-centric types cannot survive the
-- restored constraint.
DELETE FROM cards WHERE type IN ('recognition', 'invariant', 'skeleton', 'contrast', 'pitfall', 'debugging');
ALTER TABLE cards DROP CONSTRAINT cards_type_check;
ALTER TABLE cards ADD CONSTRAINT cards_type_check CHECK (
    type IN ('pattern_recognition', 'algorithm_mechanics', 'edge_case')
);

DROP TABLE company_problems;
DROP TABLE subpattern_companies;
DROP TABLE companies;
DROP TABLE problem_subpatterns;
DROP TABLE pattern_learning_materials;
DROP TABLE subpattern_prerequisites;
DROP TABLE pattern_family_subpatterns;

-- Remove nodes that exist only because of the taxonomy (tools, subpatterns,
-- families introduced by 000011). Cascades take attached cards/reviews with
-- them — acceptable for a rollback.
DELETE FROM patterns
WHERE taxonomy_version = 'realgo-v1'
  AND (
    kind IN ('tool', 'subpattern')
    OR code IN (
        'prefix_cumulative', 'topological_ordering', 'union_find', 'shortest_paths',
        'matrix_grid', 'cyclic_placement', 'divide_conquer'
    )
  );

-- Downgrade upgraded roadmap groupings back to plain patterns and restore
-- their pre-taxonomy names.
UPDATE patterns SET name = 'Arrays & Hashing' WHERE code = 'arrays_hashing' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET name = 'Intervals' WHERE code = 'intervals' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET name = 'Stack' WHERE code = 'stack' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET name = 'Heap' WHERE code = 'heap' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET name = 'Linked List' WHERE code = 'linked_list' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET name = 'Trees' WHERE code = 'trees' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET name = 'Graphs' WHERE code = 'graphs' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET name = 'Tries' WHERE code = 'tries' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET name = 'Backtracking' WHERE code = 'backtracking' AND taxonomy_version = 'realgo-v1';
UPDATE patterns SET kind = 'pattern', taxonomy_version = NULL, position = NULL
WHERE taxonomy_version = 'realgo-v1';

ALTER TABLE patterns DROP CONSTRAINT patterns_kind_check;
ALTER TABLE patterns
    DROP COLUMN kind,
    DROP COLUMN taxonomy_version,
    DROP COLUMN position;

DROP TABLE taxonomy_versions;

COMMIT;
