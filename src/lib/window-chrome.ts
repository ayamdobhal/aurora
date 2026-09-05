// Spotify's native window frame cannot be removed with theme CSS alone.
// Protocol reference: ohitstom/spicetify-extensions/noControls.
export function setupWindowsTitlebar(): void {
  if (!/^Win/i.test(navigator.platform)) return;
  const root = document.documentElement;
  let hidden = true;
  let timer: number | undefined;
  type NativeClient = {
    updateTitlebarHeight?: (request: { height: number }) => unknown;
    setButtonsVisibility?: (request: { showButtons: boolean }) => unknown;
  };
  const apply = (): void => {
    const requestedHidden = hidden;
    const platform = Spicetify.Platform as unknown as Record<
      string,
      { _updateUiClient?: NativeClient } | undefined
    >;
    const operations: Array<() => unknown> = [];
    // Newer clients use ControlMessageAPI; older builds used UpdateAPI.
    const clients = new Set([
      platform?.ControlMessageAPI?._updateUiClient,
      platform?.UpdateAPI?._updateUiClient,
    ]);
    for (const client of clients) {
      if (client?.updateTitlebarHeight)
        operations.push(() =>
          client.updateTitlebarHeight!({ height: requestedHidden ? 1 : 30 }),
        );
      if (client?.setButtonsVisibility)
        operations.push(() =>
          client.setButtonsVisibility!({ showButtons: !requestedHidden }),
        );
    }
    operations.push(() =>
      Spicetify.CosmosAsync.post("sp://messages/v1/container/control", {
        type: "update_titlebar",
        height: requestedHidden ? "1px" : "30px",
      }),
    );
    // Dispatch independently: a hanging legacy Cosmos request must not gate
    // native controls or CSS. If every route rejects, restore native styling.
    root.classList.toggle("aurora-hide-titlebar", requestedHidden);
    let failures = 0;
    for (const operation of operations) {
      Promise.resolve()
        .then(operation)
        .catch(() => {
          failures++;
          if (failures === operations.length && hidden === requestedHidden) {
            root.classList.remove("aurora-hide-titlebar");
            console.warn("[Aurora] Windows titlebar control unavailable");
          }
        });
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
