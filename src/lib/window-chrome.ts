// Spotify's native window frame cannot be removed with theme CSS alone.
// Protocol reference: ohitstom/spicetify-extensions/noControls.
export function setupWindowsTitlebar(): void {
  if (!/^Win/i.test(navigator.platform)) return;
  const root = document.documentElement;
  let hidden = true;
  let timer: number | undefined;
  const apply = async (): Promise<void> => {
    const requestedHidden = hidden;
    try {
      await Spicetify.CosmosAsync.post("sp://messages/v1/container/control", {
        type: "update_titlebar",
        height: requestedHidden ? "1px" : "30px",
      });
      if (hidden === requestedHidden)
        root.classList.toggle("aurora-hide-titlebar", hidden);
    } catch {
      // Preserve native controls if the private interface is unavailable.
      root.classList.remove("aurora-hide-titlebar");
      console.warn("[Aurora] Windows titlebar control unavailable");
    }
  };
  const schedule = (): void => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void apply(), 150);
  };
  void apply();
  // A bounded startup retry covers Spotify finishing its initial frame setup.
  window.setTimeout(schedule, 1500);
  document.addEventListener("fullscreenchange", schedule);
  window.addEventListener("resize", schedule);
  document.addEventListener("keydown", (event) => {
    if (event.key !== "F8" || event.repeat) return;
    hidden = !hidden;
    event.preventDefault();
    schedule();
  });
}
