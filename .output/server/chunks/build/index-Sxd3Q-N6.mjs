import { ssr, ssrHydrationKey, escape, createComponent, mergeProps, ssrAttribute, ssrStyleProperty, ssrElement, Dynamic } from 'solid-js/web';
import { I as Ie, W as We, $ as $e$1, C } from './components-YnJA_VXq.mjs';
import { mergeProps as mergeProps$1, splitProps, createMemo, For } from 'solid-js';

function S(e) {
  e = mergeProps$1({ inactiveClass: "inactive", activeClass: "active" }, e);
  const [, t] = splitProps(e, ["href", "state", "class", "activeClass", "inactiveClass", "end"]), a = We(() => e.href), n = $e$1(a), u = Ie(), f = createMemo(() => {
    const g = a();
    if (g === void 0) return [false, false];
    const v = C(g.split(/[?#]/, 1)[0]).toLowerCase(), m = decodeURI(C(u.pathname).toLowerCase());
    return [e.end ? v === m : m.startsWith(v + "/") || m === v, v === m];
  });
  return ssrElement("a", mergeProps(t, { get href() {
    return n() || e.href;
  }, get state() {
    return JSON.stringify(e.state);
  }, get classList() {
    return { ...e.class && { [e.class]: true }, [e.inactiveClass]: !f()[0], [e.activeClass]: f()[0], ...t.classList };
  }, link: true, get "aria-current"() {
    return f()[1] ? "page" : void 0;
  } }), void 0, true);
}
/**
* @license lucide-solid v0.563.0 - ISC
*
* This source code is licensed under the ISC license.
* See the LICENSE file in the root directory of this source tree.
*/
var z = { xmlns: "http://www.w3.org/2000/svg", width: 24, height: 24, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", "stroke-width": 2, "stroke-linecap": "round", "stroke-linejoin": "round" }, d = z, P = (e) => {
  for (const t in e) if (t.startsWith("aria-") || t === "role" || t === "title") return true;
  return false;
}, L = (...e) => e.filter((t, a, n) => !!t && t.trim() !== "" && n.indexOf(t) === a).join(" ").trim(), I = (e) => e.replace(/^([A-Z])|[\s-_]+(\w)/g, (t, a, n) => n ? n.toUpperCase() : a.toLowerCase()), b = (e) => e.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase(), W = (e) => {
  const t = I(e);
  return t.charAt(0).toUpperCase() + t.slice(1);
}, j = (e) => {
  const [t, a] = splitProps(e, ["color", "size", "strokeWidth", "children", "class", "name", "iconNode", "absoluteStrokeWidth"]);
  return ssrElement("svg", mergeProps(d, { get width() {
    var _a;
    return (_a = t.size) != null ? _a : d.width;
  }, get height() {
    var _a;
    return (_a = t.size) != null ? _a : d.height;
  }, get stroke() {
    var _a;
    return (_a = t.color) != null ? _a : d.stroke;
  }, get "stroke-width"() {
    var _a, _b;
    return t.absoluteStrokeWidth ? Number((_a = t.strokeWidth) != null ? _a : d["stroke-width"]) * 24 / Number(t.size) : Number((_b = t.strokeWidth) != null ? _b : d["stroke-width"]);
  }, get class() {
    return L("lucide", "lucide-icon", ...t.name != null ? [`lucide-${b(W(t.name))}`, `lucide-${b(t.name)}`] : [], t.class != null ? t.class : "");
  }, get "aria-hidden"() {
    return !t.children && !P(a) ? "true" : void 0;
  } }, a), () => escape(createComponent(For, { get each() {
    return t.iconNode;
  }, children: ([n, u]) => createComponent(Dynamic, mergeProps({ component: n }, u)) })), true);
}, l = j, H = [["path", { d: "M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2", key: "169zse" }]], B = (e) => createComponent(l, mergeProps(e, { iconNode: H, name: "activity" })), E = B, T = [["rect", { width: "18", height: "18", x: "3", y: "3", rx: "2", key: "afitv7" }], ["path", { d: "M7 3v18", key: "bbkbws" }], ["path", { d: "M3 7.5h4", key: "zfgn84" }], ["path", { d: "M3 12h18", key: "1i2n21" }], ["path", { d: "M3 16.5h4", key: "1230mu" }], ["path", { d: "M17 3v18", key: "in4fa5" }], ["path", { d: "M17 7.5h4", key: "myr1c1" }], ["path", { d: "M17 16.5h4", key: "go4c1d" }]], D = (e) => createComponent(l, mergeProps(e, { iconNode: T, name: "film" })), O = D, R = [["path", { d: "M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8", key: "5wwlr5" }], ["path", { d: "M3 10a2 2 0 0 1 .709-1.528l7-6a2 2 0 0 1 2.582 0l7 6A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", key: "r6nss1" }]], U = (e) => createComponent(l, mergeProps(e, { iconNode: R, name: "house" })), V = U, q = [["path", { d: "M9 18V5l12-2v13", key: "1jmyc2" }], ["circle", { cx: "6", cy: "18", r: "3", key: "fqmcym" }], ["circle", { cx: "18", cy: "16", r: "3", key: "1hluhg" }]], F = (e) => createComponent(l, mergeProps(e, { iconNode: q, name: "music" })), K = F, Y = [["path", { d: "m21 21-4.34-4.34", key: "14j7rj" }], ["circle", { cx: "11", cy: "11", r: "8", key: "4ej97u" }]], Z = (e) => createComponent(l, mergeProps(e, { iconNode: Y, name: "search" })), J = Z, G = [["path", { d: "M9.671 4.136a2.34 2.34 0 0 1 4.659 0 2.34 2.34 0 0 0 3.319 1.915 2.34 2.34 0 0 1 2.33 4.033 2.34 2.34 0 0 0 0 3.831 2.34 2.34 0 0 1-2.33 4.033 2.34 2.34 0 0 0-3.319 1.915 2.34 2.34 0 0 1-4.659 0 2.34 2.34 0 0 0-3.32-1.915 2.34 2.34 0 0 1-2.33-4.033 2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915", key: "1i5ecw" }], ["circle", { cx: "12", cy: "12", r: "3", key: "1v7zrd" }]], Q = (e) => createComponent(l, mergeProps(e, { iconNode: G, name: "settings" })), X = Q, ee = [["path", { d: "m17 2-5 5-5-5", key: "16satq" }], ["rect", { width: "20", height: "15", x: "2", y: "7", rx: "2", key: "1e6viu" }]], te = (e) => createComponent(l, mergeProps(e, { iconNode: ee, name: "tv" })), ae = te, re = ["<div", ' class="layout"><aside class="sidebar"><div class="sidebar-header"><div class="logo"><span class="logo-bracket">[</span><span class="logo-text">SoLaRi</span><span class="logo-bracket">]</span></div><div class="logo-subtitle">MEDIA_SYSTEM_V1.0</div></div><nav class="sidebar-nav">', '</nav><div class="sidebar-footer"><div class="status-indicator"><span class="status-dot online"></span><span class="status-text">SYSTEM ONLINE</span></div></div></aside><main class="main-content">', "</main></div>"], se = ["<span", ">", "</span>"];
const ne = [{ href: "/", icon: V, label: "Dashboard" }, { href: "/movies", icon: O, label: "Movies" }, { href: "/tv", icon: ae, label: "TV Shows" }, { href: "/music", icon: K, label: "Music" }, { href: "/search", icon: J, label: "Search" }, { href: "/activity", icon: E, label: "Activity" }, { href: "/settings", icon: X, label: "Settings" }];
function ge(e) {
  const t = Ie();
  return ssr(re, ssrHydrationKey(), escape(ne.map((a) => {
    const n = a.icon, u = t.pathname === a.href || a.href !== "/" && t.pathname.startsWith(a.href);
    return createComponent(S, { get href() {
      return a.href;
    }, class: `nav-link ${u ? "active" : ""}`, get children() {
      return [createComponent(n, { size: 18 }), ssr(se, ssrHydrationKey(), escape(a.label))];
    } });
  })), escape(e.children));
}
var ie = ["<div", ' class="', '">', "</div>"], ce = ["<div", ' class="card-header">', "</div>"], oe = ["<h3", ' class="card-title">', "</h3>"], le = ["<button", ' class="', '"', ">", "</button>"], de = ["<span", ' class="', '">', "</span>"], ue = ["<div", ' class="progress"><div class="progress-bar" style="', '"></div></div>'], he = ["<input", ' class="', '"', ">"];
const ye = (e) => ssr(ie, ssrHydrationKey(), `card ${escape(e.class, true) || ""}`, escape(e.children)), be = (e) => ssr(ce, ssrHydrationKey(), escape(e.children)), pe = (e) => ssr(oe, ssrHydrationKey(), escape(e.children)), ke = (e) => {
  const t = () => {
    switch (e.variant) {
      case "primary":
        return "btn-primary";
      case "secondary":
        return "btn-secondary";
      case "ghost":
        return "btn-ghost";
      default:
        return "";
    }
  }, a = () => {
    switch (e.size) {
      case "sm":
        return "btn-sm";
      case "lg":
        return "btn-lg";
      default:
        return "";
    }
  };
  return ssr(le, ssrHydrationKey() + ssrAttribute("type", escape(e.type, true) || "button", false), `btn ${escape(t(), true)} ${escape(a(), true)} ${escape(e.class, true) || ""}`, ssrAttribute("disabled", e.disabled, true), escape(e.children));
}, we = (e) => {
  const t = () => {
    switch (e.variant) {
      case "success":
        return "badge-success";
      case "warning":
        return "badge-warning";
      case "error":
        return "badge-error";
      case "info":
        return "badge-info";
      default:
        return "";
    }
  };
  return ssr(de, ssrHydrationKey(), `badge ${escape(t(), true)}`, escape(e.children));
}, $e = (e) => {
  const t = () => {
    const a = e.max || 100;
    return Math.min(100, Math.max(0, e.value / a * 100));
  };
  return ssr(ue, ssrHydrationKey(), ssrStyleProperty("width:", `${escape(t(), true)}%`));
}, Ce = (e) => ssr(he, ssrHydrationKey() + ssrAttribute("type", escape(e.type, true) || "text", false), `input ${escape(e.class, true) || ""}`, ssrAttribute("placeholder", escape(e.placeholder, true), false) + ssrAttribute("value", escape(e.value, true), false));

export { $e as $, Ce as C, E, J, K, O, X, ae as a, be as b, ge as g, ke as k, l, pe as p, we as w, ye as y };
//# sourceMappingURL=index-Sxd3Q-N6.mjs.map
