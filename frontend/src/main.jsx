import { StrictMode } from "react";
import { createRoot }  from "react-dom/client";
import "./index.css";
import "./themes/charcoal-gold.css";
import "./themes/slate-ivory.css";
import "./themes/midnight-rose.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);