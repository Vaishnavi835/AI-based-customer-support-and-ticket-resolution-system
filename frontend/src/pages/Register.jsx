import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Eye, EyeOff, Sparkles } from "lucide-react";

/**
 * AIWorkflowVisualizer
 * ====================
 * Renders a vertical progress stepper showing active/completed AI steps.
 */
function AIWorkflowVisualizer({ currentStep }) {
  const steps = [
    { title: "Customer Ticket", subtitle: "User submits a billing inquiry about a refund" },
    { title: "AI Reads Ticket", subtitle: "Parsing language sentiment and content intent" },
    { title: "AI Classifies Issue", subtitle: "Classified as: Billing & Payments (97.2%)" },
    { title: "Knowledge Base Search", subtitle: "Scanning KB articles for refund rules" },
    { title: "AI Response Generated", subtitle: "Drafting auto-response with KB reference citations" },
    { title: "Resolved", subtitle: "Ticket marked solved without agent intervention" }
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
 * DemoTicket
 * ==========
 * A self-looping mockup of the actual product flow.
 */
function DemoTicket({ step }) {
  const resolved = step === 5;

  return (
    <div className="demo-ticket demo-ticket--enhanced" style={{ minHeight: '340px' }}>
      <div className="demo-ticket__top">
        <div>
          <div className="demo-ticket__title" style={{ fontSize: '18px', fontWeight: '700', color: '#1C2333' }}>
            Refund taking too long
          </div>
          <div className="demo-ticket__meta" style={{ fontSize: '12px' }}>Opened 2 min ago</div>
        </div>
        <span className={`demo-pill ${resolved ? "demo-pill--resolved" : "demo-pill--open"}`} style={{ animation: resolved ? 'bulletPulse 2s infinite' : 'none' }}>
          {resolved ? "resolved" : "open"}
        </span>
      </div>

      <div className="demo-messages" style={{ height: '230px', overflowY: 'auto' }}>
        {/* Customer message - always visible */}
        <div className="demo-msg-row" style={{ marginTop: '8px' }}>
          <div className="demo-msg-label demo-msg-label--customer">
            <div className="demo-avatar demo-avatar--customer">CU</div>
            <span>Customer</span>
          </div>
          <div className="demo-bubble demo-bubble--customer" style={{ fontSize: '14px', padding: '10px 16px' }}>
            My refund hasn&rsquo;t shown up. It&rsquo;s been over a week, this is frustrating.
          </div>
        </div>

        {step === 1 && (
          <div className="demo-msg-row">
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
          <div className="demo-msg-row">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai" style={{ background: '#F5F3FF', color: '#5B21B6', border: '1px solid #DDD6FE', fontSize: '13px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '4px' }}>
                <Sparkles size={14} /> AI Classification
              </div>
              <div>Category: <strong>Billing / Refunds</strong></div>
              <div>Priority: <strong>Medium</strong></div>
              <div>Confidence: <strong>97.2%</strong></div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="demo-msg-row">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai" style={{ background: '#F0FDF4', color: '#166534', border: '1px solid #BBF7D0', fontSize: '13px', padding: '10px 14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: '700', marginBottom: '4px' }}>
                📖 Knowledge Base Match
              </div>
              Searching <strong>refund_policy.md</strong> (kb_001)... Found matching rule: Refunds processed within 5-7 business days.
            </div>
          </div>
        )}

        {step >= 4 && (
          <div className="demo-msg-row">
            <div className="demo-msg-label demo-msg-label--ai">
              <div className="demo-avatar demo-avatar--ai">AI</div>
              <span>AI Assistant</span>
            </div>
            <div className="demo-bubble demo-bubble--ai" style={{ fontSize: '13.5px', padding: '12px 16px' }}>
              Refunds are processed within 5&ndash;7 business days. You&rsquo;re currently at day 7, so the transaction should settle within the next 24 hours.
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
    </div>
  );
}

function RegisterDemoSection() {
  const [step, setStep] = useState(0);

  useEffect(() => {
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

      <div className="demo-eyebrow">Instant AI Resolution</div>
      <h2 className="demo-heading" style={{ fontSize: '32px', marginBottom: '16px' }}>
        Every ticket gets read, classified, and answered &mdash; before a human ever sees it.
      </h2>

      {/* Workflow Stepper */}
      <AIWorkflowVisualizer currentStep={step} />

      {/* Demo Ticket Card */}
      <DemoTicket step={step} />

      {/* Feature highlights */}
      <div className="demo-features" style={{ marginTop: '24px' }}>
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
    </div>
  );
}

export default function Register() {
  const [name,            setName]            = useState("");
  const [email,           setEmail]           = useState("");
  const [password,        setPassword]        = useState("");
  const [showPassword,    setShowPassword]    = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const role = "customer";
  const [error,           setError]           = useState("");
  const [loading,         setLoading]         = useState(false);

  const { register } = useAuth();
  const navigate     = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      await register(name, email, password, role);
      navigate("/");
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

  const strength = (() => {
    if (!password) return null;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    if (score === 1) return { label: "Weak", className: "weak" };
    if (score === 2) return { label: "Medium", className: "medium" };
    if (score === 3) return { label: "Strong & Secure", className: "strong" };
    return { label: "Weak", className: "weak" };
  })();

  return (
    <div className="register-shell">
      <div className="register-card">

        {/* ── Left: Form Side ───────────────────────────────── */}
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
              <div className="password-input-wrapper">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
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
              
              {/* Dynamic Strength Indicator */}
              {strength && (
                <div className="password-strength-container">
                  <div className="password-strength-label">
                    <span>Password Strength:</span>
                    <span className={`strength-text strength-text--${strength.className}`} style={{ color: strength.className === 'weak' ? '#EF4444' : strength.className === 'medium' ? '#F59E0B' : '#10B981', fontWeight: 'bold' }}>
                      {strength.label}
                    </span>
                  </div>
                  <div className="password-strength-bar-bg">
                    <div className={`password-strength-bar ${strength.className}`} />
                  </div>
                </div>
              )}
              <div className="field-hint">8+ characters, with a number and a symbol</div>
            </div>

            <div className="field">
              <label htmlFor="confirmPassword">Confirm Password</label>
              <div className="password-input-wrapper">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••••"
                  required
                  style={{ width: '100%' }}
                />
                <button
                  type="button"
                  className="password-toggle-btn"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>



            <button type="submit" className="register-submit" disabled={loading} style={{ marginTop: '16px' }}>
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

        {/* ── Right: Live Demo ───────────────────────────────── */}
        <RegisterDemoSection />

      </div>
    </div>
  );
}