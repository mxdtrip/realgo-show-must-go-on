BEGIN;

-- Pattern Atlas: Realgo Taxonomy v1.
--
-- The taxonomy (tools -> pattern families -> subpatterns) is versioned
-- reference data, so it lives in a migration like the base catalog in
-- 000002. The tree the UI shows is derived from explicit many-to-many
-- edge tables, NOT from patterns.parent_id: a subpattern may belong to
-- several families, depend on several tools, and a problem may practice
-- several subpatterns.
--
-- Taxonomy nodes reuse the existing `patterns` table (discriminated by
-- `kind`) so that cards.pattern_id, review_schedules.pattern_id and
-- review_attempts.pattern_id keep working for subpatterns without any
-- change to the spaced-repetition queue.

CREATE TABLE taxonomy_versions (
    code TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO taxonomy_versions (code, title) VALUES
    ('realgo-v1', 'Realgo Taxonomy v1');

ALTER TABLE patterns
    ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'pattern',
    ADD COLUMN taxonomy_version TEXT REFERENCES taxonomy_versions(code) ON DELETE SET NULL,
    ADD COLUMN position INTEGER;

ALTER TABLE patterns
    ADD CONSTRAINT patterns_kind_check
    CHECK (kind IN ('pattern', 'tool', 'family', 'subpattern'));

COMMENT ON COLUMN patterns.kind IS 'Node role: pattern=legacy roadmap grouping, tool=prerequisite, family=pattern family, subpattern=learning unit.';
COMMENT ON COLUMN patterns.taxonomy_version IS 'Taxonomy release this node belongs to (NULL for legacy nodes outside the taxonomy).';
COMMENT ON COLUMN patterns.position IS 'Display order inside its kind for taxonomy nodes.';

-- ---------------------------------------------------------------------------
-- Nodes: 13 tools, 22 pattern families, 72 subpatterns.
-- Families that already exist as roadmap groupings are upgraded in place
-- (same code/id) so previously attached cards, reviews and methodology
-- content stay linked. seed_roadmap.py preserves names of taxonomy nodes.
-- ---------------------------------------------------------------------------

WITH nodes(code, name, kind, position) AS (
    VALUES
    -- Tools / prerequisites (13)
    ('tool_arrays',       'Arrays',               'tool', 1),
    ('tool_hash_map',     'Hash Map',             'tool', 2),
    ('tool_set',          'Set',                  'tool', 3),
    ('tool_stack',        'Stack',                'tool', 4),
    ('tool_queue',        'Queue',                'tool', 5),
    ('tool_deque',        'Deque',                'tool', 6),
    ('tool_heap',         'Heap / Priority Queue','tool', 7),
    ('tool_linked_list',  'Linked List',          'tool', 8),
    ('tool_trees',        'Trees',                'tool', 9),
    ('tool_graphs',       'Graphs',               'tool', 10),
    ('tool_recursion',    'Recursion',            'tool', 11),
    ('tool_sorting',      'Sorting',              'tool', 12),
    ('tool_complexity',   'Complexity / Big-O',   'tool', 13),

    -- Pattern families (22)
    ('arrays_hashing',       'Hashing / Frequency',              'family', 1),
    ('two_pointers',         'Two Pointers',                     'family', 2),
    ('sliding_window',       'Sliding Window',                   'family', 3),
    ('prefix_cumulative',    'Prefix & Cumulative State',        'family', 4),
    ('binary_search',        'Binary Search',                    'family', 5),
    ('intervals',            'Intervals & Sweep',                'family', 6),
    ('stack',                'Stack & Monotonic Structures',     'family', 7),
    ('heap',                 'Heap / Priority Queue',            'family', 8),
    ('linked_list',          'Linked List Techniques',           'family', 9),
    ('trees',                'Tree Traversal & Structure',       'family', 10),
    ('graphs',               'Graph Traversal',                  'family', 11),
    ('topological_ordering', 'Topological Ordering',             'family', 12),
    ('union_find',           'Union Find / Connectivity',        'family', 13),
    ('shortest_paths',       'Shortest Paths',                   'family', 14),
    ('backtracking',         'Backtracking & Search',            'family', 15),
    ('greedy',               'Greedy',                           'family', 16),
    ('dynamic_programming',  'Dynamic Programming',              'family', 17),
    ('tries',                'Trie & String Search',             'family', 18),
    ('bit_manipulation',     'Bit Manipulation',                 'family', 19),
    ('matrix_grid',          'Matrix & Grid',                    'family', 20),
    ('cyclic_placement',     'Cyclic Placement / Index Mapping', 'family', 21),
    ('divide_conquer',       'Divide & Conquer / Selection',     'family', 22),

    -- Subpatterns (72)
    ('frequency_map_counting',          'Frequency Map / Counting',                       'subpattern', 1),
    ('membership_deduplication',        'Membership & Deduplication',                     'subpattern', 2),
    ('complement_lookup',               'Complement Lookup / Pair Mapping',               'subpattern', 3),
    ('opposite_direction_pointers',     'Opposite-Direction Pointers',                    'subpattern', 4),
    ('same_direction_read_write',       'Same-Direction Read/Write',                      'subpattern', 5),
    ('fast_slow_pointers',              'Fast & Slow Pointers',                           'subpattern', 6),
    ('fixed_size_window',               'Fixed-Size Window',                              'subpattern', 7),
    ('longest_valid_window',            'Longest Valid Variable Window',                  'subpattern', 8),
    ('shortest_valid_window',           'Shortest Valid Variable Window',                 'subpattern', 9),
    ('frequency_coverage_window',       'Frequency / Coverage Window',                    'subpattern', 10),
    ('prefix_sum_range_query',          '1D Prefix Sum / Range Query',                    'subpattern', 11),
    ('prefix_balance_hashmap',          'Prefix Balance + Hash Map',                      'subpattern', 12),
    ('difference_array',                'Difference Array / Range Updates',               'subpattern', 13),
    ('exact_search_monotone',           'Exact Search on Monotone Space',                 'subpattern', 14),
    ('lower_upper_bound',               'Lower / Upper Bound',                            'subpattern', 15),
    ('binary_search_on_answer',         'Binary Search on Answer',                        'subpattern', 16),
    ('rotated_peak_search',             'Rotated / Peak / Implicit Sorted Search',        'subpattern', 17),
    ('merge_overlapping_intervals',     'Merge Overlapping Intervals',                    'subpattern', 18),
    ('interval_insertion_intersection', 'Interval Insertion / Intersection',              'subpattern', 19),
    ('sweep_line_event_counting',       'Sweep Line / Event Counting',                    'subpattern', 20),
    ('matching_nesting_stack',          'Matching / Nesting Stack',                       'subpattern', 21),
    ('expression_evaluation_stack',     'Expression / Evaluation Stack',                  'subpattern', 22),
    ('monotonic_stack',                 'Monotonic Stack',                                'subpattern', 23),
    ('monotonic_deque',                 'Monotonic Deque',                                'subpattern', 24),
    ('top_k_bounded_heap',              'Top K / Bounded Heap',                           'subpattern', 25),
    ('two_heaps_streaming_median',      'Two Heaps / Streaming Median',                   'subpattern', 26),
    ('k_way_merge_best_first',          'K-way Merge / Best-First Heap',                  'subpattern', 27),
    ('dummy_node_rewiring',             'Dummy Node / Sentinel Rewiring',                 'subpattern', 28),
    ('in_place_reversal',               'In-Place Reversal',                              'subpattern', 29),
    ('merge_split_reconnect',           'Merge / Split / Reconnect Lists',                'subpattern', 30),
    ('dfs_path_subtree_aggregation',    'DFS Path / Subtree Aggregation',                 'subpattern', 31),
    ('bfs_level_order',                 'BFS Level Order',                                'subpattern', 32),
    ('bst_ordering_bounds',             'BST Ordering / Bounds',                          'subpattern', 33),
    ('connected_components_flood_fill', 'Connected Components / Flood Fill',              'subpattern', 34),
    ('cycle_detection_traversal',       'Cycle Detection by Traversal',                   'subpattern', 35),
    ('multi_source_bfs',                'Multi-Source BFS',                               'subpattern', 36),
    ('state_space_graph_search',        'Implicit / State-Space Graph Search',            'subpattern', 37),
    ('kahn_in_degree_bfs',              'Kahn In-Degree BFS',                             'subpattern', 38),
    ('dfs_postorder_toposort',          'DFS Postorder Topological Sort',                 'subpattern', 39),
    ('dependency_scheduling',           'Dependency Scheduling / Feasibility',            'subpattern', 40),
    ('online_connectivity',             'Online Connectivity / Component Merging',        'subpattern', 41),
    ('dsu_cycle_detection',             'Redundant Edge / DSU Cycle Detection',           'subpattern', 42),
    ('kruskal_connectivity',            'Kruskal-Style Connectivity',                     'subpattern', 43),
    ('unweighted_shortest_path_bfs',    'Unweighted Shortest Path BFS',                   'subpattern', 44),
    ('dijkstra_nonnegative',            'Dijkstra for Nonnegative Weights',               'subpattern', 45),
    ('relaxation_based_paths',          'Relaxation-Based Paths: 0-1 BFS / Bellman-Ford', 'subpattern', 46),
    ('subsets_combinations',            'Subsets / Combinations',                         'subpattern', 47),
    ('permutations_used_state',         'Permutations / Used-State',                      'subpattern', 48),
    ('constraint_placement',            'Constraint Placement',                           'subpattern', 49),
    ('path_construction_word_search',   'Path Construction / Word Search',                'subpattern', 50),
    ('sort_then_greedy',                'Sort-Then-Greedy',                               'subpattern', 51),
    ('local_choice_invariant',          'Local Choice with Invariant',                    'subpattern', 52),
    ('greedy_scheduling',               'Greedy Scheduling / Interval Selection',         'subpattern', 53),
    ('dp_1d_linear',                    '1D Linear DP',                                   'subpattern', 54),
    ('dp_2d_grid',                      '2D Grid DP',                                     'subpattern', 55),
    ('dp_01_knapsack',                  '0/1 Knapsack / Subset DP',                       'subpattern', 56),
    ('dp_unbounded_knapsack',           'Unbounded Knapsack / Coin Change',               'subpattern', 57),
    ('dp_sequence_lis_lcs',             'Sequence DP: LIS / LCS',                         'subpattern', 58),
    ('dp_state_machine_interval',       'State-Machine / Interval DP',                    'subpattern', 59),
    ('trie_prefix_search',              'Trie Prefix Search',                             'subpattern', 60),
    ('rolling_hash_rabin_karp',         'Rolling Hash / Rabin-Karp',                      'subpattern', 61),
    ('kmp_prefix_function',             'KMP / Prefix Function',                          'subpattern', 62),
    ('xor_cancellation',                'XOR Cancellation',                               'subpattern', 63),
    ('bitmask_state_enumeration',       'Bitmask State / Enumeration',                    'subpattern', 64),
    ('bit_tricks_submask',              'Bit Tricks / Submask Iteration',                 'subpattern', 65),
    ('directional_traversal_simulation','Directional Traversal / Simulation',             'subpattern', 66),
    ('in_place_transform_boundary',     'In-Place Transform / Boundary Layers',           'subpattern', 67),
    ('cyclic_sort_placement',           'Cyclic Sort / Value-to-Index Placement',         'subpattern', 68),
    ('sign_marking_index_encoding',     'Sign Marking / Index Encoding',                  'subpattern', 69),
    ('merge_sort_divide_conquer',       'Merge-Sort Divide & Conquer',                    'subpattern', 70),
    ('quickselect_order_statistics',    'Quickselect / Order Statistics',                 'subpattern', 71),
    ('recursive_partition_search',      'Recursive Partition / Divide-and-Conquer Search','subpattern', 72)
)
INSERT INTO patterns (code, name, kind, taxonomy_version, position)
SELECT code, name, kind, 'realgo-v1', position
FROM nodes
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    taxonomy_version = EXCLUDED.taxonomy_version,
    position = EXCLUDED.position;

-- ---------------------------------------------------------------------------
-- Family <-> subpattern edges (many-to-many; UI renders them as a tree).
-- ---------------------------------------------------------------------------

CREATE TABLE pattern_family_subpatterns (
    family_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    subpattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    position INTEGER NOT NULL,
    PRIMARY KEY (family_id, subpattern_id)
);

CREATE INDEX pattern_family_subpatterns_subpattern_idx
    ON pattern_family_subpatterns (subpattern_id);

WITH edges(family_code, subpattern_code, position) AS (
    VALUES
    ('arrays_hashing', 'frequency_map_counting', 1),
    ('arrays_hashing', 'membership_deduplication', 2),
    ('arrays_hashing', 'complement_lookup', 3),
    ('two_pointers', 'opposite_direction_pointers', 1),
    ('two_pointers', 'same_direction_read_write', 2),
    ('two_pointers', 'fast_slow_pointers', 3),
    ('sliding_window', 'fixed_size_window', 1),
    ('sliding_window', 'longest_valid_window', 2),
    ('sliding_window', 'shortest_valid_window', 3),
    ('sliding_window', 'frequency_coverage_window', 4),
    ('prefix_cumulative', 'prefix_sum_range_query', 1),
    ('prefix_cumulative', 'prefix_balance_hashmap', 2),
    ('prefix_cumulative', 'difference_array', 3),
    ('binary_search', 'exact_search_monotone', 1),
    ('binary_search', 'lower_upper_bound', 2),
    ('binary_search', 'binary_search_on_answer', 3),
    ('binary_search', 'rotated_peak_search', 4),
    ('intervals', 'merge_overlapping_intervals', 1),
    ('intervals', 'interval_insertion_intersection', 2),
    ('intervals', 'sweep_line_event_counting', 3),
    ('stack', 'matching_nesting_stack', 1),
    ('stack', 'expression_evaluation_stack', 2),
    ('stack', 'monotonic_stack', 3),
    ('stack', 'monotonic_deque', 4),
    ('heap', 'top_k_bounded_heap', 1),
    ('heap', 'two_heaps_streaming_median', 2),
    ('heap', 'k_way_merge_best_first', 3),
    ('linked_list', 'dummy_node_rewiring', 1),
    ('linked_list', 'in_place_reversal', 2),
    ('linked_list', 'merge_split_reconnect', 3),
    ('trees', 'dfs_path_subtree_aggregation', 1),
    ('trees', 'bfs_level_order', 2),
    ('trees', 'bst_ordering_bounds', 3),
    ('graphs', 'connected_components_flood_fill', 1),
    ('graphs', 'cycle_detection_traversal', 2),
    ('graphs', 'multi_source_bfs', 3),
    ('graphs', 'state_space_graph_search', 4),
    ('topological_ordering', 'kahn_in_degree_bfs', 1),
    ('topological_ordering', 'dfs_postorder_toposort', 2),
    ('topological_ordering', 'dependency_scheduling', 3),
    ('union_find', 'online_connectivity', 1),
    ('union_find', 'dsu_cycle_detection', 2),
    ('union_find', 'kruskal_connectivity', 3),
    ('shortest_paths', 'unweighted_shortest_path_bfs', 1),
    ('shortest_paths', 'dijkstra_nonnegative', 2),
    ('shortest_paths', 'relaxation_based_paths', 3),
    ('backtracking', 'subsets_combinations', 1),
    ('backtracking', 'permutations_used_state', 2),
    ('backtracking', 'constraint_placement', 3),
    ('backtracking', 'path_construction_word_search', 4),
    ('greedy', 'sort_then_greedy', 1),
    ('greedy', 'local_choice_invariant', 2),
    ('greedy', 'greedy_scheduling', 3),
    ('dynamic_programming', 'dp_1d_linear', 1),
    ('dynamic_programming', 'dp_2d_grid', 2),
    ('dynamic_programming', 'dp_01_knapsack', 3),
    ('dynamic_programming', 'dp_unbounded_knapsack', 4),
    ('dynamic_programming', 'dp_sequence_lis_lcs', 5),
    ('dynamic_programming', 'dp_state_machine_interval', 6),
    ('tries', 'trie_prefix_search', 1),
    ('tries', 'rolling_hash_rabin_karp', 2),
    ('tries', 'kmp_prefix_function', 3),
    ('bit_manipulation', 'xor_cancellation', 1),
    ('bit_manipulation', 'bitmask_state_enumeration', 2),
    ('bit_manipulation', 'bit_tricks_submask', 3),
    ('matrix_grid', 'directional_traversal_simulation', 1),
    ('matrix_grid', 'in_place_transform_boundary', 2),
    ('cyclic_placement', 'cyclic_sort_placement', 1),
    ('cyclic_placement', 'sign_marking_index_encoding', 2),
    ('divide_conquer', 'merge_sort_divide_conquer', 1),
    ('divide_conquer', 'quickselect_order_statistics', 2),
    ('divide_conquer', 'recursive_partition_search', 3)
)
INSERT INTO pattern_family_subpatterns (family_id, subpattern_id, position)
SELECT f.id, s.id, e.position
FROM edges e
JOIN patterns f ON f.code = e.family_code
JOIN patterns s ON s.code = e.subpattern_code;

-- ---------------------------------------------------------------------------
-- Subpattern -> tool prerequisites (many-to-many).
-- ---------------------------------------------------------------------------

CREATE TABLE subpattern_prerequisites (
    subpattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    tool_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    PRIMARY KEY (subpattern_id, tool_id)
);

CREATE INDEX subpattern_prerequisites_tool_idx
    ON subpattern_prerequisites (tool_id);

WITH prereqs(subpattern_code, tool_code) AS (
    VALUES
    ('frequency_map_counting', 'tool_hash_map'),
    ('frequency_map_counting', 'tool_arrays'),
    ('membership_deduplication', 'tool_set'),
    ('membership_deduplication', 'tool_hash_map'),
    ('complement_lookup', 'tool_hash_map'),
    ('complement_lookup', 'tool_arrays'),
    ('opposite_direction_pointers', 'tool_arrays'),
    ('opposite_direction_pointers', 'tool_sorting'),
    ('same_direction_read_write', 'tool_arrays'),
    ('fast_slow_pointers', 'tool_linked_list'),
    ('fixed_size_window', 'tool_arrays'),
    ('longest_valid_window', 'tool_arrays'),
    ('longest_valid_window', 'tool_hash_map'),
    ('shortest_valid_window', 'tool_arrays'),
    ('shortest_valid_window', 'tool_hash_map'),
    ('frequency_coverage_window', 'tool_arrays'),
    ('frequency_coverage_window', 'tool_hash_map'),
    ('prefix_sum_range_query', 'tool_arrays'),
    ('prefix_balance_hashmap', 'tool_arrays'),
    ('prefix_balance_hashmap', 'tool_hash_map'),
    ('difference_array', 'tool_arrays'),
    ('exact_search_monotone', 'tool_arrays'),
    ('exact_search_monotone', 'tool_complexity'),
    ('lower_upper_bound', 'tool_arrays'),
    ('lower_upper_bound', 'tool_complexity'),
    ('binary_search_on_answer', 'tool_arrays'),
    ('binary_search_on_answer', 'tool_complexity'),
    ('rotated_peak_search', 'tool_arrays'),
    ('merge_overlapping_intervals', 'tool_arrays'),
    ('merge_overlapping_intervals', 'tool_sorting'),
    ('interval_insertion_intersection', 'tool_arrays'),
    ('interval_insertion_intersection', 'tool_sorting'),
    ('sweep_line_event_counting', 'tool_sorting'),
    ('sweep_line_event_counting', 'tool_arrays'),
    ('matching_nesting_stack', 'tool_stack'),
    ('expression_evaluation_stack', 'tool_stack'),
    ('monotonic_stack', 'tool_stack'),
    ('monotonic_stack', 'tool_arrays'),
    ('monotonic_deque', 'tool_deque'),
    ('monotonic_deque', 'tool_arrays'),
    ('top_k_bounded_heap', 'tool_heap'),
    ('top_k_bounded_heap', 'tool_sorting'),
    ('two_heaps_streaming_median', 'tool_heap'),
    ('k_way_merge_best_first', 'tool_heap'),
    ('k_way_merge_best_first', 'tool_linked_list'),
    ('dummy_node_rewiring', 'tool_linked_list'),
    ('in_place_reversal', 'tool_linked_list'),
    ('merge_split_reconnect', 'tool_linked_list'),
    ('dfs_path_subtree_aggregation', 'tool_trees'),
    ('dfs_path_subtree_aggregation', 'tool_recursion'),
    ('bfs_level_order', 'tool_trees'),
    ('bfs_level_order', 'tool_queue'),
    ('bst_ordering_bounds', 'tool_trees'),
    ('bst_ordering_bounds', 'tool_recursion'),
    ('connected_components_flood_fill', 'tool_graphs'),
    ('connected_components_flood_fill', 'tool_recursion'),
    ('cycle_detection_traversal', 'tool_graphs'),
    ('cycle_detection_traversal', 'tool_recursion'),
    ('multi_source_bfs', 'tool_graphs'),
    ('multi_source_bfs', 'tool_queue'),
    ('state_space_graph_search', 'tool_graphs'),
    ('state_space_graph_search', 'tool_queue'),
    ('state_space_graph_search', 'tool_set'),
    ('kahn_in_degree_bfs', 'tool_graphs'),
    ('kahn_in_degree_bfs', 'tool_queue'),
    ('dfs_postorder_toposort', 'tool_graphs'),
    ('dfs_postorder_toposort', 'tool_recursion'),
    ('dependency_scheduling', 'tool_graphs'),
    ('dependency_scheduling', 'tool_queue'),
    ('online_connectivity', 'tool_arrays'),
    ('online_connectivity', 'tool_graphs'),
    ('dsu_cycle_detection', 'tool_graphs'),
    ('dsu_cycle_detection', 'tool_arrays'),
    ('kruskal_connectivity', 'tool_graphs'),
    ('kruskal_connectivity', 'tool_sorting'),
    ('unweighted_shortest_path_bfs', 'tool_graphs'),
    ('unweighted_shortest_path_bfs', 'tool_queue'),
    ('dijkstra_nonnegative', 'tool_graphs'),
    ('dijkstra_nonnegative', 'tool_heap'),
    ('relaxation_based_paths', 'tool_graphs'),
    ('relaxation_based_paths', 'tool_deque'),
    ('subsets_combinations', 'tool_recursion'),
    ('permutations_used_state', 'tool_recursion'),
    ('permutations_used_state', 'tool_set'),
    ('constraint_placement', 'tool_recursion'),
    ('constraint_placement', 'tool_set'),
    ('path_construction_word_search', 'tool_recursion'),
    ('path_construction_word_search', 'tool_arrays'),
    ('sort_then_greedy', 'tool_sorting'),
    ('sort_then_greedy', 'tool_arrays'),
    ('local_choice_invariant', 'tool_arrays'),
    ('local_choice_invariant', 'tool_complexity'),
    ('greedy_scheduling', 'tool_sorting'),
    ('greedy_scheduling', 'tool_heap'),
    ('dp_1d_linear', 'tool_recursion'),
    ('dp_1d_linear', 'tool_arrays'),
    ('dp_2d_grid', 'tool_recursion'),
    ('dp_2d_grid', 'tool_arrays'),
    ('dp_01_knapsack', 'tool_recursion'),
    ('dp_01_knapsack', 'tool_arrays'),
    ('dp_unbounded_knapsack', 'tool_recursion'),
    ('dp_unbounded_knapsack', 'tool_arrays'),
    ('dp_sequence_lis_lcs', 'tool_recursion'),
    ('dp_sequence_lis_lcs', 'tool_arrays'),
    ('dp_state_machine_interval', 'tool_recursion'),
    ('dp_state_machine_interval', 'tool_arrays'),
    ('trie_prefix_search', 'tool_trees'),
    ('trie_prefix_search', 'tool_hash_map'),
    ('rolling_hash_rabin_karp', 'tool_arrays'),
    ('rolling_hash_rabin_karp', 'tool_hash_map'),
    ('kmp_prefix_function', 'tool_arrays'),
    ('xor_cancellation', 'tool_arrays'),
    ('bitmask_state_enumeration', 'tool_set'),
    ('bitmask_state_enumeration', 'tool_recursion'),
    ('bit_tricks_submask', 'tool_complexity'),
    ('bit_tricks_submask', 'tool_arrays'),
    ('directional_traversal_simulation', 'tool_arrays'),
    ('in_place_transform_boundary', 'tool_arrays'),
    ('cyclic_sort_placement', 'tool_arrays'),
    ('sign_marking_index_encoding', 'tool_arrays'),
    ('merge_sort_divide_conquer', 'tool_recursion'),
    ('merge_sort_divide_conquer', 'tool_sorting'),
    ('quickselect_order_statistics', 'tool_recursion'),
    ('quickselect_order_statistics', 'tool_sorting'),
    ('recursive_partition_search', 'tool_recursion'),
    ('recursive_partition_search', 'tool_trees')
)
INSERT INTO subpattern_prerequisites (subpattern_id, tool_id)
SELECT s.id, t.id
FROM prereqs p
JOIN patterns s ON s.code = p.subpattern_code
JOIN patterns t ON t.code = p.tool_code;

-- ---------------------------------------------------------------------------
-- Methodology material: one compact learning unit per taxonomy node.
-- Content is seeded separately (seeds/atlas_content.yaml); missing rows
-- render as an honest "material in preparation" state.
-- ---------------------------------------------------------------------------

CREATE TABLE pattern_learning_materials (
    pattern_id BIGINT PRIMARY KEY REFERENCES patterns(id) ON DELETE CASCADE,
    what_it_is TEXT NOT NULL,
    mental_model TEXT NOT NULL DEFAULT '',
    recognition_cues TEXT[] NOT NULL DEFAULT '{}',
    anti_cues TEXT[] NOT NULL DEFAULT '{}',
    core_invariant TEXT NOT NULL DEFAULT '',
    canonical_skeleton TEXT NOT NULL DEFAULT '',
    common_mistakes TEXT[] NOT NULL DEFAULT '{}',
    dont_confuse_with JSONB NOT NULL DEFAULT '[]',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON COLUMN pattern_learning_materials.dont_confuse_with IS 'JSON array of {"title","note"} contrast pairs.';

-- ---------------------------------------------------------------------------
-- Problem <-> subpattern practice links (many-to-many).
-- ---------------------------------------------------------------------------

CREATE TABLE problem_subpatterns (
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    subpattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    tier VARCHAR(20) CHECK (tier IN ('foundational', 'core', 'advanced')),
    position INTEGER,
    PRIMARY KEY (problem_id, subpattern_id)
);

CREATE INDEX problem_subpatterns_subpattern_idx
    ON problem_subpatterns (subpattern_id);

-- ---------------------------------------------------------------------------
-- Companies + evidence-based relevance overlay. No production rows are
-- inserted here: relevance data comes from seeds and every row carries its
-- source_type ('demo' fixtures are labelled as such in the UI).
-- ---------------------------------------------------------------------------

CREATE TABLE companies (
    id BIGSERIAL PRIMARY KEY,
    code TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL
);

CREATE TABLE subpattern_companies (
    subpattern_id BIGINT NOT NULL REFERENCES patterns(id) ON DELETE CASCADE,
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    relevance VARCHAR(30) NOT NULL CHECK (
        relevance IN ('high', 'medium', 'low', 'insufficient_evidence', 'no_evidence')
    ),
    confidence VARCHAR(20) NOT NULL DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
    evidence_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at DATE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('demo', 'manual', 'community', 'dataset')),
    PRIMARY KEY (subpattern_id, company_id)
);

CREATE INDEX subpattern_companies_company_idx
    ON subpattern_companies (company_id);

CREATE TABLE company_problems (
    company_id BIGINT NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    problem_id BIGINT NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    evidence_count INTEGER NOT NULL DEFAULT 0,
    last_seen_at DATE,
    source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('demo', 'manual', 'community', 'dataset')),
    PRIMARY KEY (company_id, problem_id)
);

