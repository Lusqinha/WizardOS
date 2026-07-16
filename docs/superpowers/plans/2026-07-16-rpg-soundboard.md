# RPG Soundboard & Timers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dashboard PHP estilo OS retrô pixelado onde um mestre de RPG gerencia trilhas (YT/mp3), sons ambiente em loop, efeitos one-shot e cronômetros, tudo numa tela só.

**Architecture:** `index.php` serve uma single-page (desktop com 4 janelas System.css). `api.php` é um backend fino que persiste a biblioteca em `data/library.json` e mp3 enviados em `uploads/`. Toda lógica de áudio/timer roda no navegador (`assets/app.js`): camadas de áudio independentes (mp3 via `<audio>`, YouTube via IFrame API).

**Tech Stack:** PHP 8.5 (via mise), JS vanilla (sem build), System.css (janelas), Pixel Icon Library (ícones), YouTube IFrame API.

## Global Constraints

- **Runtimes via mise:** todo comando PHP/Node roda com `mise exec -- php ...`. Nunca assumir `php` global no PATH.
- **Sem build, sem dependências em runtime:** nada de npm/composer no runtime. Assets (System.css, ícones, fontes) são vendorizados em `assets/`.
- **Sem CDN:** tudo local, funciona offline com o servidor PHP. Exceção única: `https://www.youtube.com/iframe_api` (necessário pro embed YT).
- **api.php responde sempre JSON:** `{"ok": true, ...}` ou `{"ok": false, "error": "..."}`.
- **Segurança de upload:** só `audio/mpeg`, ≤30MB, nome gerado (uuid), nunca o nome do cliente. `delete` só remove dentro de `uploads/` (checar realpath).
- **Item schema:** `{id, category: "track"|"ambient"|"sfx", source: "youtube"|"mp3url"|"mp3file", title, ref, loop}`. `ref` = videoId (yt) | URL (mp3url) | nome-de-arquivo em uploads/ (mp3file).
- **Licenças/atribuição:** crédito "Pixel Icon Library — CC BY 4.0 / HackerNoon" e "System.css — MIT" no rodapé.

---

## File Structure

- `mise.toml` — pina php (e node p/ tooling opcional).
- `index.php` — HTML da dashboard; inclui o desktop e as 4 janelas.
- `api.php` — router HTTP + funções puras de lógica (`add_link`, `delete_item`, `validate_upload`, `record_file`, `load`, `save`, `yt_id`, `uuid`).
- `test_api.php` — self-check CLI (assert-based) das funções puras de `api.php`.
- `data/library.json` — biblioteca (criado no primeiro save; `.gitkeep` no dir).
- `uploads/` — mp3 enviados (`.gitkeep`).
- `assets/system.css` — System.css vendorizado (MIT).
- `assets/pixel-icons.css` + `assets/fonts/pixel-icons.woff2` — Pixel Icon Library.
- `assets/app.css` — tema/wallpaper/layout do desktop.
- `assets/app.js` — data-fetch, render das janelas, motor de áudio, SFX, timers, dialog de adicionar.
- `assets/beep.mp3` — alerta de timer (CC0).
- `README.md` — como rodar.

---

## Task 1: Scaffold + assets vendorizados

**Files:**
- Create: `mise.toml`, `index.php`, `assets/app.css`, `assets/system.css`, `assets/pixel-icons.css`, `assets/fonts/pixel-icons.woff2`, `assets/beep.mp3`, `data/.gitkeep`, `uploads/.gitkeep`, `README.md`

**Interfaces:**
- Produces: uma página servível que mostra o desktop com 4 janelas vazias e o rodapé de atribuição. `assets/app.js` ainda não existe (adicionado na Task 3).

- [ ] **Step 1: Pin runtime com mise**

`mise.toml`:
```toml
[tools]
php = "8.5"
```
Run: `mise install` e depois `mise exec -- php -v` → espera `PHP 8.5.x`.

