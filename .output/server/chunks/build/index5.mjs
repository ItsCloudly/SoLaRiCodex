import { createComponent, ssr, ssrHydrationKey, escape, ssrAttribute, ssrStyleProperty, mergeProps } from 'solid-js/web';
import { g as ge, J as J$1, C as Ce, O, a as ae, K as K$1, k as ke, y as ye, l } from './index-Sxd3Q-N6.mjs';
import { createSignal } from 'solid-js';
import './components-YnJA_VXq.mjs';

var P = [["path", { d: "M5 12h14", key: "1ays0h" }], ["path", { d: "m12 5 7 7-7 7", key: "xquz4c" }]], L = (i) => createComponent(l, mergeProps(i, { iconNode: P, name: "arrow-right" })), q = L, A = ["<div", ' class="search-page"><header class="page-header"><!--$-->', '<!--/--><h1 class="section-title">Search</h1></header><!--$-->', "<!--/--></div>"], R = ["<div", ' class="category-selection"><p class="selection-hint">Select a category to start searching</p><div class="categories-grid">', "</div></div>"], x = ["<div", ' class="category-icon" style="', '">', "</div>"], B = ["<h3", ' class="category-label">', "</h3>"], N = ["<p", ' class="category-description">', "</p>"], T = ["<div", ' class="category-arrow">', "</div>"], V = ["<div", ' class="search-interface"><div class="search-bar"><button class="back-button">&lt;- Back</button><div class="search-input-wrapper"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", '<!--/--></div></div><div class="search-results"><!--$-->', "<!--/--><!--$-->", "<!--/--></div></div>"], j = ["<div", ' class="no-results"><!--$-->', '<!--/--><p>No results found for "<!--$-->', '<!--/-->"</p></div>'], H = ["<div", ' class="result-poster">', "</div>"], K = ["<div", ' class="result-info"><h3>', "</h3><p>", '</p><div class="result-actions">', "</div></div>"], Q = ["<img", ">"], U = ["<div", ' class="poster-placeholder"><!--$-->', "<!--/--><!--$-->", "<!--/--><!--$-->", "<!--/--></div>"];
const g = [{ id: "movies", label: "Movies", icon: O, color: "var(--accent-primary)", description: "Search for movies to add to your library" }, { id: "tv", label: "TV Shows", icon: ae, color: "var(--accent-secondary)", description: "Search for TV series and episodes" }, { id: "music", label: "Music", icon: K$1, color: "var(--success)", description: "Search for artists and albums" }];
function J() {
  const [i, _] = createSignal(null), [c, b] = createSignal(""), [p, S] = createSignal([]), [l, h] = createSignal(false), w = async () => {
    if (!(!c() || !i())) {
      h(true);
      try {
        const n = await (await fetch(`/api/search/${i()}?q=${encodeURIComponent(c())}`)).json();
        S(n.results || []);
      } catch (r) {
        console.error("Search failed:", r);
      } finally {
        h(false);
      }
    }
  };
  return createComponent(ge, { get children() {
    return ssr(A, ssrHydrationKey(), escape(createComponent(J$1, { size: 28, class: "header-icon" })), i() ? ssr(V, ssrHydrationKey(), escape(createComponent(J$1, { size: 20 })), escape(createComponent(Ce, { get placeholder() {
      var _a;
      return `Search ${(_a = g.find((r) => r.id === i())) == null ? void 0 : _a.label.toLowerCase()}...`;
    }, get value() {
      return c();
    }, onInput: b, class: "search-input" })), escape(createComponent(ke, { variant: "primary", onClick: w, get disabled() {
      return l() || !c();
    }, get children() {
      return l() ? "Searching..." : "Search";
    } })), p().length === 0 && !l() && c() && ssr(j, ssrHydrationKey(), escape(createComponent(J$1, { size: 48 })), escape(c())), escape(p().map((r) => createComponent(ye, { class: "result-card", get key() {
      return r.id;
    }, get children() {
      return [ssr(H, ssrHydrationKey(), r.posterPath ? ssr(Q, ssrHydrationKey() + ssrAttribute("src", escape(r.posterPath, true), false) + ssrAttribute("alt", escape(r.title, true), false)) : ssr(U, ssrHydrationKey(), i() === "movies" && escape(createComponent(O, { size: 32 })), i() === "tv" && escape(createComponent(ae, { size: 32 })), i() === "music" && escape(createComponent(K$1, { size: 32 })))), ssr(K, ssrHydrationKey(), escape(r.title), escape(r.overview) || escape(r.description), escape(createComponent(ke, { variant: "primary", size: "sm", children: "Add to Library" })))];
    } })))) : ssr(R, ssrHydrationKey(), escape(g.map((r) => {
      const n = r.icon;
      return createComponent(ye, { get key() {
        return r.id;
      }, class: "category-card", onClick: () => _(r.id), get children() {
        return [ssr(x, ssrHydrationKey(), ssrStyleProperty("color:", escape(r.color, true)), escape(createComponent(n, { size: 48 }))), ssr(B, ssrHydrationKey(), escape(r.label)), ssr(N, ssrHydrationKey(), escape(r.description)), ssr(T, ssrHydrationKey(), escape(createComponent(q, { size: 20 })))];
      } });
    }))));
  } });
}

export { J as default };
//# sourceMappingURL=index5.mjs.map
