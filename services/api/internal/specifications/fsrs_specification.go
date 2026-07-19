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
