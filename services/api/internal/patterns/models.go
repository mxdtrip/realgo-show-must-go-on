package patterns

type WeakPattern struct {
	PatternCode   string `json:"pattern_code"`
	Pattern       string `json:"pattern"`
	HardCount     int    `json:"hard_count"`
	ReviewCount   int    `json:"review_count"`
	LowConfidence bool   `json:"low_confidence"`
}
