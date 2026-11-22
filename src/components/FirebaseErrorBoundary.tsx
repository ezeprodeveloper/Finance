import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { FirestoreErrorInfo } from '../firebase';

interface FirebaseErrorBoundaryState {
  error: Error | null;
}

export class FirebaseErrorBoundary extends React.Component<
  { children: React.ReactNode },
  FirebaseErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error: Error): FirebaseErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught error:', error, info);
  }

  private parseFirestoreInfo(): FirestoreErrorInfo | null {
    if (!this.state.error?.message) return null;
    try {
      const parsed = JSON.parse(this.state.error.message) as FirestoreErrorInfo;
      if (parsed && typeof parsed.error === 'string' && 'operationType' in parsed) {
        return parsed;
      }
      return null;
    } catch {
      return null;
    }
  }

  override render() {
    if (!this.state.error) {
      return this.props.children;
    }

    const fsInfo = this.parseFirestoreInfo();
    const isQuotaError =
      (fsInfo?.error || this.state.error.message).includes('Quota exceeded');

    return (
      <div className="min-h-screen bg-shifting-soft flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-amber-50 border border-amber-200 text-amber-700 flex items-center justify-center mb-4">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-[#071B38]">
            {isQuotaError ? 'Daily Cloud Limit Reached' : 'Cloud Synchronization Interrupted'}
          </h1>
          <p className="text-sm text-slate-600 mt-2 leading-relaxed">
            {isQuotaError
              ? 'The Firebase Spark tier daily read/write quota has been reached. Quota resets automatically tomorrow.'
              : fsInfo
                ? `Cloud operation (${fsInfo.operationType} on ${fsInfo.path ?? 'database'}) returned: ${fsInfo.error}`
                : this.state.error.message}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => {
                this.setState({ error: null });
                window.location.reload();
              }}
              className="h-10 px-4 bg-[#071B38] hover:bg-[#0c2954] text-white text-sm font-semibold rounded-lg inline-flex items-center gap-2 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Reload Platform</span>
            </button>
          </div>
        </div>
      </div>
    );
  }
}
