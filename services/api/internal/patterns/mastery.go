package patterns

// Mastery heuristic v1. Deliberately transparent: two observable components,
// fixed weights, thresholds documented below. The API exposes the components
// separately so richer models (recognition, discrimination, transfer) can be
// added later without reinterpreting a single opaque percent.
//
//	practice  — share of the subpattern's linked problems the user solved.
//	retention — share of non-hard ratings among the user's review attempts
//	            mapped to this subpattern (problems, node reviews, cards).
//
// Status thresholds:
//
//	not_started — no solved problems, no in-progress problems, no attempts.
//	weak        — hard ratings dominate recent attempts (>= 40%).
//	learning    — practice below a third of the linked problems.
//	mastered    — >= 85% practice, < 15% hard, nothing due.
//	unstable    — noticeable hard share (>= 15%) or overdue reviews.
//	strong      — everything else.
const (
	practiceWeight  = 6
	retentionWeight = 4

	weakHardShare     = 0.40
	unstableHardShare = 0.15
	learningPractice  = 34
	masteredPractice  = 85
)

func computeMastery(s SubpatternStats) Mastery {
	practice := 0
	if s.ProblemCount > 0 {
		practice = 100 * s.SolvedCount / s.ProblemCount
	}

	hardShare := 0.0
	retention := 100
	if s.AttemptCount > 0 {
		hardShare = float64(s.HardCount) / float64(s.AttemptCount)
		retention = 100 - int(hardShare*100)
	}

	percent := practice
	if s.AttemptCount > 0 {
		percent = (practice*practiceWeight + retention*retentionWeight) / (practiceWeight + retentionWeight)
	}

	status := MasteryStrong
	switch {
	case s.SolvedCount == 0 && s.InProgressCount == 0 && s.AttemptCount == 0:
		status = MasteryNotStarted
		percent = 0
	case s.AttemptCount > 0 && hardShare >= weakHardShare:
		status = MasteryWeak
	case practice < learningPractice:
		status = MasteryLearning
	case practice >= masteredPractice && hardShare < unstableHardShare && s.DueCount == 0:
		status = MasteryMastered
	case hardShare >= unstableHardShare || s.DueCount > 0:
		status = MasteryUnstable
	}

	return Mastery{
		Status:  status,
		Percent: percent,
		Components: MasteryComponents{
			Practice:  practice,
			Retention: retention,
		},
	}
}
