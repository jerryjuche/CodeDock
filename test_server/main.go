package main

import (
	"bytes"
	"encoding/base64"
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

	cmd := exec.Command("go", "test", "./...", "-v", "-count=1", "-p", "1")
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
<title>CodeDock — Test Dashboard</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;600;800&display=swap" rel="stylesheet">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:        #080b10;
    --surface:   #0d1117;
    --border:    #1e2530;
    --text:      #cdd6e0;
    --muted:     #4a5568;
    --green:     #00f5a0;
    --red:       #ff4d6d;
    --blue:      #38bdf8;
    --yellow:    #fbbf24;
    --glow-g:    rgba(0, 245, 160, 0.15);
    --glow-r:    rgba(255, 77, 109, 0.15);
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    min-height: 100vh;
    padding: 0;
    overflow-x: hidden;
  }

  body::before {
    content: '';
    position: fixed;
    inset: 0;
    background-image:
      linear-gradient(rgba(56, 189, 248, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(56, 189, 248, 0.03) 1px, transparent 1px);
    background-size: 40px 40px;
    pointer-events: none;
    z-index: 0;
  }

  .container {
    position: relative;
    z-index: 1;
    max-width: 960px;
    margin: 0 auto;
    padding: 48px 24px;
  }

  .header {
    margin-bottom: 48px;
    animation: fadeDown 0.6s ease both;
  }

  .logo {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 8px;
  }

  .logo-icon {
    width: 36px;
    height: 36px;
    background: linear-gradient(135deg, var(--green), var(--blue));
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 18px;
  }

  .logo-text {
    font-family: 'Syne', sans-serif;
    font-size: 22px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.5px;
  }

  .logo-text span {
    color: var(--green);
  }

  .header-sub {
    font-size: 12px;
    color: var(--muted);
    letter-spacing: 2px;
    text-transform: uppercase;
    margin-left: 48px;
  }

  .stats {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 16px;
    margin-bottom: 40px;
    animation: fadeDown 0.6s ease 0.1s both;
  }

  .stat-card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px;
    position: relative;
    overflow: hidden;
  }

  .stat-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
  }

  .stat-card.total::before  { background: var(--blue); }
  .stat-card.passed::before { background: var(--green); }
  .stat-card.failed::before { background: var(--red); }
  .stat-card.time::before   { background: var(--yellow); }

  .stat-label {
    font-size: 10px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 2px;
    margin-bottom: 8px;
  }

  .stat-value {
    font-family: 'Syne', sans-serif;
    font-size: 36px;
    font-weight: 800;
    line-height: 1;
  }

  .stat-card.total  .stat-value { color: var(--blue); }
  .stat-card.passed .stat-value { color: var(--green); }
  .stat-card.failed .stat-value { color: %s; }
  .stat-card.time   .stat-value { color: var(--yellow); font-size: 24px; }

  .progress-wrap {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 20px 24px;
    margin-bottom: 32px;
    animation: fadeDown 0.6s ease 0.2s both;
  }

  .progress-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 12px;
    font-size: 12px;
    color: var(--muted);
    gap: 12px;
  }

  .progress-rate {
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 600;
    color: %s;
  }

  .progress-bar-bg {
    height: 6px;
    background: var(--border);
    border-radius: 99px;
    overflow: hidden;
  }

  .progress-bar-fill {
    height: 100%%;
    width: %d%%;
    background: %s;
    border-radius: 99px;
    transition: width 1s cubic-bezier(0.16, 1, 0.3, 1);
    box-shadow: 0 0 12px %s;
  }

  .section-title {
    font-size: 11px;
    color: var(--muted);
    text-transform: uppercase;
    letter-spacing: 3px;
    margin-bottom: 16px;
    animation: fadeDown 0.6s ease 0.3s both;
  }

  .test-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 40px;
  }

  .test-item {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 14px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    animation: fadeUp 0.4s ease both;
    transition: border-color 0.2s;
  }

  .test-item:hover {
    border-color: var(--muted);
  }

  .test-item.pass { border-left: 3px solid var(--green); }
  .test-item.fail { border-left: 3px solid var(--red); background: rgba(255, 77, 109, 0.05); }

  .test-icon {
    font-size: 16px;
    width: 24px;
    text-align: center;
    flex-shrink: 0;
  }

  .test-name {
    flex: 1;
    font-size: 13px;
    color: var(--text);
  }

  .test-category {
    font-size: 10px;
    color: var(--muted);
    background: var(--border);
    padding: 2px 8px;
    border-radius: 99px;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  .test-duration {
    font-size: 11px;
    color: var(--muted);
    min-width: 60px;
    text-align: right;
  }

  .test-error {
    margin-top: 10px;
    padding: 10px 12px;
    background: rgba(255, 77, 109, 0.08);
    border: 1px solid rgba(255, 77, 109, 0.2);
    border-radius: 6px;
    font-size: 11px;
    color: var(--red);
    white-space: pre-wrap;
    display: none;
    overflow-wrap: anywhere;
  }

  .test-item.fail .test-error {
    display: block;
  }

  .test-item-inner {
    flex: 1;
    min-width: 0;
  }

  .footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
    animation: fadeUp 0.6s ease 0.5s both;
  }

  .footer-left {
    font-size: 11px;
    color: var(--muted);
  }

  .refresh-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: 'JetBrains Mono', monospace;
    font-size: 12px;
    padding: 8px 16px;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s;
    text-decoration: none;
  }

  .refresh-btn:hover {
    border-color: var(--green);
    color: var(--green);
    box-shadow: 0 0 16px var(--glow-g);
  }

  .ran-at {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: var(--surface);
    border: 1px solid var(--border);
    padding: 6px 12px;
    border-radius: 99px;
    font-size: 11px;
    color: var(--muted);
    margin-bottom: 32px;
    animation: fadeDown 0.6s ease 0.05s both;
  }

  .ran-at-dot {
    width: 6px;
    height: 6px;
    background: var(--green);
    border-radius: 50%%;
    animation: pulse 2s infinite;
  }

  @keyframes fadeDown {
    from { opacity: 0; transform: translateY(-12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(8px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @keyframes pulse {
    0%%, 100%% { opacity: 1; }
    50%%       { opacity: 0.3; }
  }

  @media (max-width: 820px) {
    .stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .test-item {
      flex-wrap: wrap;
      align-items: flex-start;
    }

    .test-duration {
      min-width: auto;
      margin-left: auto;
    }

    .footer {
      flex-direction: column;
      align-items: flex-start;
    }
  }

  @media (max-width: 520px) {
    .container {
      padding: 32px 16px;
    }

    .stats {
      grid-template-columns: 1fr;
    }

    .header-sub {
      margin-left: 0;
      margin-top: 8px;
    }

    .progress-header {
      flex-direction: column;
      align-items: flex-start;
    }
  }
</style>
</head>
<body>
<div class="container">

  <header class="header">
    <div class="logo">
      <div class="logo-icon">⬡</div>
      <div class="logo-text">Code<span>Dock</span></div>
    </div>
    <div class="header-sub">Integration Test Dashboard</div>
  </header>

  <div class="ran-at">
    <div class="ran-at-dot"></div>
    Last run: %s
  </div>

  <div class="stats">
    <div class="stat-card total">
      <div class="stat-label">Total Tests</div>
      <div class="stat-value">%d</div>
    </div>
    <div class="stat-card passed">
      <div class="stat-label">Passed</div>
      <div class="stat-value">%d</div>
    </div>
    <div class="stat-card failed">
      <div class="stat-label">Failed</div>
      <div class="stat-value">%d</div>
    </div>
    <div class="stat-card time">
      <div class="stat-label">Duration</div>
      <div class="stat-value">%s</div>
    </div>
  </div>

  <div class="progress-wrap">
    <div class="progress-header">
      <span>Pass Rate</span>
      <span class="progress-rate">%d%% passing</span>
    </div>
    <div class="progress-bar-bg">
      <div class="progress-bar-fill"></div>
    </div>
  </div>

  <div class="section-title">Test Results</div>

  <div class="test-list" id="testList"></div>

  <footer class="footer">
    <div class="footer-left">CodeDock · Integration Suite · %d tests</div>
    <a href="/" class="refresh-btn">↻ &nbsp;Re-run Tests</a>
  </footer>

</div>

<script>
const suite = JSON.parse(atob("%s"));

function getCategory(name) {
  if (name.toLowerCase().includes('register') || name.toLowerCase().includes('login')) return 'Auth';
  if (name.toLowerCase().includes('protected') || name.toLowerCase().includes('token')) return 'Middleware';
  if (name.toLowerCase().includes('room')) return 'Rooms';
  return 'General';
}

function formatDuration(ns) {
  if (ns === 0) return '—';
  if (ns < 1000000) return (ns / 1000).toFixed(0) + 'µs';
  if (ns < 1000000000) return (ns / 1000000).toFixed(0) + 'ms';
  return (ns / 1000000000).toFixed(2) + 's';
}

const list = document.getElementById('testList');
suite.results.forEach((t, i) => {
  const item = document.createElement('div');
  item.className = 'test-item ' + (t.passed ? 'pass' : 'fail');
  item.style.animationDelay = (i * 0.04) + 's';

  const icon = document.createElement('div');
  icon.className = 'test-icon';
  icon.textContent = t.passed ? '✓' : '✗';
  item.appendChild(icon);
 
  const inner = document.createElement('div');
  inner.className = 'test-item-inner';
   
  const name = document.createElement('div');
  name.className = 'test-name';
  name.textContent = t.name;
  inner.appendChild(name);
 
  if (!t.passed && t.output) {
    const error = document.createElement('div');
    error.className = 'test-error';
    error.textContent = t.output;
    inner.appendChild(error);
  }
  item.appendChild(inner);

  const category = document.createElement('div');
  category.className = 'test-category';
  category.textContent = getCategory(t.name);
  item.appendChild(category);
 
  const duration = document.createElement('div');
  duration.className = 'test-duration';
  duration.textContent = formatDuration(t.duration);
  item.appendChild(duration);

  list.appendChild(item);
});

if (suite.results.length === 0) {
  list.innerHTML = '<div class="test-item" style="justify-content:center;color:var(--muted)">No tests found. Make sure your test file is in the project root.</div>';
}
</script>
</body>
</html>`,
		failedColor,
		progressRateColor,
		passRate,
		progressFillColor,
		progressGlow,
		suite.RanAt,
		suite.Total,
		suite.Passed,
		suite.Failed,
		suite.Duration.Round(time.Millisecond).String(),
		passRate,
		suite.Total,
		base64.StdEncoding.EncodeToString(suiteJSON),
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
