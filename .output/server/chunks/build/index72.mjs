import { createComponent, ssr, ssrHydrationKey, escape, ssrAttribute } from 'solid-js/web';
import { g as ge, a as ae, J, k as ke, y as ye, w as we } from './index-ucQxicSy.mjs';
import { d, p } from './api-BB7gk3Fl2.mjs';
import { u, f as f$1 } from './plus-BQcuN1cW.mjs';
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
import 'solid-js';
import 'solid-js/web/storage';
import 'node:path';
import 'node:crypto';

var f = ["<div", ' class="tv-page"><header class="page-header"><div class="header-title"><!--$-->', '<!--/--><div><h1 class="section-title">TV Shows</h1><p class="header-subtitle"><!--$-->', '<!--/--> series in library</p></div></div><div class="header-actions"><div class="search-box"><!--$-->', '<!--/--><input type="text" placeholder="Search TV shows..." class="input"></div><!--$-->', "<!--/--><!--$-->", '<!--/--></div></header><div class="series-grid">', "</div></div>"], y = ["<div", ' class="empty-state"><!--$-->', "<!--/--><h3>No TV shows yet</h3><p>Start building your library by adding TV series</p><!--$-->", "<!--/--></div>"], $ = ["<div", ' class="series-poster"><!--$-->', '<!--/--><div class="series-overlay">', "</div></div>"], _ = ["<div", ' class="series-info"><h3 class="series-title">', '</h3><p class="series-meta">', "</p></div>"], z = ["<img", ">"], b = ["<div", ' class="poster-placeholder">', "</div>"];
const S = async () => {
  try {
    const r = await fetch(p("/api/media/tv")), s = r.headers.get("content-type") || "";
    return !r.ok || !s.includes("application/json") ? [] : await r.json();
  } catch {
    return [];
  }
};
function D() {
  const r = d(S);
  return createComponent(ge, { get children() {
    var _a, _b, _c;
    return ssr(f, ssrHydrationKey(), escape(createComponent(ae, { size: 28, class: "header-icon" })), escape((_a = r()) == null ? void 0 : _a.length) || 0, escape(createComponent(J, { size: 18 })), escape(createComponent(ke, { variant: "ghost", get children() {
      return [createComponent(u, { size: 18 }), "Filter"];
    } })), escape(createComponent(ke, { variant: "primary", get children() {
      return [createComponent(f$1, { size: 18 }), "Add Series"];
    } })), ((_b = r()) == null ? void 0 : _b.length) === 0 ? ssr(y, ssrHydrationKey(), escape(createComponent(ae, { size: 64 })), escape(createComponent(ke, { variant: "primary", size: "lg", get children() {
      return [createComponent(f$1, { size: 20 }), "Add Your First Series"];
    } }))) : escape((_c = r()) == null ? void 0 : _c.map((s) => createComponent(ye, { class: "series-card", get key() {
      return s.id;
    }, get children() {
      return [ssr($, ssrHydrationKey(), s.posterPath ? ssr(z, ssrHydrationKey() + ssrAttribute("src", escape(s.posterPath, true), false) + ssrAttribute("alt", escape(s.title, true), false)) : ssr(b, ssrHydrationKey(), escape(createComponent(ae, { size: 48 }))), escape(createComponent(we, { get variant() {
        return s.status === "downloaded" ? "success" : s.status === "continuing" ? "info" : "warning";
      }, get children() {
        return s.status;
      } }))), ssr(_, ssrHydrationKey(), escape(s.title), s.releaseDate && escape(new Date(s.releaseDate).getFullYear()))];
    } }))));
  } });
}

export { D as default };
//# sourceMappingURL=index72.mjs.map
