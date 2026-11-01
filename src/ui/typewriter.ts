/* Rotating role line (same roles and pacing as the original site). */
const ROLES = ["AI / ML researcher", "5G & edge systems builder", "Full-stack engineer", "Kubernetes tinkerer"];

export function initTypewriter(reduce: boolean) {
  const el = document.getElementById("roles");
  if (!el) return;
  if (reduce) {
    el.textContent = ROLES[0];
    return;
  }
  let ri = 0, ci = 0, del = false;
  const type = () => {
    const w = ROLES[ri];
    el.textContent = w.slice(0, ci);
    if (!del && ci === w.length) {
      del = true;
      return setTimeout(type, 1500);
    }
    if (del && ci === 0) {
      del = false;
      ri = (ri + 1) % ROLES.length;
    }
    ci += del ? -1 : 1;
    setTimeout(type, del ? 35 : 75);
  };
  type();
}
