package main

import (
	"bytes"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)


type TestResult struct {
	Name     string `json:"name"`
	Category string `json:"category"`
	Passed   bool   `json:"passed"`
	Duration string `json:"duration"`
	Output   string `json:"output"`
}

type TestSuite struct {
	Results  []TestResult `json:"results"`
	Total    int          `json:"total"`
	Passed   int          `json:"passed"`
	Failed   int          `json:"failed"`
	Duration string       `json:"duration"`
	RanAt    string       `json:"ran_at"`
	Raw      string       `json:"raw"`
}

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/tests", testsHandler)

	addr := ":9000"
	log.Printf("CodeDock test dashboard backend running on %s", addr)
	log.Fatal(http.ListenAndServe(addr, withCORS(mux)))
}

func testsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	suite := runTests()

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(suite); err != nil {
		http.Error(w, "failed to encode response", http.StatusInternalServerError)
		return
	}
}

func withCORS(next http.Handler) http.Handler {
	allowedOrigin := "http://localhost:5173"

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", allowedOrigin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func runTests() TestSuite {
	start := time.Now()

	projectRoot := strings.TrimSpace(os.Getenv("CODEDOCK_PROJECT_ROOTt"))
	if projectRoot == "" {
		projectRoot = "../.."
	}

	absRoot, err := filepath.Abs(projectRoot)
	if err != nil {
		absRoot = projectRoot
	}

	cmd := exec.Command("go", "test", "./...", "-v", "-count=1", "-p", "1")
	cmd.Dir = absRoot

	var stdout bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	runErr := cmd.Run()

	rawOutput := stdout.String()
	if stderr.Len() > 0 {
		if rawOutput != "" && !strings.HasSuffix(rawOutput, "\n") {
			rawOutput += "\n"
		}
		rawOutput += stderr.String()
	}
	rawOutput = strings.TrimSpace(rawOutput)

	suite := TestSuite{
		Results:  []TestResult{},
		Duration: time.Since(start).Round(time.Millisecond).String(),
		RanAt:    time.Now().Format(time.RFC3339),
		Raw:      rawOutput,
	}

	if rawOutput == "" && runErr != nil {
		suite.Raw = runErr.Error()
		return suite
	}

	lines := strings.Split(rawOutput, "\n")

	type inFlightTest struct {
		name   string
		buffer []string
	}

	testBuffers := map[string]*inFlightTest{}
	resultIndex := map[string]int{}

	for _, rawLine := range lines {
		line := strings.TrimRight(rawLine, "\r")
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "=== RUN") {
			name := strings.TrimSpace(strings.TrimPrefix(trimmed, "=== RUN"))
			if name != "" {
				testBuffers[name] = &inFlightTest{
					name:   name,
					buffer: []string{},
				}
			}
			continue
		}

		if strings.HasPrefix(trimmed, "--- PASS:") || strings.HasPrefix(trimmed, "--- FAIL:") {
			passed := strings.HasPrefix(trimmed, "--- PASS:")
			name, duration := parseTestOutcomeLine(trimmed)

			if name == "" {
				continue
			}

			output := ""
			if !passed {
				if inflight, ok := testBuffers[name]; ok {
					output = extractFailureOutput(inflight.buffer)
				}
			}

			result := TestResult{
				Name:     formatTestName(name),
				Category: categoryFromTestName(name),
				Passed:   passed,
				Duration: duration,
				Output:   output,
			}

			if idx, exists := resultIndex[name]; exists {
				suite.Results[idx] = result
			} else {
				resultIndex[name] = len(suite.Results)
				suite.Results = append(suite.Results, result)
			}

			delete(testBuffers, name)
			continue
		}

		for _, inflight := range testBuffers {
			if shouldCaptureLine(trimmed) {
				inflight.buffer = append(inflight.buffer, line)
			}
		}
	}

	for _, result := range suite.Results {
		suite.Total++
		if result.Passed {
			suite.Passed++
		} else {
			suite.Failed++
		}
	}

	return suite
}

