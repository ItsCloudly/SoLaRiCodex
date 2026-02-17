import { createComponent, isServer, getRequestEvent, delegateEvents } from 'solid-js/web';
import { H as Ht } from '../_/nitro.mjs';
import { Suspense, createSignal, onCleanup, children, createMemo, getOwner, sharedConfig, untrack, Show, on, createRoot } from 'solid-js';
import { O as Oe, D as De, a as Ce, v as ve, M as Me, U as Ue, b as $$1, e as ee, _ as _e, Q, g as ge, q as qe } from './components-YnJA_VXq.mjs';
import 'node:http';
import 'node:https';
import 'node:events';
import 'node:buffer';
import 'node:async_hooks';
import 'vinxi/lib/invariant';
import 'vinxi/lib/path';
import 'node:url';
import 'node:fs';
import 'seroval';
import 'seroval-plugins/web';
import 'solid-js/web/storage';
import 'node:path';
import 'node:crypto';

const I = (t) => (n) => {
  const { base: o } = n, r = children(() => n.children), e = createMemo(() => Oe(r(), n.base || ""));
  let s;
  const u = De(t, e, () => s, { base: o, singleFlight: n.singleFlight, transformUrl: n.transformUrl });
  return t.create && t.create(u), createComponent(Ce.Provider, { value: u, get children() {
    return createComponent($, { routerState: u, get root() {
      return n.root;
    }, get preload() {
      return n.rootPreload || n.rootLoad;
    }, get children() {
      return [(s = getOwner()) && null, createComponent(tt, { routerState: u, get branches() {
        return e();
      } })];
    } });
  } });
};
function $(t) {
  const n = t.routerState.location, o = t.routerState.params, r = createMemo(() => t.preload && untrack(() => {
    t.preload({ params: o, location: n, intent: Me() || "initial" });
  }));
  return createComponent(Show, { get when() {
    return t.root;
  }, keyed: true, get fallback() {
    return t.children;
  }, children: (e) => createComponent(e, { params: o, location: n, get data() {
    return r();
  }, get children() {
    return t.children;
  } }) });
}
function tt(t) {
  if (isServer) {
    const e = getRequestEvent();
    if (e && e.router && e.router.dataOnly) {
      et(e, t.routerState, t.branches);
      return;
    }
    e && ((e.router || (e.router = {})).matches || (e.router.matches = t.routerState.matches().map(({ route: s, path: u, params: m }) => ({ path: s.originalPath, pattern: s.pattern, match: u, params: m, info: s.info }))));
  }
  const n = [];
  let o;
  const r = createMemo(on(t.routerState.matches, (e, s, u) => {
    let m = s && e.length === s.length;
    const h = [];
    for (let l = 0, w = e.length; l < w; l++) {
      const b = s && s[l], g = e[l];
      u && b && g.route.key === b.route.key ? h[l] = u[l] : (m = false, n[l] && n[l](), createRoot((R) => {
        n[l] = R, h[l] = Ue(t.routerState, h[l - 1] || t.routerState.base, C(() => r()[l + 1]), () => t.routerState.matches()[l]);
      }));
    }
    return n.splice(e.length).forEach((l) => l()), u && m ? u : (o = h[0], h);
  }));
  return C(() => r() && o)();
}
const C = (t) => () => createComponent(Show, { get when() {
  return t();
}, keyed: true, children: (n) => createComponent(ee.Provider, { value: n, get children() {
  return n.outlet();
} }) });
function et(t, n, o) {
  const r = new URL(t.request.url), e = $$1(o, new URL(t.router.previousUrl || t.request.url).pathname), s = $$1(o, r.pathname);
  for (let u = 0; u < s.length; u++) {
    (!e[u] || s[u].route !== e[u].route) && (t.router.dataOnly = true);
    const { route: m, params: h } = s[u];
    m.preload && m.preload({ params: h, location: n.location, intent: "preload" });
  }
}
function nt([t, n], o, r) {
  return [t, r ? (e) => n(r(e)) : n];
}
function rt(t) {
  let n = false;
  const o = (e) => typeof e == "string" ? { value: e } : e, r = nt(createSignal(o(t.get()), { equals: (e, s) => e.value === s.value && e.state === s.state }), void 0, (e) => (!n && t.set(e), sharedConfig.registry && !sharedConfig.done && (sharedConfig.done = true), e));
  return t.init && onCleanup(t.init((e = t.get()) => {
    n = true, r[1](o(e)), n = false;
  })), I({ signal: r, create: t.create, utils: t.utils });
}
function ot(t, n, o) {
  return t.addEventListener(n, o), () => t.removeEventListener(n, o);
}
function at(t, n) {
  const o = t && document.getElementById(t);
  o ? o.scrollIntoView() : n && window.scrollTo(0, 0);
}
function it(t) {
  const n = new URL(t);
  return n.pathname + n.search;
}
function st(t) {
  let n;
  const o = { value: t.url || (n = getRequestEvent()) && it(n.request.url) || "" };
  return I({ signal: [() => o, (r) => Object.assign(o, r)] })(t);
}
const ut = /* @__PURE__ */ new Map();
function ct(t = true, n = false, o = "/_server", r) {
  return (e) => {
    const s = e.base.path(), u = e.navigatorFactory(e.base);
    let m, h;
    function l(a) {
      return a.namespaceURI === "http://www.w3.org/2000/svg";
    }
    function w(a) {
      if (a.defaultPrevented || a.button !== 0 || a.metaKey || a.altKey || a.ctrlKey || a.shiftKey) return;
      const i = a.composedPath().find((A) => A instanceof Node && A.nodeName.toUpperCase() === "A");
      if (!i || n && !i.hasAttribute("link")) return;
      const d = l(i), c = d ? i.href.baseVal : i.href;
      if ((d ? i.target.baseVal : i.target) || !c && !i.hasAttribute("state")) return;
      const p = (i.getAttribute("rel") || "").split(/\s+/);
      if (i.hasAttribute("download") || p && p.includes("external")) return;
      const v = d ? new URL(c, document.baseURI) : new URL(c);
      if (!(v.origin !== window.location.origin || s && v.pathname && !v.pathname.toLowerCase().startsWith(s.toLowerCase()))) return [i, v];
    }
    function b(a) {
      const i = w(a);
      if (!i) return;
      const [d, c] = i, E = e.parsePath(c.pathname + c.search + c.hash), p = d.getAttribute("state");
      a.preventDefault(), u(E, { resolve: false, replace: d.hasAttribute("replace"), scroll: !d.hasAttribute("noscroll"), state: p ? JSON.parse(p) : void 0 });
    }
    function g(a) {
      const i = w(a);
      if (!i) return;
      const [d, c] = i;
      r && (c.pathname = r(c.pathname)), e.preloadRoute(c, d.getAttribute("preload") !== "false");
    }
    function R(a) {
      clearTimeout(m);
      const i = w(a);
      if (!i) return h = null;
      const [d, c] = i;
      h !== d && (r && (c.pathname = r(c.pathname)), m = setTimeout(() => {
        e.preloadRoute(c, d.getAttribute("preload") !== "false"), h = d;
      }, 20));
    }
    function S(a) {
      if (a.defaultPrevented) return;
      let i = a.submitter && a.submitter.hasAttribute("formaction") ? a.submitter.getAttribute("formaction") : a.target.getAttribute("action");
      if (!i) return;
      if (!i.startsWith("https://action/")) {
        const c = new URL(i, ve);
        if (i = e.parsePath(c.pathname + c.search), !i.startsWith(o)) return;
      }
      if (a.target.method.toUpperCase() !== "POST") throw new Error("Only POST forms are supported for Actions");
      const d = ut.get(i);
      if (d) {
        a.preventDefault();
        const c = new FormData(a.target, a.submitter);
        d.call({ r: e, f: a.target }, a.target.enctype === "multipart/form-data" ? c : new URLSearchParams(c));
      }
    }
    delegateEvents(["click", "submit"]), document.addEventListener("click", b), t && (document.addEventListener("mousemove", R, { passive: true }), document.addEventListener("focusin", g, { passive: true }), document.addEventListener("touchstart", g, { passive: true })), document.addEventListener("submit", S), onCleanup(() => {
      document.removeEventListener("click", b), t && (document.removeEventListener("mousemove", R), document.removeEventListener("focusin", g), document.removeEventListener("touchstart", g)), document.removeEventListener("submit", S);
    });
  };
}
function lt(t) {
  if (isServer) return st(t);
  const n = () => {
    const r = window.location.pathname.replace(/^\/+/, "/") + window.location.search, e = window.history.state && window.history.state._depth && Object.keys(window.history.state).length === 1 ? void 0 : window.history.state;
    return { value: r + window.location.hash, state: e };
  }, o = ge();
  return rt({ get: n, set({ value: r, replace: e, scroll: s, state: u }) {
    e ? window.history.replaceState(_e(u), "", r) : window.history.pushState(u, "", r), at(decodeURIComponent(window.location.hash.slice(1)), s), Q();
  }, init: (r) => ot(window, "popstate", qe(r, (e) => {
    if (e && e < 0) return !o.confirm(e);
    {
      const s = n();
      return !o.confirm(s.value, { state: s.state });
    }
  })), create: ct(t.preload, t.explicitLinks, t.actionBase, t.transformUrl), utils: { go: (r) => window.history.go(r), beforeLeave: o } })(t);
}
function St() {
  return createComponent(lt, { root: (t) => createComponent(Suspense, { get children() {
    return t.children;
  } }), get children() {
    return createComponent(Ht, {});
  } });
}

export { St as default };
//# sourceMappingURL=app-BwPfAnN8.mjs.map
