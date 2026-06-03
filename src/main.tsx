import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Analytics } from "@vercel/analytics/react";
import App from "./App";
import "./styles.css";

const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    {!isLocalHost && <Analytics />}
  </StrictMode>,
);
