package extension

import (
	"context"
)

// StatusService builds the extension status response for the current user.
type StatusService struct {
	repo StatusRepository
}

// NewStatusService wires extension status reads.
func NewStatusService(repo StatusRepository) *StatusService {
	return &StatusService{repo: repo}
}

func (s *StatusService) Get(ctx context.Context, userID int64, limit int32) (StatusResponse, error) {
	platforms, err := s.repo.ListPlatformStatuses(ctx, userID)
	if err != nil {
		return StatusResponse{}, err
	}

	events, err := s.repo.ListRecentEvents(ctx, userID, limit)
	if err != nil {
		return StatusResponse{}, err
	}

	connected := false
	for _, platform := range platforms {
		if platform.Status == "connected" {
			connected = true
			break
		}
	}

	return StatusResponse{
		Connected:    connected,
		Platforms:    platforms,
		RecentEvents: events,
	}, nil
}
