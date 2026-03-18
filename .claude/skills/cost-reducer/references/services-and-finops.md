# Services and FinOps

## Auditoria de serviços SaaS
Crie uma planilha com todos os serviços pagos e responda para cada um:
- Quantas pessoas/sistemas usam ativamente?
- Existe alternativa open-source viável?
- Tem overlap com outro serviço que já pago?

## Serviços comuns com alternativas mais baratas

| Serviço caro | Alternativa | Economia estimada |
|---|---|---|
| Datadog | Grafana + Prometheus | 70-90% |
| Algolia | Meilisearch (self-hosted) | 80-100% |
| Sendgrid (alto volume) | AWS SES | 85% |
| Auth0 | Clerk / Supabase Auth | 50-70% |
| Heroku | Railway / Fly.io / VPS | 40-60% |
| PlanetScale | Supabase / Neon | 30-60% |

## FinOps: boas práticas
- **Tagging obrigatório**: todo recurso cloud deve ter tag de projeto, time e ambiente (prod/staging/dev)
- **Budget alerts**: configure alertas em 50%, 80% e 100% do orçamento mensal
- **Staging menor**: ambiente de staging não precisa ter o mesmo tamanho do prod
- **Delete o que não usa**: recursos "órfãos" (IPs, discos, load balancers sem destino) geram custo zero a zero

## Processo mensal de revisão
1. Exportar fatura detalhada do cloud provider
2. Identificar top 5 itens de custo
3. Para cada um: está crescendo? É proporcional ao crescimento do negócio?
4. Eliminar ou otimizar qualquer item que cresceu mais que a receita no mesmo período
