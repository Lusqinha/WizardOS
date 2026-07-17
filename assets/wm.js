// Window manager: arrastar, focar, minimizar (windowshade) e fechar/reabrir (dock).
// Layout persistido em localStorage.
(() => {
  const WM_KEY = 'wizardos-wm';
  const desktop = document.getElementById('desktop');
  const dock = document.getElementById('dock');
  const wins = [...desktop.querySelectorAll('.window')];
  let z = 10;

  const DEFAULTS = {
    'win-track':   { x: 20,  y: 20 },
    'win-ambient': { x: 360, y: 20 },
    'win-sfx':     { x: 20,  y: 300 },
    'win-timers':  { x: 360, y: 300 },
    'win-notes':   { x: 700, y: 20 },
  };
  const APP_ICON = {
    'win-track':   'assets/icons/track.png',
    'win-ambient': 'assets/icons/ambient.png',
    'win-sfx':     'assets/icons/sfx.png',
    'win-timers':  'assets/icons/timers.png',
    'win-notes':   'assets/icons/notes.png',
    'win-books':   'assets/icons/books.png',
  };
  const TB_ICON = {
    'win-track':   'assets/icons/track-tb.png',
    'win-ambient': 'assets/icons/ambient-tb.png',
    'win-sfx':     'assets/icons/sfx-tb.png',
    'win-timers':  'assets/icons/timers-tb.png',
    'win-notes':   'assets/icons/notes-tb.png',
    'win-books':   'assets/icons/books-tb.png',
  };

  let layout;
  try { layout = JSON.parse(localStorage.getItem(WM_KEY)) || {}; } catch { layout = {}; }
  // Janelas comecam FECHADAS por padrao (abre pela dock / icones do desktop).
  const stOf = (id) => layout[id] || (layout[id] = { ...(DEFAULTS[id] || { x: 40, y: 40 }), closed: true });
  const save = () => localStorage.setItem(WM_KEY, JSON.stringify(layout));

  function render(win) {
    const st = stOf(win.id);
    win.style.left = st.x + 'px';
    win.style.top = st.y + 'px';
    win.classList.toggle('rolled', !!st.rolled);
    win.hidden = !!st.closed;
    renderDock();
  }

  function focus(win) { win.style.zIndex = ++z; }

  // dock = launcher fixo com todos os apps (icone + label); clique abre/foca
  function renderDock() {
    dock.innerHTML = '';
    for (const win of wins) {
      const st = stOf(win.id);
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'dock-app' + (st.closed ? '' : ' open');
      b.innerHTML = `<img class="dock-ico" src="${TB_ICON[win.id]}" alt=""><span>${win.querySelector('.title-bar-text').textContent}</span>`;
      b.onclick = () => { st.closed = false; st.rolled = false; save(); render(win); focus(win); };
      dock.appendChild(b);
    }
  }

  for (const win of wins) {
    const st = stOf(win.id);
    focus(win);
    win.addEventListener('pointerdown', () => focus(win));

    // icone na title-bar
    const tb = win.querySelector('.title-bar');
    if (APP_ICON[win.id] && !tb.querySelector('.title-ico')) {
      const im = document.createElement('img');
      im.className = 'title-ico'; im.src = APP_ICON[win.id]; im.alt = '';
      tb.insertBefore(im, tb.firstChild);
    }

    const bar = win.querySelector('.title-bar');
    bar.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return; // controles não arrastam
      const r = win.getBoundingClientRect();
      const dRect = desktop.getBoundingClientRect();
      const offX = e.clientX - r.left, offY = e.clientY - r.top;
      const move = (ev) => {
        st.x = Math.max(0, ev.clientX - dRect.left - offX);
        st.y = Math.max(0, ev.clientY - dRect.top - offY);
        win.style.left = st.x + 'px';
        win.style.top = st.y + 'px';
      };
      const up = () => {
        document.removeEventListener('pointermove', move);
        document.removeEventListener('pointerup', up);
        save();
      };
      document.addEventListener('pointermove', move);
      document.addEventListener('pointerup', up);
      e.preventDefault();
    });

    win.querySelector('.wm-min')?.addEventListener('click', () => {
      st.rolled = !st.rolled; save(); render(win);
    });
    win.querySelector('.wm-close')?.addEventListener('click', () => {
      st.closed = true; save(); render(win);
    });

    render(win);
  }

  // atalhos na area de trabalho
  const deskIcons = document.getElementById('desk-icons');
  if (deskIcons) for (const win of wins) {
    const b = document.createElement('button');
    b.className = 'desk-ico';
    b.type = 'button';
    b.innerHTML = `<img src="${APP_ICON[win.id]}" alt=""><span>${win.querySelector('.title-bar-text').textContent}</span>`;
    b.onclick = () => { stOf(win.id).closed = false; stOf(win.id).rolled = false; render(win); focus(win); };
    deskIcons.appendChild(b);
  }

  // botao Iniciar: abre/fecha o menu
  const startBtn = document.getElementById('start-btn');
  const startMenu = document.getElementById('start-menu');
  const importFile = document.getElementById('import-file');
  const openAll = () => {
    for (const win of wins) { stOf(win.id).closed = false; stOf(win.id).rolled = false; render(win); focus(win); }
    save();
  };
  if (startBtn && startMenu) {
    startBtn.addEventListener('click', (e) => { e.stopPropagation(); startMenu.hidden = !startMenu.hidden; });
    document.addEventListener('click', () => { startMenu.hidden = true; });
    startMenu.addEventListener('click', (e) => e.stopPropagation());
    startMenu.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      startMenu.hidden = true;
      const act = b.dataset.act;
      if (act === 'export') location.href = 'api.php?action=export';
      else if (act === 'import') importFile.click();
      else if (act === 'open-all') openAll();
    }));
  }
  if (importFile) importFile.addEventListener('change', async () => {
    if (!importFile.files[0]) return;
    const fd = new FormData();
    fd.append('file', importFile.files[0]);
    try {
      const res = await fetch('api.php?action=import', { method: 'POST', body: fd });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'erro');
      location.reload();
    } catch (ex) { alert('Falha ao importar: ' + ex.message); }
    importFile.value = '';
  });

  // relogio no tray da taskbar
  const clk = document.getElementById('clock');
  if (clk) {
    const WD = ['DOM','SEG','TER','QUA','QUI','SEX','SAB'];
    const p = (n) => String(n).padStart(2, '0');
    const upd = () => {
      const d = new Date();
      clk.textContent = `${WD[d.getDay()]} ${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}  ${p(d.getHours())}:${p(d.getMinutes())}`;
    };
    upd();
    setInterval(upd, 15000);
  }
})();