- [ ] **Step 2: Vendorizar System.css**

Baixar o CSS (release MIT do projeto System.css) para `assets/system.css`:
```bash
curl -fsSL https://unpkg.com/@sakun/system.css/dist/system.css -o assets/system.css
```
(Se offline, copiar o arquivo manualmente. É MIT; pode versionar.)

- [ ] **Step 3: Vendorizar Pixel Icon Library**

Baixar o bundle do `@hackernoon/pixel-icon-library` (CC BY 4.0). Extrair o CSS da font e o `.woff2`:
```bash
curl -fsSL https://unpkg.com/@hackernoon/pixel-icon-library/fonts/iconfont.css -o assets/pixel-icons.css
curl -fsSL https://unpkg.com/@hackernoon/pixel-icon-library/fonts/HackerNoon.woff2 -o assets/fonts/pixel-icons.woff2
```
Editar `assets/pixel-icons.css` pra o `src:` apontar `url("fonts/pixel-icons.woff2")`. Confirmar classes de mídia existem (ex. `hn-play`, `hn-pause`, `hn-plus`, `hn-trash`, `hn-clock`, `hn-redo`). Se algum nome divergir, ajustar os usos nas Tasks 3/4/5/7.

- [ ] **Step 4: Beep CC0**

Colocar um mp3 curto CC0 em `assets/beep.mp3` (ex. de kenney.nl ou freesound CC0). Qualquer bipe ≤1s serve.

- [ ] **Step 5: index.php — shell do desktop**

`index.php`:
```php
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
```

- [ ] **Step 6: assets/app.css — layout do desktop**

`assets/app.css`:
```css
:root { --wall: #6c8ab0; }
* { box-sizing: border-box; }
body { margin: 0; min-height: 100vh; background: var(--wall);
  image-rendering: pixelated; font-family: "Geneva", "Chicago", monospace; }
.menu-bar { background:#fff; border-bottom:2px solid #000; padding:2px 10px;
  display:flex; gap:14px; font-weight:bold; position:sticky; top:0; z-index:10; }
#desktop { display:grid; grid-template-columns:repeat(2,minmax(280px,1fr));
  gap:18px; padding:18px; max-width:900px; margin:0 auto; }
.window-pane { padding:10px; }
.item-list { list-style:none; margin:0 0 8px; padding:0; }
.item-list li { display:flex; align-items:center; gap:6px; padding:3px 0;
  border-bottom:1px dotted #000; }
.item-list .title-txt { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.vol { width:100%; }
.sfx-grid { list-style:none; margin:0 0 8px; padding:0;
  display:grid; grid-template-columns:repeat(3,1fr); gap:6px; }
.sfx-grid li { display:flex; gap:2px; }
.sfx-grid .btn-sfx { flex:1; }
.timer { text-align:center; margin-bottom:10px; }
.timer .readout { font-size:2rem; font-family:"VT323",monospace; }
.timer.done .readout { color:#c00; animation:blink .5s steps(1) infinite; }
@keyframes blink { 50% { opacity:0; } }
#credits { text-align:center; font-size:11px; padding:8px; color:#fff; }
@media (max-width:640px){ #desktop{ grid-template-columns:1fr; } }
```

- [ ] **Step 7: README + rodar**

`README.md` com:
```
mise install
mise exec -- php -S localhost:8000
# abrir http://localhost:8000
```

- [ ] **Step 8: Verificar visual**

Run: `mise exec -- php -S localhost:8000` e abrir no navegador.
Espera: 4 janelas estilo Mac clássico em grid 2×2, title-bars, botões "+ adicionar", rodapé de crédito. Sem erros no console (app.js ainda não incluído).

- [ ] **Step 9: Commit**

```bash
git init 2>/dev/null; git add -A
git commit -m "scaffold: desktop shell, vendored System.css + pixel icons"
```

---

## Task 2: api.php — biblioteca (lógica pura + router) com self-check CLI

