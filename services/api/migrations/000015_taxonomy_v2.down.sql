BEGIN;

-- Возврат к Realgo Taxonomy v1: новые v2-узлы удаляются (вместе с их
-- материалами, связями задач и рёбрами по ON DELETE CASCADE), имена и
-- позиции v1 восстанавливаются, расформированные лейблы возвращаются в v1.

-- Удалить 44 новых узла v2.
DELETE FROM patterns WHERE code IN (
    'frequency_counting',
    'grouping_canonical_signature',
    'frequency_of_frequency_buckets',
    'sorted_pair_triplet_search',
    'converging_validation_palindrome',
    'root_to_leaf_path_state',
    'postorder_subtree_aggregation',
    'tree_construction_serialization',
    'greedy_pairing_matching',
    'resource_assignment',
    'exchange_argument_ordering',
    'dp_take_skip',
    'dp_prefix_partition',
    'dp_counting_ways',
    'linear_string_scan_parsing',
    'finite_state_parser',
    'process_event_simulation',
    'direct_construction_formatting',
    'digit_arithmetic_base_conversion',
    'number_theory_gcd_factorization',
    'modular_arithmetic_fast_pow',
    'dp_digit_positional',
    'combinatorial_counting',
    'probability_expected_value',
    'orientation_cross_product',
    'slope_normalization_geo_hashing',
    'area_rectangle_overlap',
    'geometric_distance_optimization',
    'fenwick_tree_bit',
    'segment_tree_lazy',
    'ordered_set_sorted_map',
    'coordinate_compression_offline',
    'eulerian_path_circuit',
    'low_link_bridges_articulation',
    'bipartite_coloring',
    'strongly_connected_components',
    'binary_lifting_jump_pointers',
    'cache_eviction_design',
    'composite_o1_structures',
    'iterator_stream_snapshot',
    'randomized_sampling_reservoir',
    'interactive_query_strategy',
    'palindrome_expansion_manacher',
    'suffix_structures'
);

-- Вернуть имена переименованных семейств.
UPDATE patterns SET name = 'Prefix & Cumulative State' WHERE code = 'prefix_cumulative' AND kind = 'family';
UPDATE patterns SET name = 'Linked List Techniques' WHERE code = 'linked_list' AND kind = 'family';
UPDATE patterns SET name = 'Tree Traversal & Structure' WHERE code = 'trees' AND kind = 'family';
UPDATE patterns SET name = 'Graph Traversal' WHERE code = 'graphs' AND kind = 'family';
UPDATE patterns SET name = 'Backtracking & Search' WHERE code = 'backtracking' AND kind = 'family';
UPDATE patterns SET name = 'Trie & String Search' WHERE code = 'tries' AND kind = 'family';
UPDATE patterns SET name = 'Matrix & Grid' WHERE code = 'matrix_grid' AND kind = 'family';
UPDATE patterns SET name = 'Cyclic Placement / Index Mapping' WHERE code = 'cyclic_placement' AND kind = 'family';
UPDATE patterns SET name = 'Directional Traversal / Simulation' WHERE code = 'directional_traversal_simulation';

-- Все узлы таксономии обратно в v1; позиции субпаттернов v1 восстановить.
UPDATE patterns SET taxonomy_version = 'realgo-v1'
WHERE taxonomy_version = 'realgo-v2';

WITH v1(code, position) AS (
    VALUES
    ('frequency_map_counting', 1),
    ('membership_deduplication', 2),
    ('complement_lookup', 3),
    ('opposite_direction_pointers', 4),
    ('same_direction_read_write', 5),
    ('fast_slow_pointers', 6),
    ('fixed_size_window', 7),
    ('longest_valid_window', 8),
    ('shortest_valid_window', 9),
    ('frequency_coverage_window', 10),
    ('prefix_sum_range_query', 11),
    ('prefix_balance_hashmap', 12),
    ('difference_array', 13),
    ('exact_search_monotone', 14),
    ('lower_upper_bound', 15),
    ('binary_search_on_answer', 16),
    ('rotated_peak_search', 17),
    ('merge_overlapping_intervals', 18),
    ('interval_insertion_intersection', 19),
    ('sweep_line_event_counting', 20),
    ('matching_nesting_stack', 21),
    ('expression_evaluation_stack', 22),
    ('monotonic_stack', 23),
    ('monotonic_deque', 24),
    ('top_k_bounded_heap', 25),
    ('two_heaps_streaming_median', 26),
    ('k_way_merge_best_first', 27),
    ('dummy_node_rewiring', 28),
    ('in_place_reversal', 29),
    ('merge_split_reconnect', 30),
    ('dfs_path_subtree_aggregation', 31),
    ('bfs_level_order', 32),
    ('bst_ordering_bounds', 33),
    ('connected_components_flood_fill', 34),
    ('cycle_detection_traversal', 35),
    ('multi_source_bfs', 36),
    ('state_space_graph_search', 37),
    ('kahn_in_degree_bfs', 38),
    ('dfs_postorder_toposort', 39),
    ('dependency_scheduling', 40),
    ('online_connectivity', 41),
    ('dsu_cycle_detection', 42),
    ('kruskal_connectivity', 43),
    ('unweighted_shortest_path_bfs', 44),
    ('dijkstra_nonnegative', 45),
    ('relaxation_based_paths', 46),
    ('subsets_combinations', 47),
    ('permutations_used_state', 48),
    ('constraint_placement', 49),
    ('path_construction_word_search', 50),
    ('sort_then_greedy', 51),
    ('local_choice_invariant', 52),
    ('greedy_scheduling', 53),
    ('dp_1d_linear', 54),
    ('dp_2d_grid', 55),
    ('dp_01_knapsack', 56),
    ('dp_unbounded_knapsack', 57),
    ('dp_sequence_lis_lcs', 58),
    ('dp_state_machine_interval', 59),
    ('trie_prefix_search', 60),
    ('rolling_hash_rabin_karp', 61),
    ('kmp_prefix_function', 62),
    ('xor_cancellation', 63),
    ('bitmask_state_enumeration', 64),
    ('bit_tricks_submask', 65),
    ('directional_traversal_simulation', 66),
    ('in_place_transform_boundary', 67),
    ('cyclic_sort_placement', 68),
    ('sign_marking_index_encoding', 69),
    ('merge_sort_divide_conquer', 70),
    ('quickselect_order_statistics', 71),
    ('recursive_partition_search', 72)
)
UPDATE patterns p SET position = v1.position
FROM v1 WHERE p.code = v1.code AND p.kind = 'subpattern';

-- Пересобрать рёбра семейств в порядке v1 (как в 000011).
DELETE FROM pattern_family_subpatterns;

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

DELETE FROM taxonomy_versions WHERE code = 'realgo-v2';

COMMIT;
