# Cloud and Infrastructure Cost Optimization

## Principais alavancas de economia em cloud

### Compute (EC2, VPS, Cloud Run)
- **Right-sizing**: instâncias superdimensionadas são o erro mais comum. Use métricas de CPU/RAM dos últimos 30 dias para dimensionar corretamente
- **Spot/Preemptible instances**: para workloads tolerantes a interrupção, economia de 60-90%
- **Reserved instances**: compromisso de 1 ano = ~40% de desconto frente ao on-demand
- **Auto-scaling**: nunca deixe instâncias fixas onde há variação de tráfego

### Storage
- **S3/Object Storage lifecycle policies**: mova arquivos antigos para tiers mais baratos (Glacier, Nearline) automaticamente
- **Snapshots desnecessários**: audite snapshots de discos que já foram deletados
- **Egress**: tráfego de saída é caro. CDN resolve a maioria dos casos

### Banco de dados
- **Leitura vs escrita**: separe réplicas de leitura. RDS Multi-AZ só vale para produção crítica
- **Connection pooling**: PgBouncer/RDS Proxy evita custos de instâncias maiores só por conexões
- **Backups automáticos**: defina retention period adequado, não deixe no padrão infinito

### Kubernetes / Containers
- **Namespace resource limits**: sem limits definidos, pods consomem tudo
- **Idle pods**: use HPA (Horizontal Pod Autoscaler) para zerar réplicas fora do horário
- **Container registry**: limpe imagens antigas, cobranças por GB armazenado

## Checklist rápido de auditoria
- [ ] CPU médio > 20% nas instâncias principais?
- [ ] Algum serviço sem auto-scaling em produção?
- [ ] Snapshots/backups com retenção indefinida?
- [ ] Egress sem CDN em assets estáticos?
- [ ] Banco de dados em instância maior que o necessário?
