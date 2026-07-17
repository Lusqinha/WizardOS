// ui — dialog "adicionar", timers, notas, e boot da aplicacao.

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

// --- Timers ---
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
    if (targetAt) return;
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

// --- Notas: carrega do servidor e autosalva (debounced) — vao junto no export ---
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

// --- Livros: upload de PDF ---
function initBooks() {
  const btn = document.querySelector('.btn-add-book');
  const file = document.querySelector('.book-file');
  if (!btn || !file) return;
  btn.onclick = () => file.click();
  file.addEventListener('change', async () => {
    if (!file.files[0]) return;
    const fd = new FormData();
    fd.append('title', file.files[0].name.replace(/\.pdf$/i, ''));
    fd.append('file', file.files[0]);
    try { await api('upload-pdf', fd); await refresh(); }
    catch (ex) { alert('Falha ao enviar PDF: ' + ex.message); }
    file.value = '';
  });
}

// --- Boot ---
initSfxDelete();
initTimers();
initNotes();
initBooks();
refresh().catch(e => console.error(e));
