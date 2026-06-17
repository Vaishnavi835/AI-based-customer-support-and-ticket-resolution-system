import { useState, useCallback } from "react";

/* ── All puzzle types ─────────────────────────────────────────── */
function generatePuzzle() {
  const type = Math.floor(Math.random() * 4);

  if (type === 0) {
    /* Math puzzle */
    const ops = ["+", "−", "×"];
    const op = ops[Math.floor(Math.random() * ops.length)];
    let a, b, answer;
    if (op === "+") {
      a = Math.floor(Math.random() * 20) + 5;
      b = Math.floor(Math.random() * 20) + 5;
      answer = String(a + b);
    } else if (op === "−") {
      a = Math.floor(Math.random() * 20) + 15;
      b = Math.floor(Math.random() * 14) + 1;
      answer = String(a - b);
    } else {
      a = Math.floor(Math.random() * 9) + 2;
      b = Math.floor(Math.random() * 9) + 2;
      answer = String(a * b);
    }
    return {
      kind: "math",
      icon: "🧮",
      label: "Solve the equation",
      question: `${a} ${op} ${b} = ?`,
      answer,
      placeholder: "Enter a number",
    };
  }

  if (type === 1) {
    /* Word scramble */
    const words = [
      "ROBOT", "CLOUD", "TIGER", "FLAME", "PLANT",
      "STORM", "RIVER", "SOLAR", "PHONE", "MUSIC",
    ];
    const word = words[Math.floor(Math.random() * words.length)];
    const scrambled = word
      .split("")
      .sort(() => Math.random() - 0.5)
      .join("");
    return {
      kind: "scramble",
      icon: "🔤",
      label: "Unscramble the word",
      question: scrambled,
      answer: word,
      placeholder: "Type the word",
    };
  }

  if (type === 2) {
    /* Number sequence */
    const sequences = [
      { seq: [2, 4, 6, 8, "?"],   answer: "10",  rule: "+2" },
      { seq: [3, 6, 12, 24, "?"], answer: "48",  rule: "×2" },
      { seq: [1, 4, 9, 16, "?"],  answer: "25",  rule: "squares" },
      { seq: [5, 10, 15, 20, "?"],answer: "25",  rule: "+5" },
      { seq: [100, 50, 25, "?"],  answer: "12",  rule: "÷2" },
      { seq: [1, 1, 2, 3, 5, "?"],answer: "8",   rule: "Fibonacci" },
      { seq: [7, 14, 21, 28, "?"],answer: "35",  rule: "+7" },
      { seq: [81, 27, 9, 3, "?"], answer: "1",   rule: "÷3" },
    ];
    const s = sequences[Math.floor(Math.random() * sequences.length)];
    return {
      kind: "sequence",
      icon: "🔢",
      label: "Complete the pattern",
      question: s.seq.join("  →  "),
      answer: s.answer,
      placeholder: "Enter the next number",
    };
  }

  /* Simple riddles / trivia */
  const riddles = [
    { q: "How many sides does a triangle have?",    a: "3" },
    { q: "How many hours are in a day?",            a: "24" },
    { q: "What is the opposite of 'hot'?",          a: "cold" },
    { q: "How many days are in a week?",            a: "7" },
    { q: "What shape has four equal sides?",        a: "square" },
    { q: "How many months are in a year?",          a: "12" },
    { q: "What is 100 divided by 4?",              a: "25" },
    { q: "How many zeros are in one thousand?",    a: "3" },
    { q: "What is the first letter of the alphabet?", a: "a" },
    { q: "How many seconds are in one minute?",    a: "60" },
  ];
  const r = riddles[Math.floor(Math.random() * riddles.length)];
  return {
    kind: "riddle",
    icon: "🤔",
    label: "Answer the question",
    question: r.q,
    answer: r.a,
    placeholder: "Your answer",
  };
}

