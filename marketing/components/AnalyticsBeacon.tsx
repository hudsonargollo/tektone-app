"use client";

import { useEffect } from "react";
import { trackEvent } from "@/lib/analytics";

// Mounted once on the homepage (see app/page.tsx) — fires a single
// page_view per tab session. form_start/form_complete are fired directly
// from QualificacaoSection.tsx at the moments that actually matter.
export default function AnalyticsBeacon() {
  useEffect(() => {
    trackEvent("page_view");
  }, []);
  return null;
}
