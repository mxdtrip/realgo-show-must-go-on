package main_test

import (
	"context"
	"flag"
	"fmt"
	"os"
	"testing"

	"github.com/mxdtrip/freeburger/services/api/internal/specifications"
	httpdriver "github.com/mxdtrip/freeburger/services/api/internal/testdriver/http"
	"github.com/mxdtrip/freeburger/services/api/internal/testutil"
)

// harness — общая пара контейнеров testcontainers, которая запускается
// один раз в TestMain и переиспользуется всеми acceptance-тестами пакета.
// Изоляция между тестами обеспечивается вызовом harness.Reset,
// а не созданием новых контейнеров (это слишком медленно для обычного
// цикла разработки).
var harness *testutil.Harness

// TestMain один раз запускает Harness с Postgres и Redis для всего пакета.
// При запуске с флагом -short контейнеры не поднимаются, поэтому быстрый
// цикл unit-тестов (go test -short ./...) не требует Docker.
func TestMain(m *testing.M) {
	// К моменту вызова TestMain flag.Parse ещё не выполнен, а вызов
	// testing.Short до разбора флагов приводит к panic
	// Поэтому разбираем флаги явно.
	flag.Parse()

	if testing.Short() {
		os.Exit(m.Run())
	}

	h, err := testutil.Start(context.Background())
	if err != nil {
		fmt.Fprintln(os.Stderr, "acceptance: failed to start harness:", err)
		os.Exit(1)
	}
	harness = h

	code := m.Run()
	harness.Stop()
	os.Exit(code)
}

// TestAcceptance_HarnessWalkingSkeleton — цель
// доказать, что весь конвейер работает.
//
// testcontainers с Postgres 16 и Redis 7 → настоящий server.New,
// запущенный через httptest → реальный POST /auth/register,
// возвращающий JWT → GET /me с Bearer-токеном,
// возвращающий email зарегистрированного пользователя.
//
// Здесь нет заглушек — используются только реальные компоненты системы.
func TestAcceptance_HarnessWalkingSkeleton(t *testing.T) {
	if testing.Short() {
		t.Skip("acceptance test requires Docker")
	}

	harness.Reset(t)

	d := httpdriver.New(t, harness)
	defer d.Close()

	specifications.HarnessSpecification(t, d)
}
