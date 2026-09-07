import { getSpotifyLyricsContainer } from './resolvers';
export function setupFocusMode(): void {
  let previousRoute = '/', enteredFromLyrics = false, previousFocus: HTMLElement | null = null;
  const controls = document.createElement('div'); controls.className = 'aurora-focus-controls';
  controls.innerHTML = '<button type="button" data-exit>Exit focus</button><button type="button" data-play>Play / pause</button><label>Seek <input type="range" min="0" max="100" value="0" aria-label="Playback position" /></label>';
  document.body.appendChild(controls);
  const seek = controls.querySelector('input')!;
  const toggle = () => {
    if (document.body.classList.contains('aurora-focus')) {exit(); return;}
    previousFocus = document.activeElement as HTMLElement;
    enteredFromLyrics = !!getSpotifyLyricsContainer();
    previousRoute = (Spicetify.Platform.History as unknown as {location?: {pathname?:string}}).location?.pathname || '/';
    if (!enteredFromLyrics) Spicetify.Platform.History.push('/lyrics');
    document.body.classList.add('aurora-focus');
    sync();
    controls.querySelector<HTMLButtonElement>('[data-exit]')?.focus();
  };
  function exit() {
    document.body.classList.remove('aurora-focus');
    if (!enteredFromLyrics) Spicetify.Platform.History.push(previousRoute);
    if (previousFocus?.isConnected) previousFocus.focus();
  }
  controls.querySelector('[data-exit]')!.addEventListener('click', exit);
  controls.querySelector('[data-play]')!.addEventListener('click', () => Spicetify.Player.togglePlay());
  seek.addEventListener('input', () => Spicetify.Player.seek(Number(seek.value)*Spicetify.Player.getDuration()/100));
  const sync = () => {
    if (!document.body.classList.contains('aurora-focus')) return;
    seek.value = String(Spicetify.Player.getProgress()/Math.max(1,Spicetify.Player.getDuration())*100);
    controls.querySelector('[data-play]')!.textContent = Spicetify.Player.data?.isPaused ? 'Play' : 'Pause';
  };
  Spicetify.Player.addEventListener('onprogress', sync); Spicetify.Player.addEventListener('onplaypause', sync);
  document.addEventListener('toggle-focus', toggle);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && document.body.classList.contains('aurora-focus') && !document.querySelector('.command-palette:not(.hidden),.shortcut-help:not(.hidden)')) {e.preventDefault(); exit();}
  });
}
