package ai

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

var expectedCardTypes = [...]string{
	"pattern_recognition",
	"algorithm_mechanics",
	"edge_case",
}

func parseCardsResponse(raw string) ([]GeneratedCard, error) {
	body := []byte(strings.TrimSpace(raw))
	if len(body) == 0 {
		return nil, ErrInvalidResponse
	}

	if body[0] == '{' {
		var refusal struct {
			Error string `json:"error"`
		}
		if err := decodeStrict(body, &refusal); err != nil {
			return nil, fmt.Errorf("%w: %v", ErrInvalidResponse, err)
		}
		if refusal.Error == "unknown_problem" {
			return nil, ErrUnknownProblem
		}
		return nil, ErrInvalidResponse
	}

	var cards []GeneratedCard
	if err := decodeStrict(body, &cards); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidResponse, err)
	}
	if err := validateGeneratedCards(cards); err != nil {
		return nil, err
	}
	return cards, nil
}

func validateGeneratedCards(cards []GeneratedCard) error {
	if len(cards) != len(expectedCardTypes) {
		return fmt.Errorf("%w: expected 3 cards", ErrInvalidResponse)
	}
	for i, card := range cards {
		if card.Type != expectedCardTypes[i] {
			return fmt.Errorf("%w: card %d has invalid type", ErrInvalidResponse, i+1)
		}
		if strings.TrimSpace(card.Question) == "" || strings.TrimSpace(card.Answer) == "" {
			return fmt.Errorf("%w: card %d has empty question or answer", ErrInvalidResponse, i+1)
		}
		cards[i].Question = strings.TrimSpace(card.Question)
		cards[i].Answer = strings.TrimSpace(card.Answer)
		cards[i].Explanation = strings.TrimSpace(card.Explanation)
	}
	return nil
}

func decodeStrict(data []byte, dst any) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(dst); err != nil {
		return err
	}
	if dec.Decode(&struct{}{}) == nil {
		return errors.New("extra json value")
	}
	return nil
}
