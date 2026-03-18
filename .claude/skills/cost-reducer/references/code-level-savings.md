# Code-Level Cost Savings

## Queries e banco de dados
- **Problema N+1**: cada item da lista dispara uma query extra. Use eager loading (JOIN, includes, preload)
- **Índices faltando**: queries lentas forçam instâncias maiores de banco. Rode EXPLAIN ANALYZE regularmente
- **Queries sem LIMIT**: um endpoint sem paginação pode retornar milhões de linhas e travar tudo
- **Transações desnecessárias**: wrapping de operações simples em transações aumenta lock time

## APIs externas
- **Sem cache em respostas**: se a resposta não muda em 60s, não chame a API de novo. Use Redis ou cache em memória
- **Retry sem backoff exponencial**: loops de retry agressivo multiplicam custos de chamadas pagas
- **Polling vs Webhook**: nunca faça polling em APIs que oferecem webhook

## Processamento
- **Processamento síncrono do que pode ser assíncrono**: coloque em fila (BullMQ, SQS) tudo que não precisa de resposta imediata
- **Sem compressão em respostas HTTP**: gzip/brotli reduz egress em 60-80% para JSON
- **Logs excessivos em produção**: log de debug em produção = storage e processamento desnecessário

## Checklist de revisão de código
- [ ] Tem paginação em todos os endpoints de listagem?
- [ ] APIs de terceiros têm cache implementado?
- [ ] Jobs pesados rodam em background?
- [ ] Respostas HTTP têm compressão ativa?
- [ ] Índices criados para todas as colunas filtradas frequentemente?
