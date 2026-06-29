package reviews

type AttemptRequest struct {
	Rating      int `json:"rating"`
	DurationSec int `json:"duration_sec"`
}
