// Package aitest provides a deterministic, network-free ai.Provider for unit
// and integration tests (fake-provider testing per the AI-card generation
// contract — no real LLM calls in test suites).
package aitest

import (
	"context"
	"sync"
	"time"

	"github.com/mxdtrip/freeburger/services/api/internal/ai"
)

// Fake is a test double for ai.Provider. Zero value returns three canned
// cards; set Err to simulate a refusal (ai.ErrUnknownProblem,
// ai.ErrQuotaExceeded) or any other failure. Safe for concurrent use so
// tests can assert exactly-once-call semantics under concurrent generation.
type Fake struct {
	mu      sync.Mutex
	Err     error
	Cards   []ai.GeneratedCard
	Version string
	// Delay, if set, makes GenerateCards block for this long (or until ctx is
	// done) before returning — useful for asserting a caller doesn't wait on
	// generation (e.g. Provisioner.Ensure only ever kicks it off async).
	Delay time.Duration
	calls int
}

// New builds a Fake with the default three-card canned response.
func New() *Fake {
	return &Fake{}
}

func (f *Fake) GenerateCards(ctx context.Context, in ai.GenerateCardsInput) ([]ai.GeneratedCard, error) {
	f.mu.Lock()
	f.calls++
	delay := f.Delay
	f.mu.Unlock()

	if delay > 0 {
		select {
		case <-time.After(delay):
		case <-ctx.Done():
			return nil, ctx.Err()
		}
	}

	if f.Err != nil {
		return nil, f.Err
	}
	if f.Cards != nil {
		return f.Cards, nil
	}
	return defaultCards(in), nil
}

func (f *Fake) PromptVersion() string {
	if f.Version != "" {
		return f.Version
	}
	return "fake-v1"
}

func (f *Fake) ProviderName() string { return "fake" }

func (f *Fake) ModelName() string { return "fake-model" }

// Calls reports how many times GenerateCards was invoked.
func (f *Fake) Calls() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls
}

func defaultCards(in ai.GenerateCardsInput) []ai.GeneratedCard {
	return []ai.GeneratedCard{
		{
			Type:        "pattern_recognition",
			Question:    "Какой паттерн подходит для " + in.Title + "?",
			Answer:      "Fake answer: pattern recognition.",
			Explanation: "fake",
		},
		{
			Type:        "algorithm_mechanics",
			Question:    "Что меняется на каждом шаге в " + in.Title + "?",
			Answer:      "Fake answer: algorithm mechanics.",
			Explanation: "fake",
		},
		{
			Type:        "edge_case",
			Question:    "Какой граничный случай важен в " + in.Title + "?",
			Answer:      "Fake answer: edge case.",
			Explanation: "fake",
		},
	}
}
