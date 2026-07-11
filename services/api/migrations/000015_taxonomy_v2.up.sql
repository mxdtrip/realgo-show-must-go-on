BEGIN;

-- Realgo Taxonomy v2 (22 families / 111 subpatterns), по файлу
-- realgo_taxonomy_v2_22x111_gap_audit (snapshot 2026-07-07):
--  * 8 семейств переименованы (коды и id сохранены);
--  * 5 широких v1-лейблов расформированы (Frequency Map / Counting,
--    Opposite-Direction Pointers, DFS Path / Subtree Aggregation,
--    Sort-Then-Greedy, 1D Linear DP) -> остаются на realgo-v1 и уходят из
--    атласа; их задачи ЖДУТ отдельного re-audit (решение: не force-мапить);
--  * 14 узких потомков расформированных + 30 gap-fill узлов = 44 новых;
--  * #66 сужен: Directional Traversal / Simulation -> Directional Grid /
--    Matrix Traversal.

INSERT INTO taxonomy_versions (code, title) VALUES
    ('realgo-v2', 'Realgo Taxonomy v2');

-- Инструменты и семейства переходят в v2 как есть (позиции 1..22 сохранены).
UPDATE patterns SET taxonomy_version = 'realgo-v2'
WHERE kind IN ('tool', 'family') AND taxonomy_version = 'realgo-v1';

-- Переименованные семейства (коды сохранены).
UPDATE patterns SET name = 'Prefix, Range & Ordered Structures' WHERE code = 'prefix_cumulative' AND kind = 'family';
UPDATE patterns SET name = 'Linked Lists & Stateful Data Structures' WHERE code = 'linked_list' AND kind = 'family';
UPDATE patterns SET name = 'Tree Traversal & Queries' WHERE code = 'trees' AND kind = 'family';
UPDATE patterns SET name = 'Graph Traversal & Structure' WHERE code = 'graphs' AND kind = 'family';
UPDATE patterns SET name = 'Backtracking, Search & Adaptive Strategy' WHERE code = 'backtracking' AND kind = 'family';
UPDATE patterns SET name = 'String Processing & Search' WHERE code = 'tries' AND kind = 'family';
UPDATE patterns SET name = 'Simulation, Matrix & Grid' WHERE code = 'matrix_grid' AND kind = 'family';
UPDATE patterns SET name = 'Math, Geometry & Index Mapping' WHERE code = 'cyclic_placement' AND kind = 'family';

-- Сохранённые субпаттерны: версия v2 + позиция из реестра v2.
-- #66 дополнительно переименован (semantic narrowing).
UPDATE patterns SET name = 'Directional Grid / Matrix Traversal' WHERE code = 'directional_traversal_simulation';

WITH retained(code, position) AS (
    VALUES
    ('membership_deduplication', 4),
    ('complement_lookup', 5),
    ('same_direction_read_write', 8),
    ('fast_slow_pointers', 9),
    ('fixed_size_window', 10),
    ('longest_valid_window', 11),
    ('shortest_valid_window', 12),
    ('frequency_coverage_window', 13),
    ('prefix_sum_range_query', 14),
    ('prefix_balance_hashmap', 15),
    ('difference_array', 16),
    ('exact_search_monotone', 17),
    ('lower_upper_bound', 18),
    ('binary_search_on_answer', 19),
    ('rotated_peak_search', 20),
    ('merge_overlapping_intervals', 21),
    ('interval_insertion_intersection', 22),
    ('sweep_line_event_counting', 23),
    ('matching_nesting_stack', 24),
    ('expression_evaluation_stack', 25),
    ('monotonic_stack', 26),
    ('monotonic_deque', 27),
    ('top_k_bounded_heap', 28),
    ('two_heaps_streaming_median', 29),
    ('k_way_merge_best_first', 30),
    ('dummy_node_rewiring', 31),
    ('in_place_reversal', 32),
    ('merge_split_reconnect', 33),
    ('bfs_level_order', 37),
    ('bst_ordering_bounds', 38),
    ('connected_components_flood_fill', 39),
    ('cycle_detection_traversal', 40),
    ('multi_source_bfs', 41),
    ('state_space_graph_search', 42),
    ('kahn_in_degree_bfs', 43),
    ('dfs_postorder_toposort', 44),
    ('dependency_scheduling', 45),
    ('online_connectivity', 46),
    ('dsu_cycle_detection', 47),
    ('kruskal_connectivity', 48),
    ('unweighted_shortest_path_bfs', 49),
    ('dijkstra_nonnegative', 50),
    ('relaxation_based_paths', 51),
    ('subsets_combinations', 52),
    ('permutations_used_state', 53),
    ('constraint_placement', 54),
    ('path_construction_word_search', 55),
    ('local_choice_invariant', 59),
    ('greedy_scheduling', 60),
    ('dp_2d_grid', 64),
    ('dp_01_knapsack', 65),
    ('dp_unbounded_knapsack', 66),
    ('dp_sequence_lis_lcs', 67),
    ('dp_state_machine_interval', 68),
    ('trie_prefix_search', 69),
    ('rolling_hash_rabin_karp', 70),
    ('kmp_prefix_function', 71),
    ('xor_cancellation', 72),
    ('bitmask_state_enumeration', 73),
    ('bit_tricks_submask', 74),
    ('directional_traversal_simulation', 75),
    ('in_place_transform_boundary', 76),
    ('cyclic_sort_placement', 77),
    ('sign_marking_index_encoding', 78),
    ('merge_sort_divide_conquer', 79),
    ('quickselect_order_statistics', 80),
    ('recursive_partition_search', 81)
)
UPDATE patterns p SET taxonomy_version = 'realgo-v2', position = retained.position
FROM retained WHERE p.code = retained.code AND p.kind = 'subpattern';

