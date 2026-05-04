import { useEffect, useMemo, useState } from 'react'

const API_URL = 'http://localhost:9000/api/tests'

function App() {
  const [suite, setSuite] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchSuite = async () => {
    setLoading(true)
    setError('')``

    try {
      const response = await fetch(API_URL)

      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
      }

      const data = await response.json()
      setSuite(data)
    } catch (err) {
      setError(err.message || 'Failed to load test results')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSuite()
  }, [])

  const passRate = useMemo(() => {
    if (!suite || !suite.total) return 0
    return Math.round((suite.passed / suite.total) * 100)
  }, [suite])

  return (
    <div className="app-shell">
      <div className="container py-5">
        <header className="d-flex flex-column flex-lg-row justify-content-between align-items-lg-center gap-3 mb-4">
          <div>
            <p className="eyebrow mb-2">CodeDock</p>
            <h1 className="page-title mb-2">Test Dashboard</h1>
            <p className="page-subtitle mb-0">
              Professional visibility into your Go test suite, with raw runner output available when structured parsing finds nothing.
            </p>
          </div>

          <div className="d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-primary px-4"
              onClick={fetchSuite}
              disabled={loading}
            >
              {loading ? 'Running…' : 'Re-run tests'}
            </button>
          </div>
        </header>

        {error ? (
          <section className="panel p-4">
            <h2 className="section-title mb-2">Error</h2>
            <p className="text-danger mb-0">{error}</p>
          </section>
        ) : null}

        {loading ? (
          <section className="panel p-5 text-center">
            <div className="spinner-border text-light mb-3" role="status" aria-hidden="true" />
            <p className="mb-0 text-secondary">Loading latest test results…</p>
          </section>
        ) : null}

        {!loading && !error && suite ? (
          <>
            <section className="row g-4 mb-4">
              <MetricCard label="Total Tests" value={suite.total} />
              <MetricCard label="Passed" value={suite.passed} success />
              <MetricCard label="Failed" value={suite.failed} danger />
              <MetricCard label="Runtime" value={suite.duration || '0s'} />
            </section>

            <section className="panel p-4 mb-4">
              <div className="d-flex flex-column flex-lg-row justify-content-between gap-3 mb-3">
                <div>
                  <h2 className="section-title mb-1">Execution Summary</h2>
                  <p className="text-secondary mb-0">
                    Last run: {formatDateTime(suite.ran_at)}
                  </p>
                </div>
                <div className="summary-chip">
                  Pass Rate <strong>{passRate}%</strong>
                </div>
              </div>

              <div
                className="progress dashboard-progress"
                role="progressbar"
                aria-label="Pass rate"
                aria-valuenow={passRate}
                aria-valuemin="0"
                aria-valuemax="100"
              >
                <div
                  className="progress-bar"
                  style={{ width: `${passRate}%` }}
                />
              </div>
            </section>

            {suite.results?.length > 0 ? (
              <section className="panel p-4 mb-4">
                <div className="d-flex justify-content-between align-items-center mb-3">
                  <div>
                    <h2 className="section-title mb-1">Test Results</h2>
                    <p className="text-secondary mb-0">
                      Parsed from structured test output.
                    </p>
                  </div>
                </div>

                <div className="results-list">
                  {suite.results.map((result, index) => (
                    <article key={`${result.name}-${index}`} className="result-card">
                      <div className="d-flex flex-column flex-lg-row justify-content-between gap-3">
                        <div className="flex-grow-1">
                          <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                            <h3 className="result-title mb-0">{result.name}</h3>
                            <span className={`status-badge ${result.passed ? 'status-pass' : 'status-fail'}`}>
                              {result.passed ? 'Passed' : 'Failed'}
                            </span>
                          </div>

                          <div className="meta-row">
                            <span>Category: {result.category || 'General'}</span>
                            <span>Duration: {result.duration || '0s'}</span>
                          </div>

                          {!result.passed && result.output ? (
                            <div className="mt-3">
                              <div className="failure-label">Failure Output</div>
                              <pre className="failure-output mb-0">{result.output}</pre>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ) : (
              <section className="panel p-4 mb-4">
                <h2 className="section-title mb-2">No tests found</h2>
                <p className="text-secondary mb-4">
                  No structured test cases were parsed from the runner output.
                </p>

                <div className="debug-panel">
                  <div className="debug-title">Raw Runner Output</div>
                  <pre className="debug-output mb-0">
                    {suite.raw?.trim() ? suite.raw : 'No raw output was returned by the runner.'}
                  </pre>
                </div>
              </section>
            )}

            {suite.results?.length > 0 && suite.raw?.trim() ? (
              <section className="panel p-4">
                <h2 className="section-title mb-2">Raw Runner Output</h2>
                <p className="text-secondary mb-3">
                  Useful for debugging parser edge cases or package-level failures.
                </p>
                <div className="debug-panel">
                  <pre className="debug-output mb-0">{suite.raw}</pre>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  )
}

function MetricCard({ label, value, success = false, danger = false }) {
  return (
    <div className="col-12 col-sm-6 col-xl-3">
      <div className={`metric-card ${success ? 'metric-success' : ''} ${danger ? 'metric-danger' : ''}`}>
        <div className="metric-label">{label}</div>
        <div className="metric-value">{value}</div>
      </div>
    </div>
  )
}

function formatDateTime(value) {
  if (!value) return 'Unknown'

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return date.toLocaleString()
}

export default App