CREATE INDEX company_problems_problem_idx
    ON company_problems (problem_id);

-- ---------------------------------------------------------------------------
-- Subpattern-centric card types (recognition / invariant / skeleton /
-- contrast / pitfall / debugging) alongside the original problem-centric
-- types.
-- ---------------------------------------------------------------------------

ALTER TABLE cards DROP CONSTRAINT cards_type_check;
ALTER TABLE cards ADD CONSTRAINT cards_type_check CHECK (
    type IN (
        'pattern_recognition', 'algorithm_mechanics', 'edge_case',
        'recognition', 'invariant', 'skeleton', 'contrast', 'pitfall', 'debugging'
    )
);

-- ---------------------------------------------------------------------------
-- Self-check: Realgo Taxonomy v1 must contain exactly 13 tools,
-- 22 pattern families and 72 subpatterns.
-- ---------------------------------------------------------------------------

DO $$
DECLARE
    tool_count INTEGER;
    family_count INTEGER;
    subpattern_count INTEGER;
    edge_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO tool_count FROM patterns WHERE kind = 'tool' AND taxonomy_version = 'realgo-v1';
    SELECT COUNT(*) INTO family_count FROM patterns WHERE kind = 'family' AND taxonomy_version = 'realgo-v1';
    SELECT COUNT(*) INTO subpattern_count FROM patterns WHERE kind = 'subpattern' AND taxonomy_version = 'realgo-v1';
    SELECT COUNT(*) INTO edge_count FROM pattern_family_subpatterns;

    IF tool_count <> 13 OR family_count <> 22 OR subpattern_count <> 72 OR edge_count <> 72 THEN
        RAISE EXCEPTION 'realgo-v1 taxonomy integrity failure: % tools (want 13), % families (want 22), % subpatterns (want 72), % family edges (want 72)',
            tool_count, family_count, subpattern_count, edge_count;
    END IF;
END $$;

COMMIT;