-- Новые субпаттерны v2 (14 потомков + 30 gap-fill).
WITH nodes(code, name, position) AS (
    VALUES
    ('frequency_counting', 'Frequency Counting', 1),
    ('grouping_canonical_signature', 'Grouping / Canonical Signature', 2),
    ('frequency_of_frequency_buckets', 'Frequency-of-Frequency / Bucket Counts', 3),
    ('sorted_pair_triplet_search', 'Sorted Pair / Triplet Search', 6),
    ('converging_validation_palindrome', 'Converging Validation / Palindrome Scan', 7),
    ('root_to_leaf_path_state', 'Root-to-Leaf Path State', 34),
    ('postorder_subtree_aggregation', 'Postorder Subtree Aggregation', 35),
    ('tree_construction_serialization', 'Tree Construction / Serialization', 36),
    ('greedy_pairing_matching', 'Greedy Pairing / Matching', 56),
    ('resource_assignment', 'Resource Assignment', 57),
    ('exchange_argument_ordering', 'Exchange-Argument Ordering', 58),
    ('dp_take_skip', 'Take / Skip DP', 61),
    ('dp_prefix_partition', 'Prefix / Partition DP', 62),
    ('dp_counting_ways', 'Counting Ways DP', 63),
    ('linear_string_scan_parsing', 'Linear String Scan / Parsing', 82),
    ('finite_state_parser', 'Finite-State Parser / Token Recognition', 83),
    ('process_event_simulation', 'Process / Event Simulation', 84),
    ('direct_construction_formatting', 'Direct Construction / Formatting', 85),
    ('digit_arithmetic_base_conversion', 'Digit Arithmetic / Base Conversion', 86),
    ('number_theory_gcd_factorization', 'Number Theory: GCD / LCM / Divisibility / Factorization', 87),
    ('modular_arithmetic_fast_pow', 'Modular Arithmetic / Fast Exponentiation', 88),
    ('dp_digit_positional', 'Digit DP / Positional Counting', 89),
    ('combinatorial_counting', 'Combinatorial Counting / Inclusion–Exclusion', 90),
    ('probability_expected_value', 'Probability / Expected Value / Game Reasoning', 91),
    ('orientation_cross_product', 'Orientation / Cross Product / Collinearity', 92),
    ('slope_normalization_geo_hashing', 'Slope Normalization / Geometric Hashing', 93),
    ('area_rectangle_overlap', 'Area / Rectangle / Overlap Geometry', 94),
    ('geometric_distance_optimization', 'Geometric Distance / Optimization', 95),
    ('fenwick_tree_bit', 'Fenwick Tree / BIT', 96),
    ('segment_tree_lazy', 'Segment Tree / Lazy Propagation', 97),
    ('ordered_set_sorted_map', 'Ordered Set / Multiset / Sorted Map', 98),
    ('coordinate_compression_offline', 'Coordinate Compression / Offline Range Query', 99),
    ('eulerian_path_circuit', 'Eulerian Path / Circuit', 100),
    ('low_link_bridges_articulation', 'Low-Link / Bridges / Articulation', 101),
    ('bipartite_coloring', 'Bipartite Coloring', 102),
    ('strongly_connected_components', 'Strongly Connected Components', 103),
    ('binary_lifting_jump_pointers', 'Binary Lifting / Jump Pointers', 104),
    ('cache_eviction_design', 'Cache / Eviction Design', 105),
    ('composite_o1_structures', 'Composite O(1) Data Structures', 106),
    ('iterator_stream_snapshot', 'Iterator / Stream / Snapshot State', 107),
    ('randomized_sampling_reservoir', 'Randomized Sampling / Reservoir / Rejection', 108),
    ('interactive_query_strategy', 'Interactive Query Strategy', 109),
    ('palindrome_expansion_manacher', 'Palindrome Expansion / Manacher', 110),
    ('suffix_structures', 'Suffix Structures', 111)
)
INSERT INTO patterns (code, name, kind, taxonomy_version, position)
SELECT code, name, 'subpattern', 'realgo-v2', position
FROM nodes
ON CONFLICT (code) DO UPDATE SET
    name = EXCLUDED.name,
    kind = EXCLUDED.kind,
    taxonomy_version = EXCLUDED.taxonomy_version,
    position = EXCLUDED.position;

