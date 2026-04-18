import {
  Component,
  type ComponentType,
  type GetDerivedStateFromError,
  type PropsWithChildren,
  type ReactNode,
} from 'react';

export interface ErrorBoundaryProps extends PropsWithChildren {
  fallback?: ReactNode | ComponentType<{ error: unknown }>;
}

interface ErrorBoundaryState {
  error?: unknown;
  hasError: boolean;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError: GetDerivedStateFromError<
    ErrorBoundaryProps,
    ErrorBoundaryState
  > = (error) => ({ error, hasError: true });

  override componentDidCatch(error: Error) {
    this.setState({ error, hasError: true });
  }

  override render() {
    const { error, hasError } = this.state;
    const { fallback: Fallback, children } = this.props;

    if (!hasError) return children;
    if (typeof Fallback === 'function') return <Fallback error={error} />;
    return Fallback ?? null;
  }
}
