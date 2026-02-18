// @refresh reload
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { ErrorBoundary, Suspense } from 'solid-js';
import { MediaPlayerProvider } from '~/components/player/MediaPlayerProvider';
import '~/styles/global.css';
import '~/styles/components.css';
import '~/styles/player.css';

export default function App() {
  return (
    <Router
      root={(props) => (
        <MediaPlayerProvider>
          <ErrorBoundary
            fallback={(error, reset) => (
              <div style={{ padding: '2rem', 'max-width': '780px', margin: '0 auto' }}>
                <h2 style={{ margin: '0 0 0.6rem 0' }}>Something went wrong</h2>
                <p style={{ margin: '0 0 0.9rem 0', opacity: 0.9 }}>
                  A client-side error occurred. You can retry without refreshing.
                </p>
                <pre style={{ 'white-space': 'pre-wrap', 'font-size': '0.82rem', opacity: 0.8 }}>
                  {error instanceof Error ? error.message : String(error)}
                </pre>
                <div style={{ display: 'flex', gap: '0.6rem', 'margin-top': '0.9rem' }}>
                  <button
                    type="button"
                    class="btn btn-secondary"
                    onClick={() => reset()}
                  >
                    Try Again
                  </button>
                  <button
                    type="button"
                    class="btn btn-primary"
                    onClick={() => window.location.reload()}
                  >
                    Reload App
                  </button>
                </div>
              </div>
            )}
          >
            <Suspense>{props.children}</Suspense>
          </ErrorBoundary>
        </MediaPlayerProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
