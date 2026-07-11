package roadmap

const neetcode150Code = "neetcode_150"

type Response struct {
	OverallProgress int       `json:"overallProgress"`
	Target          Target    `json:"target"`
	Weeks           []Week    `json:"weeks"`
	Patterns        []Pattern `json:"patterns"`
}

type Target struct {
	Company       *Company `json:"company"`        // null when user has no target_company
	InterviewDate *string  `json:"interviewDate"`
	Topics        []string `json:"topics"`         // snake_case topic codes, [] when none
}

// Company is the enriched target-company object exposed by the roadmap. The
// stored value is free-text (users.target_company); Code is populated by a
// best-effort lookup against the autocomplete catalog and is null when the
// name does not match any catalog entry.
type Company struct {
	Code *string `json:"code"`
	Name string  `json:"name"`
}

type Week struct {
	ID       string   `json:"id"`
	Label    string   `json:"label"`
	Title    string   `json:"title"`
	Progress int      `json:"progress"`
	Focus    string   `json:"focus"`
	Status   string   `json:"status"`
	Topics   []string `json:"topics"`
}

type Pattern struct {
	ID                 string    `json:"id"`
	Code               string    `json:"code"`
	Name               string    `json:"name"`
	TotalProblems      int       `json:"totalProblems"`
	SolvedProblems     int       `json:"solvedProblems"`
	InProgressProblems int       `json:"inProgressProblems"`
	Progress           int       `json:"progress"`
	Problems           []Problem `json:"problems"`
}

type Problem struct {
	ID         int64   `json:"id"`
	ExternalID *string `json:"externalId,omitempty"`
	Slug       string  `json:"slug"`
	Title      string  `json:"title"`
	URL        string  `json:"url"`
	Difficulty string  `json:"difficulty"`
	Status     string  `json:"status"`
	Rating     *string `json:"rating,omitempty"`
	Confidence *int32  `json:"confidence,omitempty"`
	Position   int     `json:"position"`
}
