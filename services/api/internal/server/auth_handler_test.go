package server

import (
	"encoding/json"
	"testing"
)

func TestOptionalNullableStringDistinguishesMissingNullAndValue(t *testing.T) {
	var request patchProfileRequest
	if err := json.Unmarshal([]byte(`{}`), &request); err != nil {
		t.Fatalf("decode missing interview_date: %v", err)
	}
	if request.InterviewDate.Set {
		t.Fatal("missing interview_date was marked as set")
	}

	if err := json.Unmarshal([]byte(`{"interview_date":null}`), &request); err != nil {
		t.Fatalf("decode null interview_date: %v", err)
	}
	if !request.InterviewDate.Set || request.InterviewDate.Value != nil {
		t.Fatalf("null interview_date = %#v, want set nullable value", request.InterviewDate)
	}

	if err := json.Unmarshal([]byte(`{"interview_date":"2026-08-12T09:00:00Z"}`), &request); err != nil {
		t.Fatalf("decode interview_date value: %v", err)
	}
	if !request.InterviewDate.Set || request.InterviewDate.Value == nil || *request.InterviewDate.Value != "2026-08-12T09:00:00Z" {
		t.Fatalf("valued interview_date = %#v", request.InterviewDate)
	}
}

func TestValidTimezone(t *testing.T) {
	valid := []string{"UTC", "Europe/Moscow", "America/New_York", "Asia/Tokyo"}
	for _, tz := range valid {
		if !validTimezone(tz) {
			t.Errorf("validTimezone(%q) = false, want true", tz)
		}
	}

	// "Local" is valid for Go but not for Postgres AT TIME ZONE, which is where
	// the stored value is ultimately used.
	invalid := []string{"Local", "Мордор", "Europe/NotACity", "UTC+3h", " "}
	for _, tz := range invalid {
		if validTimezone(tz) {
			t.Errorf("validTimezone(%q) = true, want false", tz)
		}
	}
}

func TestNormaliseTopicsDeduplicatesAndBoundsInput(t *testing.T) {
	got, err := normaliseTopics([]string{" Two-Pointers ", "two_pointers", "", "ARRAYS"})
	if err != nil {
		t.Fatalf("normaliseTopics: %v", err)
	}
	if len(got) != 2 || got[0] != "two_pointers" || got[1] != "arrays" {
		t.Fatalf("normaliseTopics = %#v", got)
	}

	tooMany := make([]string, maxTargetTopics+1)
	if _, err := normaliseTopics(tooMany); err == nil {
		t.Fatal("normaliseTopics accepted too many topics")
	}
}
