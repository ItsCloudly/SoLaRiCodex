import { JSX } from "solid-js";
import { useLocation } from "@solidjs/router";
import { ThemeProvider } from "~/components/ui/ThemeProvider";
import StoreScene from "~/components/3d/StoreScene";
import SmartphoneHUD from "~/components/ui/SmartphoneHUD";
import { Maximize, Monitor } from "lucide-solid";
import "~/styles/global.css";
import "~/styles/components.css";
import "~/styles/layout.css";

interface LayoutProps {
  children: JSX.Element;
}



export default function MainLayout(props: LayoutProps) {
  const location = useLocation();

  const isCrtRoute = () => {
    const p = location.pathname;
    return p === '/' || p.startsWith('/search') || p.startsWith('/activity') || p.startsWith('/settings') || p.startsWith('/player');
  };

  return (
    <ThemeProvider>
      <StoreScene />
      <div class="layout cinematic-layout" style={{ background: 'transparent', "pointer-events": "none" }}>

        {/* 2D HUD for Media Pages (Films, Series, Music, Home) */}
        {!isCrtRoute() && (
          <main class="main-content cinematic-main is-media" style={{ background: 'transparent', "pointer-events": "auto" }}>
            {props.children}
          </main>
        )}

        {/* 3D Content bound to CRT Screens */}
        <div id="crt-content-container" style={{
          display: isCrtRoute() ? 'block' : 'none',
          width: '1024px',
          height: '768px',
          "background-color": "var(--bg-primary)",
          "overflow-y": "auto",
          "pointer-events": "auto"
        }}>
          {isCrtRoute() && (
            <main class="cinematic-main is-overlay" style={{ padding: '2rem' }}>
              <div class="cinematic-content">
                {props.children}
              </div>
            </main>
          )}
        </div>

        {/* Smartphone HUD for 3D Navigation */}
        <SmartphoneHUD />

        {/* Fullscreen Controls */}
        <div class="fullscreen-controls" style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          display: 'flex',
          gap: '10px',
          "z-index": 9999,
          "pointer-events": "auto"
        }}>
          {isCrtRoute() && (
            <button
              class="btn"
              style={{ "background-color": "var(--bg-tertiary)", color: "var(--text-primary)", border: "2px solid #808080", padding: "8px" }}
              title="Fullscreen Monitor"
              onClick={() => {
                const crt = document.getElementById('crt-content-container');
                if (crt && !document.fullscreenElement) {
                  crt.requestFullscreen().catch(err => console.log(err));
                } else if (document.fullscreenElement) {
                  document.exitFullscreen().catch(err => console.log(err));
                }
              }}
            >
              <Monitor size={20} />
            </button>
          )}
          <button
            class="btn"
            style={{ "background-color": "var(--bg-tertiary)", color: "var(--text-primary)", border: "2px solid #808080", padding: "8px" }}
            title="Fullscreen App"
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen().catch(err => console.log(err));
              } else {
                document.exitFullscreen().catch(err => console.log(err));
              }
            }}
          >
            <Maximize size={20} />
          </button>
        </div>

      </div>
    </ThemeProvider>
  );
}
