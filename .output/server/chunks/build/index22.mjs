import { createComponent, ssr, ssrHydrationKey, escape } from 'solid-js/web';
import { createSignal, onMount } from 'solid-js';
import { g as ge, y as ye, b as be, p as pe, O, a as ae, K } from './index-ucQxicSy.mjs';
import { p } from './download-DQHt9Yn2.mjs';
import '../_/nitro.mjs';
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

var b = ["<div", ' class="stat-icon movies">', "</div>"], y = ["<div", ' class="stat-content"><div class="stat-value">0</div><div class="stat-label">Movies</div></div>'], S = ["<div", ' class="stat-icon tv">', "</div>"], w = ["<div", ' class="stat-content"><div class="stat-value">0</div><div class="stat-label">TV Series</div></div>'], A = ["<div", ' class="stat-icon music">', "</div>"], C = ["<div", ' class="stat-content"><div class="stat-value">0</div><div class="stat-label">Albums</div></div>'], z = ["<div", ' class="stat-icon downloads">', "</div>"], D = ["<div", ' class="stat-content"><div class="stat-value">0</div><div class="stat-label">Active Downloads</div></div>'], M = ["<div", ' class="dashboard"><header class="dashboard-header"><h1 class="section-title">System Overview</h1><div class="header-actions"><span class="timestamp">API Status: <!--$-->', "<!--/--></span></div></header><!--$-->", '<!--/--><div class="stats-grid"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div></div>"], H = ["<pre", ">", "</pre>"];
function k() {
  const [n, d] = createSignal("loading"), [r, v] = createSignal(null);
  return onMount(async () => {
    try {
      const l = await fetch("/api/health");
      if (l.ok) {
        const o = await l.json();
        d("connected"), v(o);
      } else d("error");
    } catch {
      d("error");
    }
  }), createComponent(ge, { get children() {
    return ssr(M, ssrHydrationKey(), escape(n()), r() && escape(createComponent(ye, { get children() {
      return [createComponent(be, { get children() {
        return createComponent(pe, { children: "API Response" });
      } }), ssr(H, ssrHydrationKey(), escape(JSON.stringify(r(), null, 2)))];
    } })), escape(createComponent(ye, { class: "stat-card", get children() {
      return [ssr(b, ssrHydrationKey(), escape(createComponent(O, { size: 24 }))), ssr(y, ssrHydrationKey())];
    } })), escape(createComponent(ye, { class: "stat-card", get children() {
      return [ssr(S, ssrHydrationKey(), escape(createComponent(ae, { size: 24 }))), ssr(w, ssrHydrationKey())];
    } })), escape(createComponent(ye, { class: "stat-card", get children() {
      return [ssr(A, ssrHydrationKey(), escape(createComponent(K, { size: 24 }))), ssr(C, ssrHydrationKey())];
    } })), escape(createComponent(ye, { class: "stat-card", get children() {
      return [ssr(z, ssrHydrationKey(), escape(createComponent(p, { size: 24 }))), ssr(D, ssrHydrationKey())];
    } })));
  } });
}

export { k as default };
//# sourceMappingURL=index22.mjs.map