**Files:**
- Create: `api.php`, `test_api.php`

**Interfaces:**
- Produces (funções puras, usadas pelo router e pelo teste):
  - `load(string $path): array` → `['items'=>[...]]`
  - `save(string $path, array $data): void`
  - `uuid(): string`
  - `yt_id(string $url): ?string`
  - `add_link(array $lib, array $in): array` (throws `ApiError`)
  - `validate_upload(array $file, int $max): void` (throws `ApiError`)
  - `record_file(array $lib, string $cat, string $title, string $filename): array`
  - `delete_item(array $lib, string $id, string $uploadsDir): array`
- Produces (HTTP, consumido por `app.js` na Task 3):
  - `GET  api.php?action=list` → `{ok:true, items:[...]}`
  - `POST api.php?action=add-link` (JSON body) → `{ok:true, item:{...}}`
  - `POST api.php?action=upload` (multipart: `file`, `category`, `title`) → `{ok:true, item:{...}}`
  - `POST api.php?action=delete` (JSON body `{id}`) → `{ok:true}`

- [ ] **Step 1: Escrever o teste que falha**

`test_api.php`:
```php
<?php
declare(strict_types=1);
require __DIR__ . '/api.php';

function check(bool $cond, string $msg): void {
  if (!$cond) { fwrite(STDERR, "FAIL: $msg\n"); exit(1); }
  echo "ok: $msg\n";
}

// yt_id extrai videoId de formatos variados
check(yt_id('https://www.youtube.com/watch?v=dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'yt watch url');
check(yt_id('https://youtu.be/dQw4w9WgXcQ') === 'dQw4w9WgXcQ', 'yt short url');
check(yt_id('nao-e-url') === null, 'yt invalido vira null');

$lib = ['items' => []];

// add_link youtube
$lib = add_link($lib, ['category'=>'track','source'=>'youtube','title'=>'Batalha','ref'=>'https://youtu.be/dQw4w9WgXcQ']);
check(count($lib['items']) === 1, 'add_link adiciona item');
check($lib['items'][0]['ref'] === 'dQw4w9WgXcQ', 'add_link guarda videoId');
check($lib['items'][0]['loop'] === false, 'track nao faz loop');

// add_link ambient => loop true
$lib = add_link($lib, ['category'=>'ambient','source'=>'mp3url','title'=>'Chuva','ref'=>'https://x/y.mp3']);
check($lib['items'][1]['loop'] === true, 'ambient faz loop por padrao');

// add_link rejeita categoria invalida
try { add_link($lib, ['category'=>'x','source'=>'mp3url','title'=>'t','ref'=>'https://a.mp3']); check(false,'deveria lancar'); }
catch (ApiError $e) { check(true, 'categoria invalida rejeitada'); }

// add_link rejeita mp3url sem http
try { add_link($lib, ['category'=>'sfx','source'=>'mp3url','title'=>'t','ref'=>'ftp://a.mp3']); check(false,'deveria lancar'); }
catch (ApiError $e) { check(true, 'mp3url nao-http rejeitada'); }

// validate_upload rejeita nao-mp3
try { validate_upload(['error'=>0,'size'=>10,'tmp_name'=>__FILE__], 30*1024*1024); check(false,'deveria lancar'); }
catch (ApiError $e) { check(true, 'nao-mp3 rejeitado'); }

// record_file adiciona item mp3file com filename
$lib = record_file($lib, 'sfx', 'Porta', 'abc123.mp3');
$last = end($lib['items']);
check($last['source']==='mp3file' && $last['ref']==='abc123.mp3', 'record_file guarda filename');

// delete_item remove por id
$id = $lib['items'][0]['id'];
$before = count($lib['items']);
$lib = delete_item($lib, $id, sys_get_temp_dir());
check(count($lib['items']) === $before-1, 'delete_item remove');

// save/load round-trip
$tmp = tempnam(sys_get_temp_dir(),'lib');
save($tmp, $lib);
check(load($tmp) == $lib, 'save/load round-trip');
unlink($tmp);

echo "\nTODOS OS TESTES PASSARAM\n";
```

