import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/**
 * The last line of defence for a render throw. A malformed persisted record can
 * reach computeStrength, which throws by design; without this, React unmounts
 * the tree and the user sees a blank page with no way forward.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("comp3tive render error", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="app" data-testid="error-boundary">
        <div className="screen">
          <div className="load-error" role="alert">
            <strong>Something went wrong drawing this screen.</strong> {error.message}
          </div>
          <p className="lede">
            Your saved data is safe on this device — nothing was changed. Reload to continue.
          </p>
          <div className="bar">
            <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
