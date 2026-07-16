<?php // ponytail: index estático; PHP só pra manter tudo sob o mesmo servidor ?>
<!doctype html>
<html lang="pt-br">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>RPG Soundboard</title>
<link rel="stylesheet" href="assets/system.css">
<link rel="stylesheet" href="assets/pixel-icons.css">
<link rel="stylesheet" href="assets/app.css">
</head>
<body>
<div class="menu-bar"><span class="brand"><i class="hn hn-music-solid"></i> RPG Soundboard</span><span id="clock"></span></div>
<main id="desktop">
  <section class="window" id="win-track">
    <div class="title-bar"><h1 class="title">Trilha</h1>
      <div class="title-bar-controls"><button class="wm-min" aria-label="Minimize"></button><button class="wm-close" aria-label="Close"></button></div></div>
    <div class="window-pane"><ul class="item-list" data-cat="track"></ul>
      <button class="btn-add" data-cat="track"><i class="hn hn-plus"></i> adicionar</button>
    </div>
  </section>
  <section class="window" id="win-ambient">
    <div class="title-bar"><h1 class="title">Ambiente</h1>
      <div class="title-bar-controls"><button class="wm-min" aria-label="Minimize"></button><button class="wm-close" aria-label="Close"></button></div></div>
    <div class="window-pane"><ul class="item-list" data-cat="ambient"></ul>
      <button class="btn-add" data-cat="ambient"><i class="hn hn-plus"></i> adicionar</button>
    </div>
  </section>
  <section class="window" id="win-sfx">
    <div class="title-bar"><h1 class="title">Efeitos</h1>
      <div class="title-bar-controls"><button class="wm-min" aria-label="Minimize"></button><button class="wm-close" aria-label="Close"></button></div></div>
    <div class="window-pane"><ul class="sfx-grid" data-cat="sfx"></ul>
      <button class="btn-add" data-cat="sfx"><i class="hn hn-plus"></i> adicionar</button>
    </div>
  </section>
  <section class="window" id="win-timers">
    <div class="title-bar"><h1 class="title">Timers</h1>
      <div class="title-bar-controls"><button class="wm-min" aria-label="Minimize"></button><button class="wm-close" aria-label="Close"></button></div></div>
    <div class="window-pane" id="timers"></div>
  </section>
</main>
<div id="dock"></div>
<footer id="credits">Pixel Icon Library — CC BY 4.0 (HackerNoon) · System.css — MIT</footer>

<dialog id="add-dialog" class="window" style="padding:0;max-width:340px">
  <div class="title-bar"><h1 class="title">Adicionar</h1></div>
  <form method="dialog" class="window-pane" id="add-form">
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
<script src="assets/app.js" defer></script>
<script src="assets/wm.js" defer></script>
</body>
</html>
