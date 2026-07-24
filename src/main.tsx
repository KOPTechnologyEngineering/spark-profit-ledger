import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App.tsx";
import ErrorBoundary from "@/components/ErrorBoundary";
import { initLogging } from "@/lib/logger";
import "./index.css";

// Starts batched log flushing and global error capture (window.onerror /
// unhandledrejection). Safe to call before render; never throws.
initLogging();

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <HelmetProvider>
      <App />
    </HelmetProvider>
  </ErrorBoundary>,
);
