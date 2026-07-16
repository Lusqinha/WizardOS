# RPG Soundboard & Timers — Design

**Data:** 2026-07-16
**Objetivo:** App simples para mestre de RPG gerenciar trilhas sonoras, sons ambiente, efeitos sonoros e cronômetros — tudo numa dashboard única estilo sistema operacional retrô pixelado (vibe poolsuite.net).

## Escopo

Mestre precisa, durante a mesa, disparar áudio rápido e controlar tempo:

- **Trilha sonora**: música de fundo via embed do YouTube ou mp3 (link direto ou upload).
- **Ambiente**: sons em loop (chuva, taverna) via mp3/YT.
- **Efeitos (SFX)**: sons pontuais one-shot (porta, espada) — clique dispara.
- **Timers**: presets de 30min, 10min e 1h, independentes.

Tudo visível e acionável numa tela só ("dashboard única"), organizado em janelas por categoria.

### Fora de escopo (YAGNI — adicionar só se pedido)
- Drag/reposicionamento de janelas.
- Timer com duração customizada.
- Múltiplas playlists / ordenação / crossfade.
- Multiusuário / sincronização remota / autenticação.

## Arquitetura

App PHP local, sem build, sem dependências externas em runtime.

```
TTRPG-utils/
├── index.php          # dashboard single-page (HTML + CSS + JS inline ou em assets/)
├── api.php            # endpoints: list, add-link, upload, delete
├── data/
│   └── library.json   # biblioteca de itens (persistida)
├── uploads/           # mp3 enviados por upload
├── assets/
│   ├── system.css     # System.css (MIT) vendorizado local
│   ├── app.css        # tema/ajustes próprios
│   ├── app.js         # motor de áudio, timers, UI
│   ├── pixel-icons.css + fonte woff2   # Pixel Icon Library (CC BY 4.0)
│   └── fonts/         # (se usar VT323)
└── docs/
```

**Rodar:** `php -S localhost:8000` (ou hospedagem PHP). Sem Node, sem npm em runtime.

### api.php (backend fino)
JSON in/out. `library.json` é a fonte de verdade; sem banco.

| Ação | Método | Faz |
|------|--------|-----|
| `list` | GET | devolve `library.json` |
| `add-link` | POST | adiciona item YT ou mp3-url à biblioteca |
| `upload` | POST (multipart) | salva mp3 em `uploads/`, adiciona item |
| `delete` | POST | remove item (e arquivo em uploads/ se for upload) |

**Validação (não pular):**
- Upload: só `audio/mpeg` + extensão `.mp3`, limite de tamanho (ex. 30MB), nome sanitizado (uuid, não o nome original).
- `add-link`: validar que URL é http(s); extrair videoId do YT por regex.
- Escrita de `library.json` com lock (`LOCK_EX`) pra não corromper.
- `delete`: só remove arquivo dentro de `uploads/` (checar path traversal via basename/realpath).

## Modelo de dados

`library.json` = `{ "items": [ Item, ... ] }`

```
Item {
  id:       string   // uuid
  category: "track" | "ambient" | "sfx"
  source:   "youtube" | "mp3url" | "mp3file"
  title:    string
  ref:      string   // videoId (yt) | URL (mp3url) | caminho uploads/ (mp3file)
  loop:     bool      // default: true p/ ambient, false p/ resto
}
```

## Frontend — desktop OS retrô

Uma tela = o desktop (a dashboard única). Wallpaper pastel/dither em CSS. Quatro janelas fixas em grid, cada uma com title-bar System.css:

```
┌─ TRILHA ─────────┐  ┌─ AMBIENTE ───────┐
│ item ▶  [x]      │  │ item ▶ loop [x]  │
│ vol ----o----    │  │ vol --o------    │
│ [+ adicionar]    │  │ [+ adicionar]    │
└──────────────────┘  └──────────────────┘
┌─ EFEITOS ────────┐  ┌─ TIMERS ─────────┐
│ [chuva][porta]   │  │  30m   10m   1h  │
│ [espada][+]      │  │  25:14  ▶ ⏸ ⟳    │
└──────────────────┘  └──────────────────┘
```

