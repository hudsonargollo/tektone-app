import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { MotionConfig } from "framer-motion";
import "./index.css";
import "./crm/crm-theme.css";
import CrmApp from "./crm/CrmApp.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <CrmApp />
    </MotionConfig>
  </StrictMode>
);
