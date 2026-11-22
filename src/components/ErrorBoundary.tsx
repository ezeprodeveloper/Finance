import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-red-200 rounded-xl p-6 space-y-4 shadow-sm">
            <h1 className="font-display text-lg font-bold text-red-900">
              Connection or Sync Error
            </h1>
            <p className="text-xs text-slate-600 break-words font-mono bg-slate-50 p-3 rounded-lg border border-slate-200">
              {this.state.message}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="h-10 px-4 bg-[#071B38] text-white text-xs font-semibold rounded-lg"
            >
              Reload E-Finance
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
