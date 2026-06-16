import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/**
 * DemoTicket
 * ==========
 * A self-looping mockup of the actual product flow: a customer message
 * comes in, the AI "thinks", then replies with a visible knowledge-base
 * citation, and the ticket flips to resolved. Purely decorative —
 * no API calls — but every line mirrors what /chat and /rag actually do.
 */
function DemoTicket() {
  const [step, setStep] = useState(0);
  const timeoutRef = useRef(null);

  useEffect(() => {
    const delay = step % 4 === 3 ? 3200 : 1100;
    timeoutRef.current = setTimeout(() => {
      setStep((s) => s + 1);
    }, delay);
    return () => clearTimeout(timeoutRef.current);
  }, [step]);

  const phase = step % 4; // 0: customer msg, 1: thinking, 2: ai answer, 3: resolved
  const resolved = phase === 3;

  return (
    <div className="demo-ticket">
      <div className="demo-ticket__top">
        <div>
          <div className="demo-ticket__title">Refund taking too long</div>
          <div className="demo-ticket__meta">Opened 2 min ago</div>
        </div>
        <span className={`demo-pill ${resolved ? "demo-pill--resolved" : "demo-pill--open"}`}>
          {resolved ? "resolved" : "open"}
        </span>
      </div>

      {phase >= 0 && (
        <div className="demo-msg-row">
          <div className="demo-bubble demo-bubble--customer">
            My refund hasn&rsquo;t shown up. It&rsquo;s been over a week, this is frustrating.
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
          <div className="demo-bubble demo-bubble--ai">
            Refunds are processed within 5&ndash;7 business days. You&rsquo;re at day 7,
            so it should land within 24 hours.
            <div className="demo-citation">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12h6m-6 4h6M5 5h14a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" />
              </svg>
              Refund Policy &middot; kb_001
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Register() {
  const [name,     setName]     = useState("");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState("");
  const [loading,  setLoading]  = useState(false);

  const { register } = useAuth();
  const navigate     = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await register(name, email, password);
      navigate("/my-tickets");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg).join(", "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("Registration failed. Please try again.");
      }
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
          <p className="register-subhead">Create your account to start a ticket</p>

          {error && <div className="alert alert-error">{error}</div>}

          <form onSubmit={handleSubmit} className="register-form">
            <div className="field">
              <label htmlFor="name">Full name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                required
                autoFocus
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
                required
              />
              <div className="field-hint">8+ characters, with a number and a symbol</div>
            </div>

            <button type="submit" className="register-submit" disabled={loading}>
              {loading ? "Creating account..." : "Create account"}
            </button>
          </form>

          <p className="register-switch">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>

          <div className="register-footer">
            By continuing you agree to our Terms and Privacy Policy.
          </div>
        </div>

        {/* ── Right: live demo ─────────────────────────────── */}
        <div className="register-demo-side">
          <div className="demo-eyebrow">How it works</div>
          <h2 className="demo-heading">
            Every ticket gets read, classified, and answered &mdash; before a human ever sees it.
          </h2>

          <DemoTicket />

          <div className="demo-caption">
            <span className="demo-caption__dot" />
            Resolved without a support agent
          </div>
        </div>

      </div>
    </div>
  );
}