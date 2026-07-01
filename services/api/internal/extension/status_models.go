package extension

import "time"

// StatusResponse is the GET /api/v1/me/extension/status payload.
type StatusResponse struct {
	Connected    bool             `json:"connected"`
	Platforms    []PlatformStatus `json:"platforms"`
	RecentEvents []RecentEvent    `json:"recentEvents"`
}

// PlatformStatus summarizes the latest sync activity for one source.
type PlatformStatus struct {
	Source     string    `json:"source"`
	Status     string    `json:"status"`
	LastSyncAt time.Time `json:"lastSyncAt"`
}

// RecentEvent is one extension activity-feed item.
type RecentEvent struct {
	ID         string    `json:"id"`
	Source     string    `json:"source"`
	Event      string    `json:"event"`
	Title      string    `json:"title"`
	OccurredAt time.Time `json:"occurredAt"`
}
