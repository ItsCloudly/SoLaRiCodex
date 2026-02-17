import { createComponent, ssr, ssrHydrationKey, escape, ssrAttribute, mergeProps } from 'solid-js/web';
import { g as ge, K, J, k as ke, y as ye, w as we, l } from './index-ucQxicSy.mjs';
import { d, p } from './api-BB7gk3Fl2.mjs';
import { u, f } from './plus-BQcuN1cW.mjs';
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

var $ = [["circle", { cx: "12", cy: "12", r: "10", key: "1mglay" }], ["circle", { cx: "12", cy: "12", r: "2", key: "1c9p78" }]], _ = (a) => createComponent(l, mergeProps(a, { iconNode: $, name: "disc" })), z = _, A = ["<div", ' class="music-page"><header class="page-header"><div class="header-title"><!--$-->', '<!--/--><div><h1 class="section-title">Music</h1><p class="header-subtitle"><!--$-->', '<!--/--> artists in library</p></div></div><div class="header-actions"><div class="search-box"><!--$-->', '<!--/--><input type="text" placeholder="Search artists..." class="input"></div><!--$-->', "<!--/--><!--$-->", '<!--/--></div></header><div class="artists-grid">', "</div></div>"], b = ["<div", ' class="empty-state"><!--$-->', "<!--/--><h3>No music yet</h3><p>Start building your library by adding artists</p><!--$-->", "<!--/--></div>"], k = ["<div", ' class="artist-image"><!--$-->', '<!--/--><div class="artist-overlay">', "</div></div>"], w = ["<div", ' class="artist-info"><h3 class="artist-name">', '</h3><p class="artist-genre">', "</p></div>"], x = ["<img", ">"], M = ["<div", ' class="image-placeholder">', "</div>"];
const P = async () => {
  try {
    const a = await fetch(p("/api/media/music/artists")), s = a.headers.get("content-type") || "";
    return !a.ok || !s.includes("application/json") ? [] : await a.json();
  } catch {
    return [];
  }
};
function S() {
  const a = d(P);
  return createComponent(ge, { get children() {
    var _a, _b, _c;
    return ssr(A, ssrHydrationKey(), escape(createComponent(K, { size: 28, class: "header-icon" })), escape((_a = a()) == null ? void 0 : _a.length) || 0, escape(createComponent(J, { size: 18 })), escape(createComponent(ke, { variant: "ghost", get children() {
      return [createComponent(u, { size: 18 }), "Filter"];
    } })), escape(createComponent(ke, { variant: "primary", get children() {
      return [createComponent(f, { size: 18 }), "Add Artist"];
    } })), ((_b = a()) == null ? void 0 : _b.length) === 0 ? ssr(b, ssrHydrationKey(), escape(createComponent(z, { size: 64 })), escape(createComponent(ke, { variant: "primary", size: "lg", get children() {
      return [createComponent(f, { size: 20 }), "Add Your First Artist"];
    } }))) : escape((_c = a()) == null ? void 0 : _c.map((s) => createComponent(ye, { class: "artist-card", get key() {
      return s.id;
    }, get children() {
      return [ssr(k, ssrHydrationKey(), s.posterPath ? ssr(x, ssrHydrationKey() + ssrAttribute("src", escape(s.posterPath, true), false) + ssrAttribute("alt", escape(s.title, true), false)) : ssr(M, ssrHydrationKey(), escape(createComponent(K, { size: 48 }))), escape(createComponent(we, { get variant() {
        return s.status === "downloaded" ? "success" : "warning";
      }, get children() {
        return s.status;
      } }))), ssr(w, ssrHydrationKey(), escape(s.title), escape(s.genre) || "Unknown Genre")];
    } }))));
  } });
}

export { S as default };
//# sourceMappingURL=index42.mjs.map
