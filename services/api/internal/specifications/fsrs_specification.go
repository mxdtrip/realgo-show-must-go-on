package specifications

import (
	"strings"
	"testing"
	"time"
)

// Этот файл содержит north-star acceptance-спецификации для FSRS-движка. Они
// фиксируют два инварианта, без которых два пути планирования (extension-event
// и review-rate) нельзя считать одной и той же моделью:
//
//   1. Параметры FSRS конфигурируемы — retention, заданный приложением,
//      доходит до движка и влияет на интервалы, видимые клиенту.
//   2. Оба пути планирования разделяют один scheduler — для одинакового
//      first-rating они выдают одинаковый nextReviewAt.
//
// Спецификации не знают о HTTP: ими управляет FSRSProvider, который реализует
// драйвер. Пробы состояния (probe) читают БД напрямую — это сознательное
// test-only исключение: read-API для FSRS-полей отсутствует.

// FSRSUser — клиентские операции одного аутентифицированного пользователя,
// затрагивающие FSRS-расписание. Спецификации гоняют именно их, потому что
// именно эти операции наблюдаемы конечным потребителем API.
type FSRSUser interface {
	AuthenticatedUser

	// SubmitExtensionSolved отправляет событие «задача решена» через расширение
	// (POST /extension/events) с указанным рейтингом. Возвращает nextReviewAt из
	// ответа сервера или падает.
	SubmitExtensionSolved(t *testing.T, title, url, slug, rating string) time.Time

	// RateFirstReview оценивает первое повторение карточки, только что
	// созданной через CreateCard, через POST /me/cards/{id}/rate. Возвращает
	// nextReviewAt из ответа сервера.
	RateFirstReview(t *testing.T, front, back, rating string) time.Time

	// CreateUnratedCard создаёт карточку через POST /me/cards без её оценки
	// и возвращает id новой карточки. Используется спекой B1: проверяется, что
	// unrated-карточка либо не имеет schedule вообще (ленивая модель), либо
	// имеет канонический New-state из fsrs.NewCard() — но никогда не несёт
	// placeholder-значений вроде stability=0.1. Сам инвариант зафиксирован в
	// FSRSUnratedCardHasNoOrCanonicalState, а не в этом методе.
	CreateUnratedCard(t *testing.T, front, back, cardType string) int64

	// RateCardAgain повторно оценивает уже оценённую карточку тем же рейтингом
	// через POST /me/cards/{id}/rate. Возвращает nextReviewAt из ответа.
	// Используется спекой B3-test для фиксации контракта replay=advance.
	RateCardAgain(t *testing.T, cardID int64, rating string) time.Time

	// StartSessionAll запускает карточную сессию со scope="all" и возвращает
	// sessionId. Сессия "all" включает карточки без расписания, что заставляет
	// ленивые реализации создать schedule как side-effect. Спека B1 использует
	// это, чтобы проверить созданную строку.
	StartSessionAll(t *testing.T) string

	// LastRatedCardID возвращает id карточки, только что оценённой через
	// RateFirstReview. Нужен спеке B3-test, чтобы сделать второй rate по тому
	// же cardID. Возврат card_id как int64 (а не из response) — тест-only
	// допущение: RateFirstReview не возвращает card_id в response.
	LastRatedCardID(t *testing.T) int64
}

// FSRSState — snapshot FSRS-полей одной строки review_schedules. test-only
// read-контракт; probe читает БД напрямую, потому что HTTP read-API для этих
// полей нет (см. QuizProbe).
type FSRSState struct {
	State        int8
	Stability    float64
	Difficulty   float64
	IntervalDays float64
	ReviewCount  int
	Lapses       int
	LastReviewAt *time.Time
	NextReviewAt time.Time
}

// FSRSStateProbe — test-only read-helper для FSRS-состояния расписания.
// Спецификации используют его, чтобы проверить, что записи в БД консистентны
// с FSRS-инвариантами (B1: unrated → New-state; B3: rate растит review_count).
type FSRSStateProbe interface {
	// CardScheduleState возвращает FSRS-состояние расписания карточки.
	// Второе возвращаемое значение — false, если расписания нет (unrated
	// карточка без истории). Это валидное состояние: «no row = no history».
	CardScheduleState(t *testing.T, userID, cardID int64) (FSRSState, bool)
}

