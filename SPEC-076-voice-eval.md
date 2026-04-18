# SPEC-076 Voice Clone Evaluation — Trava-Línguas PT-BR

## Ficheiros Gerados

### Kokoro (Baseline)
| Ficheiro | Voz | Texto | Duração |
|----------|-----|-------|---------|
| `kokoro_trava_lingua.wav` | pf_dora | O rato roeu a roupa... | 4.3s |
| `kokoro_pm_santa_trava.wav` | pm_santa | Otrabalhardor ara... | ~4s |
| `kokoro_pf_dora_frase.wav` | pf_dora | A garrafa do rei... | ~4s |

### XTTS v2 (Voice Clone — a gerar)
| Ficheiro | Reference | Texto |
|----------|-----------|-------|
| `xtts_zappro_trava.wav` | will_voice_ZapPro.wav (28.2s) | O rato roeu... |
| `xtts_zappro_frase.wav` | will_voice_ZapPro.wav (28.2s) | A inteligência... |
| `xtts_jarvis_trava.wav` | will_voice_Jarvis_home_lab.wav (16.8s) | O rato roeu... |

## Como Avaliar

```bash
# Ouvir Kokoro
ffplay -nodisp -autoexit /srv/monorepo/kokoro_trava_lingua.wav

# Ouvir XTTS clone (após geração)
ffplay -nodisp -autoexit /srv/monorepo/xtts_zappro_trava.wav
```

## Critérios de Avaliação (1-5)

| Atributo | Descrição | Kokoro | XTTS-ZapPro |
|----------|-----------|--------|-------------|
| **Naturalidade** | Soa como voz humana? | ? | ? |
| **Timbre** | Mantém o timbre do reference? | N/A | ? |
| **Prosódia** | Entonação e ritmo naturais? | ? | ? |
| **Clareza** | Palavras perceptíveis? | ? | ? |
| **Artefactos** | Ruídos, clicks, distorções? | ? | ? |

**Decisão:**
- XTTS ≥ 4/5 em todos → SWAP Kokoro → XTTS
- XTTS < 4/5 em qualquer → MANTER Kokoro

## Texto de Teste

**Trava-línguas (pior caso):**
> O rato roeu a roupa do rei de Roma e a rainha com raiva resolveu remendar.

**Frase complexa:**
> A inteligência artificial está a transformar a forma como interagimos com a tecnologia. Com avanços cada vez mais rápidos, podemos esperar que nos próximos anos vejamos aplicações ainda mais impressionantes.

**Frase simples:**
> Otrabalhardor ara a trena do treme trelim do troção, trelim tremo troção.