- [ ] **Step 2: Rodar o teste — deve falhar**

Run: `mise exec -- php test_api.php`
Espera: erro fatal (`require api.php` falha / funções indefinidas). Confirma que o teste ainda não passa.

- [ ] **Step 3: Implementar api.php**

`api.php`:
```php
<?php
declare(strict_types=1);

class ApiError extends Exception {}

const MAX_UPLOAD = 30 * 1024 * 1024;
const CATEGORIES = ['track', 'ambient', 'sfx'];

function uuid(): string { return bin2hex(random_bytes(8)); }

function yt_id(string $url): ?string {
  if (preg_match('~(?:youtube\.com/(?:watch\?v=|embed/|shorts/)|youtu\.be/)([\w-]{11})~', $url, $m)) return $m[1];
  if (preg_match('~^[\w-]{11}$~', $url)) return $url;
  return null;
}

function load(string $path): array {
  if (!is_file($path)) return ['items' => []];
  $j = json_decode((string)file_get_contents($path), true);
  return is_array($j) && isset($j['items']) && is_array($j['items']) ? $j : ['items' => []];
}

function save(string $path, array $data): void {
  file_put_contents($path, json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function add_link(array $lib, array $in): array {
  $cat = (string)($in['category'] ?? '');
  if (!in_array($cat, CATEGORIES, true)) throw new ApiError('categoria invalida');
  $title = trim((string)($in['title'] ?? ''));
  if ($title === '') throw new ApiError('titulo vazio');
  $src = (string)($in['source'] ?? '');
  if ($src === 'youtube') {
    $ref = yt_id((string)($in['ref'] ?? ''));
    if ($ref === null) throw new ApiError('link do YouTube invalido');
  } elseif ($src === 'mp3url') {
    $ref = (string)($in['ref'] ?? '');
    if (!preg_match('~^https?://~i', $ref)) throw new ApiError('URL de mp3 invalida');
  } else {
    throw new ApiError('source invalido para link');
  }
  $lib['items'][] = [
    'id' => uuid(), 'category' => $cat, 'source' => $src,
    'title' => $title, 'ref' => $ref, 'loop' => $cat === 'ambient',
  ];
  return $lib;
}

function validate_upload(array $file, int $max): void {
  if ((int)($file['error'] ?? 1) !== UPLOAD_ERR_OK) throw new ApiError('falha no upload');
  if ((int)($file['size'] ?? 0) > $max) throw new ApiError('arquivo grande demais (max 30MB)');
  $mime = (new finfo(FILEINFO_MIME_TYPE))->file((string)$file['tmp_name']);
  if ($mime !== 'audio/mpeg') throw new ApiError('so arquivos mp3');
}

function record_file(array $lib, string $cat, string $title, string $filename): array {
  if (!in_array($cat, CATEGORIES, true)) throw new ApiError('categoria invalida');
  $title = trim($title);
  if ($title === '') throw new ApiError('titulo vazio');
  $lib['items'][] = [
    'id' => uuid(), 'category' => $cat, 'source' => 'mp3file',
    'title' => $title, 'ref' => $filename, 'loop' => $cat === 'ambient',
  ];
  return $lib;
}

function delete_item(array $lib, string $id, string $uploadsDir): array {
  $kept = [];
  foreach ($lib['items'] as $it) {
    if (($it['id'] ?? null) === $id) {
      if (($it['source'] ?? '') === 'mp3file') {
        $f = $uploadsDir . '/' . basename((string)$it['ref']);
        $real = realpath($f);
        if ($real !== false && str_starts_with($real, (string)realpath($uploadsDir))) @unlink($real);
      }
      continue;
    }
    $kept[] = $it;
  }
  $lib['items'] = array_values($kept);
  return $lib;
}

// --- Router HTTP (so quando servido, nao no include do teste) ---
if (PHP_SAPI !== 'cli') {
  header('Content-Type: application/json; charset=utf-8');
  $DATA = __DIR__ . '/data/library.json';
  $UPLOADS = __DIR__ . '/uploads';
  $action = $_GET['action'] ?? '';

  $respond = fn(array $p) => print(json_encode($p, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
  try {
    $lib = load($DATA);
    switch ($action) {
      case 'list':
        $respond(['ok' => true, 'items' => $lib['items']]);
        break;
      case 'add-link':
        $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $lib = add_link($lib, $in);
        save($DATA, $lib);
        $respond(['ok' => true, 'item' => end($lib['items'])]);
        break;
      case 'upload':
        if (!isset($_FILES['file'])) throw new ApiError('sem arquivo');
        validate_upload($_FILES['file'], MAX_UPLOAD);
        if (!is_dir($UPLOADS)) mkdir($UPLOADS, 0775, true);
        $name = uuid() . '.mp3';
        if (!move_uploaded_file($_FILES['file']['tmp_name'], "$UPLOADS/$name")) throw new ApiError('nao salvou o arquivo');
        $lib = record_file($lib, (string)($_POST['category'] ?? ''), (string)($_POST['title'] ?? ''), $name);
        save($DATA, $lib);
        $respond(['ok' => true, 'item' => end($lib['items'])]);
        break;
      case 'delete':
        $in = json_decode((string)file_get_contents('php://input'), true) ?: [];
        $lib = delete_item($lib, (string)($in['id'] ?? ''), $UPLOADS);
        save($DATA, $lib);
        $respond(['ok' => true]);
        break;
      default:
        http_response_code(404);
        $respond(['ok' => false, 'error' => 'acao desconhecida']);
    }
  } catch (ApiError $e) {
    http_response_code(400);
    $respond(['ok' => false, 'error' => $e->getMessage()]);
  } catch (Throwable $e) {
    http_response_code(500);
    $respond(['ok' => false, 'error' => 'erro interno']);
  }
}
```