-- Рёбра семейство<->субпаттерн пересобираются под порядок v2;
-- рёбра расформированных лейблов удаляются вместе с остальными.
DELETE FROM pattern_family_subpatterns;

WITH edges(family_code, subpattern_code, position) AS (
    VALUES
    ('arrays_hashing', 'frequency_counting', 1),
    ('arrays_hashing', 'grouping_canonical_signature', 2),
    ('arrays_hashing', 'frequency_of_frequency_buckets', 3),
    ('arrays_hashing', 'membership_deduplication', 4),
    ('arrays_hashing', 'complement_lookup', 5),
    ('two_pointers', 'sorted_pair_triplet_search', 1),
    ('two_pointers', 'converging_validation_palindrome', 2),
    ('two_pointers', 'same_direction_read_write', 3),
    ('two_pointers', 'fast_slow_pointers', 4),
    ('sliding_window', 'fixed_size_window', 1),
    ('sliding_window', 'longest_valid_window', 2),
    ('sliding_window', 'shortest_valid_window', 3),
    ('sliding_window', 'frequency_coverage_window', 4),
    ('prefix_cumulative', 'prefix_sum_range_query', 1),
    ('prefix_cumulative', 'prefix_balance_hashmap', 2),
    ('prefix_cumulative', 'difference_array', 3),
    ('prefix_cumulative', 'fenwick_tree_bit', 4),
    ('prefix_cumulative', 'segment_tree_lazy', 5),
    ('prefix_cumulative', 'ordered_set_sorted_map', 6),
    ('prefix_cumulative', 'coordinate_compression_offline', 7),
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
    ('linked_list', 'cache_eviction_design', 4),
    ('linked_list', 'composite_o1_structures', 5),
    ('linked_list', 'iterator_stream_snapshot', 6),
    ('trees', 'root_to_leaf_path_state', 1),
    ('trees', 'postorder_subtree_aggregation', 2),
    ('trees', 'tree_construction_serialization', 3),
    ('trees', 'bfs_level_order', 4),
    ('trees', 'bst_ordering_bounds', 5),
    ('trees', 'binary_lifting_jump_pointers', 6),
    ('graphs', 'connected_components_flood_fill', 1),
    ('graphs', 'cycle_detection_traversal', 2),
    ('graphs', 'multi_source_bfs', 3),
    ('graphs', 'state_space_graph_search', 4),
    ('graphs', 'eulerian_path_circuit', 5),
    ('graphs', 'low_link_bridges_articulation', 6),
    ('graphs', 'bipartite_coloring', 7),
    ('graphs', 'strongly_connected_components', 8),
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
    ('backtracking', 'randomized_sampling_reservoir', 5),
    ('backtracking', 'interactive_query_strategy', 6),
    ('greedy', 'greedy_pairing_matching', 1),
    ('greedy', 'resource_assignment', 2),
    ('greedy', 'exchange_argument_ordering', 3),
    ('greedy', 'local_choice_invariant', 4),
    ('greedy', 'greedy_scheduling', 5),
    ('dynamic_programming', 'dp_take_skip', 1),
    ('dynamic_programming', 'dp_prefix_partition', 2),
    ('dynamic_programming', 'dp_counting_ways', 3),
    ('dynamic_programming', 'dp_2d_grid', 4),
    ('dynamic_programming', 'dp_01_knapsack', 5),
    ('dynamic_programming', 'dp_unbounded_knapsack', 6),
    ('dynamic_programming', 'dp_sequence_lis_lcs', 7),
    ('dynamic_programming', 'dp_state_machine_interval', 8),
    ('dynamic_programming', 'dp_digit_positional', 9),
    ('tries', 'trie_prefix_search', 1),
    ('tries', 'rolling_hash_rabin_karp', 2),
    ('tries', 'kmp_prefix_function', 3),
    ('tries', 'linear_string_scan_parsing', 4),
    ('tries', 'finite_state_parser', 5),
    ('tries', 'palindrome_expansion_manacher', 6),
    ('tries', 'suffix_structures', 7),
    ('bit_manipulation', 'xor_cancellation', 1),
    ('bit_manipulation', 'bitmask_state_enumeration', 2),
    ('bit_manipulation', 'bit_tricks_submask', 3),
    ('matrix_grid', 'directional_traversal_simulation', 1),
    ('matrix_grid', 'in_place_transform_boundary', 2),
    ('matrix_grid', 'process_event_simulation', 3),
    ('matrix_grid', 'direct_construction_formatting', 4),
    ('cyclic_placement', 'cyclic_sort_placement', 1),
    ('cyclic_placement', 'sign_marking_index_encoding', 2),
    ('cyclic_placement', 'digit_arithmetic_base_conversion', 3),
    ('cyclic_placement', 'number_theory_gcd_factorization', 4),
    ('cyclic_placement', 'modular_arithmetic_fast_pow', 5),
    ('cyclic_placement', 'combinatorial_counting', 6),
    ('cyclic_placement', 'probability_expected_value', 7),
    ('cyclic_placement', 'orientation_cross_product', 8),
    ('cyclic_placement', 'slope_normalization_geo_hashing', 9),
    ('cyclic_placement', 'area_rectangle_overlap', 10),
    ('cyclic_placement', 'geometric_distance_optimization', 11),
    ('divide_conquer', 'merge_sort_divide_conquer', 1),
    ('divide_conquer', 'quickselect_order_statistics', 2),
    ('divide_conquer', 'recursive_partition_search', 3)
)
INSERT INTO pattern_family_subpatterns (family_id, subpattern_id, position)
SELECT f.id, s.id, e.position
FROM edges e
JOIN patterns f ON f.code = e.family_code
JOIN patterns s ON s.code = e.subpattern_code;

