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

  function renderDock() {
    dock.innerHTML = '';
    for (const win of wins) {
      if (!stOf(win.id).closed) continue;
      const b = document.createElement('button');
      b.textContent = win.querySelector('.title').textContent;
      b.onclick = () => { stOf(win.id).closed = false; save(); render(win); focus(win); };
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
})();