// FSRSProvider — контракт драйвера для FSRS-спецификаций. Расширяет Register
// (harness) операцией превращения пользователя в FSRSUser.
type FSRSProvider interface {
	Register(t *testing.T, email, password string) AuthenticatedUser
	FSRSUser(user AuthenticatedUser) FSRSUser
}

// FSRSRetentionAffectsIntervals — north-star инвариант A2: retention из
// конфигурации приложения доходит до FSRS-движка.
//
// Два независимых пользователя регистрируются в двух независимых системах с
// разным request_retention (low=0.85 vs high=0.99) и отправляют одинаковое
// событие «задача решена» с одинаковым rating. Чем ниже retention, тем длиннее
// допустимый интервал (формула nextInterval обратно пропорциональна retention),
// поэтому low.NextReviewAt должен быть строго позже high.NextReviewAt.
//
// Если retention не пробрасывается в движок, обе системы дадут одинаковые
// интервалы — и ассерт упадёт. Это и есть RED-условие для A2.
func FSRSRetentionAffectsIntervals(t *testing.T, low, high FSRSProvider) {
	t.Helper()
	const rating = "easy"

	// Derive distinct emails and slugs for the two retention variants from a
	// single t (sharing t would otherwise make uniqueEmail/uniqueSlug return
	// identical values and the second Register would 409). Suffixes keep them
	// apart within the same test scope.
	base := uniqueEmail(t)
	lowUser := low.Register(t, withTag(base, ".low"), "AcceptanceTest-2026!")
	highUser := high.Register(t, withTag(base, ".high"), "AcceptanceTest-2026!")

	lowFU := low.FSRSUser(lowUser)
	highFU := high.FSRSUser(highUser)

	slug := uniqueSlug(t)
	lowDue := lowFU.SubmitExtensionSolved(t,
		"Two Sum", "https://leetcode.com/problems/two-sum/",
		slug+"-low", rating)
	highDue := highFU.SubmitExtensionSolved(t,
		"Two Sum", "https://leetcode.com/problems/two-sum/",
		slug+"-high", rating)

	// FSRS nextInterval: lower retention → longer interval.
	if !lowDue.After(highDue) {
		t.Fatalf("retention should affect intervals: low (0.85) next=%v must be after high (0.99) next=%v",
			lowDue, highDue)
	}
}

// withTag inserts a tag before the @ of an email built by uniqueEmail so two
// users can be registered within the same test without colliding. The tag uses
// a leading separator that uniqueEmail already produces, keeping the local part
// syntactically valid (no leading/trailing dot).
func withTag(email, tag string) string {
	at := strings.IndexByte(email, '@')
	if at < 0 {
		return email + tag
	}
	return email[:at] + tag + email[at:]
}

// FSRSPathsShareAlgorithm — north-star инвариант A1: оба пути планирования
// (extension-event и review-rate) используют один scheduler с одними
// параметрами, поэтому для одинакового first-rating выдают одинаковый
// nextReviewAt.
//
// Один пользователь в одной системе делает два действия:
//   - отправляет extension-event с rating=easy (создаёт расписание задачи);
//   - создаёт карточку и оценивает её с rating=easy через cards-rate.
//
// Оба first-rating прогоняются через FSRS с одними и теми же параметрами
// (поэтому должны дать идентичный интервал), но на разных сущностях, поэтому
// session-card и extension-problem не конфликтуют. Интервал — это разница
// nextReviewAt − now, поэтому ассерт сравнивает интервалы (с допуском в
// секунды на время запросов), а не абсолютные метки времени.
//
// Если reviewService использует свой собственный *fsrs.FSRS (с другими
// параметрами) вместо инжектированного scheduler'а, интервалы разойдутся — и
// ассерт упадёт. Это и есть RED-условие для A1.
func FSRSPathsShareAlgorithm(t *testing.T, p FSRSProvider) {
	t.Helper()
	const rating = "easy"

	user := p.Register(t, uniqueEmail(t), "AcceptanceTest-2026!")
	fu := p.FSRSUser(user)

	now := time.Now().UTC()
	extDue := fu.SubmitExtensionSolved(t,
		"Valid Anagram", "https://leetcode.com/problems/valid-anagram/",
		uniqueSlug(t)+"-ext", rating)
	cardDue := fu.RateFirstReview(t,
		"What is a hash map?", "A key-value data structure", rating)

	extInterval := extDue.Sub(now)
	cardInterval := cardDue.Sub(now)

	const tolerance = 2 * time.Second
	if diff := extInterval - cardInterval; diff > tolerance || diff < -tolerance {
		t.Fatalf("paths must share one FSRS scheduler: extension interval=%v, card interval=%v, diff=%v (tolerance %v)",
			extInterval, cardInterval, diff, tolerance)
	}
}

