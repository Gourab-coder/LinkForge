import { useEffect, useState } from 'react'
import { apiRequest, authHeaders } from './api'
import './App.css'

const TOKEN_KEY = 'linkforge_token'

function formatDate(value) {
  if (!value) return 'Never'

  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function Brand() {
  return (
    <a className="brand" href="#top" aria-label="LinkForge home">
      <span className="brand-mark" aria-hidden="true">↗</span> linkforge
    </a>
  )
}

function AuthModal({ mode, setMode, onClose, onSuccess, message, setMessage }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  async function submit(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const result = await apiRequest(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })

      localStorage.setItem(TOKEN_KEY, result.token)
      onSuccess(result)
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  function switchMode() {
    setMode(mode === 'login' ? 'register' : 'login')
    setMessage('')
  }

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button className="close-button modal-close" type="button" onClick={onClose} aria-label="Close">
          ×
        </button>
        <p className="eyebrow">{mode === 'login' ? 'Welcome back' : 'Make your mark'}</p>
        <h2 id="auth-title">{mode === 'login' ? 'Log in to LinkForge' : 'Create your account'}</h2>
        <p className="modal-copy">
          {mode === 'login' ? 'Your links are waiting.' : 'Start building a smarter link library.'}
        </p>

        <form onSubmit={submit}>
          <label>
            Email address
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength="8"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="8 characters minimum"
              required
            />
          </label>
          {message && <p className="error-message" role="alert">{message}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            {loading ? 'Working...' : mode === 'login' ? 'Log in' : 'Create account'}
            <span aria-hidden="true">→</span>
          </button>
        </form>

        <button className="switch-auth" type="button" onClick={switchMode}>
          {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Log in'}
        </button>
      </section>
    </div>
  )
}

function Landing({ openAuth }) {
  return (
    <main className="landing-shell" id="top">
      <header className="topbar landing-topbar">
        <Brand />
        <nav aria-label="Main navigation">
          <a href="#features">Why LinkForge</a>
          <a href="#how-it-works">How it works</a>
          <button className="login-button" type="button" onClick={() => openAuth('login')}>
            Log in <span aria-hidden="true">↗</span>
          </button>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">Links, but better</p>
          <h1>Turn long links into <em>lasting</em> connections.</h1>
          <p className="hero-description">
            LinkForge gives your URLs a sharper edge. Create, share, and learn from every click
            with one calm, capable workspace.
          </p>
          <div className="hero-actions">
            <button className="primary-button" type="button" onClick={() => openAuth('register')}>
              Start forging <span aria-hidden="true">→</span>
            </button>
            <span className="no-card">Free to get started</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="orbit orbit-one" />
          <div className="orbit orbit-two" />
          <div className="link-card">
            <span className="mini-label">Your link is live</span>
            <strong>linkforge.to/<b>bright-idea</b></strong>
            <div className="link-card-footer">
              <span><i /> 1,284 clicks</span>
              <span>↗</span>
            </div>
          </div>
          <div className="floating-note">Built for the<br /><b>curious.</b> <span>✦</span></div>
        </div>
      </section>

      <section className="feature-strip" id="features">
        <div>
          <span className="feature-number">01</span>
          <h3>Short by design</h3>
          <p>Clean links people can actually remember and trust.</p>
        </div>
        <div>
          <span className="feature-number">02</span>
          <h3>Insightful by default</h3>
          <p>See clicks and visitors without drowning in dashboards.</p>
        </div>
        <div>
          <span className="feature-number">03</span>
          <h3>Ready to share</h3>
          <p>One workspace for every campaign, idea, and story.</p>
        </div>
      </section>

      <section className="how-section" id="how-it-works">
        <p className="eyebrow">A simpler flow</p>
        <h2>From link to lift-off<br /><em>in three moves.</em></h2>
        <div className="steps">
          <div><b>01</b><span>Paste</span><p>Bring your long URL.</p></div>
          <div><b>02</b><span>Forge</span><p>Get a polished short link.</p></div>
          <div><b>03</b><span>Learn</span><p>Watch the visits roll in.</p></div>
        </div>
      </section>
    </main>
  )
}

function Workspace({ user, token, onLogout }) {
  const [urls, setUrls] = useState([])
  const [selected, setSelected] = useState(null)
  const [analytics, setAnalytics] = useState(null)
  const [analyticsError, setAnalyticsError] = useState('')
  const [longUrl, setLongUrl] = useState('')
  const [expiresAt, setExpiresAt] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    apiRequest('/api/v1/urls', { headers: authHeaders(token) })
      .then((result) => setUrls(result.urls))
      .catch((error) => setMessage(error.message))
  }, [token])

  async function createUrl(event) {
    event.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const result = await apiRequest('/api/v1/urls', {
        method: 'POST',
        headers: authHeaders(token),
        body: JSON.stringify({
          longUrl,
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        }),
      })

      setUrls((current) => [result, ...current])
      setLongUrl('')
      setExpiresAt('')
      setMessage('Your short link is ready.')
    } catch (error) {
      setMessage(error.message)
    } finally {
      setLoading(false)
    }
  }

  async function showAnalytics(url) {
    setSelected(url)
    setAnalytics(null)
    setAnalyticsError('')

    try {
      const result = await apiRequest(`/api/v1/urls/${encodeURIComponent(url.id)}/analytics`, {
        headers: authHeaders(token),
      })
      setAnalytics(result)
    } catch (error) {
      setAnalyticsError(error.message)
    }
  }

  async function removeUrl(id) {
    try {
      await apiRequest(`/api/v1/urls/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      })
      setUrls((current) => current.filter((url) => url.id !== id))
      if (selected?.id === id) setSelected(null)
    } catch (error) {
      setMessage(error.message)
    }
  }

  async function copyLink(value) {
    try {
      await navigator.clipboard.writeText(value)
      setMessage('Short link copied to clipboard.')
    } catch {
      setMessage('Could not copy the link. Please copy it manually.')
    }
  }

  const totalClicks = urls.reduce((total, url) => total + Number(url.clickCount || 0), 0)

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <Brand />
        <div className="account-area">
          <span>{user.email}</span>
          <button className="ghost-button" type="button" onClick={onLogout}>Log out</button>
        </div>
      </header>

      <section className="workspace" id="top">
        <div className="workspace-intro">
          <div>
            <p className="eyebrow">Your link workspace</p>
            <h1>Make every click<br /><em>count.</em></h1>
          </div>
          <p className="intro-copy">
            Create clean, memorable links and understand the people behind every visit.
          </p>
        </div>

        <div className="dashboard-grid">
          <section className="create-panel panel">
            <div className="panel-heading">
              <div><p className="eyebrow">New link</p><h2>Shorten something</h2></div>
              <span className="sparkle" aria-hidden="true">✦</span>
            </div>
            <form onSubmit={createUrl}>
              <label>
                Long URL
                <input
                  type="url"
                  value={longUrl}
                  onChange={(event) => setLongUrl(event.target.value)}
                  placeholder="https://your-next-big-thing.com"
                  required
                />
              </label>
              <label>
                Expiration <span className="optional">Optional</span>
                <input
                  type="datetime-local"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
              </label>
              <button className="primary-button" type="submit" disabled={loading}>
                {loading ? 'Creating...' : 'Forge short link'} <span aria-hidden="true">→</span>
              </button>
            </form>
            {message && <p className="form-message" role="status">{message}</p>}
          </section>

          <section className="stat-panel panel" aria-label="Link statistics">
            <p className="eyebrow">At a glance</p>
            <div className="stat-row">
              <div><strong>{urls.length}</strong><span>Links created</span></div>
              <div><strong>{totalClicks}</strong><span>Total clicks</span></div>
            </div>
            <div className="stat-note"><span className="pulse-dot" /> Analytics update as visitors arrive</div>
          </section>
        </div>

        <div className="links-layout">
          <section className="links-panel panel">
            <div className="section-heading">
              <div><p className="eyebrow">Library</p><h2>Your links</h2></div>
              <span>{urls.length} total</span>
            </div>

            {urls.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon" aria-hidden="true">↗</div>
                <h3>Your next link starts here</h3>
                <p>Paste a long URL above and we’ll forge a neat, trackable link for you.</p>
              </div>
            ) : (
              <div className="link-list">
                {urls.map((url) => (
                  <article
                    className={`link-item ${selected?.id === url.id ? 'is-selected' : ''}`}
                    key={url.id}
                  >
                    <div className="link-icon" aria-hidden="true">↗</div>
                    <div className="link-content">
                      <a href={url.shortUrl} target="_blank" rel="noopener noreferrer">
                        {url.shortUrl.replace(/^https?:\/\//, '')}
                      </a>
                      <p title={url.longUrl}>{url.longUrl}</p>
                      <small>Created {formatDate(url.createdAt)} · {url.clickCount} clicks</small>
                    </div>
                    <div className="link-actions">
                      <button
                        className="icon-button"
                        type="button"
                        title="Copy short link"
                        aria-label="Copy short link"
                        onClick={() => copyLink(url.shortUrl)}
                      >⧉</button>
                      <button className="analytics-button" type="button" onClick={() => showAnalytics(url)}>
                        Insights
                      </button>
                      <button
                        className="icon-button danger"
                        type="button"
                        title="Delete link"
                        aria-label="Delete link"
                        onClick={() => removeUrl(url.id)}
                      >×</button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <aside className={`insights-panel panel ${selected ? '' : 'inactive-insights'}`}>
            {selected ? (
              <>
                <div className="section-heading">
                  <div><p className="eyebrow">Link insights</p><h2>Performance</h2></div>
                  <button
                    className="close-button"
                    type="button"
                    aria-label="Close insights"
                    onClick={() => setSelected(null)}
                  >×</button>
                </div>
                <div className="selected-link">
                  <span>{selected.shortUrl}</span>
                  <p>{selected.longUrl}</p>
                </div>
                {analytics ? (
                  <>
                    <div className="insight-stats">
                      <div><strong>{analytics.totalClicks}</strong><span>Total clicks</span></div>
                      <div><strong>{analytics.uniqueVisitors}</strong><span>Unique visitors</span></div>
                    </div>
                    <div className="breakdown">
                      <h3>Devices</h3>
                      {Object.entries(analytics.devices || {}).length ? (
                        Object.entries(analytics.devices).map(([device, clicks]) => (
                          <div className="breakdown-row" key={device}>
                            <span>{device}</span><strong>{clicks}</strong>
                          </div>
                        ))
                      ) : <p className="muted">No click data yet.</p>}
                    </div>
                  </>
                ) : analyticsError ? (
                  <div className="loading-state" role="alert">Could not load insights: {analyticsError}</div>
                ) : (
                  <div className="loading-state" role="status">Loading insights...</div>
                )}
              </>
            ) : (
              <>
                <div className="insight-art" aria-hidden="true">◌</div>
                <p className="eyebrow">Click into a link</p>
                <h2>See the story<br />behind the click.</h2>
                <p>Select any link to view clicks, unique visitors, and device breakdowns.</p>
              </>
            )}
          </aside>
        </div>
      </section>
    </main>
  )
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY))
  const [user, setUser] = useState(null)
  const [authMode, setAuthMode] = useState('login')
  const [authOpen, setAuthOpen] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) return

    apiRequest('/api/auth/me', { headers: authHeaders(token) })
      .then(({ user: currentUser }) => setUser(currentUser))
      .catch(logout)
  }, [token])

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }

  function openAuth(mode) {
    setAuthMode(mode)
    setMessage('')
    setAuthOpen(true)
  }

  function completeAuth(result) {
    setToken(result.token)
    setUser(result.user)
    setAuthOpen(false)
  }

  if (token && user) return <Workspace user={user} token={token} onLogout={logout} />

  return (
    <>
      <Landing openAuth={openAuth} />
      {authOpen && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          onClose={() => setAuthOpen(false)}
          onSuccess={completeAuth}
          message={message}
          setMessage={setMessage}
        />
      )}
    </>
  )
}

export default App