- [ ] **Step 4: Rodar o teste — deve passar**

Run: `mise exec -- php test_api.php`
Espera: várias linhas `ok:` e `TODOS OS TESTES PASSARAM`, exit 0.

- [ ] **Step 5: Smoke test do router HTTP**

Run (com `mise exec -- php -S localhost:8000` em outro terminal):
```bash
curl -s "localhost:8000/api.php?action=add-link" -d '{"category":"track","source":"youtube","title":"Teste","ref":"https://youtu.be/dQw4w9WgXcQ"}'
curl -s "localhost:8000/api.php?action=list"
```
Espera: 1º devolve `{"ok":true,"item":{...}}`; 2º lista o item. Confere que `data/library.json` foi criado.

- [ ] **Step 6: Commit**

```bash
git add api.php test_api.php data/library.json
git commit -m "feat: api.php library CRUD with CLI self-check"
```

---

## Task 3: Frontend data layer — carregar e renderizar itens

**Files:**
- Create: `assets/app.js`
- Modify: `index.php` (trocar o comentário por `<script src="assets/app.js" defer></script>`)

**Interfaces:**
- Consumes: `GET api.php?action=list`, `POST .../delete`.
- Produces (globais em `app.js`, usadas pelas Tasks 4-7):
  - `state.items` — array de itens carregados.
  - `api(action, body)` → `Promise<object>` (fetch wrapper, lança em `ok:false`).
  - `itemsOf(cat)` → itens filtrados por categoria.
  - `refresh()` → recarrega `state.items` e re-renderiza todas as janelas.
  - `removeItem(id)` → delete + refresh.
  - `renderTrackLike(cat)`, `renderSfx()` — placeholders aqui; corpo real nas Tasks 4/5.
  - `openAddDialog(cat)` — placeholder aqui; real na Task 6.