// FSRSFirstRateComputesCanonicalState — north-star инвариант B1: после
// первого rate карточки расписание в БД содержит честно вычисленные FSRS
// значения, а не placeholder-хардкод из CreateCardReviewSchedule.
//
// Cards-path создаёт schedule в два шага: EnsureReviewSchedule вставляет
// строку с hardcoded stability/difficulty (placeholder), затем RateReview
// должен её перезаписать вычисленными значениями через scheduler. Этот AT
// доказывает, что перезапись действительно произошла: после первого rate
//   - state != 0 (FSRS вышел из New)
//   - stability > 0 (FSRS вычислил S0)
//   - difficulty > 0 (FSRS вычислил D0)
//   - review_count == 1
//   - last_review_at IS NOT NULL
//
// Если EnsureReviewSchedule вставляет stability=0.1, но RateReview падает
// между insert и persist (или случайно перетирает stability нулем), ассерт
// поймает это: stability останется placeholder'ом, но review_count=1 скажет,
// что rate якобы прошёл.
func FSRSFirstRateComputesCanonicalState(t *testing.T, p FSRSProvider, probe FSRSStateProbe) {
	t.Helper()

	user := p.Register(t, uniqueEmail(t), "AcceptanceTest-2026!")
	fu := p.FSRSUser(user)
	uid := user.UserID(t)

	fu.RateFirstReview(t,
		"What is Big-O of binary search?",
		"O(log n)",
		"normal")

	cardID := fu.LastRatedCardID(t)
	state, ok := probe.CardScheduleState(t, uid, cardID)
	if !ok {
		t.Fatal("expected review schedule after first rate, got none")
	}

	if state.State == 0 {
		t.Errorf("after first rate: state still New (0), FSRS should advance it; got %+v", state)
	}
	if state.Stability <= 0 {
		t.Errorf("after first rate: stability = %v, want > 0 (FSRS S0)", state.Stability)
	}
	if state.Difficulty <= 0 {
		t.Errorf("after first rate: difficulty = %v, want > 0 (FSRS D0)", state.Difficulty)
	}
	if state.ReviewCount != 1 {
		t.Errorf("after first rate: review_count = %d, want 1", state.ReviewCount)
	}
	if state.LastReviewAt == nil {
		t.Error("after first rate: last_review_at is NULL, want a timestamp")
	}
}

