Invoca o workflow spec-driven development focado em planejamento.

Uso: `/plan <descrição-da-tarefa>`

Processo:
1. Lê SPECs existentes em docs/specflow/
2. Carrega o plano de tasks existente (tasks/plan.md, tasks/todo.md)
3. Usa o agent Plan para decompor a tarefa em phases e tasks
4. Atualiza tasks/plan.md com o plano gerado
5. Presenta o plano para revisão humana antes de implementar

Se não houver SPEC existente para a tarefa, redireciona para /spec primeiro.

Exemplo:
/plan implementar autenticação JWT

Agents utilizados:
- Plan agent: para decomposição em tasks
- Explore agent: para entender código existente
