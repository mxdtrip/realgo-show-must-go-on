package roadmaps

type Item struct {
	Position    int    `json:"position"`
	PatternCode string `json:"pattern_code"`
	Pattern     string `json:"pattern"`
	ProblemID   int64  `json:"problem_id"`
	ExternalID  string `json:"external_id"`
	Slug        string `json:"slug"`
	Title       string `json:"title"`
	URL         string `json:"url"`
	Difficulty  string `json:"difficulty"`
}

type Response struct {
	Code  string `json:"code"`
	Items []Item `json:"items"`
}
