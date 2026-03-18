# Escalation Guide

## Quando escalar imediatamente (P0)

### Para o time técnico/engineering
- Sistema completamente fora do ar afetando todos os usuários
- Brecha de segurança ou suspeita de acesso indevido a dados
- Perda de dados de clientes
- Bug crítico que causa cobrança incorreta

### Para gestão/liderança
- Ameaça de ação legal
- Menção à imprensa ou redes sociais com potencial viral negativo
- Cliente VIP ou grande conta expressando insatisfação grave
- Situação que pode virar crise de imagem

## Quando escalar no mesmo dia (P1)
- Bug confirmado que afeta um grupo de usuários
- Integração crítica fora do ar (pagamento, autenticação)
- Reclamação repetida de múltiplos clientes sobre o mesmo problema

## Quando resolver no suporte (P2/P3)
- Dúvidas de uso da plataforma
- Solicitações de funcionalidade
- Problemas de configuração resolvíveis com instruções
- Reclamações pontuais sem padrão identificado

## Como escalar corretamente
1. Documente o caso: cliente, problema exato, impacto, urgência
2. Inclua contexto: desde quando, quantos afetados, evidências (prints, logs, IDs)
3. Use o canal correto: Slack para P0/P1 imediato, ticket para P2/P3
4. Informe o cliente que está escalando e qual o próximo passo/prazo esperado

## Template de escalação interna
```
URGÊNCIA: [P0/P1/P2]
CLIENTE: [nome/ID]
PROBLEMA: [descrição objetiva em 1-2 frases]
IMPACTO: [quantos usuários, qual funcionalidade]
EVIDÊNCIAS: [link para ticket, prints, IDs relevantes]
JÁ TENTOU: [o que foi feito até agora no suporte]
```
