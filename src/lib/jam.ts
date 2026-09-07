type Member = { id: string; displayName?: string; username?: string; imageUrl?: string };
type Session = { sessionId?: string; isSessionOwner?: boolean; sessionOwnerId?: string; sessionMembers?: Member[]; deviceName?: string };
type JamAPI = {
  getCurrentSession?: () => Session | null;
  fetchCurrentSession?: () => Promise<unknown>;
  getEnabled?: () => string;
  createSession?: () => Promise<unknown>;
  deleteSession?: () => Promise<boolean>;
  leaveSession?: () => Promise<boolean>;
  removeSessionMember?: (id: string) => Promise<unknown>;
  getJamJoinInfo?: () => { joinSessionShortLink?: { shareableUrl?: string } } | null;
};
const api = () => (Spicetify.Platform as unknown as { SocialConnectAPI?: JamAPI }).SocialConnectAPI;

/** Session state belongs to Spotify, never local storage. All mutations require a click. */
export function setupJam(root: HTMLElement): void {
  const pane = root.querySelector('.crp-tab-pane[data-pane="friends"]');
  if (!pane) return;
  let busy = false, message = '', confirm: (() => Promise<void>) | null = null;
  let checking = !!api()?.fetchCurrentSession, session: Session | null = null, key = '';
  const card = document.createElement('section'); card.className = 'aurora-jam';
  card.innerHTML = `<button class="aurora-jam-heading" type="button" aria-expanded="true"><strong>Jam</strong><span class="aurora-jam-summary"></span><span aria-hidden="true">⌄</span></button>
    <div class="aurora-jam-content"><p class="aurora-jam-status" role="status"></p><ul class="aurora-jam-members" aria-label="Jam participants"></ul><div class="aurora-jam-actions"></div>
    <div class="aurora-jam-confirm" hidden><p></p><button type="button" data-confirm>Confirm</button><button type="button" data-cancel>Cancel</button></div></div>`;
  pane.prepend(card);
  const heading = card.querySelector<HTMLButtonElement>('.aurora-jam-heading')!;
  const content = card.querySelector<HTMLElement>('.aurora-jam-content')!;
  const status = card.querySelector<HTMLElement>('.aurora-jam-status')!;
  const list = card.querySelector('ul')!;
  const actions = card.querySelector<HTMLElement>('.aurora-jam-actions')!;
  const confirmation = card.querySelector<HTMLElement>('.aurora-jam-confirm')!;
  heading.addEventListener('click', () => { content.hidden = !content.hidden; heading.setAttribute('aria-expanded', String(!content.hidden)); });
  function ask(text: string, action: () => Promise<void>) {
    confirm = action; confirmation.hidden = false; confirmation.querySelector('p')!.textContent = text;
    confirmation.querySelector<HTMLButtonElement>('[data-cancel]')!.focus();
  }
  card.querySelector('[data-cancel]')!.addEventListener('click', () => { confirm = null; confirmation.hidden = true; heading.focus(); });
  card.querySelector('[data-confirm]')!.addEventListener('click', () => {
    const action = confirm; confirm = null; confirmation.hidden = true;
    if (action) void perform(action); heading.focus();
  });
  async function perform(action: () => Promise<void>) {
    if (busy || checking) return;
    busy = true; message = ''; render();
    try { await action(); }
    catch { message = 'Couldn’t complete that. Please try again.'; }
    finally { busy = false; key = ''; render(); }
  }
  function addButton(label: string, fn: () => void, parent: HTMLElement = actions) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = label;
    button.dataset.intent = /^(Start a Jam|Copy invite link)$/.test(label) ? 'primary' : /^(End Jam|Leave Jam|Remove)$/.test(label) ? 'quiet' : 'secondary';
    button.disabled = busy || checking; button.addEventListener('click', fn); parent.appendChild(button);
    return button;
  }
  async function refresh() { await api()?.fetchCurrentSession?.(); }
  function render() {
    try { session = api()?.getCurrentSession?.() ?? null; } catch { session = null; }
    const summary = session ? `${session.isSessionOwner ? 'Hosting' : 'Listening together'} · ${session.sessionMembers?.length ?? 1}` : 'Listen together';
    card.querySelector('.aurora-jam-summary')!.textContent = summary;
    status.textContent = checking ? 'Checking your session…' : busy ? 'Updating Jam…' : message || (session ? session.deviceName ? `Listening on ${session.deviceName}` : 'Everyone can add to the queue.' : 'Start a Jam and share the link with friends.');
    const nextKey = JSON.stringify([session, busy, checking]);
    if (nextKey === key) return;
    key = nextKey;
    // A departed/changed session invalidates any outstanding destructive confirmation.
    confirm = null; confirmation.hidden = true;
    list.replaceChildren(); actions.replaceChildren();
    if (!session) {
      const supported = !!api()?.createSession && (!api()?.getEnabled || api()?.getEnabled?.() === 'ENABLED');
      if (supported) addButton('Start a Jam', () => void perform(async () => {
        await refresh();
        if (!api()?.getCurrentSession?.() && !await api()?.createSession?.()) throw Error();
      }));
      else status.textContent = message || 'Jam hosting isn’t available here. Check Spotify’s track menu for account options.';
      if (api()?.fetchCurrentSession) addButton('Refresh', () => void perform(refresh));
      return;
    }
    const current = session;
    for (const member of current.sessionMembers ?? []) {
      const li = document.createElement('li');
      if (member.imageUrl && /^https:\/\//.test(member.imageUrl)) {
        const img = document.createElement('img'); img.src = member.imageUrl; img.alt = ''; img.loading = 'lazy'; li.appendChild(img);
      }
      const name = document.createElement('span'); name.textContent = member.displayName || member.username || 'Listener'; li.appendChild(name);
      if (member.id === current.sessionOwnerId) { const tag = document.createElement('small'); tag.textContent = 'Host'; li.appendChild(tag); }
      else if (current.isSessionOwner && api()?.removeSessionMember) {
        const button = addButton('Remove', () => ask(`Remove ${name.textContent} from this Jam?`, async () => {
          if (api()?.getCurrentSession?.()?.sessionId !== current.sessionId) throw Error();
          await api()?.removeSessionMember?.(member.id); await refresh();
          if (api()?.getCurrentSession?.()?.sessionMembers?.some(m => m.id === member.id)) throw Error();
        }), li);
        button.setAttribute('aria-label', `Remove ${name.textContent} from Jam`);
      }
      list.appendChild(li);
    }
    if (api()?.getJamJoinInfo) addButton('Copy invite link', () => void perform(async () => {
      const link = api()?.getJamJoinInfo?.()?.joinSessionShortLink?.shareableUrl;
      if (!link || !/^https:\/\//.test(link) || !navigator.clipboard) throw Error();
      await navigator.clipboard.writeText(link); message = 'Invite link copied';
    }));
    const end = current.isSessionOwner;
    if (end ? api()?.deleteSession : api()?.leaveSession) addButton(end ? 'End Jam' : 'Leave Jam', () => ask(end ? 'End this Jam for everyone?' : 'Leave this Jam?', async () => {
      if (api()?.getCurrentSession?.()?.sessionId !== current.sessionId) throw Error();
      const success = end ? await api()?.deleteSession?.() : await api()?.leaveSession?.();
      if (!success) { await refresh(); throw Error(); }
    }));
  }
  const devices = root.querySelector('.crp-tab-pane[data-pane="devices"]');
  if (devices) {
    const shortcut = document.createElement('button'); shortcut.type = 'button'; shortcut.className = 'aurora-jam-shortcut'; shortcut.textContent = 'Jam with friends';
    shortcut.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('crp-switch-tab', { detail: 'friends' }));
      content.hidden = false; heading.setAttribute('aria-expanded', 'true'); heading.focus();
    }); devices.prepend(shortcut);
  }
  render();
  if (checking) void Promise.resolve().then(refresh).catch(() => {message = 'Couldn’t check Jam. Refresh to try again.';}).finally(() => { checking = false; render(); });
  const timer = window.setInterval(() => { if (!root.isConnected) clearInterval(timer); else render(); }, 2500);
}
