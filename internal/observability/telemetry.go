package observability

import (
	"log"
	"os"

	"github.com/posthog/posthog-go"
)

var client posthog.Client

// InitTelemetry initializes the PostHog telemetry client
func InitTelemetry() func() {
	token := os.Getenv("POSTHOG_API_KEY")
	if token == "" {
		log.Println("telemetry disabled: POSTHOG_API_KEY is not set")
		return func() {}
	}

	host := os.Getenv("POSTHOG_HOST")
	if host == "" {
		host = "https://eu.i.posthog.com"
	}

	var err error
	client, err = posthog.NewWithConfig(token, posthog.Config{
		Endpoint: host,
	})
	if err != nil {
		log.Printf("telemetry initialization failed: %v", err)
		return func() {}
	}

	log.Println("telemetry (posthog) initialized")

	return func() {
		if client != nil {
			_ = client.Close()
		}
	}
}

// TrackEvent captures a backend event on PostHog
func TrackEvent(distinctID string, eventName string, properties map[string]interface{}) {
	if client == nil {
		return
	}

	props := posthog.NewProperties()
	for k, v := range properties {
		props.Set(k, v)
	}

	err := client.Enqueue(posthog.Capture{
		DistinctId: distinctID,
		Event:      eventName,
		Properties: props,
	})
	if err != nil {
		log.Printf("failed to enqueue telemetry event %s: %v", eventName, err)
	}
}