// FSRSUnratedCardHasNoOrCanonicalState — north-star инвариант B1: unrated
// карточка (создана через POST /me/cards, не оценена) либо не имеет schedule
// вообще («no row = no history» — ленивая модель), либо, если реализация
// создаёт строку при создании/листинге, эта строка обязана быть в каноническом
// New-state из fsrs.NewCard():
//   - state = 0 (New)
//   - stability = 0
//   - difficulty = 0
//   - review_count = 0
//   - last_review_at IS NULL
//
// Что запрещено: unrated-карточка со stability=0.1 или difficulty=5.0 — это
// «placeholder с историей», который выглядит неконсистентно.
func FSRSUnratedCardHasNoOrCanonicalState(t *testing.T, p FSRSProvider, probe FSRSStateProbe) {
	t.Helper()

	user := p.Register(t, uniqueEmail(t), "AcceptanceTest-2026!")
	fu := p.FSRSUser(user)
	uid := user.UserID(t)

	cardID := fu.CreateUnratedCard(t,
		"What is a closure?",
		"A function that captures its environment",
		"pattern_recognition")

	// Listing through a session may trigger lazy schedule creation as a side
	// effect. If it does, the row must carry canonical New-state.
	fu.StartSessionAll(t)

	state, ok := probe.CardScheduleState(t, uid, cardID)
	if !ok {
		// No schedule row yet — lazy model, unrated card has no history.
		// This is valid; nothing to assert.
		return
	}
	if state.State != 0 {
		t.Errorf("unrated card state: expected 0 (New), got %d", state.State)
	}
	if state.Stability != 0 {
		t.Errorf("unrated card stability: expected 0 (no history yet), got %v", state.Stability)
	}
	if state.Difficulty != 0 {
		t.Errorf("unrated card difficulty: expected 0 (no history yet), got %v", state.Difficulty)
	}
	if state.ReviewCount != 0 {
		t.Errorf("unrated card review_count: expected 0, got %d", state.ReviewCount)
	}
	if state.LastReviewAt != nil {
		t.Errorf("unrated card last_review_at: expected nil, got %v", *state.LastReviewAt)
	}
}

// FSRSManualRateReplayAdvances — фиксация контракта идемпотентности manual
// rate (B3-test): повторный POST /me/cards/{id}/rate с тем же рейтингом
// засчитывается как новая попытка, FSRS пересчитывает интервал, review_count
// растёт. Поведение НЕ меняем в этой итерации — только закрепляем, чтобы
// случайная регрессия (например, добавление replay-блокировки) не прошла
// незамеченной.
//
// Замечание: спека использует card-rate path, а не /me/reviews/{id}/rate,
// потому что cards-path уже обёрнут в FSRSUser и не требует seed'а проблемы.
// Контракт идемпотентности общий: и /me/reviews, и /me/cards идут в один
// reviewService.RateReview.
func FSRSManualRateReplayAdvances(t *testing.T, p FSRSProvider, probe FSRSStateProbe) {
	t.Helper()
	const rating = "easy"

	user := p.Register(t, uniqueEmail(t), "AcceptanceTest-2026!")
	fu := p.FSRSUser(user)
	uid := user.UserID(t)

	// First rate — инициализирует расписание.
	firstDue := fu.RateFirstReview(t,
		"What is a closure?",
		"A function that captures its environment",
		rating)

	// Находим card_id только что оценённой карточки через probe — он не
	// возвращается из RateFirstReview напрямую.
	cardID := fu.LastRatedCardID(t)
	stateAfterFirst, ok := probe.CardScheduleState(t, uid, cardID)
	if !ok {
		t.Fatalf("after first rate: expected schedule to exist for card %d", cardID)
	}
	if stateAfterFirst.ReviewCount != 1 {
		t.Fatalf("after first rate: expected review_count=1, got %d", stateAfterFirst.ReviewCount)
	}

	// Second rate — тот же рейтинг, тот же card. По контракту должен advance.
	secondDue := fu.RateCardAgain(t, cardID, rating)
	stateAfterSecond, ok := probe.CardScheduleState(t, uid, cardID)
	if !ok {
		t.Fatalf("after second rate: expected schedule to exist for card %d", cardID)
	}

	if stateAfterSecond.ReviewCount != 2 {
		t.Fatalf("after second rate: expected review_count=2, got %d (replay did not advance)", stateAfterSecond.ReviewCount)
	}
	// FSRS для Review-state + easy должен дать интервал не меньше первого
	// (стабильность не убывает от easy на второй итерации). Сравниваем
	// абсолютные nextReviewAt: второй должен быть не раньше первого.
	if secondDue.Before(firstDue) {
		t.Fatalf("replay should advance nextReviewAt forward or equal: first=%v, second=%v",
			firstDue, secondDue)
	}
}
