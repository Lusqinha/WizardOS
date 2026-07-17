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
  await api('delete', { id });
  await refresh();
}

// --- Helpers compartilhados ---
let ytReady = new Promise(r => { window.onYouTubeIframeAPIReady = r; });

function srcOf(item) {
  return item.source === 'mp3file' ? `uploads/${item.ref}` : item.ref;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

// --- Camadas de áudio (Trilha / Ambiente): um player por janela ---
class Layer {
  constructor(name) { this.name = name; this.audio = null; this.yt = null;
    this.currentId = null; this.volume = 0.8; this.paused = false; }

  async play(item) {
    this.stop();
    this.currentId = item.id; this.paused = false;
    if (item.source === 'youtube') {
      await ytReady;
      const host = document.createElement('div');
      document.getElementById('yt-hosts').appendChild(host);
      this.yt = new YT.Player(host, {
        videoId: item.ref,
        playerVars: { autoplay: 1, loop: item.loop ? 1 : 0, playlist: item.loop ? item.ref : undefined },
        events: { onReady: e => e.target.setVolume(this.volume * 100) },
      });
    } else {
      this.audio = new Audio(srcOf(item));
      this.audio.loop = item.loop;
      this.audio.volume = this.volume;
      this.audio.play().catch(e => console.error('play falhou', e));
    }
    renderTrackLike(this.name);
  }

  pauseToggle() {
    this.paused = !this.paused;
    if (this.yt) { this.paused ? this.yt.pauseVideo() : this.yt.playVideo(); }
    if (this.audio) { this.paused ? this.audio.pause() : this.audio.play(); }
    renderTrackLike(this.name);
  }

  setVolume(v) {
    this.volume = v;
    if (this.yt && this.yt.setVolume) this.yt.setVolume(v * 100);
    if (this.audio) this.audio.volume = v;
  }

  stop() {
    if (this.audio) { this.audio.pause(); this.audio = null; }
    if (this.yt) { this.yt.destroy(); this.yt = null; }
    this.currentId = null; this.paused = false;
  }
}

const layers = { track: new Layer('track'), ambient: new Layer('ambient') };

function renderTrackLike(cat) {
  const layer = layers[cat];
  const ul = document.querySelector(`.item-list[data-cat="${cat}"]`);
  ul.innerHTML = '';
  for (const it of itemsOf(cat)) {
    const li = document.createElement('li');
    const playing = layer.currentId === it.id;
    const icon = playing && !layer.paused ? 'hn-pause-solid' : 'hn-play-solid';
    li.innerHTML = `
      <button class="btn-play"><i class="hn ${icon}"></i></button>
      <span class="title-txt">${escapeHtml(it.title)}</span>
      <button class="btn-del"><i class="hn hn-trash"></i></button>`;
    li.querySelector('.btn-play').onclick = () =>
      playing ? layer.pauseToggle() : layer.play(it);
    li.querySelector('.btn-del').onclick = () => removeItem(it.id);
    ul.appendChild(li);
  }
  // slider de volume da janela (criado uma vez)
  const pane = ul.closest('.window-pane');
  let vol = pane.querySelector('.vol');
  if (!vol) {
    vol = document.createElement('input');
    vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.01;
    vol.value = layer.volume; vol.className = 'vol';
    vol.oninput = () => layer.setVolume(parseFloat(vol.value));
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

function renderSfx() {
  const ul = document.querySelector('.sfx-grid[data-cat="sfx"]');
  ul.innerHTML = '';
  for (const it of itemsOf('sfx')) {
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="btn-sfx">${escapeHtml(it.title)}</button>
      <button class="btn-del" title="remover"><i class="hn hn-trash"></i></button>`;
    li.querySelector('.btn-sfx').onclick = () => playSfx(it);
    li.querySelector('.btn-del').onclick = () => removeItem(it.id);
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