-- Tool-пререквизиты новых узлов (инвариант: у субпаттерна >= 1 tool).
WITH prereqs(subpattern_code, tool_code) AS (
    VALUES
    ('area_rectangle_overlap', 'tool_arrays'),
    ('binary_lifting_jump_pointers', 'tool_trees'),
    ('binary_lifting_jump_pointers', 'tool_arrays'),
    ('bipartite_coloring', 'tool_graphs'),
    ('bipartite_coloring', 'tool_queue'),
    ('cache_eviction_design', 'tool_hash_map'),
    ('cache_eviction_design', 'tool_linked_list'),
    ('combinatorial_counting', 'tool_complexity'),
    ('combinatorial_counting', 'tool_recursion'),
    ('composite_o1_structures', 'tool_hash_map'),
    ('composite_o1_structures', 'tool_arrays'),
    ('converging_validation_palindrome', 'tool_arrays'),
    ('coordinate_compression_offline', 'tool_sorting'),
    ('coordinate_compression_offline', 'tool_arrays'),
    ('digit_arithmetic_base_conversion', 'tool_arrays'),
    ('digit_arithmetic_base_conversion', 'tool_complexity'),
    ('direct_construction_formatting', 'tool_arrays'),
    ('dp_counting_ways', 'tool_arrays'),
    ('dp_counting_ways', 'tool_recursion'),
    ('dp_digit_positional', 'tool_recursion'),
    ('dp_digit_positional', 'tool_arrays'),
    ('dp_prefix_partition', 'tool_arrays'),
    ('dp_prefix_partition', 'tool_recursion'),
    ('dp_take_skip', 'tool_arrays'),
    ('dp_take_skip', 'tool_recursion'),
    ('eulerian_path_circuit', 'tool_graphs'),
    ('eulerian_path_circuit', 'tool_stack'),
    ('exchange_argument_ordering', 'tool_sorting'),
    ('exchange_argument_ordering', 'tool_complexity'),
    ('fenwick_tree_bit', 'tool_arrays'),
    ('fenwick_tree_bit', 'tool_complexity'),
    ('finite_state_parser', 'tool_arrays'),
    ('finite_state_parser', 'tool_complexity'),
    ('frequency_counting', 'tool_hash_map'),
    ('frequency_counting', 'tool_arrays'),
    ('frequency_of_frequency_buckets', 'tool_hash_map'),
    ('frequency_of_frequency_buckets', 'tool_arrays'),
    ('geometric_distance_optimization', 'tool_arrays'),
    ('geometric_distance_optimization', 'tool_sorting'),
    ('greedy_pairing_matching', 'tool_sorting'),
    ('greedy_pairing_matching', 'tool_arrays'),
    ('grouping_canonical_signature', 'tool_hash_map'),
    ('grouping_canonical_signature', 'tool_sorting'),
    ('interactive_query_strategy', 'tool_complexity'),
    ('interactive_query_strategy', 'tool_arrays'),
    ('iterator_stream_snapshot', 'tool_arrays'),
    ('iterator_stream_snapshot', 'tool_stack'),
    ('linear_string_scan_parsing', 'tool_arrays'),
    ('low_link_bridges_articulation', 'tool_graphs'),
    ('low_link_bridges_articulation', 'tool_recursion'),
    ('modular_arithmetic_fast_pow', 'tool_recursion'),
    ('modular_arithmetic_fast_pow', 'tool_complexity'),
    ('number_theory_gcd_factorization', 'tool_recursion'),
    ('number_theory_gcd_factorization', 'tool_complexity'),
    ('ordered_set_sorted_map', 'tool_set'),
    ('ordered_set_sorted_map', 'tool_sorting'),
    ('orientation_cross_product', 'tool_arrays'),
    ('palindrome_expansion_manacher', 'tool_arrays'),
    ('postorder_subtree_aggregation', 'tool_trees'),
    ('postorder_subtree_aggregation', 'tool_recursion'),
    ('probability_expected_value', 'tool_complexity'),
    ('process_event_simulation', 'tool_queue'),
    ('process_event_simulation', 'tool_hash_map'),
    ('randomized_sampling_reservoir', 'tool_arrays'),
    ('randomized_sampling_reservoir', 'tool_complexity'),
    ('resource_assignment', 'tool_sorting'),
    ('resource_assignment', 'tool_heap'),
    ('root_to_leaf_path_state', 'tool_trees'),
    ('root_to_leaf_path_state', 'tool_recursion'),
    ('segment_tree_lazy', 'tool_arrays'),
    ('segment_tree_lazy', 'tool_recursion'),
    ('slope_normalization_geo_hashing', 'tool_hash_map'),
    ('slope_normalization_geo_hashing', 'tool_arrays'),
    ('sorted_pair_triplet_search', 'tool_arrays'),
    ('sorted_pair_triplet_search', 'tool_sorting'),
    ('strongly_connected_components', 'tool_graphs'),
    ('strongly_connected_components', 'tool_stack'),
    ('suffix_structures', 'tool_arrays'),
    ('suffix_structures', 'tool_sorting'),
    ('tree_construction_serialization', 'tool_trees'),
    ('tree_construction_serialization', 'tool_recursion')
)
INSERT INTO subpattern_prerequisites (subpattern_id, tool_id)
SELECT s.id, t.id
FROM prereqs p
JOIN patterns s ON s.code = p.subpattern_code
JOIN patterns t ON t.code = p.tool_code
ON CONFLICT DO NOTHING;

