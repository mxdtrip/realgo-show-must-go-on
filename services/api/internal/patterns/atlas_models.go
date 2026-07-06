package patterns

import "time"

// TaxonomyVersion is the currently served taxonomy release. Bumping it (and
// shipping the matching nodes/edges) is how realgo-v2 rolls out without
// rewriting the atlas API.
const TaxonomyVersion = "realgo-v1"

// Mastery statuses, ordered from "never touched" to "fully retained".
const (
	MasteryNotStarted = "not_started"
	MasteryLearning   = "learning"
	MasteryWeak       = "weak"
	MasteryUnstable   = "unstable"
	MasteryStrong     = "strong"
	MasteryMastered   = "mastered"
)

// AtlasResponse is the full Pattern Atlas payload: taxonomy nodes, edges and
// per-user state in one round trip (the taxonomy is small by design).
type AtlasResponse struct {
	TaxonomyVersion string               `json:"taxonomy_version"`
	Tools           []AtlasTool          `json:"tools"`
	Families        []AtlasFamily        `json:"families"`
	Subpatterns     []AtlasSubpattern    `json:"subpatterns"`
	Company         *AtlasCompanyOverlay `json:"company,omitempty"`
}

type AtlasTool struct {
	Code            string   `json:"code"`
	Name            string   `json:"name"`
	Position        int      `json:"position"`
	SubpatternCodes []string `json:"subpattern_codes"`
}

type AtlasFamily struct {
	Code            string   `json:"code"`
	Name            string   `json:"name"`
	Description     string   `json:"description"`
	Position        int      `json:"position"`
	SubpatternCodes []string `json:"subpattern_codes"`
}

type AtlasSubpattern struct {
	Code        string            `json:"code"`
	Name        string            `json:"name"`
	Position    int               `json:"position"`
	FamilyCodes []string          `json:"family_codes"`
	ToolCodes   []string          `json:"tool_codes"`
	Stats       SubpatternStats   `json:"stats"`
	Mastery     Mastery           `json:"mastery"`
	Relevance   *CompanyRelevance `json:"relevance,omitempty"`
}

// SubpatternStats are the raw per-user aggregates a subpattern's mastery is
// derived from. Kept separate from Mastery so the calculation can evolve
// (recognition/transfer/retention components) without an API break.
type SubpatternStats struct {
	ProblemCount    int        `json:"problem_count"`
	SolvedCount     int        `json:"solved_count"`
	InProgressCount int        `json:"in_progress_count"`
	DueCount        int        `json:"due_count"`
	CardCount       int        `json:"card_count"`
	AttemptCount    int        `json:"attempt_count"`
	HardCount       int        `json:"hard_count"`
	NextReviewAt    *time.Time `json:"next_review_at,omitempty"`
	LastSolvedAt    *time.Time `json:"last_solved_at,omitempty"`
}

type Mastery struct {
	Status     string            `json:"status"`
	Percent    int               `json:"percent"`
	Components MasteryComponents `json:"components"`
}

// MasteryComponents keeps the aggregate percent decomposable. More components
// (recognition, discrimination, transfer) can be added without breaking the
// payload shape.
type MasteryComponents struct {
	Practice  int `json:"practice"`
	Retention int `json:"retention"`
}

// CompanyRelevance mirrors one subpattern_companies evidence record. It never
// invents data: rows exist only when a dataset provided them, and SourceType
// tells the UI whether it is looking at demo fixtures.
type CompanyRelevance struct {
	Relevance     string `json:"relevance"`
	Confidence    string `json:"confidence"`
	EvidenceCount int    `json:"evidence_count"`
	LastSeenAt    string `json:"last_seen_at,omitempty"`
	SourceType    string `json:"source_type"`
}

type AtlasCompanyOverlay struct {
	Code     string        `json:"code"`
	Name     string        `json:"name"`
	DemoOnly bool          `json:"demo_only"`
	Coverage AtlasCoverage `json:"coverage"`
}

