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

func dashboardHandler(w http.ResponseWriter, r *http.Request) {
	suite := runTests()

	suiteJSON, err := json.Marshal(suite)
	if err != nil {
		http.Error(w, "failed to render test suite", http.StatusInternalServerError)
		return
	}

	passRate := 0
	if suite.Total > 0 {
		passRate = (suite.Passed * 100) / suite.Total
	}

	failedColor := "var(--muted)"
	if suite.Failed > 0 {
		failedColor = "var(--red)"
	}

	progressRateColor := "var(--red)"
	if passRate == 100 {
		progressRateColor = "var(--green)"
	} else if passRate >= 70 {
		progressRateColor = "var(--yellow)"
	}

	progressFillColor := "var(--red)"
	if passRate == 100 {
		progressFillColor = "var(--green)"
	} else if passRate >= 70 {
		progressFillColor = "var(--yellow)"
	}

	progressGlow := "var(--glow-r)"
	if passRate == 100 {
		progressGlow = "var(--glow-g)"
	}

	html := fmt.Sprintf(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CodeDock Test Dashboard</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after {
      box-sizing: border-box;
    }

    :root {
      --bg: #0a0f1a;
      --bg-soft: #0f1724;
      --panel: rgba(15, 23, 36, 0.82);
      --panel-strong: #111827;
      --panel-hover: #172033;
      --border: rgba(148, 163, 184, 0.14);
      --border-strong: rgba(148, 163, 184, 0.22);
      --text: #e5edf7;
      --text-soft: #9fb0c7;
      --text-muted: #6f8198;
      --green: #22c55e;
      --green-soft: rgba(34, 197, 94, 0.12);
      --red: #ef4444;
      --red-soft: rgba(239, 68, 68, 0.12);
      --amber: #f59e0b;
      --amber-soft: rgba(245, 158, 11, 0.12);
      --blue: #38bdf8;
      --blue-soft: rgba(56, 189, 248, 0.12);
      --shadow-lg: 0 18px 50px rgba(0, 0, 0, 0.35);
      --shadow-md: 0 10px 30px rgba(0, 0, 0, 0.22);
      --radius-xl: 20px;
      --radius-lg: 16px;
      --radius-md: 12px;
      --radius-sm: 10px;
      --max-width: 1180px;
    }

    html, body {
      margin: 0;
      padding: 0;
      min-height: 100%%;
      background:
        radial-gradient(circle at top left, rgba(56, 189, 248, 0.08), transparent 30%%),
        radial-gradient(circle at top right, rgba(34, 197, 94, 0.06), transparent 25%%),
        linear-gradient(180deg, #09101b 0%%, #0a0f1a 100%%);
      color: var(--text);
      font-family: 'Inter', sans-serif;
    }

    body {
      min-height: 100vh;
      padding: 32px 20px 48px;
    }

    .shell {
      max-width: var(--max-width);
      margin: 0 auto;
    }

    .topbar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 18px;
      margin-bottom: 28px;
      flex-wrap: wrap;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .brand-mark {
      width: 44px;
      height: 44px;
      border-radius: 14px;
      display: grid;
      place-items: center;
      background: linear-gradient(135deg, rgba(56,189,248,0.18), rgba(34,197,94,0.18));
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.05);
      font-size: 18px;
      font-weight: 800;
      color: #dff7ff;
    }

    .brand-copy h1 {
      margin: 0;
      font-size: 1.25rem;
      line-height: 1.1;
      font-weight: 800;
      letter-spacing: -0.02em;
    }

    .brand-copy p {
      margin: 4px 0 0;
      color: var(--text-soft);
      font-size: 0.92rem;
    }

    .toolbar {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .pill {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 40px;
      padding: 0 14px;
      border-radius: 999px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      color: var(--text-soft);
      font-size: 0.88rem;
      backdrop-filter: blur(8px);
    }

    .pill-dot {
      width: 8px;
      height: 8px;
      border-radius: 999px;
      background: var(--green);
      box-shadow: 0 0 0 6px rgba(34,197,94,0.12);
    }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 42px;
      padding: 0 16px;
      border-radius: 12px;
      border: 1px solid var(--border-strong);
      background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.03));
      color: var(--text);
      text-decoration: none;
      font-weight: 600;
      font-size: 0.92rem;
      transition: 160ms ease;
      box-shadow: var(--shadow-md);
    }

    .button:hover {
      transform: translateY(-1px);
      background: linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04));
      border-color: rgba(56, 189, 248, 0.32);
    }

    .hero {
      display: grid;
      grid-template-columns: 1.6fr 1fr;
      gap: 18px;
      margin-bottom: 18px;
    }

    .hero-card,
    .summary-card,
    .card,
    .results-card {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: var(--radius-xl);
      backdrop-filter: blur(12px);
      box-shadow: var(--shadow-lg);
    }

    .hero-card {
      padding: 28px;
      position: relative;
      overflow: hidden;
    }

    .hero-card::before {
      content: "";
      position: absolute;
      inset: 0;
      background:
        linear-gradient(135deg, rgba(56,189,248,0.08), transparent 40%%),
        radial-gradient(circle at 80%% 20%%, rgba(34,197,94,0.08), transparent 22%%);
      pointer-events: none;
    }

    .hero-label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      min-height: 30px;
      padding: 0 12px;
      border-radius: 999px;
      background: rgba(56,189,248,0.08);
      border: 1px solid rgba(56,189,248,0.16);
      color: #b6e8ff;
      font-size: 0.78rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin-bottom: 16px;
    }

    .hero-title {
      font-size: clamp(1.7rem, 3vw, 2.5rem);
      line-height: 1.05;
      letter-spacing: -0.04em;
      margin: 0 0 12px;
      font-weight: 800;
      max-width: 12ch;
    }

    .hero-text {
      margin: 0;
      color: var(--text-soft);
      max-width: 62ch;
      line-height: 1.65;
      font-size: 0.98rem;
    }

    .summary-card {
      padding: 24px;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      gap: 18px;
    }

    .summary-top {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 12px;
    }

    .summary-title {
      margin: 0;
      font-size: 0.9rem;
      color: var(--text-soft);
      font-weight: 600;
    }

    .summary-rate {
      margin-top: 8px;
      font-size: 2.8rem;
      line-height: 1;
      font-weight: 800;
      letter-spacing: -0.05em;
      color: %s;
    }

    .summary-caption {
      color: var(--text-muted);
      font-size: 0.88rem;
    }

    .progress {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .progress-meta {
      display: flex;
      justify-content: space-between;
      gap: 10px;
      font-size: 0.86rem;
      color: var(--text-soft);
    }

    .progress-track {
      width: 100%%;
      height: 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      overflow: hidden;
      border: 1px solid rgba(255,255,255,0.05);
    }

    .progress-fill {
      height: 100%%;
      width: %d%%;
      border-radius: inherit;
      background: %s;
      box-shadow: 0 0 28px %s;
      transition: width 0.5s ease;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 18px;
      margin-bottom: 22px;
    }

    .card {
      padding: 22px;
      position: relative;
      overflow: hidden;
    }

    .card::after {
      content: "";
      position: absolute;
      inset: auto 0 0 0;
      height: 3px;
      opacity: 0.9;
    }

    .card.total::after { background: var(--blue); }
    .card.passed::after { background: var(--green); }
    .card.failed::after { background: %s; }
    .card.duration::after { background: var(--amber); }

    .card-label {
      color: var(--text-muted);
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.02em;
      margin-bottom: 12px;
    }

    .card-value {
      font-size: 2.15rem;
      line-height: 1;
      letter-spacing: -0.04em;
      font-weight: 800;
      margin-bottom: 8px;
    }

    .card.total .card-value { color: var(--blue); }
    .card.passed .card-value { color: var(--green); }
    .card.failed .card-value { color: %s; }
    .card.duration .card-value {
      color: var(--amber);
      font-size: 1.5rem;
    }

    .card-sub {
      color: var(--text-soft);
      font-size: 0.88rem;
    }

    .results-card {
      padding: 0;
      overflow: hidden;
    }

    .results-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding: 22px 24px;
      border-bottom: 1px solid var(--border);
      flex-wrap: wrap;
    }

    .results-title-wrap h2 {
      margin: 0;
      font-size: 1.05rem;
      font-weight: 700;
      letter-spacing: -0.02em;
    }

    .results-title-wrap p {
      margin: 6px 0 0;
      color: var(--text-soft);
      font-size: 0.9rem;
    }

    .legend {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }

    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-radius: 999px;
      background: rgba(255,255,255,0.04);
      border: 1px solid var(--border);
      color: var(--text-soft);
      font-size: 0.82rem;
      font-weight: 500;
    }

    .legend-mark {
      width: 8px;
      height: 8px;
      border-radius: 999px;
    }

    .results-list {
      display: flex;
      flex-direction: column;
    }

    .result-row {
      display: grid;
      grid-template-columns: auto 1fr auto auto;
      gap: 16px;
      align-items: start;
      padding: 18px 24px;
      border-bottom: 1px solid rgba(255,255,255,0.04);
      transition: background 140ms ease;
    }

    .result-row:hover {
      background: rgba(255,255,255,0.025);
    }

    .result-row.pass {
      background-image: linear-gradient(90deg, rgba(34,197,94,0.035), transparent 16%%);
    }

    .result-row.fail {
      background-image: linear-gradient(90deg, rgba(239,68,68,0.06), transparent 18%%);
    }

    .status {
      width: 34px;
      height: 34px;
      border-radius: 12px;
      display: grid;
      place-items: center;
      font-size: 0.96rem;
      font-weight: 800;
      margin-top: 2px;
      border: 1px solid transparent;
    }

    .result-row.pass .status {
      background: var(--green-soft);
      color: var(--green);
      border-color: rgba(34,197,94,0.18);
    }

    .result-row.fail .status {
      background: var(--red-soft);
      color: var(--red);
      border-color: rgba(239,68,68,0.18);
    }

    .result-main {
      min-width: 0;
    }

    .result-title {
      margin: 0;
      font-size: 0.98rem;
      font-weight: 700;
      letter-spacing: -0.015em;
      word-break: break-word;
    }

    .result-sub {
      margin-top: 6px;
      color: var(--text-soft);
      font-size: 0.86rem;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      min-height: 30px;
      padding: 0 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.05);
      border: 1px solid var(--border);
      color: var(--text-soft);
      font-size: 0.76rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      white-space: nowrap;
    }

    .result-time {
      min-width: 78px;
      text-align: right;
      color: var(--text-soft);
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.84rem;
      padding-top: 7px;
      white-space: nowrap;
    }

    .failure-output {
      margin-top: 14px;
      padding: 14px 16px;
      border-radius: 14px;
      background: rgba(239,68,68,0.08);
      border: 1px solid rgba(239,68,68,0.16);
      color: #ffd2d8;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.78rem;
      line-height: 1.65;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }

    .empty-state {
      padding: 38px 24px 42px;
      text-align: center;
      color: var(--text-soft);
    }

    .empty-state h3 {
      margin: 0 0 10px;
      font-size: 1rem;
    }

    .empty-state p {
      margin: 0;
      color: var(--text-muted);
    }

    @media (max-width: 1024px) {
      .hero {
        grid-template-columns: 1fr;
      }

      .stats-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 760px) {
      body {
        padding: 20px 14px 36px;
      }

      .hero-card,
      .summary-card,
      .card {
        padding: 20px;
      }

      .result-row {
        grid-template-columns: auto 1fr;
      }

      .tag,
      .result-time {
        margin-left: 50px;
      }

      .result-time {
        text-align: left;
        padding-top: 0;
      }
    }

    @media (max-width: 560px) {
      .stats-grid {
        grid-template-columns: 1fr;
      }

      .topbar {
        align-items: stretch;
      }

      .toolbar {
        width: 100%%;
      }

      .button,
      .pill {
        width: 100%%;
        justify-content: center;
      }
    }
  </style>
