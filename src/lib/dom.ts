// Replacing identical text still produces child-list mutations and wakes the
// theme's subtree observers. Keep hot player labels quiet between changes.
export function setTextIfChanged(el: HTMLElement | null, value: string): void {
  if (el && el.textContent !== value) el.textContent = value;
}
