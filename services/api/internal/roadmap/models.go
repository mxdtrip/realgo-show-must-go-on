package roadmap

type Response struct {
	OverallProgress int    `json:"overallProgress"`
	Target          Target `json:"target"`
	Weeks           []Week `json:"weeks"`
}

type Target struct {
	Company       *Company `json:"company"` // null when user has no target_company
	InterviewDate *string  `json:"interviewDate"`
	Topics        []string `json:"topics"` // snake_case topic codes, [] when none
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
