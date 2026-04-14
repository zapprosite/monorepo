# Language Standards — PT-BR / EN

## Regra Geral

| Tipo | Idioma | Exemplo |
|------|--------|---------|
| **Respostas ao utilizador** | PT-BR | "O container está healthy" |
| **Documentação (.md)** | PT-BR | "Este documento descreve..." |
| **Código / Código-fonte** | EN (technical) | `const userId = getUserId()` |
| **Comments no código** | EN (technical) | `// Initialize connection pool` |
| **Commits** | EN | `feat: add user authentication` |
| **PRs / Issues** | EN ou PT-BR | Conforme projeto |
| **Specs / ADRs** | PT-BR | "Especificação do sistema de autenticação" |
| **Erros / Logs** | EN (technical) | `Error: connection timeout` |

## Justificação

- **PT-BR para comunicação**: O utilizador é brasileiro, respostas em PT-BR são mais claras e naturais
- **EN para código**: Código é internacional por natureza, APIs são em EN,stack é em EN
- **Comments EN**: Stack Overflow, documentação, code review — tudo em EN técnico

## Exemplos

### ✅ Correto

```typescript
// Initialize database connection pool
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// Verifica se o utilizador tem permissões
async function checkPermissions(userId: string): Promise<boolean> {
  const user = await db.user.findUnique({ where: { id: userId } });
  return user?.role === 'admin';
}
```

```markdown
## Autenticação OAuth

Este documento descreve o fluxo de autenticação OAuth com Google.
O token é armazenado no .env e nunca em código.
```

### ❌ Incorreto

```typescript
// Pega o ID do usuário (pt-br no código)
const idDoUsuario = getUserId();
```

```markdown
## Auth System

Este sistema faz authentication com OAuth. (mistura)
```

## Nomenclatura de Código

| Conceito | Regra | Exemplo |
|---------|-------|---------|
| Funções | EN, camelCase | `getUserById()`, `createToken()` |
| Variáveis | EN, camelCase | `userId`, `isAuthenticated` |
| Classes | EN, PascalCase | `AuthService`, `UserRepository` |
| Constantes | EN, SCREAMING_SNAKE | `MAX_RETRY_COUNT`, `API_TIMEOUT` |
| Types/Interfaces | EN, PascalCase | `UserProfile`, `AuthConfig` |
| Ficheiros | EN, kebab-case | `auth-service.ts`, `user-repository.ts` |
| Packages npm | EN, kebab-case | `@repo/env`, `@repo/trpc` |

## Regra de Exceção

Se o código for **exclusivamente para consumo interno** (scripts de automação pessoal, configs de homelab), pode-se usar PT-BR nos comentários para melhor compreensão imediata.

**Exemplo aceite:**
```bash
#!/bin/bash
# Backup do Postgres —Executa às 3h diariamente
# Não precisa de comentário em EN se for script interno
```

## Formato de Respostas

### Estrutura padrão

```
## [Título em PT-BR]

[Explicação em 1-2 frases]

| Tabela | Quando | Necessário |
|--------|--------|------------|
| Item 1 | Uso | ✅ |

### Blocos de código
[Código sempre em EN técnico]

### Ações
- [ ] Tarefa 1
- [ ] Tarefa 2
```

## Aplicação

Esta rule aplica-se a:
- `/srv/monorepo` e todos os subdirectórios
- Todos os documentos .md
- Todos os comentários de código (.ts, .js, .py, .sh)
- Todas as mensagens de commit

**Execução**: Usar `/lint-lang` para verificar conformidade.
