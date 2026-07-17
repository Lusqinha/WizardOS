// RPG Soundboard — data layer, audio engine, SFX, add-dialog, timers.

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
  await api('delete', { id });
  await refresh();
}

// --- Helpers compartilhados ---
let ytReady = new Promise(r => {
  if (window.YT && window.YT.Player) { r(); return; } // API ja carregou (defer race)
  const prev = window.onYouTubeIframeAPIReady;
  window.onYouTubeIframeAPIReady = () => { if (typeof prev === 'function') prev(); r(); };
});

function srcOf(item) {
  return item.source === 'mp3file' ? `uploads/${item.ref}` : item.ref;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// --- Camadas de áudio (Trilha / Ambiente): um player por janela ---
function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

// Um player por item ativo (audio/yt) com painel now-playing minimizavel.
class Player {
  constructor(item, group) {
    this.item = item; this.group = group;
    this.audio = null; this.yt = null; this.ticker = null; this.minimized = false;
    this.el = document.createElement('div');
    this.el.className = 'now-playing';
    group.body.appendChild(this.el);
  }

  async start() {
    const item = this.item;
    this.el.innerHTML = `
      <div class="np-head">
        <span class="np-title">${escapeHtml(item.title)}</span>
        <button class="np-min" title="Minimizar player"><i class="hn hn-minus"></i></button>
        <button class="np-stop" title="Parar"><i class="hn hn-times"></i></button>
      </div>
      <div class="np-media"></div>
      <div class="np-row"><span class="np-cur">0:00</span>
        <input type="range" class="np-seek" min="0" max="0" value="0" step="0.1">
        <span class="np-dur">0:00</span></div>`;
    const media = this.el.querySelector('.np-media');
    const seek = this.el.querySelector('.np-seek');
    seek.addEventListener('input', () => {
      const v = parseFloat(seek.value);
      if (this.audio) this.audio.currentTime = v;
      if (this.yt && this.yt.seekTo) this.yt.seekTo(v, true);
    });
    this.el.querySelector('.np-min').onclick = () => {
      this.minimized = !this.minimized;
      this.el.classList.toggle('mini', this.minimized);
    };
    this.el.querySelector('.np-stop').onclick = () => this.group.stopItem(item.id);

    const vol = this.group.volume;
    if (item.source === 'youtube') {
      await ytReady;
      const host = document.createElement('div');
      media.appendChild(host);
      this.yt = new YT.Player(host, {
        width: '240', height: '135', videoId: item.ref,
        playerVars: { autoplay: 1, playsinline: 1, loop: item.loop ? 1 : 0, playlist: item.loop ? item.ref : undefined },
        events: {
          onReady: e => { e.target.setVolume(vol * 100); e.target.playVideo(); },
          onError: e => {
            console.error('YT error', e.data);
            const msg = (e.data === 101 || e.data === 150) ? 'vídeo proíbe embed — abra no YouTube' : 'erro YT ' + e.data;
            const t = this.el.querySelector('.np-title');
            if (t) t.innerHTML += ` <a href="https://youtu.be/${item.ref}" target="_blank">(${msg})</a>`;
          },
        },
      });
    } else {
      this.audio = new Audio(srcOf(item));
      this.audio.loop = item.loop;
      this.audio.volume = vol;
      this.audio.play().catch(e => console.error('play falhou', e));
    }
    this.startTicker();
  }

  startTicker() {
    clearInterval(this.ticker);
    this.ticker = setInterval(() => {
      const seek = this.el.querySelector('.np-seek');
      if (!seek) return;
      let cur = 0, dur = 0;
      if (this.audio) { cur = this.audio.currentTime; dur = this.audio.duration || 0; }
      else if (this.yt && this.yt.getDuration) { cur = this.yt.getCurrentTime() || 0; dur = this.yt.getDuration() || 0; }
      if (dur && isFinite(dur)) seek.max = dur;
      if (document.activeElement !== seek) seek.value = cur;
      this.el.querySelector('.np-cur').textContent = fmtTime(cur);
      this.el.querySelector('.np-dur').textContent = fmtTime(dur);
    }, 500);
  }

  setVolume(v) {
    if (this.yt && this.yt.setVolume) this.yt.setVolume(v * 100);
    if (this.audio) this.audio.volume = v;
  }

  destroy() {
    clearInterval(this.ticker); this.ticker = null;
    if (this.audio) { this.audio.pause(); this.audio = null; }
    if (this.yt) { this.yt.destroy(); this.yt = null; }
    this.el.remove();
  }
}

// Grupo por janela. single=true toca um por vez (Trilha); false permite varios (Ambiente).
class Group {
  constructor(name, single) {
    this.name = name; this.single = single; this.volume = 0.8; this.players = new Map();
    this.body = document.querySelector(`.item-list[data-cat="${name}"]`).closest('.window-body');
  }
  isPlaying(id) { return this.players.has(id); }
  async toggle(item) {
    if (this.players.has(item.id)) { this.stopItem(item.id); return; }
    if (this.single) for (const id of [...this.players.keys()]) this.stopItem(id);
    const p = new Player(item, this);
    this.players.set(item.id, p);
    renderTrackLike(this.name);
    await p.start();
  }
  stopItem(id) {
    const p = this.players.get(id);
    if (p) { p.destroy(); this.players.delete(id); }
    renderTrackLike(this.name);
  }
  setVolume(v) { this.volume = v; for (const p of this.players.values()) p.setVolume(v); }
}

const groups = { track: new Group('track', true), ambient: new Group('ambient', false) };

function renderTrackLike(cat) {
  const group = groups[cat];
  const ul = document.querySelector(`.item-list[data-cat="${cat}"]`);
  ul.innerHTML = '';
  for (const it of itemsOf(cat)) {
    const li = document.createElement('li');
    const playing = group.isPlaying(it.id);
    const icon = playing ? 'hn-pause-solid' : 'hn-play-solid';
    li.innerHTML = `
      <button class="btn-play"><i class="hn ${icon}"></i></button>
      <span class="title-txt">${escapeHtml(it.title)}</span>
      <button class="btn-del"><i class="hn hn-trash"></i></button>`;
    li.querySelector('.btn-play').onclick = () => group.toggle(it);
    li.querySelector('.btn-del').onclick = () => removeItem(it.id);
    ul.appendChild(li);
  }
  // slider de volume da janela (criado uma vez)
  const pane = ul.closest('.window-body');
  let vol = pane.querySelector('.vol');
  if (!vol) {
    vol = document.createElement('input');
    vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.01;
    vol.value = group.volume; vol.className = 'vol';
    vol.oninput = () => group.setVolume(parseFloat(vol.value));
    ul.after(vol);
  }
}

// --- Efeitos (SFX): one-shot, sobrepõem ---
const sfxYtPlayers = {}; // id -> YT.Player (reutilizado; seek0 a cada clique)

async function playSfx(item) {
  if (item.source === 'youtube') {
    await ytReady;
    let p = sfxYtPlayers[item.id];
    if (!p) {
      const host = document.createElement('div');
      document.getElementById('yt-hosts').appendChild(host);
      p = sfxYtPlayers[item.id] = new YT.Player(host, {
        videoId: item.ref,
        events: { onReady: e => { e.target.setVolume(100); e.target.playVideo(); } },
      });
    } else {
      p.seekTo(0); p.playVideo();
    }
  } else {
    const a = new Audio(srcOf(item)); // instancia nova => sobreposicao livre
    a.play().catch(e => console.error('sfx falhou', e));
  }
}

let sfxDeleteMode = false;
function initSfxDelete() {
  const btn = document.querySelector('.btn-delmode[data-cat="sfx"]');
  const ul = document.querySelector('.sfx-grid[data-cat="sfx"]');
  if (!btn || !ul) return;
  btn.addEventListener('click', () => {
    sfxDeleteMode = !sfxDeleteMode;
    ul.classList.toggle('del-mode', sfxDeleteMode);
    btn.classList.toggle('active', sfxDeleteMode);
  });
}
initSfxDelete();

function renderSfx() {
  const ul = document.querySelector('.sfx-grid[data-cat="sfx"]');
  ul.innerHTML = '';
  for (const it of itemsOf('sfx')) {
    const li = document.createElement('li');
    li.innerHTML = `<button class="btn-sfx">${escapeHtml(it.title)}</button>`;
    li.querySelector('.btn-sfx').onclick = () => sfxDeleteMode ? removeItem(it.id) : playSfx(it);
    ul.appendChild(li);
  }
}

// --- Dialog "adicionar item" ---
const dlg = document.getElementById('add-dialog');
const addForm = document.getElementById('add-form');
const srcSel = addForm.source;

function syncFields() {
  const src = srcSel.value;
  addForm.querySelectorAll('[data-for]').forEach(el =>
    el.hidden = !el.dataset.for.split(' ').includes(src));
  addForm.querySelector('.ref-label').textContent = src === 'mp3url' ? 'URL do MP3' : 'Link YouTube';
}
srcSel.onchange = syncFields;
addForm.querySelector('.cancel').onclick = () => dlg.close();

function openAddDialog(cat) {
  addForm.reset();
  addForm.category.value = cat;
  addForm.querySelector('.err').textContent = '';
  syncFields();
  dlg.showModal();
}

addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = addForm.querySelector('.err');
  err.textContent = '';
  try {
    const cat = addForm.category.value;
    const src = addForm.source.value;
    if (src === 'mp3file') {
      const fd = new FormData();
      fd.append('category', cat);
      fd.append('title', addForm.title.value);
      fd.append('file', addForm.file.files[0]);
      await api('upload', fd);
    } else {
      await api('add-link', { category: cat, source: src, title: addForm.title.value, ref: addForm.ref.value });
    }
    dlg.close();
    await refresh();
  } catch (ex) {
    err.textContent = ex.message;
  }
});