- [ ] **Step 1: Esqueleto do app.js — fetch + render de lista**

`assets/app.js`:
```js
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

// placeholders — corpo completo nas Tasks 4/5/6
function renderTrackLike(cat) {}
function renderSfx() {}
function openAddDialog(cat) { alert('dialog na Task 6: ' + cat); }

document.querySelectorAll('.btn-add').forEach(b =>
  b.addEventListener('click', () => openAddDialog(b.dataset.cat)));

refresh().catch(e => console.error(e));
```

- [ ] **Step 2: Incluir o script no index.php**

Modify `index.php`: trocar o comentário `<!-- app.js adicionado na Task 3 -->` por:
```html
<script src="assets/app.js" defer></script>
```

- [ ] **Step 3: Verificar carregamento**

Com o item de teste criado na Task 2, recarregar a página.
Espera: sem erros no console; `state.items` populado (checar via `console.log` ou DevTools). Janelas ainda vazias (render é placeholder) — ok. Clicar "+ adicionar" mostra o alert temporário.

- [ ] **Step 4: Commit**

```bash
git add assets/app.js index.php
git commit -m "feat: frontend data layer (list/refresh/delete)"
```

---

## Task 4: Motor de áudio — camadas Trilha e Ambiente

**Files:**
- Modify: `assets/app.js`, `index.php` (carregar YouTube IFrame API + host de players)

**Interfaces:**
- Consumes: `state.items`, `itemsOf(cat)`, `removeItem(id)`.
- Produces:
  - `srcOf(item)` → URL de áudio (`uploads/<ref>` p/ mp3file, senão `ref`).
  - `escapeHtml(s)` → string escapada.
  - `class Layer { play(item); pauseToggle(); setVolume(v); stop(); }`.
  - `layers` = `{ track: Layer, ambient: Layer }`.
  - `renderTrackLike(cat)` — corpo completo (substitui o placeholder da Task 3).
  - Regra: `play` para o item anterior da mesma Layer (um por vez por janela).

- [ ] **Step 1: Carregar YouTube IFrame API + host de players**

Modify `index.php`: antes de `<script src="assets/app.js" defer></script>`, adicionar:
```html
<div id="yt-hosts" style="position:absolute;left:-9999px;top:0"></div>
<script src="https://www.youtube.com/iframe_api"></script>
```
(É a única exceção de CDN — necessária pro embed. Documentar no README.)

- [ ] **Step 2: Implementar a classe Layer**

Adicionar em `assets/app.js` (antes do placeholder `renderTrackLike`):
```js
// Espera a YT IFrame API ficar pronta
let ytReady = new Promise(r => { window.onYouTubeIframeAPIReady = r; });

function srcOf(item) {
  return item.source === 'mp3file' ? `uploads/${item.ref}` : item.ref;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

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
```

- [ ] **Step 3: Implementar renderTrackLike**

Substituir o placeholder `function renderTrackLike(cat) {}` em `assets/app.js`:
```js
function renderTrackLike(cat) {
  const layer = layers[cat];
  const ul = document.querySelector(`.item-list[data-cat="${cat}"]`);
  ul.innerHTML = '';
  for (const it of itemsOf(cat)) {
    const li = document.createElement('li');
    const playing = layer.currentId === it.id;
    const icon = playing && !layer.paused ? 'hn-pause' : 'hn-play';
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
```

- [ ] **Step 4: Verificação manual — camadas simultâneas**

Adicionar (via UI da Task 6, ou temporariamente via curl na api) 1 item YT em Trilha e 1 mp3-url em Ambiente. Recarregar.
Espera:
- Play na Trilha toca o YT; play no Ambiente toca o mp3 **ao mesmo tempo** (as duas camadas soam juntas).
- Sliders ajustam volume de cada camada de forma independente.
- Play num segundo item da mesma janela para o primeiro.
- Botão vira pause enquanto toca; pause/retoma funciona.
- Lixeira remove e para se estava tocando.