/* ── Kind labels & colors ─────────────────────────────────────── */
const KIND_META = {
  math:     { tag: "Math",     color: "#2563EB", bg: "#EFF6FF" },
  scramble: { tag: "Unscramble", color: "#7C3AED", bg: "#F5F3FF" },
  sequence: { tag: "Pattern",  color: "#0891B2", bg: "#ECFEFF" },
  riddle:   { tag: "Riddle",   color: "#D97706", bg: "#FFFBEB" },
};

/* ══════════════════════════════════════════════════════════════════
   EXPORTED COMPONENT
   Props:
     onVerified(true/false) — called when verification state changes
   ══════════════════════════════════════════════════════════════════ */
export default function CustomCaptcha({ onVerified }) {
  const [puzzle,    setPuzzle]    = useState(() => generatePuzzle());
  const [input,     setInput]     = useState("");
  const [status,    setStatus]    = useState("idle"); // idle | correct | wrong
  const [attempts,  setAttempts]  = useState(0);

  const refresh = useCallback(() => {
    setPuzzle(generatePuzzle());
    setInput("");
    setStatus("idle");
    onVerified(false);
  }, [onVerified]);

  const check = () => {
    const userAns = input.trim().toLowerCase();
    const correct = puzzle.answer.toLowerCase();
    if (userAns === correct) {
      setStatus("correct");
      onVerified(true);
    } else {
      setStatus("wrong");
      setAttempts(a => a + 1);
      onVerified(false);
      // Auto-refresh to a new puzzle after 3 wrong attempts
      if (attempts >= 2) {
        setTimeout(() => {
          setPuzzle(generatePuzzle());
          setInput("");
          setStatus("idle");
          setAttempts(0);
        }, 900);
      }
    }
  };

  const handleKey = (e) => {
    if (e.key === "Enter") { e.preventDefault(); check(); }
    if (status === "wrong") setStatus("idle");
  };

  const meta = KIND_META[puzzle.kind];

  return (
    <div className={`captcha-box captcha-box--${status}`}>
      {/* Header row */}
      <div className="captcha-header">
        <div className="captcha-shield">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div className="captcha-header-text">
          <span className="captcha-title">Human Verification</span>
          <span className="captcha-subtitle">Prove you're not a robot</span>
        </div>
        <button
          type="button"
          className="captcha-refresh"
          onClick={refresh}
          title="Get a new puzzle"
          disabled={status === "correct"}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M23 4v6h-6"/>
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
          </svg>
        </button>
      </div>

      {/* Puzzle type tag */}
      <div
        className="captcha-kind-tag"
        style={{ background: meta.bg, color: meta.color }}
      >
        {puzzle.icon} {meta.tag} Challenge
      </div>

      {/* Question */}
      <div className="captcha-label">{puzzle.label}</div>
      <div className={`captcha-question captcha-question--${puzzle.kind}`}>
        {puzzle.question}
      </div>

      {/* Input + check */}
      {status !== "correct" ? (
        <div className="captcha-input-row">
          <input
            type="text"
            className={`captcha-input ${status === "wrong" ? "captcha-input--wrong" : ""}`}
            value={input}
            onChange={e => { setInput(e.target.value); if (status !== "idle") setStatus("idle"); }}
            onKeyDown={handleKey}
            placeholder={puzzle.placeholder}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            type="button"
            className="captcha-check-btn"
            onClick={check}
            disabled={!input.trim()}
          >
            Check
          </button>
        </div>
      ) : null}

      {/* Feedback */}
      {status === "correct" && (
        <div className="captcha-feedback captcha-feedback--correct">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          Verified! You're human ✓
        </div>
      )}
      {status === "wrong" && (
        <div className="captcha-feedback captcha-feedback--wrong">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="12"/>
            <line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          {attempts >= 3 ? "Too many attempts — new puzzle loading…" : "Incorrect. Try again!"}
        </div>
      )}
    </div>
  );
}
