import { createComponent, ssr, ssrHydrationKey, escape, mergeProps } from 'solid-js/web';
import { g as ge, X, y as ye, b as be, p as pe, C as Ce, k as ke, l } from './index-Sxd3Q-N6.mjs';
import { createSignal } from 'solid-js';
import { m } from './hard-drive-Dc-U1AVQ.mjs';
import './components-YnJA_VXq.mjs';

var x = [["path", { d: "M10.268 21a2 2 0 0 0 3.464 0", key: "vwvbt9" }], ["path", { d: "M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326", key: "11g9vi" }]], w = (l$1) => createComponent(l, mergeProps(l$1, { iconNode: x, name: "bell" })), P = w, M = [["path", { d: "M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z", key: "1c8476" }], ["path", { d: "M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7", key: "1ydtos" }], ["path", { d: "M7 3v4a1 1 0 0 0 1 1h7", key: "t51u73" }]], _ = (l$1) => createComponent(l, mergeProps(l$1, { iconNode: M, name: "save" })), S = _, C = [["rect", { width: "20", height: "8", x: "2", y: "2", rx: "2", ry: "2", key: "ngkwjq" }], ["rect", { width: "20", height: "8", x: "2", y: "14", rx: "2", ry: "2", key: "iecqi9" }], ["line", { x1: "6", x2: "6.01", y1: "6", y2: "6", key: "16zg32" }], ["line", { x1: "6", x2: "6.01", y1: "18", y2: "18", key: "nzw8ys" }]], I = (l$1) => createComponent(l, mergeProps(l$1, { iconNode: C, name: "server" })), g = I, N = [["path", { d: "M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z", key: "oel41y" }]], A = (l$1) => createComponent(l, mergeProps(l$1, { iconNode: N, name: "shield" })), T = A, D = ["<div", ' class="settings-page"><header class="page-header"><!--$-->', '<!--/--><h1 class="section-title">Settings</h1></header><div class="settings-layout"><nav class="settings-nav">', '</nav><div class="settings-content"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--><div class="settings-actions">', "</div></div></div></div>"], z = ["<button", ' class="', '"><!--$-->', "<!--/--><!--$-->", "<!--/--></button>"], H = ["<div", ' class="settings-form"><div class="form-group"><label>Server Port</label><!--$-->', '<!--/--></div><div class="form-group"><label>Host</label><!--$-->', '<!--/--></div><div class="form-group"><label>Database Path</label><!--$-->', "<!--/--></div></div>"], E = ["<div", ' class="settings-form"><div class="form-group"><label>Movies Path</label><!--$-->', '<!--/--></div><div class="form-group"><label>TV Shows Path</label><!--$-->', '<!--/--></div><div class="form-group"><label>Music Path</label><!--$-->', '<!--/--></div><div class="form-group checkbox"><input type="checkbox" id="rename" checked><label for="rename">Rename files on completion</label></div><div class="form-group checkbox"><input type="checkbox" id="hardlinks" checked><label for="hardlinks">Use hardlinks</label></div></div>'], K = ["<div", ' class="settings-form"><div class="form-group"><label>Jackett URL</label><!--$-->', '<!--/--></div><div class="form-group"><label>API Key</label><!--$-->', "<!--/--></div><!--$-->", "<!--/--></div>"], B = ["<div", ' class="settings-form"><div class="form-group"><label>Host</label><!--$-->', '<!--/--></div><div class="form-group"><label>Port</label><!--$-->', '<!--/--></div><div class="form-group"><label>Password</label><!--$-->', "<!--/--></div><!--$-->", "<!--/--></div>"], V = ["<div", ' class="settings-form"><div class="form-group checkbox"><input type="checkbox" id="discord-enabled"><label for="discord-enabled">Enable Discord notifications</label></div><div class="form-group"><label>Webhook URL</label><!--$-->', '<!--/--></div><div class="form-group checkbox"><input type="checkbox" id="notify-started"><label for="notify-started">Notify on download started</label></div><div class="form-group checkbox"><input type="checkbox" id="notify-completed" checked><label for="notify-completed">Notify on download completed</label></div><div class="form-group checkbox"><input type="checkbox" id="notify-failed" checked><label for="notify-failed">Notify on download failed</label></div><!--$-->', "<!--/--></div>"], J = ["<div", ' class="settings-form"><div class="form-group"><label>TMDB API Key</label><!--$-->', '<!--/--></div><div class="form-group"><label>OMDb API Key</label><!--$-->', "<!--/--></div></div>"];
const L = [{ id: "general", label: "General", icon: X }, { id: "media", label: "Media", icon: m }, { id: "indexers", label: "Indexers", icon: g }, { id: "download", label: "Download Client", icon: g }, { id: "notifications", label: "Notifications", icon: P }, { id: "advanced", label: "Advanced", icon: T }];
function j() {
  const [l, R] = createSignal("general"), [p, b] = createSignal(false), f = async () => {
    b(true), await new Promise((n) => setTimeout(n, 500)), b(false);
  };
  return createComponent(ge, { get children() {
    return ssr(D, ssrHydrationKey(), escape(createComponent(X, { size: 28, class: "header-icon" })), escape(L.map((n) => {
      const y = n.icon;
      return ssr(z, ssrHydrationKey(), `settings-tab ${l() === n.id ? "active" : ""}`, escape(createComponent(y, { size: 18 })), escape(n.label));
    })), l() === "general" && escape(createComponent(ye, { get children() {
      return [createComponent(be, { get children() {
        return createComponent(pe, { children: "General Settings" });
      } }), ssr(H, ssrHydrationKey(), escape(createComponent(Ce, { type: "number", value: "3000" })), escape(createComponent(Ce, { value: "0.0.0.0" })), escape(createComponent(Ce, { value: "./data/solari.db" })))];
    } })), l() === "media" && escape(createComponent(ye, { get children() {
      return [createComponent(be, { get children() {
        return createComponent(pe, { children: "Media Settings" });
      } }), ssr(E, ssrHydrationKey(), escape(createComponent(Ce, { value: "./media/movies" })), escape(createComponent(Ce, { value: "./media/tv" })), escape(createComponent(Ce, { value: "./media/music" })))];
    } })), l() === "indexers" && escape(createComponent(ye, { get children() {
      return [createComponent(be, { get children() {
        return createComponent(pe, { children: "Jackett Configuration" });
      } }), ssr(K, ssrHydrationKey(), escape(createComponent(Ce, { value: "http://localhost:9117", placeholder: "http://localhost:9117" })), escape(createComponent(Ce, { type: "password", placeholder: "Enter Jackett API key" })), escape(createComponent(ke, { variant: "secondary", children: "Test Connection" })))];
    } })), l() === "download" && escape(createComponent(ye, { get children() {
      return [createComponent(be, { get children() {
        return createComponent(pe, { children: "Deluge Configuration" });
      } }), ssr(B, ssrHydrationKey(), escape(createComponent(Ce, { value: "localhost" })), escape(createComponent(Ce, { type: "number", value: "58846" })), escape(createComponent(Ce, { type: "password", placeholder: "Enter Deluge password" })), escape(createComponent(ke, { variant: "secondary", children: "Test Connection" })))];
    } })), l() === "notifications" && escape(createComponent(ye, { get children() {
      return [createComponent(be, { get children() {
        return createComponent(pe, { children: "Discord Notifications" });
      } }), ssr(V, ssrHydrationKey(), escape(createComponent(Ce, { placeholder: "https://discord.com/api/webhooks/..." })), escape(createComponent(ke, { variant: "secondary", children: "Test Webhook" })))];
    } })), l() === "advanced" && escape(createComponent(ye, { get children() {
      return [createComponent(be, { get children() {
        return createComponent(pe, { children: "API Keys" });
      } }), ssr(J, ssrHydrationKey(), escape(createComponent(Ce, { placeholder: "Enter TMDB API key" })), escape(createComponent(Ce, { placeholder: "Enter OMDb API key" })))];
    } })), escape(createComponent(ke, { variant: "primary", size: "lg", onClick: f, get disabled() {
      return p();
    }, get children() {
      return [createComponent(S, { size: 18 }), p() ? "Saving..." : "Save Settings"];
    } })));
  } });
}

export { j as default };
//# sourceMappingURL=index6.mjs.map
