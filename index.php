<?php ?>
<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WizardOS</title>
<link rel="icon" href="assets/favicon.ico" sizes="any">
<link rel="stylesheet" href="assets/98.css">
<link rel="stylesheet" href="assets/pixel-icons.css">
<link rel="stylesheet" href="assets/app.css">
</head>
<body>
<main id="desktop">
  <div id="desk-icons"></div>
  <section class="window" id="win-track">
    <div class="title-bar"><div class="title-bar-text">Trilha</div>
      <div class="title-bar-controls"><button aria-label="Minimize" class="wm-min"></button><button aria-label="Close" class="wm-close"></button></div></div>
    <div class="window-body"><ul class="item-list" data-cat="track"></ul>
      <button class="btn-add" data-cat="track"><i class="hn hn-plus"></i> adicionar</button>
    </div>
  </section>
  <section class="window" id="win-ambient">
    <div class="title-bar"><div class="title-bar-text">Ambiente</div>
      <div class="title-bar-controls"><button aria-label="Minimize" class="wm-min"></button><button aria-label="Close" class="wm-close"></button></div></div>
    <div class="window-body"><ul class="item-list" data-cat="ambient"></ul>
      <button class="btn-add" data-cat="ambient"><i class="hn hn-plus"></i> adicionar</button>
    </div>
  </section>
  <section class="window" id="win-sfx">
    <div class="title-bar"><div class="title-bar-text">Efeitos</div>
      <div class="title-bar-controls"><button aria-label="Minimize" class="wm-min"></button><button aria-label="Close" class="wm-close"></button></div></div>
    <div class="window-body"><ul class="sfx-grid" data-cat="sfx"></ul>
      <div class="sfx-actions">
        <button class="btn-add" data-cat="sfx"><i class="hn hn-plus"></i> adicionar</button>
        <button class="btn-delmode" data-cat="sfx"><i class="hn hn-trash"></i> remover</button>
      </div>
    </div>
  </section>
  <section class="window" id="win-timers">
    <div class="title-bar"><div class="title-bar-text">Timers</div>
      <div class="title-bar-controls"><button aria-label="Minimize" class="wm-min"></button><button aria-label="Close" class="wm-close"></button></div></div>
    <div class="window-body" id="timers"></div>
  </section>
  <section class="window" id="win-notes">
    <div class="title-bar"><div class="title-bar-text">Notas</div>
      <div class="title-bar-controls"><button aria-label="Minimize" class="wm-min"></button><button aria-label="Close" class="wm-close"></button></div></div>
    <div class="window-body"><textarea id="notes" placeholder="Anotações da mesa..."></textarea></div>
  </section>
  <section class="window" id="win-books">
    <div class="title-bar"><div class="title-bar-text">Livros</div>
      <div class="title-bar-controls"><button aria-label="Minimize" class="wm-min"></button><button aria-label="Close" class="wm-close"></button></div></div>
    <div class="window-body">
      <ul class="book-list"></ul>
      <button class="btn-add-book"><i class="hn hn-plus"></i> adicionar PDF</button>
      <input type="file" class="book-file" accept="application/pdf" hidden>
      <iframe class="book-view" title="Visualizador de PDF"></iframe>
    </div>
  </section>
</main>
<footer id="credits">Ta em desenvolvimento ainda pae</footer>
<div id="start-menu" hidden>
  <button data-act="export">Exportar config (.zip)</button>
  <button data-act="import">Importar config (.zip)</button>
  <button data-act="open-all">Abrir todas as janelas</button>
</div>
<input type="file" id="import-file" accept=".zip,application/zip" hidden>
<div id="taskbar">
  <button id="start-btn"><span class="win-flag"></span> Iniciar</button>
  <div id="dock"></div>
  <div id="tray"><span id="clock"></span></div>
</div>

<dialog id="add-dialog" class="window" style="padding:0;max-width:340px">
  <div class="title-bar"><div class="title-bar-text">Adicionar</div></div>
  <form method="dialog" class="window-body" id="add-form">
    <input type="hidden" name="category">
    <p class="field-row-stacked"><label>Título</label><input name="title" required></p>
    <p class="field-row-stacked"><label>Tipo</label>
      <select name="source">
        <option value="youtube">YouTube</option>
        <option value="mp3url">Link MP3 direto</option>
        <option value="mp3file">Upload MP3</option>
      </select></p>
    <p class="field-row-stacked" data-for="youtube mp3url"><label class="ref-label">Link</label>
      <input name="ref" class="ref-input"></p>
    <p class="field-row-stacked" data-for="mp3file" hidden><label>Arquivo MP3</label>
      <input type="file" name="file" accept="audio/mpeg"></p>
    <p class="err" style="color:#c00"></p>
    <menu style="display:flex;gap:8px;justify-content:flex-end">
      <button value="cancel" type="button" class="cancel">Cancelar</button>
      <button value="ok" type="submit">Adicionar</button>
    </menu>
  </form>
</dialog>

<div id="yt-hosts" style="position:absolute;left:-9999px;top:0"></div>
<script src="https://www.youtube.com/iframe_api"></script>
<script src="assets/core.js" defer></script>
<script src="assets/players.js" defer></script>
<script src="assets/ui.js" defer></script>
<script src="assets/wm.js" defer></script>
</body>
</html>
