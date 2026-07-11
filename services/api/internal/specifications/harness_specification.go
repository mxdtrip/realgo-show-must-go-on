// Package specifications содержит спецификации acceptance-тестов, написанные
// на языке предметной области и не зависящие от ввода-вывода. Спецификация —
// это функция, которая управляет HarnessProvider и проверяет ключевое
// поведение системы. Она переиспользуется всеми драйверами (сейчас HTTP,
// в будущем — любыми другими), поэтому ничего не знает о транспорте.
package specifications

import (
	"strings"
	"testing"
)

// HarnessProvider — контракт, который реализует драйвер, чтобы спецификация
// могла взаимодействовать с системой. Вся работа с вводом-выводом (транспорт,
// жизненный цикл сервера и т.п.) остаётся ответственностью драйвера;
// спецификация же оперирует только понятиями предметной области.
type HarnessProvider interface {
	// Register создаёт новую учётную запись и возвращает уже
	// аутентифицированного пользователя.
	Register(t *testing.T, email, password string) AuthenticatedUser
}

// AuthenticatedUser представляет пользователя, который уже вошёл в систему
// и с которым может работать спецификация.
type AuthenticatedUser interface {
	// OwnIdentity возвращает идентификатор пользователя таким, каким его
	// сообщает сама система (например, email, который возвращает GET /me).
	// Это самая сильная и при этом дешёвая проверка того, что весь конвейер
	// работает от начала до конца.
	OwnIdentity(t *testing.T) string

	// UserID возвращает числовой идентификатор пользователя. Нужен тестовым
	// хелперам (seed-операции, probe), которым для прямой работы с БД требуется
	// именно numeric id, а не email.
	UserID(t *testing.T) int64
}

// HarnessSpecification — acceptance-тест уровня walking skeleton:
// только что зарегистрированный пользователь должен иметь возможность
// получить собственный идентификатор. Спецификация намеренно минимальна —
// она подтверждает работоспособность всего конвейера
// (регистрация → Bearer-аутентификация → получение идентификатора),
// не проверяя данные какой-либо конкретной функциональности.
// Спецификации для карточек будут строиться поверх неё.
func HarnessSpecification(t *testing.T, p HarnessProvider) {
	t.Helper()
	t.Run("freshly registered user can read their own identity", func(t *testing.T) {
		email := uniqueEmail(t)
		user := p.Register(t, email, "AcceptanceTest-2026!")
		if got := user.OwnIdentity(t); got != email {
			t.Fatalf("expected identity %q, got %q", email, got)
		}
	})
}

// uniqueEmail строит корректный email, уникальный в рамках текущего теста,
// используя имя выполняемого теста. Благодаря этому параллельные тесты и
// подтесты не конфликтуют из-за ограничения уникальности users.email.
// Email должен быть лишь корректным и стабильным в пределах одного теста
// (между тестами harness очищает таблицу users), а не глобально уникальным.
func uniqueEmail(t *testing.T) string {
	t.Helper()
	var b strings.Builder
	for _, r := range strings.ToLower(t.Name()) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		default:
			b.WriteRune('.')
		}
	}
	local := strings.Trim(b.String(), ".")
	for strings.Contains(local, "..") {
		local = strings.ReplaceAll(local, "..", ".")
	}
	if len(local) > 48 { // оставляем запас до ограничения в 64 символа для локальной части email
		local = local[:48]
	}
	return local + "@acceptance.test"
}

// uniqueSlug строит уникальный в пределах теста slug (для problems.external_slug,
// где действует UNIQUE(platform_id, external_slug)). Строится из имени теста,
// поэтому параллельные/под-тесты не конфликтуют.
func uniqueSlug(t *testing.T) string {
	t.Helper()
	var b strings.Builder
	for _, r := range strings.ToLower(t.Name()) {
		switch {
		case r >= 'a' && r <= 'z', r >= '0' && r <= '9':
			b.WriteRune(r)
		default:
			b.WriteRune('-')
		}
	}
	s := strings.Trim(b.String(), "-")
	for strings.Contains(s, "--") {
		s = strings.ReplaceAll(s, "--", "-")
	}
	if len(s) > 48 {
		s = s[:48]
	}
	return s
}
