export function modalFocus(root: HTMLElement, close: () => void): () => void {
  const doc = root.ownerDocument;
  const previous = doc.activeElement as HTMLElement | null;
  root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.tabIndex = -1;
  const focusables = () => Array.from(root.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),select,a[href],[tabindex="0"]')).filter(e => !e.closest('[hidden],.hidden'));
  (focusables()[0] ?? root).focus();
  const key = (e: KeyboardEvent) => {
    if (e.key === "Escape") { e.preventDefault(); e.stopImmediatePropagation(); close(); }
    if (e.key !== "Tab") return;
    const items = focusables(); const current = items.indexOf(doc.activeElement as HTMLElement);
    e.preventDefault(); e.stopPropagation();
    (items[(current + (e.shiftKey ? -1 : 1) + items.length) % items.length] ?? root).focus();
  };
  root.addEventListener("keydown", key);
  return () => { root.removeEventListener("keydown", key); if (previous?.isConnected) previous.focus(); };
}
export function wireSlider(el: HTMLElement | null, label: string, get: () => number, max: () => number, set: (n: number) => void, step: number): void {
  if (!el) return;
  el.tabIndex = 0; el.setAttribute("role", "slider"); el.setAttribute("aria-label", label);
  el.setAttribute("aria-valuemin", "0");
  const sync = () => { el.setAttribute("aria-valuemax", String(max())); el.setAttribute("aria-valuenow", String(Math.round(get()))); };
  el.addEventListener("focus", sync); sync();
  el.addEventListener("keydown", e => {
    const n = e.key === "Home" ? 0 : e.key === "End" ? max() : ["ArrowRight", "ArrowUp"].includes(e.key) ? get()+step : ["ArrowLeft", "ArrowDown"].includes(e.key) ? get()-step : null;
    if (n === null) return;
    e.preventDefault(); e.stopPropagation(); set(Math.max(0, Math.min(max(), n))); sync();
  });
}
export function syncTabs(root: HTMLElement, prefix: string, active: string): void {
  root.querySelector(`.${prefix}-tab-bar`)?.setAttribute("role", "tablist");
  const tabs = Array.from(root.querySelectorAll<HTMLElement>(`.${prefix}-tab`));
  tabs.forEach((tab, i) => {
    const id = tab.dataset.tab!;
    tab.id = `${prefix}-tab-${id}`; tab.setAttribute("role", "tab");
    tab.setAttribute("aria-controls", `${prefix}-pane-${id}`);
    tab.setAttribute("aria-selected", String(id === active)); tab.tabIndex = id === active ? 0 : -1;
    if (!tab.dataset.keysWired) {
      tab.dataset.keysWired = "1";
      tab.addEventListener("keydown", e => {
        const next = e.key === "Home" ? 0 : e.key === "End" ? tabs.length-1 : e.key === "ArrowRight" ? (i+1)%tabs.length : e.key === "ArrowLeft" ? (i+tabs.length-1)%tabs.length : -1;
        if (next < 0) return; e.preventDefault(); e.stopPropagation(); tabs[next].click(); tabs[next].focus();
      });
    }
    const pane = root.querySelector<HTMLElement>(`.${prefix}-tab-pane[data-pane="${id}"]`);
    if (pane) { pane.id = `${prefix}-pane-${id}`; pane.setAttribute("role", "tabpanel"); pane.setAttribute("aria-labelledby", tab.id); }
  });
}
