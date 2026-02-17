import { createResource, untrack, sharedConfig } from 'solid-js';
import { isServer, getRequestEvent } from 'solid-js/web';

function d(r, n) {
  let e, s = () => !e || e.state === "unresolved" ? void 0 : e.latest;
  [e] = createResource(() => f(r, untrack(s)), (a) => a, n);
  const c = () => e();
  return Object.defineProperty(c, "latest", { get() {
    return e.latest;
  } }), c;
}
class t {
  static all() {
    return new t();
  }
  static allSettled() {
    return new t();
  }
  static any() {
    return new t();
  }
  static race() {
    return new t();
  }
  static reject() {
    return new t();
  }
  static resolve() {
    return new t();
  }
  catch() {
    return new t();
  }
  then() {
    return new t();
  }
  finally() {
    return new t();
  }
}
function f(r, n) {
  if (isServer || !sharedConfig.context) return r(n);
  const e = fetch, s = Promise;
  try {
    return window.fetch = () => new t(), Promise = t, r(n);
  } finally {
    window.fetch = e, Promise = s;
  }
}
function p(r) {
  var _a;
  const n = r.startsWith("/") ? r : `/${r}`;
  if (!isServer) return n;
  const e = getRequestEvent();
  if (e) {
    const c = new URL(e.request.url).origin;
    return new URL(n, c).toString();
  }
  return `http://localhost:${(_a = process.env.PORT) != null ? _a : "3000"}${n}`;
}

export { d, p };
//# sourceMappingURL=api-BB7gk3Fl2.mjs.map
