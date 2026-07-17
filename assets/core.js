// core — data layer + helpers compartilhados.
// Carregado antes de players.js e ui.js (globais compartilhadas via <script>).

const state = { items: [] };

async function api(action, body) {
  const opts = { method: body ? 'POST' : 'GET' };
  if (body && !(body instanceof FormData)) {
    opts.headers = { 'Content-Type': 'application/json' };
    opts.body = JSON.stringify(body);
  } else if (body) {
    opts.body = body;
  }
  const res = await fetch(`api.php?action=${action}`, opts);
  const data = await res.json();
  if (!data.ok) throw new Error(data.error || 'erro');
  return data;
}

function itemsOf(cat) { return state.items.filter(i => i.category === cat); }

async function refresh() {
  state.items = (await api('list')).items;
  renderTrackLike('track');
  renderTrackLike('ambient');
  renderSfx();
}

async function removeItem(id) {
  for (const g of Object.values(groups)) if (g.isPlaying(id)) g.stopItem(id);
  if (sfxYtPlayers[id]) { sfxYtPlayers[id].destroy(); delete sfxYtPlayers[id]; }
  await api('delete', { id });
  await refresh();
}

// YT IFrame API: resolve mesmo se a API carregar antes deste script (defer race).
let ytReady = new Promise(r => {
  if (window.YT && window.YT.Player) { r(); return; }
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') prev(); r(); };
});

function srcOf(item) {
  return item.source === 'mp3file' ? `uploads/${item.ref}` : item.ref;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}
