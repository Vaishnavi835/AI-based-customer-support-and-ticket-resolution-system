import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";

export default function ForgotPassword() {
  const [step, setStep] = useState(1); // 1: Email, 2: Code, 3: Password, 4: Success
  const [email, setEmail] = useState("");
  const [code, setCode] = useState(Array(6).fill(""));
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [loading, setLoading] = useState(false);
  
  const navigate = useNavigate();
  const codeRefs = useRef([]);

  // Auto-focus code inputs on step change
  useEffect(() => {
    if (step === 2 && codeRefs.current[0]) {
      codeRefs.current[0].focus();
    }
  }, [step]);

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!email) return;
    
    setError("");
    setLoading(true);

    try {
      // Simulate API call to send recovery email
      await new Promise((resolve) => setTimeout(resolve, 1200));
      setStep(2);
    } catch {
      setError("Failed to send recovery code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCodeChange = (e, index) => {
    const val = e.target.value;
    // Allow digits only
    if (/^[0-9]$/.test(val)) {
      const newCode = [...code];
      newCode[index] = val;
      setCode(newCode);
      setError("");
      
      // Auto-focus next input
      if (index < 5 && codeRefs.current[index + 1]) {
        codeRefs.current[index + 1].focus();
      }
    } else if (val === "") {
      const newCode = [...code];
      newCode[index] = "";
      setCode(newCode);
    }
  };

  const handleCodeKeyDown = (e, index) => {
    if (e.key === "Backspace") {
      if (code[index] === "" && index > 0 && codeRefs.current[index - 1]) {
        codeRefs.current[index - 1].focus();
        const newCode = [...code];
        newCode[index - 1] = "";
        setCode(newCode);
      } else {
        const newCode = [...code];
        newCode[index] = "";
        setCode(newCode);
      }
    }
  };

  const handleCodePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();
    if (/^[0-9]{6}$/.test(pastedData)) {
      const newCode = pastedData.split("");
      setCode(newCode);
      setError("");
      if (codeRefs.current[5]) {
        codeRefs.current[5].focus();
      }
    }
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    const fullCode = code.join("");
    if (fullCode.length < 6) {
      setError("Please enter the complete 6-digit code.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Simulate API verification call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setStep(3);
    } catch {
      setError("Invalid code. Please verify and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      // Simulate API reset call
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setStep(4);
      
      // Auto-redirect to login after 5 seconds
      setTimeout(() => {
        navigate("/login");
      }, 5000);
    } catch {
      setError("Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    setError("");
    setCode(Array(6).fill(""));
    setSuccessMsg("Code resent successfully!");
    setTimeout(() => setSuccessMsg(""), 3000);
    
    // Auto focus first field
    if (codeRefs.current[0]) {
      codeRefs.current[0].focus();
    }
  };

  return (
    <div className="register-shell">
      <div className="login-card">
        <div className="register-form-side">
          {/* Enhanced brand logo */}
          <div className="register-brand" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="register-brand__icon" style={{ fontSize: '32px', color: '#C4683D', marginRight: '4px' }}>✦</span>
              <span className="register-brand__text" style={{ fontSize: '30px', fontWeight: '800', color: '#1C2333', letterSpacing: '-0.5px' }}>AI</span>
              <span className="register-brand__accent" style={{ fontSize: '30px', fontWeight: '600', color: '#C4683D', fontFamily: 'Georgia, serif' }}>Support</span>
            </div>
            <div className="register-brand__tagline" style={{ marginLeft: '36px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.08em', color: '#8A8E9C', textTransform: 'uppercase' }}>
              Smart Ticket Intelligence
            </div>
          </div>

          {/* ── STEP 1: Email ────────────────────────────────────── */}
          {step === 1 && (
            <div className="step-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h2 className="demo-ticket__title" style={{ fontSize: '20px', marginTop: '10px' }}>
                Reset your password
              </h2>
              <p className="register-subhead">
                Enter your email address and we'll send you a confirmation code to reset your password.
              </p>

              {error && <div className="alert alert-error">{error}</div>}

              <form onSubmit={handleSendCode} className="register-form">
                <div className="field">
                  <label htmlFor="email">Email address</label>
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

                <button type="submit" className="register-submit" disabled={loading}>
                  {loading ? "Sending code..." : "Send code"}
                </button>
              </form>

              <p className="register-switch" style={{ marginTop: 'auto', paddingTop: '40px' }}>
                Remember your password? <Link to="/login">Back to sign in</Link>
              </p>
            </div>
          )}

          {/* ── STEP 2: Verification Code ─────────────────────────── */}
          {step === 2 && (
            <div className="step-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
              <h2 className="demo-ticket__title" style={{ fontSize: '20px', marginTop: '10px' }}>
                Verification code
              </h2>
              <p className="register-subhead">
                We've sent a 6-digit confirmation code to <strong style={{ color: '#1C2333' }}>{email}</strong>.
              </p>

              {error && <div className="alert alert-error">{error}</div>}
              {successMsg && <div className="alert alert-success">{successMsg}</div>}

              <form onSubmit={handleVerifyCode} className="register-form">
                <div className="field">
                  <label>Confirmation Code</label>
                  <div className="code-input-container">
                    {code.map((digit, idx) => (
                      <input
                        key={idx}
                        ref={(el) => (codeRefs.current[idx] = el)}
                        type="text"
                        maxLength="1"
                        value={digit}
                        onChange={(e) => handleCodeChange(e, idx)}
                        onKeyDown={(e) => handleCodeKeyDown(e, idx)}
                        onPaste={idx === 0 ? handleCodePaste : undefined}
                        className="code-input"
                        required
                      />
                    ))}
                  </div>
                </div>

                <button type="submit" className="register-submit" disabled={loading}>
                  {loading ? "Verifying..." : "Verify code"}
                </button>
              </form>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto', paddingTop: '40px' }} className="register-switch">
                <button 
                  type="button" 
                  onClick={resendCode} 
                  className="forgot-link" 
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, font: 'inherit' }}
                >
                  Resend code
                </button>
                <Link to="/login">Back to sign in</Link>
              </div>
            </div>
          )}

          {/* ── STEP 3: Reset Password ───────────────────────────── */}
          {step === 3 && (() => {
            const strength = (() => {
              if (!newPassword) return null;
              let score = 0;
              if (newPassword.length >= 8) score++;
              if (/[0-9]/.test(newPassword)) score++;
              if (/[^A-Za-z0-9]/.test(newPassword)) score++;
              if (score === 1) return { label: "Weak", className: "weak" };
              if (score === 2) return { label: "Medium", className: "medium" };
              if (score === 3) return { label: "Strong & Secure", className: "strong" };
              return { label: "Weak", className: "weak" };
            })();

            return (
              <div className="step-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%' }}>
                <h2 className="demo-ticket__title" style={{ fontSize: '20px', marginTop: '10px' }}>
                  Create new password
                </h2>
                <p className="register-subhead">
                  Your code was verified. Choose a secure, new password for your account.
                </p>

                {error && <div className="alert alert-error">{error}</div>}

                <form onSubmit={handleResetPassword} className="register-form" style={{ width: '100%' }}>
                  <div className="field">
                    <label htmlFor="newPassword">New Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                        autoFocus
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

                    {/* Password Strength Meter */}
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
                    <div className="field-hint">Must be at least 8 characters with a number and symbol.</div>
                  </div>

                  <div className="field" style={{ marginTop: '14px' }}>
                    <label htmlFor="confirmPassword">Confirm Password</label>
                    <div className="password-input-wrapper">
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
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

                  <button type="submit" className="register-submit" style={{ marginTop: '20px' }} disabled={loading}>
                    {loading ? "Updating password..." : "Reset password"}
                  </button>
                </form>
              </div>
            );
          })()}

          {/* ── STEP 4: Success ───────────────────────────────────── */}
          {step === 4 && (
            <div className="step-fade-in" style={{ display: 'flex', flexDirection: 'column', flex: 1, textAlign: 'center', alignItems: 'center' }}>
              <div style={{
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: '#E3EBE4',
                color: '#3F5C44',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '24px 0 16px',
                fontSize: '28px'
              }}>
                ✓
              </div>
              <h2 className="demo-ticket__title" style={{ fontSize: '20px' }}>
                Password updated!
              </h2>
              <p className="register-subhead" style={{ marginBottom: '24px' }}>
                Your password has been successfully reset. You can now sign in with your new password.
              </p>
              
              <button 
                type="button" 
                onClick={() => navigate("/login")} 
                className="register-submit"
              >
                Go to Login
              </button>

              <p className="register-footer" style={{ marginTop: 'auto', paddingTop: '40px' }}>
                Redirecting you to the sign-in page in a few seconds...
              </p>
            </div>
          )}

          <div className="register-footer" style={{ marginTop: step === 4 ? '12px' : '24px' }}>
            By continuing you agree to our Terms and Privacy Policy.
          </div>
        </div>
      </div>
    </div>
  );
}
