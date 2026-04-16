---
name: MiniMax MCP
description: Ferramentas MiniMax MCP — TTS, image, video, voice clone, music generation
trigger: /minimax
---

# MiniMax MCP Skill

Servidor MCP oficial MiniMax — tools de geração de conteúdo.

## Ferramentas Disponíveis

| Tool                     | Descrição                                     |
| ------------------------ | --------------------------------------------- |
| `text_to_audio`          | Converte texto em audio (TTS)                 |
| `play_audio`             | Reproduz ficheiro audio                       |
| `voice_clone`            | Clona voz de ficheiro audio                   |
| `text_to_image`          | Gera imagens a partir de texto                |
| `generate_video`         | Gera videos a partir de texto                 |
| `query_video_generation` | Consulta estado de geração de video           |
| `music_generation`       | Gera música a partir de prompt + lyrics       |
| `voice_design`           | Cria vozes customizadas a partir de descrição |

## Modelos TTS

- `speech-02-hd` (default) — alta qualidade
- `speech-02-turbo` — rápido
- `speech-01-hd` — alternativo HD
- `speech-01-turbo` — alternativo rápido

## Modelos Video

- `MiniMax-Hailuo-02` (default) — 6s ou 10s, 768P ou 1080P
- `T2V-01` — text to video
- `I2V-01` — image to video
- `S2V-01` — subject to video

## Idiomas Suportados (TTS Language Boost)

`Chinese`, `Chinese,Yue`, `English`, `Arabic`, `Russian`, `Spanish`, `French`, `Portuguese`, `German`, `Turkish`, `Dutch`, `Ukrainian`, `Vietnamese`, `Indonesian`, `Japanese`, `Italian`, `Korean`, `Thai`, `Polish`, `Romanian`, `Greek`, `Czech`, `Finnish`, `Hindi`, `auto`

## Usage

### TTS em Português

```
text_to_audio com:
- text: "Olá mundo"
- model: "speech-02-hd"
- voiceId: "male-qn-qingse" ou outro
- languageBoost: "Portuguese"
- format: "mp3"
```

### Gerar Imagem

```
text_to_image com:
- prompt: "a beautiful sunset over Lisbon"
- model: "image-01"
- aspectRatio: "16:9"
```

### Gerar Video

```
generate_video com:
- prompt: "a robot walking in a futuristic city"
- model: "MiniMax-Hailuo-02"
- duration: 6
- resolution: "1080P"
```

### Gerar Música

```
music_generation com:
- prompt: "Pop music, happy, upbeat"
- lyrics: "[Verse]\nHappy days are here\n\n[Chorus]\nLa la la la"
```

## Configuração

- **Wrapper**: `/home/will/.npm-global/bin/minimax-mcp-wrapper.sh`
- **Env**: MINIMAX_API_KEY de `/srv/monorepo/.env`
- **Transporte**: stdio (padrão Claude Code)

## Status

✅ MiniMax MCP instalado como servidor padrão
✅ API Key configurada via .env
