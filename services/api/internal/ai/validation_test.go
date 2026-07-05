package ai

import (
	"errors"
	"testing"
)

func TestParseCardsResponse(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		err  error
	}{
		{
			name: "valid cards",
			raw: `[
				{"type":"pattern_recognition","question":"q1","answer":"a1","explanation":"e1"},
				{"type":"algorithm_mechanics","question":"q2","answer":"a2","explanation":""},
				{"type":"edge_case","question":"q3","answer":"a3","explanation":"e3"}
			]`,
		},
		{name: "unknown problem", raw: `{"error":"unknown_problem"}`, err: ErrUnknownProblem},
		{
			name: "extra field",
			raw:  `[{"type":"pattern_recognition","question":"q","answer":"a","explanation":"","extra":true}]`,
			err:  ErrInvalidResponse,
		},
		{
			name: "wrong order",
			raw: `[
				{"type":"edge_case","question":"q1","answer":"a1","explanation":""},
				{"type":"algorithm_mechanics","question":"q2","answer":"a2","explanation":""},
				{"type":"pattern_recognition","question":"q3","answer":"a3","explanation":""}
			]`,
			err: ErrInvalidResponse,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			cards, err := parseCardsResponse(tt.raw)
			if tt.err != nil {
				if !errors.Is(err, tt.err) {
					t.Fatalf("expected %v, got %v", tt.err, err)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if len(cards) != 3 {
				t.Fatalf("expected 3 cards, got %d", len(cards))
			}
		})
	}
}
