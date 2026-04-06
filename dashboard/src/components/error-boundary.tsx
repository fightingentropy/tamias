"use client";

import type { ReactNode } from "react";
import { Component } from "react";

type ErrorBoundaryRenderProps = {
  error: Error;
  reset: () => void;
};

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback?: ReactNode;
  errorComponent?: (props: ErrorBoundaryRenderProps) => ReactNode;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    error: null,
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  reset = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      if (this.props.errorComponent) {
        return this.props.errorComponent({
          error: this.state.error,
          reset: this.reset,
        });
      }

      return this.props.fallback ?? null;
    }

    return this.props.children;
  }
}
