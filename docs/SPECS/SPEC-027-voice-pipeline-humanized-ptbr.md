# SPEC-027 — Voice Pipeline Humanizado PT-BR

**Data:** 2026-04-10
**Estado:** Partial Implementation
**Tipo:** Enhancement

---

## Problema

O voice pipeline atual tem dois problemas:

1. **STT** → transcreve texto mas fica "robotizado" (seta direita, ícones, pontos sem contexto)
2. **Kokoro TTS** → lê tudo mecanicamente, não como brasileiro NATURAL

> ⚠️ **Migration:** STT migra de wav2vec2 para whisper-medium-pt em :8202. Este pipeline usa humanização no processamento de texto pós-STT.

O utilizador precisa de:

- Transcrição que entende "seta direita" = apenas texto, não lê o símbolo
- TTS que lê títulos, parágrafos, com entoação natural
- Pipeline que soa como humano brasileiro a falar

---

## Fluxo Desejado

```
[AUDIO] → whisper-medium-pt :8202 → LLM Humanizado PT-BR → Kokoro TTS → headset
                                                    ↑
                                         texto lido como brasileiro
                                         "título" → pausa antes
                                         "seta direita" → ignora símbolo
                                         pontos → entoação natural
```

---

## Arquitetura Atual

```
voice.sh:
ffmpeg → whisper-medium-pt :8202 → llama3-ptbr → clipboard → Ctrl+V

speak.sh:
  xclip → TTS Bridge :8013 → Kokoro
```

> ⚠️ **SPEC-009 Governance:** Kokoro deve ser acessado via TTS Bridge :8013, nunca diretamente.

## Arquitetura Proposta

### STT Enhancement (voice.sh)

**Problema:** STT genérico lê "seta direita" como "seta para direita" sem contexto

**Solução:** Post-processing com LLM para:

1. Detetar e remover símbolos/ícones (→, ←, ★, etc)
2. Detetar títulos (linhas curtas, maiúsculas, padrões)
3. Formatar parágrafos corretamente
4. NÃO reescrever — apenas limpar para leitura natural

### TTS Enhancement (speak.sh)

**Problema:** Kokoro lê marcadores deSlide como "bolinha", "circulo" — não sabe que são indicadores de lista

**Solução:** Pre-processamento do texto antes do TTS:

1. Marcadores de lista (• ● ○ ◆ ▸ ► ▍ ▪ - —) → IGNORADOS, não lidos como símbolo
2. Lista numerada: "1. Item" → "Primeiro: Item" / "2. Item" → "Segundo: Item"
3. Lista com letras: "(a) Opção" → "Letra A: Opção"
4. Detetar títulos (maiúsculas, markdown, ou primeira linha) → pausa + prefixo "título:"
5. Seta → como navegação: "texto → aqui" → "texto para aqui"
6. Limitar a ~3000 chars

---

## Research — Best Practices (Agents 2026-04-10)

### Agent 1: Brazilian PT Fine-tuning

- Usar modelos instruction-tuned (Llama 3.1 8B-Instruct)
- System prompt deve especificar: "Você é um assistente em português brasileiro"
- Few-shot prompting com 2-4 exemplos
- Temperature 0.7-0.9 para tarefas criativas

### Agent 2: STT Post-Processing PT-BR

> ⚠️ **SPEC-009:** STT usa whisper-medium-pt :8202. Post-processing com LLM para humanização não substitui o motor STT.

- Pipeline: whisper-medium-pt → Punctuation → Disfluency removal → Humanization
- Remover fillers: eh, né, sei lá, hmm
- Expandir números e telefones por extenso
- Usar `respunct` para pontuação em PT-BR

### Agent 3: TTS Natural PT-BR (Kokoro)

- Curvas de pontuação: ponto = pausa longa, vírgula = pausa curta
- SSML break time="500ms" para pausas deliberadas
- Sentenças curtas (8-15 palavras) para grupos respiratórios naturais
- Diphthongs PT-BR: "ãe", "ão", "oi" escritos normalmente
- Til em vogais: "não", "amanhã" para nasalização correta
- Evitar "vc", "tb", "msm" excessivos — usar formas formais

