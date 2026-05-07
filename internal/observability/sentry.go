package observability

import (
	"log"
	"os"
	"time"

	"github.com/getsentry/sentry-go"
)

const sentryFlushTimeout = 2 * time.Second

func InitSentry() func() {
	dsn := os.Getenv("SENTRY_DSN")
	if dsn == "" {
		log.Println("sentry disabled: SENTRY_DSN is not set")
		return noop
	}

	if err := sentry.Init(sentry.ClientOptions{
		Dsn:              dsn,
		Environment:      getenvDefault("SENTRY_ENVIRONMENT", "production"),
		Release:          os.Getenv("SENTRY_RELEASE"),
		AttachStacktrace: true,

		// Keep PII disabled for CodeDock by default.
		SendDefaultPII: false,

		// Enable low-volume performance tracing.
		EnableTracing:    true,
		TracesSampleRate: 0.10,
	}); err != nil {
		log.Printf("sentry initialization failed: %v", err)
		return noop
	}

	log.Println("sentry initialized")

	return func() {
		sentry.Flush(sentryFlushTimeout)
	}
}

func CaptureError(err error) {
	if err == nil {
		return
	}

	sentry.CaptureException(err)
}

func CaptureMessage(message string) {
	if message == "" {
		return
	}

	sentry.CaptureMessage(message)
}

func getenvDefault(key, fallback string) string {
	value := os.Getenv(key)
	if value == "" {
		return fallback
	}

	return value
}

func noop() {}
