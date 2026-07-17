# WizardOS
<img width="2559" height="907" alt="image" src="https://github.com/user-attachments/assets/7887feda-92a1-4bc0-8be6-a51111926ec5" />

Soundboard + timers para mestre de RPG, estilo OS retrô pixelado.

## Rodar

```
mise install
mise exec -- php -d upload_max_filesize=256M -d post_max_size=256M -S localhost:8000
# abrir http://localhost:8000
```

Requer PHP (via mise). Sem build, sem dependências em runtime.
Única chamada externa: YouTube IFrame API (necessária pro embed de vídeos YT).

## Créditos
- System.css — MIT
- Pixel Icon Library (HackerNoon) — CC BY 4.0
