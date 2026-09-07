import { onSubtreeMutation, waitFor } from './lib/resolvers';
import { mountLyricsView } from './lib/lyrics-view';
(async () => {
  while (!Spicetify?.Player?.data || !Spicetify?.CosmosAsync) await new Promise(r => setTimeout(r,100));
  await waitFor(() => document.getElementById('lyrics-slot'));
  let slot: HTMLElement | null = null;
  let view: ReturnType<typeof mountLyricsView> | null = null;
  const mount = () => {
    const next = document.getElementById('lyrics-slot');
    if (next === slot) return;
    view?.dispose(); slot = next;
    view = next ? mountLyricsView(next, () => document.body.classList.contains('on-lyrics-route')) : null;
  };
  mount(); onSubtreeMutation(document.body, mount);
})();
