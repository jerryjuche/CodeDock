package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"strings"
	"time"
)

// TestResult holds the outcome of a single test case
type TestResult struct {
	Name     string        `json:"name"`
	Passed   bool          `json:"passed"`
	Duration time.Duration `json:"duration"`
	Output   string        `json:"output"`
}

// TestSuite holds all results for the dashboard
type TestSuite struct {
	Results  []TestResult  `json:"results"`
	Total    int           `json:"total"`
	Passed   int           `json:"passed"`
	Failed   int           `json:"failed"`
	Duration time.Duration `json:"duration"`
	RanAt    string        `json:"ran_at"`
}

func runTests() TestSuite {
	start := time.Now()

	cmd := exec.Command("go", "test", "./...", "-v", "-count=1")
	cmd.Dir = ".."
	var out bytes.Buffer
	var stderr bytes.Buffer
	cmd.Stdout = &out
	cmd.Stderr = &stderr
	_ = cmd.Run() // intentionally ignored; we still parse output

	raw := out.String()
	if raw == "" {
		raw = stderr.String()
	}

	suite := TestSuite{
		RanAt: time.Now().Format("Jan 2, 2006 at 15:04:05"),
	}

	lines := strings.Split(raw, "\n")
	for _, line := range lines {
		line = strings.TrimSpace(line)

		switch {
		case strings.HasPrefix(line, "--- PASS:"):
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				name := strings.TrimSuffix(parts[2], ":")
				dur := parseDuration(parts)

				suite.Results = append(suite.Results, TestResult{
					Name:     formatTestName(name),
					Passed:   true,
					Duration: dur,
				})
				suite.Passed++
				suite.Total++
			}

		case strings.HasPrefix(line, "--- FAIL:"):
			parts := strings.Fields(line)
			if len(parts) >= 3 {
				name := strings.TrimSuffix(parts[2], ":")
				dur := parseDuration(parts)

				suite.Results = append(suite.Results, TestResult{
					Name:     formatTestName(name),
					Passed:   false,
					Duration: dur,
					Output:   extractFailureOutput(raw, name),
				})
				suite.Failed++
				suite.Total++
			}
		}
	}

	suite.Duration = time.Since(start)
	return suite
}

func parseDuration(parts []string) time.Duration {
	for _, p := range parts {
		p = strings.Trim(p, "()")
		if d, err := time.ParseDuration(p); err == nil {
			return d
		}
	}
	return 0
}

func formatTestName(name string) string {
	name = strings.TrimPrefix(name, "Test")
	name = strings.ReplaceAll(name, "_", " — ")

	runes := []rune(name)
	if len(runes) == 0 {
		return ""
	}

	var b strings.Builder
	b.Grow(len(name) + len(name)/4)

	for i, r := range runes {
		if shouldInsertSpace(runes, i) {
			b.WriteRune(' ')
		}
		b.WriteRune(r)
	}

	return strings.Join(strings.Fields(b.String()), " ")
}

func shouldInsertSpace(runes []rune, i int) bool {
	if i <= 0 {
		return false
	}

	curr := runes[i]
	prev := runes[i-1]

	if !isASCIIUpper(curr) {
		return false
	}

	if prev == ' ' || prev == '—' || prev == '-' || prev == '/' || prev == '(' {
		return false
	}

	if isASCIILower(prev) || isDigit(prev) {
		return true
	}

	// Split acronym-to-word boundary: JSONResponse -> JSON Response
	if isASCIIUpper(prev) && i+1 < len(runes) && isASCIILower(runes[i+1]) {
		return true
	}

	return false
}

func isASCIIUpper(r rune) bool { return r >= 'A' && r <= 'Z' }
func isASCIILower(r rune) bool { return r >= 'a' && r <= 'z' }
func isDigit(r rune) bool      { return r >= '0' && r <= '9' }

func extractFailureOutput(raw, testName string) string {
	lines := strings.Split(raw, "\n")
	var capture bool
	var output []string

	for _, line := range lines {
		if strings.Contains(line, "=== RUN   "+testName) {
			capture = true
		}
		if capture {
			if strings.HasPrefix(line, "--- FAIL: "+testName) {
				break
			}
			if strings.TrimSpace(line) != "" && !strings.HasPrefix(line, "=== RUN") {
				output = append(output, strings.TrimSpace(line))
			}
		}
	}

	return strings.Join(output, "\n")
}

func testsAPIHandler(w http.ResponseWriter, r *http.Request) {
	suite := runTests()

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Access-Control-Allow-Origin", "http://localhost:5173")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")

	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	if err := json.NewEncoder(w).Encode(suite); err != nil {
		http.Error(w, "failed to encode test suite", http.StatusInternalServerError)
		return
	}
}

func main() {
	http.HandleFunc("/api/tests", testsAPIHandler)

	fmt.Println("CodeDock Test API → http://localhost:9000/api/tests")
	log.Fatal(http.ListenAndServe(":9000", nil))
}