- [ ] **Step 5: Commit**

```bash
git add assets/app.js index.php
git commit -m "feat: audio layers (track/ambient) with YT + mp3 and per-layer volume"
```

---

## Task 5: Efeitos (SFX) — one-shot mp3 sobreposto + YT seek0

**Files:**
- Modify: `assets/app.js`

**Interfaces:**
- Consumes: `itemsOf('sfx')`, `srcOf(item)`, `removeItem(id)`, `ytReady`, `escapeHtml`.
- Produces: `playSfx(item)` — dispara one-shot; `renderSfx()` — corpo completo (substitui placeholder da Task 3).

- [ ] **Step 1: Implementar playSfx + renderSfx**

Substituir o placeholder `function renderSfx() {}` em `assets/app.js`:
```js
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
```

- [ ] **Step 2: Verificação manual**

Adicionar 2 SFX (um mp3-url curto, um YT). Recarregar.
Espera:
- Clicar num SFX mp3 várias vezes rápido → instâncias **sobrepõem**.
- Clicar no SFX YT → toca; clicar de novo → reinicia do zero (seek 0).
- SFX toca por cima da Trilha/Ambiente sem pará-las.

- [ ] **Step 3: Commit**

```bash
git add assets/app.js
git commit -m "feat: SFX layer (mp3 overlap + YT seek0)"
```

---

## Task 6: Dialog "adicionar item"

**Files:**
- Modify: `index.php` (markup do `<dialog>`), `assets/app.js` (`openAddDialog` real)

**Interfaces:**
- Consumes: `api('add-link', body)`, upload via `api('upload', FormData)`, `refresh()`.
- Produces: `openAddDialog(cat)` real (substitui o placeholder alert da Task 3).

- [ ] **Step 1: Markup do dialog no index.php**

Adicionar antes de `<div id="yt-hosts" ...>` (ou antes de `</body>`):
```html
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
```

- [ ] **Step 2: Implementar openAddDialog**

Substituir o placeholder `function openAddDialog(cat) { alert(...); }` em `assets/app.js`:
```js
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
```
Nota: este bloco referencia `#add-dialog`/`#add-form`, que agora existem (Step 1). Manter este código **depois** que o DOM carrega — `app.js` está com `defer`, então roda após o parse do HTML.

- [ ] **Step 3: Verificação manual — todos os fluxos de adicionar**

Espera:
- "+ adicionar" em cada janela abre o dialog com a categoria certa.
- Tipo YouTube → campo "Link YouTube"; salvar cria item e aparece na janela.
- Tipo Link MP3 → campo "URL do MP3"; salvar funciona.
- Tipo Upload → campo de arquivo; enviar mp3 salva em `uploads/` e aparece.
- Enviar não-mp3 ou vazio → mensagem de erro vermelha no dialog, sem quebrar a página.
- Cancelar fecha sem adicionar.

- [ ] **Step 4: Commit**

```bash
git add index.php assets/app.js
git commit -m "feat: add-item dialog (YT / mp3-url / upload)"
```

---

## Task 7: Timers 30m/10m/1h

**Files:**
- Modify: `assets/app.js`

**Interfaces:**
- Consumes: `assets/beep.mp3`, elemento `#timers`.
- Produces: `initTimers()` chamado no boot; três timers independentes com start/pause/reset.

- [ ] **Step 1: Implementar timers baseados em Date.now()**

Adicionar em `assets/app.js`:
```js
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

function makeTimer(preset) {
  const el = document.createElement('div');
  el.className = 'timer';
  el.innerHTML = `
    <div class="readout">${fmt(preset.ms)}</div>
    <div>${preset.label}</div>
    <button class="t-start"><i class="hn hn-play"></i></button>
    <button class="t-pause"><i class="hn hn-pause"></i></button>
    <button class="t-reset"><i class="hn hn-redo"></i></button>`;
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
    new Audio('assets/beep.mp3').play().catch(() => {});
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
  return el;
}

function initTimers() {
  const host = document.getElementById('timers');
  TIMER_PRESETS.forEach(p => host.appendChild(makeTimer(p)));
}
initTimers();
```
(Se a classe do ícone de reset não for `hn-redo`, ajustar pro nome real confirmado na Task 1 Step 3.)

