package roadmap

const neetcode150Code = "neetcode_150"

type Response struct {
	OverallProgress int       `json:"overallProgress"`
	Target          Target    `json:"target"`
	Weeks           []Week    `json:"weeks"`
	Patterns        []Pattern `json:"patterns"`
}

type Target struct {
	Company       *string `json:"company"`
	InterviewDate *string `json:"interviewDate"`
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
