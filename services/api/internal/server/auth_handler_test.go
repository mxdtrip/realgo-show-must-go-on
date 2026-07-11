package server

import "testing"

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
