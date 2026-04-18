import { useEffect, useMemo, useState } from "react";

function formatDuration(ns) {
  if (!ns) return "—";
  if (ns < 1_000_000) return `${Math.round(ns / 1_000)}µs`;
  if (ns < 1_000_000_000) return `${Math.round(ns / 1_000_000)}ms`;
  return `${(ns / 1_000_000_000).toFixed(2)}s`;
}

function getCategory(name = "") {
  const n = name.toLowerCase();
  if (n.includes("register") || n.includes("login")) return "Auth";
  if (n.includes("protected") || n.includes("token")) return "Middleware";
  if (n.includes("room")) return "Rooms";
  return "General";
}

function getTone(passRate) {
  if (passRate === 100) return "success";
  if (passRate >= 70) return "warning";
  return "danger";
}

export default function TestDashboard() {
  const [suite, setSuite] = useState(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const fetchSuite = async () => {
    try {
      setError("");
      setRunning(true);

      const response = await fetch("http://localhost:9000/api/tests");
      if (!response.ok) {
        throw new Error(`Failed to load test suite (HTTP ${response.status})`);
      }

      const data = await response.json();
      setSuite(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setRunning(false);
    }
  };

  useEffect(() => {
    fetchSuite();
  }, []);

  const passRate = useMemo(() => {
    if (!suite?.total) return 0;
    return Math.round((suite.passed * 100) / suite.total);
  }, [suite]);

  const tone = getTone(passRate);

  if (loading) {
    return (
      <div className="codedock-shell min-vh-100 d-flex align-items-center justify-content-center">
        <div className="text-center">
          <div className="spinner-border text-info mb-3" role="status" />
          <h4 className="text-light fw-bold">Loading dashboard</h4>
          <p className="text-secondary mb-0">
            Preparing integration suite results…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="codedock-shell min-vh-100 py-4 py-lg-5">
      <div className="container-xl">
        <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
          <div className="d-flex align-items-center gap-3">
            <div className="codedock-brand-mark">CD</div>
            <div>
              <h1 className="codedock-title mb-1">CodeDock Test Dashboard</h1>
              <p className="text-secondary mb-0">
                Professional visibility into your Go integration suite
              </p>
            </div>
          </div>

          <div className="d-flex flex-wrap gap-2">
            <span className="badge rounded-pill codedock-badge px-3 py-2">
              Last run: {suite?.ran_at || "—"}
            </span>
            <button
              className="btn btn-primary px-4 fw-semibold"
              onClick={fetchSuite}
              disabled={running}
            >
              {running ? "Running..." : "Re-run Tests"}
            </button>
          </div>
        </div>

        {error ? (
          <div className="alert alert-danger border-0 shadow-sm">
            <strong>Dashboard error:</strong> {error}
          </div>
        ) : null}

        <div className="row g-4 mb-4">
          <div className="col-12 col-lg-8">
            <div className="codedock-card h-100 p-4 p-lg-5">
              <span className="codedock-eyebrow">EXECUTION SUMMARY</span>
              <h2 className="display-6 fw-bold text-light mt-3 mb-3">
                Solid test insight for daily engineering work.
              </h2>
              <p className="text-secondary fs-6 mb-0">
                Review suite health, inspect failure output, and monitor
                execution duration in one clean interface built for backend
                development.
              </p>
            </div>
          </div>

          <div className="col-12 col-lg-4">
            <div className="codedock-card h-100 p-4">
              <div className="d-flex justify-content-between align-items-start mb-3 gap-3">
                <div>
                  <div className="text-secondary small text-uppercase fw-semibold">
                    Pass Rate
                  </div>
                  <div className={`codedock-rate text-${tone}`}>
                    {passRate}%
                  </div>
                </div>
                <span
                  className={`badge bg-${tone}-subtle text-${tone} border px-3 py-2`}
                >
                  {suite?.passed || 0} passed · {suite?.failed || 0} failed
                </span>
              </div>

              <div className="progress codedock-progress mb-2">
                <div
                  className={`progress-bar bg-${tone}`}
                  role="progressbar"
                  style={{ width: `${passRate}%` }}
                  aria-valuenow={passRate}
                  aria-valuemin="0"
                  aria-valuemax="100"
                />
              </div>

              <div className="d-flex justify-content-between text-secondary small">
                <span>Suite completion</span>
                <span>
                  {suite?.passed || 0} / {suite?.total || 0}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="row g-4 mb-4">
          <div className="col-12 col-md-6 col-xl-3">
            <div className="codedock-stat-card p-4 h-100">
              <div className="codedock-stat-label">Total Tests</div>
              <div className="codedock-stat-value text-info">
                {suite?.total || 0}
              </div>
              <div className="text-secondary small">
                All discovered test cases
              </div>
            </div>
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <div className="codedock-stat-card p-4 h-100">
              <div className="codedock-stat-label">Passed</div>
              <div className="codedock-stat-value text-success">
                {suite?.passed || 0}
              </div>
              <div className="text-secondary small">Successful executions</div>
            </div>
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <div className="codedock-stat-card p-4 h-100">
              <div className="codedock-stat-label">Failed</div>
              <div className="codedock-stat-value text-danger">
                {suite?.failed || 0}
              </div>
              <div className="text-secondary small">Require investigation</div>
            </div>
          </div>

          <div className="col-12 col-md-6 col-xl-3">
            <div className="codedock-stat-card p-4 h-100">
              <div className="codedock-stat-label">Runtime</div>
              <div className="codedock-stat-value text-warning codedock-runtime">
                {formatDuration(suite?.duration)}
              </div>
              <div className="text-secondary small">
                Full suite execution time
              </div>
            </div>
          </div>
        </div>

        <div className="codedock-card overflow-hidden">
          <div className="p-4 border-bottom codedock-border">
            <div className="d-flex flex-wrap justify-content-between align-items-center gap-3">
              <div>
                <h3 className="h4 text-light fw-bold mb-1">Test Results</h3>
                <p className="text-secondary mb-0">
                  Parsed from your existing Go test runner output
                </p>
              </div>

              <div className="d-flex flex-wrap gap-2">
                <span className="badge rounded-pill bg-success-subtle text-success border px-3 py-2">
                  Pass
                </span>
                <span className="badge rounded-pill bg-danger-subtle text-danger border px-3 py-2">
                  Fail
                </span>
              </div>
            </div>
          </div>

          {!suite?.results?.length ? (
            <div className="p-5 text-center">
              <h4 className="text-light fw-bold mb-2">No tests found</h4>
              <p className="text-secondary mb-0">
                Make sure your test suite is discoverable by{" "}
                <code>go test</code>.
              </p>

              {suite?.raw ? (
                <div className="codedock-failure mt-4 text-start">
                  <div className="codedock-failure-label mb-2">
                    Runner Output
                  </div>
                  <pre className="mb-0">{suite.raw}</pre>
                </div>
              ) : null}
            </div>
          ) : (
            suite.results.map((test, index) => (
              <div
                key={`${test.name}-${index}`}
                className={`codedock-result-row ${test.passed ? "is-pass" : "is-fail"}`}
              >
                <div className="row g-3 align-items-start">
                  <div className="col-auto">
                    <div
                      className={`codedock-status-icon ${
                        test.passed ? "status-pass" : "status-fail"
                      }`}
                    >
                      {test.passed ? "✓" : "✕"}
                    </div>
                  </div>

                  <div className="col">
                    <div className="d-flex flex-wrap justify-content-between align-items-start gap-3">
                      <div>
                        <h5 className="text-light fw-semibold mb-1">
                          {test.name}
                        </h5>
                        <div className="text-secondary small">
                          {test.passed
                            ? "Completed successfully"
                            : "Execution failed"}
                        </div>
                      </div>

                      <div className="d-flex flex-wrap gap-2 align-items-center">
                        <span className="badge rounded-pill codedock-category px-3 py-2">
                          {getCategory(test.name)}
                        </span>
                        <span className="codedock-time">
                          {formatDuration(test.duration)}
                        </span>
                      </div>
                    </div>

                    {!test.passed && test.output ? (
                      <div className="codedock-failure mt-3">
                        <div className="codedock-failure-label mb-2">
                          Failure Output
                        </div>
                        <pre className="mb-0">{test.output}</pre>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