</head>
<body>
  <div class="shell">
    <div class="topbar">
      <div class="brand">
        <div class="brand-mark">CD</div>
        <div class="brand-copy">
          <h1>CodeDock Test Dashboard</h1>
          <p>Integration suite status for your Go application</p>
        </div>
      </div>

      <div class="toolbar">
        <div class="pill">
          <span class="pill-dot"></span>
          <span>Last run: %s</span>
        </div>
        <a href="/" class="button">Re-run tests</a>
      </div>
    </div>

    <section class="hero">
      <div class="hero-card">
        <div class="hero-label">TEST EXECUTION SUMMARY</div>
        <h2 class="hero-title">Fast visibility into suite health.</h2>
        <p class="hero-text">
          Review pass rate, inspect failing cases, and track execution output in one focused view.
          The dashboard keeps the existing test runner logic intact and only improves the presentation layer.
        </p>
      </div>

      <div class="summary-card">
        <div class="summary-top">
          <div>
            <p class="summary-title">Pass Rate</p>
            <div class="summary-rate">%d%%</div>
          </div>
          <div class="summary-caption">%d passed · %d failed</div>
        </div>

        <div class="progress">
          <div class="progress-meta">
            <span>Suite completion</span>
            <span>%d / %d tests</span>
          </div>
          <div class="progress-track">
            <div class="progress-fill"></div>
          </div>
        </div>
      </div>
    </section>

    <section class="stats-grid">
      <div class="card total">
        <div class="card-label">Total Tests</div>
        <div class="card-value">%d</div>
        <div class="card-sub">All discovered test cases</div>
      </div>

      <div class="card passed">
        <div class="card-label">Passed</div>
        <div class="card-value">%d</div>
        <div class="card-sub">Successful executions</div>
      </div>

      <div class="card failed">
        <div class="card-label">Failed</div>
        <div class="card-value">%d</div>
        <div class="card-sub">Requires investigation</div>
      </div>

      <div class="card duration">
        <div class="card-label">Runtime</div>
        <div class="card-value">%s</div>
        <div class="card-sub">Full suite execution time</div>
      </div>
    </section>

    <section class="results-card">
      <div class="results-header">
        <div class="results-title-wrap">
          <h2>Test Results</h2>
          <p>Each result keeps its original parsing and failure output from your current runner.</p>
        </div>

        <div class="legend">
          <div class="legend-item">
            <span class="legend-mark" style="background: var(--green)"></span>
            <span>Pass</span>
          </div>
          <div class="legend-item">
            <span class="legend-mark" style="background: var(--red)"></span>
            <span>Fail</span>
          </div>
        </div>
      </div>

      <div class="results-list" id="resultsList"></div>
    </section>
  </div>

  <script>
    const suite = %s;

    function getCategory(name) {
      const n = name.toLowerCase();
      if (n.includes('register') || n.includes('login')) return 'Auth';
      if (n.includes('protected') || n.includes('token')) return 'Middleware';
      if (n.includes('room')) return 'Rooms';
      return 'General';
    }

    function formatDuration(ns) {
      if (!ns) return '—';
      if (ns < 1000000) return (ns / 1000).toFixed(0) + 'µs';
      if (ns < 1000000000) return (ns / 1000000).toFixed(0) + 'ms';
      return (ns / 1000000000).toFixed(2) + 's';
    }

    function escapeHtml(value) {
      return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }

    const list = document.getElementById('resultsList');

    if (!suite.results || suite.results.length === 0) {
      list.innerHTML = [
        '<div class="empty-state">',
          '<h3>No tests found</h3>',
          '<p>Make sure your test files are in the expected location and the suite can be discovered by go test.</p>',
        '</div>'
      ].join('');
    } else {
      suite.results.forEach((test) => {
        const row = document.createElement('div');
        row.className = 'result-row ' + (test.passed ? 'pass' : 'fail');

        const failure = (!test.passed && test.output)
          ? '<div class="failure-output">' + escapeHtml(test.output) + '</div>'
          : '';

        row.innerHTML = [
          '<div class="status">', test.passed ? '✓' : '✕', '</div>',
          '<div class="result-main">',
            '<h3 class="result-title">', escapeHtml(test.name), '</h3>',
            '<div class="result-sub">', test.passed ? 'Completed successfully' : 'Execution failed', '</div>',
            failure,
          '</div>',
          '<div class="tag">', escapeHtml(getCategory(test.name)), '</div>',
          '<div class="result-time">', escapeHtml(formatDuration(test.duration)), '</div>'
        ].join('');

        list.appendChild(row);
      });
    }
  </script>
</body>
</html>`,
	progressRateColor,
	passRate,
	progressFillColor,
	progressGlow,
	failedColor,
	failedColor,
	suite.RanAt,
	passRate,
	suite.Passed,
	suite.Failed,
	suite.Total,
	suite.Total,
	suite.Total,
	suite.Passed,
	suite.Failed,
	suite.Duration.Round(time.Millisecond).String(),
	string(suiteJSON),
)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = fmt.Fprint(w, html)
}

func main() {
	http.HandleFunc("/", dashboardHandler)

	fmt.Println("CodeDock Test Dashboard → http://localhost:9000")
	fmt.Println("Open in your browser. Refresh to re-run all tests.")

	log.Fatal(http.ListenAndServe(":9000", nil))
}