func parseTestOutcomeLine(line string) (string, string) {
	parts := strings.SplitN(line, ":", 2)
	if len(parts) != 2 {
		return "", ""
	}

	rest := strings.TrimSpace(parts[1])
	if rest == "" {
		return "", ""
	}

	name := rest
	duration := ""

	if open := strings.LastIndex(rest, "("); open != -1 && strings.HasSuffix(rest, ")") {
		name = strings.TrimSpace(rest[:open])
		duration = strings.TrimSuffix(rest[open+1:], ")")
		duration = parseDuration(duration).String()
	}

	return name, duration
}

func parseDuration(s string) time.Duration {
	s = strings.TrimSpace(s)
	if s == "" {
		return 0
	}

	d, err := time.ParseDuration(s)
	if err != nil {
		return 0
	}

	return d
}

func formatTestName(name string) string {
	name = strings.TrimSpace(name)
	if name == "" {
		return "Unnamed Test"
	}

	if strings.HasPrefix(name, "Test") && len(name) > 4 {
		name = name[4:]
	}

	var out []rune
	runes := []rune(name)

	for i, r := range runes {
		if i > 0 {
			prev := runes[i-1]

			isUpper := r >= 'A' && r <= 'Z'
			prevIsLower := prev >= 'a' && prev <= 'z'
			isDigit := r >= '0' && r <= '9'
			prevIsLetter := (prev >= 'a' && prev <= 'z') || (prev >= 'A' && prev <= 'Z')

			if r == '_' || r == '-' {
				out = append(out, ' ')
				continue
			}

			if (isUpper && prevIsLower) || (isDigit && prevIsLetter) {
				out = append(out, ' ')
			}
		}

		if r != '_' && r != '-' {
			out = append(out, r)
		}
	}

	return strings.TrimSpace(string(out))
}

func extractFailureOutput(lines []string) string {
	if len(lines) == 0 {
		return ""
	}

	var cleaned []string
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}

		if strings.HasPrefix(trimmed, "=== RUN") ||
			strings.HasPrefix(trimmed, "--- PASS:") ||
			strings.HasPrefix(trimmed, "--- FAIL:") ||
			strings.HasPrefix(trimmed, "PASS") ||
			strings.HasPrefix(trimmed, "FAIL") ||
			strings.HasPrefix(trimmed, "ok ") ||
			strings.HasPrefix(trimmed, "?   ") {
			continue
		}

		cleaned = append(cleaned, line)
	}

	return strings.TrimSpace(strings.Join(cleaned, "\n"))
}

func shouldCaptureLine(line string) bool {
	if line == "" {
		return false
	}

	if strings.HasPrefix(line, "=== RUN") ||
		strings.HasPrefix(line, "--- PASS:") ||
		strings.HasPrefix(line, "--- FAIL:") ||
		strings.HasPrefix(line, "PASS") ||
		strings.HasPrefix(line, "FAIL") ||
		strings.HasPrefix(line, "ok ") ||
		strings.HasPrefix(line, "?   ") {
		return false
	}

	return true
}

func categoryFromTestName(name string) string {
	name = strings.TrimPrefix(name, "Test")
	name = strings.TrimSpace(name)

	if name == "" {
		return "General"
	}

	for _, sep := range []string{"_", "/"} {
		if strings.Contains(name, sep) {
			parts := strings.Split(name, sep)
			if len(parts) > 0 && strings.TrimSpace(parts[0]) != "" {
				return strings.TrimSpace(parts[0])
			}
		}
	}

	var prefix []rune
	for i, r := range []rune(name) {
		if i > 0 && r >= 'A' && r <= 'Z' {
			break
		}
		prefix = append(prefix, r)
	}

	category := strings.TrimSpace(string(prefix))
	if category == "" {
		return "General"
	}

	return category
}
