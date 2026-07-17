// players — motor de áudio (Trilha/Ambiente) + Efeitos (SFX).

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
const sfxYtPlayers = {}; // id -> YT.Player (reutilizado; seek0 a cada clique; destruido ao deletar item)

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

// --- Livros (PDF): visualizador nativo do navegador via iframe ---
function renderBooks() {
  const ul = document.querySelector('.book-list');
  if (!ul) return;
  ul.innerHTML = '';
  for (const it of itemsOf('pdf')) {
    const li = document.createElement('li');
    li.innerHTML = `<button class="btn-book" title="Abrir">${escapeHtml(it.title)}</button>
      <button class="btn-del" title="remover"><i class="hn hn-trash"></i></button>`;
    li.querySelector('.btn-book').onclick = () => { document.querySelector('.book-view').src = srcOf(it); };
    li.querySelector('.btn-del').onclick = () => removeItem(it.id);
    ul.appendChild(li);
  }
  // se o livro aberto foi removido, fecha o viewer
  const view = document.querySelector('.book-view');
  const shown = view && view.getAttribute('src');
  if (shown && !itemsOf('pdf').some(it => srcOf(it) === shown)) view.removeAttribute('src');
}
