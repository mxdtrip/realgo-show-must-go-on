package patterns

import "errors"

var ErrPatternNotFound = errors.New("pattern not found")

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

type PatternDetail struct {
	Code                string           `json:"code"`
	Name                string           `json:"name"`
	Description         string           `json:"description"`
	Techniques          []string         `json:"techniques"`
	RecognitionSymptoms []string         `json:"recognitionSymptoms"`
	Checklist           []string         `json:"checklist"`
	ExampleProblems     []ExampleProblem `json:"exampleProblems"`
}

type ExampleProblem struct {
	Title      string `json:"title"`
	Difficulty string `json:"difficulty"`
	URL        string `json:"url"`
}