- **+ adicionar**: abre janela-modal (dialog System.css) com form: título, tipo (YT/mp3-url/upload), campo respectivo.
- Ícones (play/pause/stop/loop/+/lixeira/relógio): Pixel Icon Library font.
- Crédito CC BY 4.0 no rodapé do desktop.

### Motor de áudio (camadas independentes)
Cada camada = player próprio + volume próprio; todas tocam simultâneas.

- **Trilha / Ambiente**:
  - mp3 (url ou file) → elemento `<audio>`; `loop` conforme item.
  - YouTube → YouTube IFrame API, um player por item ativo; `setVolume`, `playVideo`, `pauseVideo`.
  - Slider de volume por camada controla o player daquela camada.
  - Só um item toca por vez *dentro* de Trilha e dentro de Ambiente (tocar outro para o atual da mesma janela). Trilha, Ambiente e SFX entre si são independentes e simultâneos.
- **Efeitos (SFX)**: clique dispara one-shot (sem loop).
  - mp3 → nova instância `Audio(ref)` por clique; instâncias sobrepõem livremente.
  - YouTube → player IFrame próprio por SFX; clique faz `seekTo(0)` + `playVideo`. Sobreposição da *mesma* SFX-YT não é suportada (um iframe = uma instância); SFX diferentes sobrepõem normalmente. Latência de embed é aceita (mestre lida).

### Timers
Três presets independentes (30m/10m/1h). Cada timer:
- Estado: parado / rodando / pausado, tempo restante.
- Controles: start, pause, reset.
- Ao zerar: toca um beep/alerta curto (mp3 embutido em assets) e destaca visualmente.
- Base em `Date.now()` (guardar timestamp-alvo, não contar ticks — evita drift).

### Estética
- Base System.css (janelas, botões, fonte Chicago/Geneva pixel).
- `app.css`: wallpaper pastel + dither, título "RPG Soundboard" na barra de menu topo estilo Mac.
- Fonte pixel dos timers pode usar VT323 pra leitura grande de contador.
- Sem framework CSS além do System.css. Sem copiar assets do poolsuite (só emular o look).

## Persistência & estado
- Biblioteca (itens) → servidor (`library.json`) via api.php. Sobrevive a tudo.
- Estado efêmero (o que está tocando, volumes, timers rodando) → só em memória do navegador; não persiste ao recarregar (aceitável — mesa é sessão viva). Volumes podem opcionalmente ir pra `localStorage` (nice-to-have, não obrigatório).

## Tratamento de erro
- Upload rejeitado (tipo/tamanho) → mensagem no dialog, não quebra a página.
- mp3-url que não carrega → item mostra estado de erro ao dar play.
- api.php sempre responde JSON `{ok:bool, error?:string, ...}`; frontend exibe erro em dialog System.css.

## Testes / verificação
- `api.php`: um self-check simples (PHP CLI) que exercita add-link → list → delete num `library.json` temporário e afirma o resultado. Cobre a lógica de persistência/validação (path-traversal no delete/upload).
- Frontend: verificação manual dirigindo o fluxo (adicionar YT, adicionar mp3-url, upload, tocar camadas simultâneas, rodar timer até zerar).

## Assets & licenças
| Asset | Licença | Uso |
|-------|---------|-----|
| System.css | MIT | vendorizado em assets/ |
| Pixel Icon Library (HackerNoon) | CC BY 4.0 | font local; crédito no rodapé |
| VT323 (opcional) | OFL | woff2 local |
| Beep de timer | CC0 (Kenney/freesound CC0) | mp3 em assets/ |

Tudo local, sem CDN, roda offline com o servidor PHP.
