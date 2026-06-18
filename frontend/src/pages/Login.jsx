import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CustomCaptcha from "../components/CustomCaptcha";

/**
 * DemoEscalation
 * ==============
 * Cycles cleanly through 4 phases. Customer message is always visible.
 * The AI area replaces thinking dots → response on each loop.
 */
function DemoEscalation() {
  const [phase, setPhase] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [cardKey, setCardKey] = useState(0); // forces re-mount for fade-in on loop
  const timeoutRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    // Phase durations: 0 (show customer) → 1 (AI thinking) → 2 (AI answer) → 3 (escalated) → reset
    const delays = [900, 1100, 1500, 2800];
    timeoutRef.current = setTimeout(() => {
      setPhase((p) => {
        const next = (p + 1) % 4;
        if (next === 0) setCardKey((k) => k + 1); // fresh animation on loop restart
        return next;
      });
    }, delays[phase]);
    return () => clearTimeout(timeoutRef.current);
  }, [phase]);

  // Live elapsed-minutes ticker
  useEffect(() => {
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 60000);
    return () => clearInterval(timerRef.current);
  }, []);

  const escalated = phase === 3;
  const timeLabel = elapsed === 0 ? "2 min ago" : `${elapsed + 2} min ago`;

  return (
    <div className="demo-ticket demo-ticket--enhanced">
      {/* ── Ticket header ── */}
      <div className="demo-ticket__top">
        <div className="demo-ticket__header-left">
          <div className="demo-ticket__severity-row">
            <span className="demo-ticket__sev-icon" aria-label="Critical severity">🚨</span>
            <div className="demo-ticket__title">Production database down</div>
          </div>
          <div className="demo-ticket__meta">
            Opened <span className="demo-ticket__ts">{timeLabel}</span>
          </div>
        </div>
        <span className={`demo-pill ${escalated ? "demo-pill--escalated" : "demo-pill--open"}`}>
          {escalated ? "Escalated" : "Open"}
        </span>
      </div>

      {/* ── Messages area — fixed height, no layout shift ── */}
      <div className="demo-messages">
        {/* Customer message — always visible once phase >= 0 */}
        <div className="demo-msg-row" key="customer">
          <div className="demo-msg-label demo-msg-label--customer">
            <div className="demo-avatar demo-avatar--customer">CU</div>
            <span>Customer</span>
          </div>
          <div className="demo-bubble demo-bubble--customer">
            URGENT: Our production database is unreachable. All users are getting 500 errors!
          </div>
        </div>

        {/* AI area — thinking OR response, never both */}
        {phase === 1 && (
          <div className="demo-msg-row" key="ai-thinking">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai">
              <span className="demo-thinking">
                <i /><i /><i />
              </span>
            </div>
          </div>
        )}

        {(phase === 2 || phase === 3) && (
          <div className="demo-msg-row" key="ai-response">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai demo-bubble--critical"
              style={{ background: '#FEF2F2', color: '#7F1D1D' }}>
              <span className={`demo-critical-label${
                phase === 3 ? ' demo-critical-label--pulse' : ''
              }`}>
                ⚠ Critical severity detected.
              </span>
              <br />
              Escalated to <strong>DevOps Team</strong>.
              <div className="demo-tags-row">
                <span className="demo-tag demo-tag--red">Sev-1</span>
                <span className="demo-tag demo-tag--orange">Auto Escalated</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Login() {
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [captchaOk,    setCaptchaOk]    = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!captchaOk) {
      setError("Please complete the human verification puzzle.");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password);
      if (user.role === "admin" || user.role === "support_agent") {
        navigate("/dashboard");
      } else {
        navigate("/my-tickets");
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Login failed. Check your credentials.";
      setError(msg);
      setCaptchaOk(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-shell">
      <div className="register-card">

        {/* ── Left: live demo ─────────────────────────────── */}
        <div className="register-demo-side">
          {/* Dot-grid texture overlay */}
          <div className="demo-side-texture" aria-hidden="true" />

          <div className="demo-eyebrow">Smart Routing</div>
          <h2 className="demo-heading">
            Critical issues are instantly identified and escalated to human experts.
          </h2>

          <DemoEscalation />

          {/* Feature highlights */}
          <div className="demo-features">
            <div className="demo-feature">
              <span className="demo-feature__check">✓</span>
              <span>AI Ticket Classification</span>
            </div>
            <div className="demo-feature">
              <span className="demo-feature__check">✓</span>
              <span>Smart Routing &amp; Priority Detection</span>
            </div>
            <div className="demo-feature">
              <span className="demo-feature__check">✓</span>
              <span>Auto Escalation to On-Call Teams</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="demo-stats-row">
            <div className="demo-stat">
              <span className="demo-stat__value">98%</span>
              <span className="demo-stat__label">faster triage</span>
            </div>
            <div className="demo-stat-divider" />
            <div className="demo-stat">
              <span className="demo-stat__value">24/7</span>
              <span className="demo-stat__label">AI assistance</span>
            </div>
            <div className="demo-stat-divider" />
            <div className="demo-stat">
              <span className="demo-stat__value">&lt;2s</span>
              <span className="demo-stat__label">ticket routing</span>
            </div>
          </div>

          <div className="demo-caption">
            <span className="demo-caption__dot" style={{ background: '#E53E3E' }} />
            Zero-delay escalation
          </div>
        </div>

        {/* ── Right: form ───────────────────────────────────── */}
        <div className="register-form-side">
          {/* Enhanced brand logo */}
          <div className="register-brand">
            <span className="register-brand__icon">✦</span>
            AI<span>Support</span>
            <div className="register-brand__tagline">Smart Customer Operations</div>
          </div>
          <p className="register-subhead">Welcome back! Please enter your details.</p>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="social-login-grid">
            <button className="btn-social" type="button" id="btn-google-login" onClick={() => alert('Google login coming soon!')}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button className="btn-social" type="button" id="btn-microsoft-login" onClick={() => alert('Microsoft login coming soon!')}>
              <svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Microsoft
            </button>
          </div>

          {/* Enhanced divider */}
          <div className="divider divider--elegant">or continue with email</div>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="field">
              <label htmlFor="login-email">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
                className="input--ivory"
              />
            </div>

            <div className="field">
              <div className="password-header">
                <label htmlFor="login-password">Password</label>
                <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
              </div>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="input--ivory"
              />
            </div>

            <div className="remember-row">
              <input type="checkbox" id="remember-me" />
              <label htmlFor="remember-me">Remember me for 30 days</label>
            </div>

            {/* ── Custom Puzzle CAPTCHA ─────────────────── */}
            <CustomCaptcha onVerified={(ok) => setCaptchaOk(ok)} />

            {/* Enhanced CTA button */}
            <button
              id="btn-sign-in"
              type="submit"
              className="register-submit register-submit--premium"
              disabled={loading || !captchaOk}
            >
              {loading ? "Signing in…" : <>Sign In <span className="btn-arrow">→</span></>}
            </button>
          </form>

          <p className="register-switch">
            Don't have an account? <Link to="/register">Register</Link>
          </p>

          {/* Trust indicators */}
          <div className="trust-indicators">
            <span className="trust-item">
              <span className="trust-check">✓</span> Enterprise-grade security
            </span>
            <span className="trust-item">
              <span className="trust-check">✓</span> GDPR compliant
            </span>
            <span className="trust-item">
              <span className="trust-check">✓</span> SOC 2 ready
            </span>
          </div>

          <div className="register-footer">
            By continuing you agree to our Terms and Privacy Policy.
          </div>
        </div>

      </div>
    </div>
  );
}