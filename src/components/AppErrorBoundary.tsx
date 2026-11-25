import React from 'react';

interface AppErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class AppErrorBoundary extends React.Component<
  { children: React.ReactNode },
  AppErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = {
      hasError: false,
      message: '',
    };
  }

  static getDerivedStateFromError(error: Error): AppErrorBoundaryState {
    return {
      hasError: true,
      message: error.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white text-slate-900 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-4">
          <h1 className="font-display text-xl font-bold text-[#071B38]">
            E-Finance Notice
          </h1>
          <p className="text-sm text-slate-700 leading-relaxed">{this.state.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full h-10 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }
}
