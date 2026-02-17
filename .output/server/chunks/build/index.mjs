import { createComponent, ssr, ssrHydrationKey, escape, mergeProps } from 'solid-js/web';
import { g as ge, E as E$1, y as ye, b as be, p as pe, w as we, k as ke, $ as $e, l } from './index-Sxd3Q-N6.mjs';
import { d, p as p$1 } from './api-BB7gk3Fl.mjs';
import { p } from './download-CECEns1f.mjs';
import { m } from './hard-drive-Dc-U1AVQ.mjs';
import './components-YnJA_VXq.mjs';
import 'solid-js';

var C = [["path", { d: "M12 6v6l4 2", key: "mmk7yg" }], ["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }]], D = (t) => createComponent(l, mergeProps(t, { iconNode: C, name: "clock" })), P = D, F = [["rect", { x: "14", y: "3", width: "5", height: "18", rx: "1", key: "kaeet6" }], ["rect", { x: "5", y: "3", width: "5", height: "18", rx: "1", key: "1wsw3u" }]], I = (t) => createComponent(l, mergeProps(t, { iconNode: F, name: "pause" })), y = I, S = [["path", { d: "M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z", key: "10ikf1" }]], T = (t) => createComponent(l, mergeProps(t, { iconNode: S, name: "play" })), U = T, j = [["path", { d: "M18 6 6 18", key: "1bl5f8" }], ["path", { d: "m6 6 12 12", key: "d8bk6v" }]], q = (t) => createComponent(l, mergeProps(t, { iconNode: j, name: "x" })), $ = q, E = ["<div", ' class="downloads-list">', "</div>"], w = ["<div", ' class="downloads-list compact">', "</div>"], H = ["<div", ' class="activity-page"><header class="page-header"><!--$-->', '<!--/--><h1 class="section-title">Activity</h1></header><div class="activity-grid"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div>"], K = ["<div", ' class="empty-state"><!--$-->', "<!--/--><p>No active downloads</p></div>"], L = ["<div", ' class="download-item"><div class="download-header"><div class="download-title">', '</div><div class="download-actions"><!--$-->', "<!--/--><!--$-->", '<!--/--></div></div><div class="download-meta"><!--$-->', '<!--/--><span class="meta-item">', '</span><span class="meta-item">', '</span></div><div class="download-progress"><!--$-->', '<!--/--><div class="progress-stats"><span><!--$-->', "<!--/-->%</span><span>", "</span><span>ETA: <!--$-->", "<!--/--></span></div></div></div>"], b = ["<div", ' class="empty-state"><!--$-->', "<!--/--><p>No completed downloads</p></div>"], G = ["<div", ' class="download-item compact"><div class="download-title">', '</div><div class="download-meta"><!--$-->', '<!--/--><span class="meta-item">', "</span></div></div>"], V = ["<div", ' class="empty-state"><!--$-->', "<!--/--><p>No failed downloads</p></div>"], X = ["<div", ' class="download-item compact"><div class="download-title">', '</div><div class="download-meta"><!--$-->', '<!--/--><span class="meta-item error">', "</span></div></div>"];
const J = async () => {
  try {
    const t = await fetch(p$1("/api/downloads")), i = t.headers.get("content-type") || "";
    return !t.ok || !i.includes("application/json") ? [] : await t.json();
  } catch {
    return [];
  }
};
function ie() {
  const t = d(J), i = () => {
    var _a;
    return ((_a = t()) == null ? void 0 : _a.filter((a) => ["downloading", "queued", "paused"].includes(a.status))) || [];
  }, r = () => {
    var _a;
    return ((_a = t()) == null ? void 0 : _a.filter((a) => a.status === "completed")) || [];
  }, c = () => {
    var _a;
    return ((_a = t()) == null ? void 0 : _a.filter((a) => a.status === "failed")) || [];
  }, k = (a) => {
    switch (a) {
      case "downloading":
        return createComponent(E$1, { size: 16 });
      case "paused":
        return createComponent(y, { size: 16 });
      case "completed":
        return createComponent(p, { size: 16 });
      case "failed":
        return createComponent($, { size: 16 });
      default:
        return createComponent(P, { size: 16 });
    }
  }, z = (a) => {
    switch (a) {
      case "downloading":
        return "info";
      case "paused":
        return "warning";
      case "completed":
        return "success";
      case "failed":
        return "error";
      default:
        return "default";
    }
  };
  return createComponent(ge, { get children() {
    return ssr(H, ssrHydrationKey(), escape(createComponent(E$1, { size: 28, class: "header-icon" })), escape(createComponent(ye, { class: "activity-section", get children() {
      return [createComponent(be, { get children() {
        return [createComponent(pe, { children: "Active Downloads" }), createComponent(we, { variant: "info", get children() {
          return [i().length, " active"];
        } })];
      } }), ssr(E, ssrHydrationKey(), i().length === 0 ? ssr(K, ssrHydrationKey(), escape(createComponent(E$1, { size: 48 }))) : escape(i().map((a) => {
        var _a;
        return ssr(L, ssrHydrationKey(), escape(a.title), escape(createComponent(ke, { variant: "ghost", size: "sm", get children() {
          return a.status === "paused" ? createComponent(U, { size: 16 }) : createComponent(y, { size: 16 });
        } })), escape(createComponent(ke, { variant: "ghost", size: "sm", get children() {
          return createComponent($, { size: 16 });
        } })), escape(createComponent(we, { get variant() {
          return z(a.status);
        }, get children() {
          return [k(a.status), a.status];
        } })), escape(a.quality), escape(_(a.size)), escape(createComponent($e, { get value() {
          return a.progress || 0;
        } })), escape((_a = a.progress) == null ? void 0 : _a.toFixed(1)), escape(O(a.speed)), escape(Q(a.eta)));
      })))];
    } })), escape(createComponent(ye, { class: "activity-section", get children() {
      return [createComponent(be, { get children() {
        return [createComponent(pe, { children: "Completed" }), createComponent(we, { variant: "success", get children() {
          return r().length;
        } })];
      } }), ssr(w, ssrHydrationKey(), r().length === 0 ? ssr(b, ssrHydrationKey(), escape(createComponent(p, { size: 32 }))) : escape(r().slice(0, 10).map((a) => ssr(G, ssrHydrationKey(), escape(a.title), escape(createComponent(we, { variant: "success", children: "Completed" })), escape(R(a.completedAt))))))];
    } })), escape(createComponent(ye, { class: "activity-section", get children() {
      return [createComponent(be, { get children() {
        return [createComponent(pe, { children: "Failed" }), createComponent(we, { variant: "error", get children() {
          return c().length;
        } })];
      } }), ssr(w, ssrHydrationKey(), c().length === 0 ? ssr(V, ssrHydrationKey(), escape(createComponent(m, { size: 32 }))) : escape(c().map((a) => ssr(X, ssrHydrationKey(), escape(a.title), escape(createComponent(we, { variant: "error", children: "Failed" })), escape(a.errorMessage)))))];
    } })));
  } });
}
function _(t) {
  if (!t) return "Unknown";
  const i = ["B", "KB", "MB", "GB"];
  let r = t, c = 0;
  for (; r >= 1024 && c < i.length - 1; ) r /= 1024, c++;
  return `${r.toFixed(1)} ${i[c]}`;
}
function O(t) {
  return t ? _(t) + "/s" : "0 B/s";
}
function Q(t) {
  if (!t) return "Unknown";
  const i = Math.floor(t / 3600), r = Math.floor(t % 3600 / 60);
  return i > 0 ? `${i}h ${r}m` : `${r}m`;
}
function R(t) {
  return t ? new Date(t).toLocaleDateString() : "";
}

export { ie as default };
//# sourceMappingURL=index.mjs.map
