// @refresh reload
import { Router } from '@solidjs/router';
import { FileRoutes } from '@solidjs/start/router';
import { Suspense } from 'solid-js';
import { MediaPlayerProvider } from '~/components/player/MediaPlayerProvider';
import '~/styles/global.css';
import '~/styles/components.css';
import '~/styles/player.css';

export default function App() {
  return (
    <Router
      root={(props) => (
        <MediaPlayerProvider>
          <Suspense>{props.children}</Suspense>
        </MediaPlayerProvider>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
