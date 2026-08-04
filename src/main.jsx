import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import "./index.css";
import App from "./App.jsx";
import { registerServiceWorker } from "./lib/push.js";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <App />
    </MotionConfig>
  </StrictMode>
);

// Registering here only readies the service worker for later use — it never
// requests notification permission or subscribes on its own (that's gated to
// the explicit toggle in PushPermissionPrompt.jsx). Silently no-ops in
// unsupported browsers.
registerServiceWorker();
