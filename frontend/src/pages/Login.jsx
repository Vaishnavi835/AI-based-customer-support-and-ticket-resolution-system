import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import CustomCaptcha from "../components/CustomCaptcha";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { useToast } from "../context/ToastContext";

/**
 * AIWorkflowVisualizer
 * ====================
 * Renders a vertical progress stepper showing active/completed AI steps.
 */
function AIWorkflowVisualizer({ currentStep }) {
  const steps = [
    { title: "Customer Ticket", subtitle: "Critical database outage submitted" },
    { title: "AI Reads Ticket", subtitle: "Analyzing content syntax & sentiment" },
    { title: "AI Classifies Issue", subtitle: "Category: Database | Priority: High (99%)" },
    { title: "Severity & SLA Check", subtitle: "Checking rules & SLA timelines" },
    { title: "AI Response Generated", subtitle: "DevOps escalation ticket auto-formulated" },
    { title: "Escalated", subtitle: "Routed to DevOps On-Call Team via PagerDuty" }
  ];

  return (
    <div className="ai-workflow-stepper">
      {steps.map((step, idx) => {
        const isActive = idx === currentStep;
        const isCompleted = idx < currentStep;
        return (
          <div key={idx} className={`ai-workflow-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}>
            <div className="ai-workflow-dot">
              {isCompleted ? "✓" : idx + 1}
            </div>
            <div className="ai-workflow-content">
              <span className="ai-workflow-title">{step.title}</span>
              {isActive && <span className="ai-workflow-subtitle">{step.subtitle}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * DemoEscalation
 * ==============
 * Cycles through the ticket visual states corresponding to the active step.
 */
function DemoEscalation({ step }) {
  const escalated = step === 5;

  return (
    <div className="demo-ticket demo-ticket--enhanced" style={{ minHeight: '340px' }}>
      {/* ── Ticket header ── */}
      <div className="demo-ticket__top">
        <div className="demo-ticket__header-left">
          <div className="demo-ticket__severity-row">
            <span className="demo-ticket__sev-icon" aria-label="Critical severity">🚨</span>
            <div className="demo-ticket__title" style={{ fontSize: '18px', fontWeight: '700', color: '#1C2333' }}>
              Production database down
            </div>
          </div>
          <div className="demo-ticket__meta" style={{ fontSize: '12px' }}>
            Opened <span className="demo-ticket__ts">2 min ago</span>
          </div>
        </div>
        <span className={`demo-pill ${escalated ? "demo-pill--escalated" : "demo-pill--open"}`} style={{ animation: escalated ? 'criticalPulse 1.5s infinite' : 'none' }}>
          {escalated ? "Escalated" : "Open"}
        </span>
      </div>

      {/* ── Messages area — fixed height, no layout shift ── */}
      <div className="demo-messages" style={{ height: '230px', overflowY: 'auto' }}>
        {/* Customer message — always visible */}
        <div className="demo-msg-row" key="customer" style={{ marginTop: '8px' }}>
          <div className="demo-msg-label demo-msg-label--customer">
            <div className="demo-avatar demo-avatar--customer">CU</div>
            <span>Customer</span>
          </div>
          <div className="demo-bubble demo-bubble--customer" style={{ fontSize: '14px', padding: '10px 16px' }}>
            URGENT: Our production database is unreachable. All users are getting 500 errors!
          </div>
        </div>

        {/* AI Area synced to step */}
        {step === 1 && (
          <div className="demo-msg-row" key="ai-thinking">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai" style={{ padding: '8px 16px' }}>
              <span className="demo-thinking">
                <i /><i /><i />
              </span>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="demo-msg-row" key="ai-classify">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai" style={{ background: '#D1FAE5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '13px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '4px' }}>
                <Sparkles size={14} /> AI Classification
              </div>
              <div>Category: <strong>Database / DevOps</strong></div>
              <div>Priority: <strong>Critical (Sev-1)</strong></div>
              <div>Confidence: <strong>99.4%</strong></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="demo-msg-row" key="ai-sla">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai" style={{ background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', fontSize: '13px', padding: '10px 14px' }}>
              <div style={{ fontWeight: '700', marginBottom: '2px' }}>🚨 SLA Policy Rule Matched:</div>
              Severity is critical &amp; system downtime detected. Response window is <strong>15 minutes</strong>. Initiating team escalations.
            </div>
          </div>
        )}

        {step >= 4 && (
          <div className="demo-msg-row" key="ai-response">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai demo-bubble--critical"
              style={{ background: '#FEF2F2', color: '#7F1D1D', fontSize: '13.5px', padding: '12px 16px' }}>
              <span className="demo-critical-label demo-critical-label--pulse">
                ⚠ Sev-1 Outage Detected.
              </span>
              <br />
              Ticket escalated to <strong>DevOps Response Team</strong>. On-call agents notified.
              <div className="demo-tags-row">
                <span className="demo-tag demo-tag--red">Database Outage</span>
                <span className="demo-tag demo-tag--orange">Auto Escalated</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoginDemoSection() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    // Sequence timing: Customer message -> Thinking -> Classify -> SLA check -> Response generated -> Escalated (long hold)
    const delays = [1600, 1400, 1800, 1600, 2400, 4200];
    const timer = setTimeout(() => {
      setStep((s) => (s + 1) % 6);
    }, delays[step]);
    return () => clearTimeout(timer);
  }, [step]);

  return (
    <div className="register-demo-side">
      {/* Dot-grid texture overlay */}
      <div className="demo-side-texture" aria-hidden="true" />

      <div className="demo-eyebrow">Smart AI Routing</div>
      <h2 className="demo-heading" style={{ fontSize: '32px', marginBottom: '16px' }}>
        Critical issues are instantly escalated to experts.
      </h2>

      {/* Workflow Stepper */}
      <AIWorkflowVisualizer currentStep={step} />

      {/* Feature highlights */}
      <div className="demo-features" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <div className="demo-feature">
          <span className="demo-feature__check">✓</span>
          <span>97% routing accuracy &amp; classification</span>
        </div>
        <div className="demo-feature">
          <span className="demo-feature__check">✓</span>
          <span>24/7 AI-powered triage support</span>
        </div>
        <div className="demo-feature">
          <span className="demo-feature__check">✓</span>
          <span>&lt;10s first response and routing time</span>
        </div>
      </div>

      {/* Live Card */}
      <DemoEscalation step={step} />
    </div>
  );
}

export default function Login() {
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error,        setError]        = useState("");
  const [loading,      setLoading]      = useState(false);
  const [captchaOk,    setCaptchaOk]    = useState(false);
  const [captchaReset, setCaptchaReset] = useState(false);

  const { login }  = useAuth();
  const navigate   = useNavigate();
  const toast      = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!captchaOk) {
      setError("Please complete the human verification puzzle.");
      toast.warning("Please complete the human verification puzzle.");
      return;
    }

    setLoading(true);
    try {
      const user = await login(email, password);
      toast.success(`Welcome back, ${user.name || 'User'}!`);
      if (user.role === "admin") {
        navigate("/dashboard");
      } else if (user.role === "support_agent") {
        navigate("/agent-dashboard");
      } else {
        navigate("/my-tickets");
      }
    } catch (err) {
      const msg = err.response?.data?.detail || "Login failed. Check your credentials.";
      setError(msg);
      toast.error(msg);
      setCaptchaOk(false);
      setCaptchaReset(r => !r); // toggle to trigger captcha reset
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="register-shell">
      <div className="register-card">

        {/* ── Left: live demo ─────────────────────────────── */}
        <LoginDemoSection />

        {/* ── Right: form ───────────────────────────────────── */}
        <div className="register-form-side">
          {/* Enhanced brand logo */}
          <div className="register-brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="register-brand__icon" style={{ fontSize: '32px', color: '#C4683D', marginRight: '4px' }}>✦</span>
              <span style={{ fontSize: '30px', fontWeight: '800', color: '#1C2333', letterSpacing: '-0.5px' }}>AI</span>
              <span style={{ fontSize: '30px', fontWeight: '600', color: '#C4683D', fontFamily: 'Georgia, serif' }}>Support</span>
            </div>
            <div className="register-brand__tagline" style={{ marginLeft: '36px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: '#8A8E9C', textTransform: 'uppercase' }}>
              Smart Ticket Intelligence
            </div>
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
              <div className="password-input-wrapper">
                <input
                  id="login-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="input--ivory"
                  style={{ width: '100%' }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            <div className="remember-row">
              <input type="checkbox" id="remember-me" />
              <label htmlFor="remember-me">Remember me for 30 days</label>
            </div>

            {/* ── Custom Puzzle CAPTCHA ─────────────────── */}
            <CustomCaptcha
              onVerified={(ok) => { setCaptchaOk(ok); setCaptchaReset(false); }}
              reset={captchaReset}
            />

            {/* Enhanced CTA button */}
            <button
              id="btn-sign-in"
              type="submit"
              className={`register-submit register-submit--premium ${captchaOk && email && password ? "register-submit--indigo" : ""}`}
              disabled={loading || !captchaOk || !email || !password}
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