document.querySelectorAll('.btn-add').forEach(b =>
  b.addEventListener('click', () => openAddDialog(b.dataset.cat)));

// --- Timers 30m/10m/1h ---
const TIMER_PRESETS = [
  { label: '30 min', ms: 30 * 60000 },
  { label: '10 min', ms: 10 * 60000 },
  { label: '1 hora', ms: 60 * 60000 },
];

function fmt(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = String(Math.floor(s / 3600)).padStart(2, '0');
  const m = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return h === '00' ? `${m}:${ss}` : `${h}:${m}:${ss}`;
}

function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = 'square'; o.frequency.value = 880;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime);
    o.start(); o.stop(ctx.currentTime + 0.3);
    o.onended = () => ctx.close();
  } catch (e) { /* WebAudio indisponível — silencioso */ }
}

function makeTimer(preset, removable) {
  const el = document.createElement('div');
  el.className = 'timer';
  el.innerHTML = `
    <div class="readout">${fmt(preset.ms)}</div>
    <div>${preset.label}</div>
    <button class="t-start"><i class="hn hn-play-solid"></i></button>
    <button class="t-pause"><i class="hn hn-pause-solid"></i></button>
    <button class="t-reset"><i class="hn hn-refresh"></i></button>
    ${removable ? '<button class="t-del" title="remover"><i class="hn hn-times"></i></button>' : ''}`;
  const readout = el.querySelector('.readout');
  let remaining = preset.ms, targetAt = null, raf = null;

  function tick() {
    const left = targetAt - Date.now();
    readout.textContent = fmt(left);
    if (left <= 0) { done(); return; }
    raf = requestAnimationFrame(tick);
  }
  function done() {
    remaining = 0; targetAt = null; cancelAnimationFrame(raf);
    readout.textContent = fmt(0); el.classList.add('done');
    beep();
  }
  el.querySelector('.t-start').onclick = () => {
    if (targetAt) return;                 // ja rodando
    if (remaining <= 0) remaining = preset.ms;
    el.classList.remove('done');
    targetAt = Date.now() + remaining;
    tick();
  };
  el.querySelector('.t-pause').onclick = () => {
    if (!targetAt) return;
    remaining = targetAt - Date.now(); targetAt = null;
    cancelAnimationFrame(raf);
  };
  el.querySelector('.t-reset').onclick = () => {
    targetAt = null; cancelAnimationFrame(raf); remaining = preset.ms;
    el.classList.remove('done'); readout.textContent = fmt(preset.ms);
  };
  el.querySelector('.t-del')?.addEventListener('click', () => {
    cancelAnimationFrame(raf); el.remove();
  });
  return el;
}

function initTimers() {
  const host = document.getElementById('timers');
  TIMER_PRESETS.forEach(p => host.appendChild(makeTimer(p)));
  // timer personalizado
  const form = document.createElement('div');
  form.className = 'timer-custom';
  form.innerHTML = `<input type="number" min="1" max="600" placeholder="min" class="t-custom-min"><button class="t-custom-add">+ timer</button>`;
  const input = form.querySelector('.t-custom-min');
  const add = () => {
    const n = parseInt(input.value, 10);
    if (!n || n < 1) return;
    host.insertBefore(makeTimer({ label: `${n} min`, ms: n * 60000 }, true), form);
    input.value = '';
  };
  form.querySelector('.t-custom-add').onclick = add;
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') add(); });
  host.appendChild(form);
}

initTimers();
refresh().catch(e => console.error(e));

// notas: carrega do servidor e autosalva (debounced) — vao junto no export
async function initNotes() {
  const ta = document.getElementById('notes');
  if (!ta) return;
  try { ta.value = (await api('list')).notes || ''; } catch (e) { console.error(e); }
  let t;
  ta.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(() => api('save-notes', { notes: ta.value }).catch(e => console.error(e)), 500);
  });
}
initNotes();
