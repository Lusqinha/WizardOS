// Window manager: arrastar, focar, minimizar (windowshade) e fechar/reabrir (dock).
// Layout persistido em localStorage.
(() => {
  const WM_KEY = 'rpg-wm';
  const desktop = document.getElementById('desktop');
  const dock = document.getElementById('dock');
  const wins = [...desktop.querySelectorAll('.window')];
  let z = 10;

  const DEFAULTS = {
    'win-track':   { x: 20,  y: 20 },
    'win-ambient': { x: 360, y: 20 },
    'win-sfx':     { x: 20,  y: 300 },
    'win-timers':  { x: 360, y: 300 },
  };
  const ICONS = {
    'win-track':   'hn-music-solid',
    'win-ambient': 'hn-cloud-rain-solid',
    'win-sfx':     'hn-bolt-solid',
    'win-timers':  'hn-clock-solid',
  };

  let layout;
  try { layout = JSON.parse(localStorage.getItem(WM_KEY)) || {}; } catch { layout = {}; }
  const stOf = (id) => layout[id] || (layout[id] = { ...(DEFAULTS[id] || { x: 40, y: 40 }) });
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
      b.innerHTML = `<i class="hn ${ICONS[win.id] || 'hn-square'}"></i><span>${win.querySelector('.title-bar-text').textContent}</span>`;
      b.onclick = () => { st.closed = false; st.rolled = false; save(); render(win); focus(win); };
      dock.appendChild(b);
    }
  }

  for (const win of wins) {
    const st = stOf(win.id);
    focus(win);
    win.addEventListener('pointerdown', () => focus(win));

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

  // relogio no menu-bar (estilo poolsuite)
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
