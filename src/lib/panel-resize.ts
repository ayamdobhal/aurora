import { onSubtreeMutation } from "./resolvers";

const KEY = "aurora:right-panel-width:v1";
const DEFAULT = 340;
const MIN = 240;
const MAX = 560;

export function setupPanelResizing(): void {
  let preferred = DEFAULT;
  try {
    const value = Number(localStorage.getItem(KEY));
    if (Number.isFinite(value) && value >= MIN && value <= MAX) preferred = value;
  } catch { /* Storage may be unavailable; resizing still works. */ }
  let handle: HTMLElement | null = null;
  let observedNav: Element | null = null;
  let width = DEFAULT;
  let maximum = MAX;
  let drag: { x: number; width: number; preferred: number; pointer: number } | null = null;

  function save(): void {
    try { localStorage.setItem(KEY, String(preferred)); } catch { /* Session-only fallback. */ }
  }
  function update(): void {
    const nav = document.querySelector(".Root__nav-bar");
    if (nav !== observedNav) {
      observer?.disconnect();
      if (nav) observer?.observe(nav);
      observedNav = nav;
    }
    const left = nav?.getBoundingClientRect().width ?? 72;
    maximum = Math.max(MIN, Math.min(MAX, window.innerWidth - left - 320 - 32));
    width = Math.round(Math.max(MIN, Math.min(preferred, maximum)));
    const root = document.documentElement.style;
    const value = `${width}px`;
    if (root.getPropertyValue("--aurora-right-width") !== value)
      root.setProperty("--aurora-right-width", value);
    handle?.setAttribute("aria-valuenow", String(width));
    handle?.setAttribute("aria-valuemax", String(Math.floor(maximum)));
    handle?.setAttribute("aria-valuetext", `${width} pixels`);
  }
  const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);

  function stop(cancel = false): void {
    if (!drag) return;
    const pointer = drag.pointer;
    if (cancel) preferred = drag.preferred;
    drag = null;
    if (handle?.hasPointerCapture?.(pointer)) handle.releasePointerCapture(pointer);
    document.body.classList.remove("aurora-resizing");
    document.removeEventListener("pointermove", move);
    document.removeEventListener("pointerup", end);
    document.removeEventListener("pointercancel", cancelDrag);
    window.removeEventListener("blur", cancelDrag);
    update();
    if (!cancel) save();
  }
  function move(e: PointerEvent): void {
    if (!drag || e.pointerId !== drag.pointer) return;
    preferred = Math.max(MIN, Math.min(maximum, drag.width + drag.x - e.clientX));
    update();
  }
  function end(e: PointerEvent): void {
    if (drag && e.pointerId === drag.pointer) { move(e); stop(); }
  }
  function cancelDrag(): void { stop(true); }

  function mount(): void {
    const sidebar = document.querySelector(".Root__right-sidebar");
    if (handle && !handle.isConnected) { stop(true); handle = null; }
    if (sidebar && !handle) {
      handle = document.createElement("div");
      handle.className = "aurora-panel-resizer";
      handle.tabIndex = 0;
      handle.setAttribute("role", "separator");
      handle.setAttribute("aria-label", "Resize player panel");
      handle.setAttribute("aria-orientation", "vertical");
      handle.setAttribute("aria-valuemin", String(MIN));
      handle.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        handle?.focus();
        drag = { x: e.clientX, width, preferred, pointer: e.pointerId };
        handle?.setPointerCapture?.(e.pointerId);
        document.body.classList.add("aurora-resizing");
        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", end);
        document.addEventListener("pointercancel", cancelDrag);
        window.addEventListener("blur", cancelDrag);
      });
      handle.addEventListener("lostpointercapture", cancelDrag);
      handle.addEventListener("keydown", (e) => {
        if (e.key === "Escape") { stop(true); return; }
        const step = e.shiftKey ? 40 : 10;
        const next = e.key === "ArrowLeft" ? width + step : e.key === "ArrowRight" ? width - step
          : e.key === "Home" ? MIN : e.key === "End" ? maximum : null;
        if (next === null) return;
        e.preventDefault();
        e.stopPropagation();
        preferred = Math.max(MIN, Math.min(maximum, next));
        update(); save();
      });
      handle.addEventListener("dblclick", () => { preferred = DEFAULT; update(); save(); });
      sidebar.appendChild(handle);
    }
    update();
  }
  mount();
  onSubtreeMutation(document.body, mount);
  window.addEventListener("resize", update);
}
