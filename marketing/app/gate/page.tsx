import { Suspense } from "react";
import GateForm from "./GateForm";

export const metadata = {
  title: "Prévia — Tektone",
  robots: { index: false, follow: false },
};

export default function GatePage() {
  return (
    <Suspense fallback={null}>
      <GateForm />
    </Suspense>
  );
}
