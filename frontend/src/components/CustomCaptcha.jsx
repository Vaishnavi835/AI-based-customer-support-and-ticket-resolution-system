import { useState, useEffect } from "react";
import { Check, RefreshCw } from "lucide-react";

export default function CustomCaptcha({ onVerified, reset }) {
  const [status, setStatus] = useState("idle"); // idle, verifying, verified

  // When the parent resets captchaOk to false (e.g. after a failed login),
  // bring the widget back to idle so the user can verify again.
  useEffect(() => {
    if (reset) {
      setStatus("idle");
    }
  }, [reset]);

  const handleClick = () => {
    if (status !== "idle") return;
    setStatus("verifying");
    
    // Simulate network delay
    setTimeout(() => {
      setStatus("verified");
      onVerified(true);
    }, 800);
  };

  return (
    <div 
      className={`simple-captcha ${status}`}
      onClick={handleClick}
    >
      <div className="simple-captcha-left">
        <div className={`simple-captcha-checkbox ${status}`}>
          {status === "verifying" && <RefreshCw size={16} className="spinner" />}
          {status === "verified" && <Check size={18} color="#10B981" strokeWidth={3} />}
        </div>
        <span className="simple-captcha-text">I am not a robot</span>
      </div>
      
      <div className="simple-captcha-logo">
        <div className="logo-circles">
          <span className="circle blue"></span>
          <span className="circle red"></span>
          <span className="circle yellow"></span>
        </div>
        <span className="logo-text">reCAPTCHA</span>
        <span className="logo-terms">Privacy - Terms</span>
      </div>
    </div>
  );
}
