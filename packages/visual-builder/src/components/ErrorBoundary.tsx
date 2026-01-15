/**
 * Error Boundary component
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  errorInfo?: ErrorInfo;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined, errorInfo: undefined });
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="error-boundary">
          <div className="error-content">
            <div className="error-icon">⚠️</div>
            <h2>Something went wrong</h2>
            <p className="error-message">{this.state.error?.message}</p>
            <details className="error-details">
              <summary>Details</summary>
              <pre>{this.state.error?.stack}</pre>
              {this.state.errorInfo && (
                <div className="component-stack">
                  <strong>Component Stack:</strong>
                  <pre>{this.state.errorInfo.componentStack}</pre>
                </div>
              )}
            </details>
            <div className="error-actions">
              <button onClick={this.handleReset} className="btn-primary">
                Try Again
              </button>
              <button onClick={() => window.location.reload()} className="btn-secondary">
                Reload Page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}