- [ ] **Step 2: Verificação manual**

Espera:
- Três timers (30m/10m/1h), cada um start/pause/reset independentes.
- Start conta pra baixo; pause congela; start retoma de onde parou; reset volta ao preset.
- Deixar um preset curto zerar (temporariamente trocar `30 * 60000` por `3000` p/ testar) → toca beep + pisca vermelho. Reverter o valor depois.
- Rodar dois timers ao mesmo tempo funciona.

- [ ] **Step 3: Commit**

```bash
git add assets/app.js
git commit -m "feat: 30m/10m/1h countdown timers with beep alert"
```

---

## Task 8: Polish visual + verificação end-to-end

**Files:**
- Modify: `assets/app.css`, `README.md`

**Interfaces:** nenhuma nova — ajuste estético e verificação final.

- [ ] **Step 1: Ajustes de tema**

Refinar `assets/app.css`: wallpaper com padrão dither (repeating-linear-gradient), espaçamento das janelas, tamanho dos botões de ícone, fonte VT323 nos timers (`@font-face` local se baixado, senão o fallback monospace já definido). Manter fiel ao look System 6/poolsuite (pastel, bordas duras 1-2px pretas, sombras sólidas sem blur).

- [ ] **Step 2: Rodar o self-check de novo (regressão)**

Run: `mise exec -- php test_api.php`
Espera: `TODOS OS TESTES PASSARAM`.

- [ ] **Step 3: Verificação end-to-end completa**

Com `mise exec -- php -S localhost:8000`, percorrer:
1. Adicionar trilha YT + tocar.
2. Adicionar ambiente mp3-url em loop + tocar simultâneo com a trilha.
3. Ajustar volumes independentes.
4. Upload de mp3 como SFX + disparar sobreposto.
5. Adicionar SFX YT + disparar.
6. Rodar timer de 10min, pausar, resetar.
7. Remover um item de cada janela.
8. Recarregar a página → biblioteca persiste (itens continuam lá).
Espera: todos os passos funcionam; sem erros no console; rodapé de atribuição visível.

- [ ] **Step 4: Commit final**

```bash
git add -A
git commit -m "polish: retro OS theme + end-to-end verification"
```

---

## Self-Review (autor)

**Cobertura do spec:**
- Trilha YT/mp3 → Task 4.
- Ambiente loop → Task 4 (loop=true default; `<audio>.loop` / YT playlist-loop).
- SFX one-shot mp3 sobreposto + YT seek0 → Task 5.
- Upload mp3 + link direto + link YT → Task 6 (dialog) + Task 2 (api).
- Timers 30/10/60 min → Task 7.
- Dashboard única com janelas por categoria → Task 1.
- Estética OS retrô pixel (System.css + Pixel Icons) → Task 1 + Task 8.
- Camadas simultâneas com volume independente → Task 4.
- Persistência da biblioteca / validação / path-traversal → Task 2.
- Atribuição de licença → Task 1 (rodapé) + README.

**Consistência de tipos:** `Layer.play/pauseToggle/setVolume/stop`, `srcOf`, `itemsOf`, `api`, `refresh`, `removeItem`, `renderTrackLike`, `renderSfx`, `openAddDialog`, `escapeHtml`, `playSfx` — nomes usados de forma idêntica entre tasks. Placeholders da Task 3 substituídos explicitamente nas Tasks 4/5/6. Ícones dependem dos nomes reais confirmados na Task 1 Step 3 (fallback anotado onde divergir).

**Placeholders:** nenhum "TODO/TBD" pendente.
