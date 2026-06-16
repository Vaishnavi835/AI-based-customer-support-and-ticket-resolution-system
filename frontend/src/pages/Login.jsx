import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * DemoEscalation
 * ==============
 * Similar to DemoTicket, but shows the AI identifying a critical
 * issue and escalating it to a human team rather than resolving it.
 */
function DemoEscalation() {
  const [step, setStep] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const delay = step % 4 === 3 ? 3200 : 1100;
    timeoutRef.current = setTimeout(() => {
      setStep((s) => s + 1);
    }, delay);
    return () => clearTimeout(timeoutRef.current);
  }, [step]);

  const phase = step % 4; // 0: customer msg, 1: thinking, 2: ai answer, 3: escalated
  const escalated = phase === 3;

  return (
    <div className="demo-ticket">
      <div className="demo-ticket__top">
        <div>
          <div className="demo-ticket__title">Production database down</div>
          <div className="demo-ticket__meta">Opened just now</div>
        </div>
        <span className={`demo-pill ${escalated ? "demo-pill--escalated" : "demo-pill--open"}`}>
          {escalated ? "escalated" : "open"}
        </span>
      </div>

      {phase >= 0 && (
        <div className="demo-msg-row">
          <div className="demo-bubble demo-bubble--customer">
            URGENT: Our production database is unreachable. All users are getting 500 errors. We need help immediately!
          </div>
        </div>
      )}

      {phase === 1 && (
        <div className="demo-msg-row">
          <div className="demo-bubble demo-bubble--ai">
            <span className="demo-thinking">
              <i /><i /><i />
            </span>
          </div>
        </div>
      )}

      {(phase === 2 || phase === 3) && (
        <div className="demo-msg-row">
          <div className="demo-bubble demo-bubble--ai" style={{ background: '#FCE8E8', color: '#9B2C2C' }}>
            Critical severity detected. I have paged the DevOps on-call engineer and escalated this ticket.
            <div className="demo-citation" style={{ border: '1px solid #FCA5A5', color: '#9B2C2C', background: '#fff' }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01" />
              </svg>
              Auto-Escalation &middot; Sev-1
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Login() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const { login }   = useAuth();
  const navigate    = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const user = await login(email, password);

      // Redirect based on role
      if (user.role === "admin" || user.role === "support_agent") {
        navigate("/dashboard");
      } else {
        navigate("/my-tickets");
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Login failed. Check your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-shell">
      <div className="register-card">
        
        {/* ── Left: form ───────────────────────────────────── */}
        <div className="register-form-side">
          <div className="register-brand">
            AI<span>Support</span>
          </div>
          <p className="register-subhead">Welcome back! Please enter your details.</p>

          {error && <div className="alert alert-error">{error}</div>}

          <div className="social-login-grid">
            <button className="btn-social" type="button" onClick={() => alert('Google login coming soon!')}>
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google
            </button>
            <button className="btn-social" type="button" onClick={() => alert('Microsoft login coming soon!')}>
              <svg viewBox="0 0 21 21" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
                <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
              </svg>
              Microsoft
            </button>
          </div>

          <div className="divider">or continue with email</div>

          <form onSubmit={handleSubmit} className="register-form">
            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
                autoFocus
              />
            </div>

            <div className="field">
              <div className="password-header">
                <label htmlFor="password">Password</label>
                <Link to="/forgot-password" className="forgot-link">Forgot password?</Link>
              </div>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            <div className="remember-row">
              <input type="checkbox" id="remember" />
              <label htmlFor="remember">Remember me for 30 days</label>
            </div>

            <button type="submit" className="register-submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="register-switch">
            Don't have an account? <Link to="/register">Register</Link>
          </p>
          <div className="register-footer">
            By continuing you agree to our Terms and Privacy Policy.
          </div>
        </div>

        {/* ── Right: live demo ─────────────────────────────── */}
        <div className="register-demo-side">
          <div className="demo-eyebrow">Smart Routing</div>
          <h2 className="demo-heading">
            Critical issues are instantly identified and escalated to human experts.
          </h2>

          <DemoEscalation />

          <div className="demo-caption">
            <span className="demo-caption__dot" style={{ background: '#E53E3E' }} />
            Zero-delay escalation
          </div>
        </div>

      </div>
    </div>
  );
}