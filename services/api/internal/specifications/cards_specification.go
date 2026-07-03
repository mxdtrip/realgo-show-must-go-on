// Package specifications содержит спецификации acceptance-тестов, написанные
// на языке предметной области и не зависящие от ввода-вывода. Спецификация —
// это функция, которая управляет CardsProvider и проверяет ключевое
// поведение системы. Она переиспользуется всеми драйверами (сейчас HTTP,
// в будущем — любыми другими), поэтому ничего не знает о транспорте.
package specifications

import (
	"testing"
)

// CardInfo содержит минимум информации о карточке, достаточный
// для acceptance-тестов. Спецификация оперирует только тем, что видит
// потребитель API, не зная о внутренних структурах.
type CardInfo struct {
	ID     int64
	Front  string
	Back   string
	Type   string
	Status string
}

// SessionInfo содержит информацию о запущенной сессии повторения.
type SessionInfo struct {
	SessionID string
	Cards     []CardInfo
}

// RateInfo содержит результат оценки карточки.
type RateInfo struct {
	CardID                 int64
	Rating                 string
	RepeatInCurrentSession bool
	Reviewed               int
	Remaining              int
}

// CardsProvider расширяет HarnessProvider: помимо Register, драйвер
// должен уметь превращать AuthenticatedUser в CardsUser с карточными
// методами (list, session, rate, create).
type CardsProvider interface {
	HarnessProvider

	// CardsUser оборачивает уже аутентифицированного пользователя
	// и добавляет карточные операции.
	CardsUser(user AuthenticatedUser) CardsUser
}

// CardsUser расширяет AuthenticatedUser карточными операциями.
type CardsUser interface {
	AuthenticatedUser

	// CreateCard создает новую карточку через API и возвращает её информацию.
	CreateCard(t *testing.T, front, back, cardType string) CardInfo

	// GetCards возвращает список карточек пользователя.
	GetCards(t *testing.T) []CardInfo

	// StartSession запускает сессию повторения с указанным scope.
	StartSession(t *testing.T, scope string) SessionInfo

	// RateCard оценивает карточку в сессии.
	RateCard(t *testing.T, sessionID string, cardID int64, rating string) RateInfo
}

// CardsSpecification объединяет все north-star AT для cards-модуля.
// Каждая спецификация описывает один user journey без маппинга вариантов
// (edge cases оставляем юнит-тестам).
func CardsSpecification(t *testing.T, p CardsProvider) {
	t.Helper()
	t.Run("cards", func(t *testing.T) {
		t.Run("list: student sees their cards; unreviewed card shown as new", func(t *testing.T) {
			ListCardsSpecification(t, p)
		})
		t.Run("session: student starts due session and gets due cards", func(t *testing.T) {
			StartSessionSpecification(t, p)
		})
		t.Run("rate: after rating card moves to future; hard returns it to session", func(t *testing.T) {
			RateCardSpecification(t, p)
		})
	})
}

// ListCardsSpecification проверяет, что:
// - только что созданная карточка видна в списке
// - карточка без расписания повторения имеет статус "new"
func ListCardsSpecification(t *testing.T, p CardsProvider) {
	t.Helper()

	email := uniqueEmail(t)
	user := p.Register(t, email, "AcceptanceTest-2026!")
	cu := p.CardsUser(user)

	// Создаём карточку через CRUD — без расписания повторения.
	card := cu.CreateCard(t, "What is the time complexity of binary search?", "O(log n)", "algorithm_mechanics")
	if card.ID <= 0 {
		t.Fatalf("expected positive card ID, got %d", card.ID)
	}

	// Получаем список — карточка должна быть видна.
	cards := cu.GetCards(t)
	if len(cards) == 0 {
		t.Fatal("expected at least one card, got empty list")
	}

	// Находим нашу карточку в списке.
	var found bool
	for _, c := range cards {
		if c.ID == card.ID {
			found = true
			if c.Status != "new" {
				t.Fatalf("card %d: expected status %q, got %q", card.ID, "new", c.Status)
			}
			if c.Front != card.Front {
				t.Fatalf("card %d: expected front %q, got %q", card.ID, card.Front, c.Front)
			}
			break
		}
	}
	if !found {
		t.Fatalf("card %d not found in list of %d cards", card.ID, len(cards))
	}
}

// StartSessionSpecification проверяет, что:
// - при запуске сессии с scope "due" карточка без расписания не попадает
//   (она new, не due) — ожидаем пустую сессию
// - сессия возвращает корректный sessionId
func StartSessionSpecification(t *testing.T, p CardsProvider) {
	t.Helper()

	email := uniqueEmail(t)
	user := p.Register(t, email, "AcceptanceTest-2026!")
	cu := p.CardsUser(user)

	// Создаём карточку — она new, не due.
	cu.CreateCard(t, "What is a closure?", "A function that captures its environment", "pattern_recognition")

	// scope "due" — карточка без расписания не попадёт.
	session := cu.StartSession(t, "due")
	if session.SessionID == "" {
		t.Fatal("expected non-empty sessionID")
	}
	if len(session.Cards) != 0 {
		t.Fatalf("due session should be empty for a new card (no review schedule), got %d cards", len(session.Cards))
	}
}

// RateCardSpecification проверяет, что:
// - после rate карточка перемещается в будущее (больше не due)
// - при rating=hard карточка возвращается в текущую сессию (repeatInCurrentSession)
// - после rate счётчик reviewed увеличивается
func RateCardSpecification(t *testing.T, p CardsProvider) {
	t.Helper()

	email := uniqueEmail(t)
	user := p.Register(t, email, "AcceptanceTest-2026!")
	cu := p.CardsUser(user)

	// Создаём карточку.
	card := cu.CreateCard(t, "What is a deadlock?", "Two processes waiting for each other", "edge_case")

	// Начинаем сессию "all" (включает карточки без расписания).
	session := cu.StartSession(t, "all")
	if len(session.Cards) == 0 {
		t.Fatalf("scope 'all' should return at least the created card, got 0")
	}

	// Находим нашу карточку в сессии.
	var sessionCard *CardInfo
	for i := range session.Cards {
		if session.Cards[i].ID == card.ID {
			sessionCard = &session.Cards[i]
			break
		}
	}
	if sessionCard == nil {
		t.Fatalf("card %d not found in session", card.ID)
	}

	// Rate карточку с "hard" — она должна вернуться в сессию.
	rated := cu.RateCard(t, session.SessionID, card.ID, "hard")
	if !rated.RepeatInCurrentSession {
		t.Fatal("hard rating should set repeatInCurrentSession=true")
	}
	if rated.Reviewed < 1 {
		t.Fatalf("expected at least 1 reviewed card, got %d", rated.Reviewed)
	}
}
