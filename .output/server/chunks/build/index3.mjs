import { createComponent, ssr, ssrHydrationKey, escape, ssrAttribute } from 'solid-js/web';
import { g as ge, O, J, k as ke, y as ye, w as we } from './index-Sxd3Q-N6.mjs';
import { d, p } from './api-BB7gk3Fl.mjs';
import { u, f as f$1 } from './plus-BT_CnvzS.mjs';
import './components-YnJA_VXq.mjs';
import 'solid-js';

var f = ["<div", ' class="movies-page"><header class="page-header"><div class="header-title"><!--$-->', '<!--/--><div><h1 class="section-title">Movies</h1><p class="header-subtitle"><!--$-->', '<!--/--> titles in library</p></div></div><div class="header-actions"><div class="search-box"><!--$-->', '<!--/--><input type="text" placeholder="Search movies..." class="input"></div><!--$-->', "<!--/--><!--$-->", '<!--/--></div></header><div class="movies-grid">', "</div></div>"], y = ["<div", ' class="empty-state"><!--$-->', "<!--/--><h3>No movies yet</h3><p>Start building your library by adding movies</p><!--$-->", "<!--/--></div>"], $ = ["<div", ' class="movie-poster"><!--$-->', '<!--/--><div class="movie-overlay">', "</div></div>"], _ = ["<div", ' class="movie-info"><h3 class="movie-title">', '</h3><p class="movie-meta"><!--$-->', "<!--/--><!--$-->", "<!--/--></p></div>"], z = ["<img", ">"], M = ["<div", ' class="poster-placeholder">', "</div>"];
const b = async () => {
  try {
    const a = await fetch(p("/api/media/movies")), t = a.headers.get("content-type") || "";
    return !a.ok || !t.includes("application/json") ? [] : await a.json();
  } catch {
    return [];
  }
};
function F() {
  const a = d(b);
  return createComponent(ge, { get children() {
    var _a, _b, _c;
    return ssr(f, ssrHydrationKey(), escape(createComponent(O, { size: 28, class: "header-icon" })), escape((_a = a()) == null ? void 0 : _a.length) || 0, escape(createComponent(J, { size: 18 })), escape(createComponent(ke, { variant: "ghost", get children() {
      return [createComponent(u, { size: 18 }), "Filter"];
    } })), escape(createComponent(ke, { variant: "primary", get children() {
      return [createComponent(f$1, { size: 18 }), "Add Movie"];
    } })), ((_b = a()) == null ? void 0 : _b.length) === 0 ? ssr(y, ssrHydrationKey(), escape(createComponent(O, { size: 64 })), escape(createComponent(ke, { variant: "primary", size: "lg", get children() {
      return [createComponent(f$1, { size: 20 }), "Add Your First Movie"];
    } }))) : escape((_c = a()) == null ? void 0 : _c.map((t) => createComponent(ye, { class: "movie-card", get key() {
      return t.id;
    }, get children() {
      return [ssr($, ssrHydrationKey(), t.posterPath ? ssr(z, ssrHydrationKey() + ssrAttribute("src", escape(t.posterPath, true), false) + ssrAttribute("alt", escape(t.title, true), false)) : ssr(M, ssrHydrationKey(), escape(createComponent(O, { size: 48 }))), escape(createComponent(we, { get variant() {
        return t.status === "downloaded" ? "success" : "warning";
      }, get children() {
        return t.status;
      } }))), ssr(_, ssrHydrationKey(), escape(t.title), t.releaseDate && escape(new Date(t.releaseDate).getFullYear()), t.runtime && ` - ${escape(Math.floor(t.runtime / 60))}h ${escape(t.runtime) % 60}m`)];
    } }))));
  } });
}

export { F as default };
//# sourceMappingURL=index3.mjs.map
