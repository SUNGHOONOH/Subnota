import { Component, type ErrorInfo, type ReactNode } from 'react';

interface RenderErrorBoundaryProps {
  children: ReactNode;
  fallback: (reset: () => void) => ReactNode;
  resetKey?: string;
}

interface RenderErrorBoundaryState {
  hasError: boolean;
}

export default class RenderErrorBoundary extends Component<
  RenderErrorBoundaryProps,
  RenderErrorBoundaryState
> {
  state: RenderErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): RenderErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Subnota] render failed', error, info.componentStack);
  }

  componentDidUpdate(previousProps: RenderErrorBoundaryProps) {
    if (
      this.state.hasError &&
      previousProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ hasError: false });
    }
  }

  private reset = () => this.setState({ hasError: false });

  render() {
    return this.state.hasError
      ? this.props.fallback(this.reset)
      : this.props.children;
  }
}