// AtlasCoverage is the readiness summary for a selected company, bucketed by
// mastery status over the subpatterns with actual relevance evidence.
type AtlasCoverage struct {
	RelevantSubpatterns int        `json:"relevant_subpatterns"`
	Strong              int        `json:"strong"`
	Unstable            int        `json:"unstable"`
	Weak                int        `json:"weak"`
	NotStarted          int        `json:"not_started"`
	TopGaps             []AtlasGap `json:"top_gaps"`
}

type AtlasGap struct {
	Code           string `json:"code"`
	Name           string `json:"name"`
	Relevance      string `json:"relevance"`
	MasteryPercent int    `json:"mastery_percent"`
}

type AtlasCompany struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	SubpatternCount int    `json:"subpattern_count"`
	DemoOnly        bool   `json:"demo_only"`
	LastSeenAt      string `json:"last_seen_at,omitempty"`
}

// NodeRef is a lightweight reference to a related taxonomy node.
type NodeRef struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// ContrastPair is one "don't confuse with" entry of a learning material.
type ContrastPair struct {
	Title string `json:"title"`
	Note  string `json:"note"`
}

// LearningMaterial is the compact methodology unit of a subpattern.
type LearningMaterial struct {
	WhatItIs          string         `json:"what_it_is"`
	MentalModel       string         `json:"mental_model"`
	RecognitionCues   []string       `json:"recognition_cues"`
	AntiCues          []string       `json:"anti_cues"`
	CoreInvariant     string         `json:"core_invariant"`
	CanonicalSkeleton string         `json:"canonical_skeleton"`
	CommonMistakes    []string       `json:"common_mistakes"`
	DontConfuseWith   []ContrastPair `json:"dont_confuse_with"`
}

type CardSummary struct {
	ID           int64      `json:"id"`
	Type         string     `json:"type"`
	Question     string     `json:"question"`
	NextReviewAt *time.Time `json:"next_review_at,omitempty"`
	LastRating   string     `json:"last_rating,omitempty"`
}

type PracticeProblem struct {
	ID           int64      `json:"id"`
	Title        string     `json:"title"`
	URL          string     `json:"url"`
	Difficulty   string     `json:"difficulty"`
	Tier         string     `json:"tier,omitempty"`
	Status       string     `json:"status"`
	Rating       string     `json:"rating,omitempty"`
	SolvedAt     *time.Time `json:"solved_at,omitempty"`
	NextReviewAt *time.Time `json:"next_review_at,omitempty"`
}

type CompanyPracticeProblem struct {
	PracticeProblem
	EvidenceCount int    `json:"evidence_count"`
	LastSeenAt    string `json:"last_seen_at,omitempty"`
	SourceType    string `json:"source_type"`
}

type CompanyPracticeGroup struct {
	Company  NodeRef                  `json:"company"`
	Problems []CompanyPracticeProblem `json:"problems"`
}

type RelevantCompany struct {
	Code string `json:"code"`
	Name string `json:"name"`
	CompanyRelevance
}

// NodeDetail is the educational view of one taxonomy node. Families carry
// Subpatterns + legacy methodology fields; subpatterns carry the material,
// mastery, cards and practice sections.
type NodeDetail struct {
	Code            string `json:"code"`
	Name            string `json:"name"`
	Kind            string `json:"kind"`
	Description     string `json:"description"`
	TaxonomyVersion string `json:"taxonomy_version,omitempty"`

	// Family-level methodology (pre-atlas content, still shown for families).
	Techniques          []string         `json:"techniques"`
	RecognitionSymptoms []string         `json:"recognition_symptoms"`
	Checklist           []string         `json:"checklist"`
	ExampleProblems     []ExampleProblem `json:"example_problems"`

	Families    []NodeRef `json:"families,omitempty"`
	Tools       []NodeRef `json:"tools,omitempty"`
	Subpatterns []NodeRef `json:"subpatterns,omitempty"`

	Material          *LearningMaterial      `json:"material,omitempty"`
	Stats             *SubpatternStats       `json:"stats,omitempty"`
	Mastery           *Mastery               `json:"mastery,omitempty"`
	Cards             []CardSummary          `json:"cards"`
	Practice          []PracticeProblem      `json:"practice"`
	CompanyPractice   []CompanyPracticeGroup `json:"company_practice"`
	RelevantCompanies []RelevantCompany      `json:"relevant_companies"`
}
