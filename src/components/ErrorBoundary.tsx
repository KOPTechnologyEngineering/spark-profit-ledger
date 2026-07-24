import { Component, ErrorInfo, ReactNode } from "react";
import { log } from "@/lib/logger";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches React render errors so a crash shows a recoverable message instead
 * of a blank white screen, and records the error (with component stack) to the
 * application log.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    log.fatal(error.message || "React render error", {
      logger: "ErrorBoundary",
      error_code: error.name,
      error_detail: error.stack,
      context: { componentStack: info.componentStack },
    });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="glass-card w-full max-w-md space-y-4 p-8 text-center">
          <h1 className="font-heading text-xl font-semibold text-foreground">Something went wrong</h1>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This page hit an unexpected error. The details have been logged for your administrator.
            Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}
