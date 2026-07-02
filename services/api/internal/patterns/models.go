package patterns

type Pattern struct {
	ID           int64  `json:"id"`
	Code         string `json:"code"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	ParentID     *int64 `json:"parent_id"`
	ProblemCount int    `json:"problem_count"`
	SolvedCount  int    `json:"solved_count"`
	DueCount     int    `json:"due_count"`
}

type WeakPattern struct {
	PatternCode   string `json:"pattern_code"`
	Pattern       string `json:"pattern"`
	HardCount     int    `json:"hard_count"`
	ReviewCount   int    `json:"review_count"`
	LowConfidence bool   `json:"low_confidence"`
}
