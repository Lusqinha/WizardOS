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
<div class="menu-bar"><span class="apple"></span><span>RPG Soundboard</span></div>
<main id="desktop">
  <section class="window" id="win-track">
    <div class="title-bar"><h1 class="title">Trilha</h1></div>
    <div class="window-pane"><ul class="item-list" data-cat="track"></ul>
      <button class="btn-add" data-cat="track"><i class="hn hn-plus"></i> adicionar</button>
    </div>
  </section>
  <section class="window" id="win-ambient">
    <div class="title-bar"><h1 class="title">Ambiente</h1></div>
    <div class="window-pane"><ul class="item-list" data-cat="ambient"></ul>
      <button class="btn-add" data-cat="ambient"><i class="hn hn-plus"></i> adicionar</button>
    </div>
  </section>
  <section class="window" id="win-sfx">
    <div class="title-bar"><h1 class="title">Efeitos</h1></div>
    <div class="window-pane"><ul class="sfx-grid" data-cat="sfx"></ul>
      <button class="btn-add" data-cat="sfx"><i class="hn hn-plus"></i> adicionar</button>
    </div>
  </section>
  <section class="window" id="win-timers">
    <div class="title-bar"><h1 class="title">Timers</h1></div>
    <div class="window-pane" id="timers"></div>
  </section>
</main>
<footer id="credits">Pixel Icon Library — CC BY 4.0 (HackerNoon) · System.css — MIT</footer>
<!-- app.js adicionado na Task 3 -->
</body>
</html>