DO $$
DECLARE
    tool_count INTEGER;
    family_count INTEGER;
    subpattern_count INTEGER;
    edge_count INTEGER;
    orphan_tools INTEGER;
BEGIN
    SELECT COUNT(*) INTO tool_count FROM patterns WHERE kind = 'tool' AND taxonomy_version = 'realgo-v2';
    SELECT COUNT(*) INTO family_count FROM patterns WHERE kind = 'family' AND taxonomy_version = 'realgo-v2';
    SELECT COUNT(*) INTO subpattern_count FROM patterns WHERE kind = 'subpattern' AND taxonomy_version = 'realgo-v2';
    SELECT COUNT(*) INTO edge_count FROM pattern_family_subpatterns;
    SELECT COUNT(*) INTO orphan_tools FROM patterns p
    WHERE p.kind = 'subpattern' AND p.taxonomy_version = 'realgo-v2'
      AND NOT EXISTS (SELECT 1 FROM subpattern_prerequisites sp WHERE sp.subpattern_id = p.id);

    IF tool_count <> 13 OR family_count <> 22 OR subpattern_count <> 111
       OR edge_count <> 111 OR orphan_tools <> 0 THEN
        RAISE EXCEPTION 'realgo-v2 taxonomy integrity failure: % tools (want 13), % families (want 22), % subpatterns (want 111), % family edges (want 111), % subpatterns without tools (want 0)',
            tool_count, family_count, subpattern_count, edge_count, orphan_tools;
    END IF;
END $$;

COMMIT;