### Agent 4: Voice Command Fillers PT-BR

Fillers para remover:

- Hesitação: äh, ehn, hn, hnn, em
- Discurso: né, tipo, cara, mano, tá
- Incerteza: mais ou menos, sei lá, então, viu, bah, puxa, puts

Stuttering: "o-o-o" → "o", "que-que" → "que"

### Agent 5: Gemma4-12b-it

- Uso: enhancement layer no wav2vec2-deepgram-proxy
- Sistema: "Você é um assistente que analisa transcrições de áudio"
- Temperature: 0.3 (baixo para saídas consistentes e breves)
- Max tokens: 100 (curto, 1-2 linhas)
- Formato enforced: "ENTENDI: [resumo]"

### Prompt Template (Humanização)

```
Reescreva o texto transcrito de forma NATURAL e HUMANIZADA,
como um brasileiro falaria, mantendo o significado original:

1. Remova disfluências (repetições, "äh", "em", "né")
2. Converta símbolos em texto (→ = "para")
3. Títulos: adicione pausa antes, não leia como título
4. Pontuação natural: vírgulas = pausas curtas, pontos = pausas longas
5. NÃO reescreva — apenas limpe e formate
6. MAX 3000 caracteres

Texto: {input}
```

---

## Componentes a Modificar

| Ficheiro   | Modificação                                         |
| ---------- | --------------------------------------------------- |
| `voice.sh` | Usar whisper-medium-pt :8202 + LLM humanização      |
| `voice.sh` | Adicionar prompt humanizado no LLM correction       |
| `speak.sh` | Pre-processamento texto (pausas, títulos, símbolos) |
| `speak.sh` | Limite 3000 chars                                   |

---

## Limites Técnicos

| Serviço               | Limite Atual | Limite Proposto                       |
| --------------------- | ------------ | ------------------------------------- |
| Kokoro TTS            | 1500 chars   | 3000 chars                            |
| whisper-medium-pt STT | xlsr-53-pt   | jlondonobo/whisper-medium-pt (futuro) |

---

## Teste de Aceitação

1. Dizer: "Eu quero ir para a página inicial"
   - Resultado esperado: "Eu quero ir para a página inicial"
   - NÃO: "Eu quero ir para o ícone de seta para direita"

2. Selecionar texto com "→" :
   - Resultado esperado: "para" ou "indica"
   - NÃO: "seta para direita"

3. Título curto:
   - Resultado esperado: Lido com pausa natural e prefixo "título:"
   - NÃO: Lido como texto normal

4. Lista com marcadores:
   - Entrada: "• Primeiro item\n• Segundo item\n• Terceiro item"
   - Resultado: "Primeiro item Segundo item Terceiro item"
   - NÃO: "bolinha primeiro item circulo segundo item"

5. Lista numerada:
   - Entrada: "1. Abrir menu\n2. Selecionar opção\n3. Confirmar"
   - Resultado: "Primeiro: Abrir menu Segundo: Selecionar opção Terceiro: Confirmar"
   - NÃO: "um ponto Abrir menu dois pontos Selecionar opção"

6. Opções com letras:
   - Entrada: "(a) Opção A\n(b) Opção B"
   - Resultado: "Letra A: Opção A Letra B: Opção B"
   - NÃO: "a parêntese Opção A b parêntese Opção B"

---

## Próximos Passos

1. [x] Implementar prompt humanizado em `voice.sh`
2. [x] Implementar pre-processamento TTS em `speak.sh` (símbolos, títulos, pausas)
3. [ ] Testar com utilizador real
4. [ ] Ajustar limite Kokoro para 3000 chars (implementado no pre-processamento)

---

## Referências

- `jlondonobo/whisper-medium-pt` (STT Canonical - migration from wav2vec2)
- `respunct` (portuguese punctuation)
- Llama 3.1 8B-Instruct (humanização)
- SPEC-009 (audio stack imutável)
- SPEC-018 (wav2vec2-deepgram-proxy)
