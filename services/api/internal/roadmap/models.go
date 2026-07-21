package roadmap

const (
	PriorityBalanced         = "balanced"
	PriorityEasyFirst        = "easy_first"
	PriorityCompanyFrequency = "company_frequency"
	PriorityKnowledgeGaps    = "knowledge_gaps"

	SourceCompany = "company"
	SourceCore    = "core"

	weeklyCapacityDefault = 3
	algorithmVersion      = 1
)

var allPriorityModes = []string{
	PriorityBalanced,
	PriorityEasyFirst,
	PriorityCompanyFrequency,
	PriorityKnowledgeGaps,
}

type ConfigRequest struct {
	CompanyCode      string  `json:"companyCode"`
	CompanyName      string  `json:"companyName"`
	InterviewDate    *string `json:"interviewDate"`
	PriorityMode     string  `json:"priorityMode"`
	PreserveProgress bool    `json:"preserveProgress"`
}

type Response struct {
	OverallProgress  int      `json:"overallProgress"`
	Target           Target   `json:"target"`
	PriorityMode     string   `json:"priorityMode"`
	AvailableModes   []string `json:"availableModes"`
	AlgorithmVersion int      `json:"algorithmVersion"`
	Source           string   `json:"source"`
	HorizonWeeks     int      `json:"horizonWeeks"`
	WeeklyCapacity   int      `json:"weeklyCapacity"`
	SelectedCount    int      `json:"selectedCount"`
	ReserveCount     int      `json:"reserveCount"`
	Configured       bool     `json:"configured"`
	GeneratedAt      *string  `json:"generatedAt,omitempty"`
	Weeks            []Week   `json:"weeks"`
}

type Target struct {
	Company       *Company `json:"company"`
	InterviewDate *string  `json:"interviewDate"`
	Topics        []string `json:"topics"`
}

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
	Items    []Item   `json:"items"`
}

type Item struct {
	Code                 string         `json:"code"`
	Name                 string         `json:"name"`
	RelevantProblemCount int            `json:"relevantProblemCount"`
	DifficultyCounts     map[string]int `json:"difficultyCounts"`
	MasteryPercent       int            `json:"masteryPercent"`
}

type planItem struct {
	Item
	WeekIndex        int
	Position         int
	Selected         bool
	TaxonomyPosition int
	EvidenceCount    int
	Confidence       string
	DifficultyScore  float64
	Score            float64
}
