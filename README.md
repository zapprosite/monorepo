# Fit Tracker MVP

Fitness tracker CLI para musculação, dieta, água, suplementos e manipulados.

## Quick Start

```bash
./fit.sh d              # Dashboard
./fit.sh t add Nome grupo sets reps peso
./fit.sh diet add refei food cal prot carb fat
./fit.sh a 500         # Log 500ml água
./fit.sh s add Nome dose horario
./fit.sh m add Nome dose frequencia estoque
```

## Comandos

| Comando | Função |
|---------|--------|
| `d` | Dashboard |
| `t add` | Adiciona exercício |
| `diet add` | Adiciona refeição |
| `a [ml]` | Log água |
| `s add` | Adiciona suplemento |
| `m add` | Adiciona manipulado |

## Data Location

`~/.fit-tracker/data/*.json`
