package reviews

type AttemptRequest struct {
	Rating      string `json:"rating"`
	DurationSec int    `json:"duration_sec"`
}
