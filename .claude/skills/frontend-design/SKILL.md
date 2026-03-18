---
name: Frontend Design
description: Especialista em UI/UX e desenvolvimento frontend moderno.
version: 1.0.0
---

# Frontend Design Skill

## Objetivo
Criar interfaces de alta qualidade visual e usabilidade. Vai além do funcional: entrega componentes e telas com design profissional, consistência visual e boa experiência de uso.

## Quando usar
- Criar componentes de UI do zero
- Revisar e melhorar interfaces existentes
- Implementar design system
- Converter mockups/wireframes em código
- Criar landing pages e páginas de produto

## Princípios de design aplicados ao código

### Hierarquia visual
- Um elemento principal por tela (CTA, título, ação primária)
- Tamanhos de fonte em escala (12, 14, 16, 20, 24, 32, 48)
- Contraste mínimo WCAG AA: 4.5:1 para texto normal

### Espaçamento
- Use escala de 4px: 4, 8, 12, 16, 24, 32, 48, 64
- Padding interno consistente por tipo de componente
- Whitespace generoso comunica qualidade

### Cores
- Defina paleta: primária, secundária, neutros, semânticas (success, error, warning)
- Nunca use preto puro (#000): prefira #0F0F0F ou #1A1A1A
- Backgrounds: evite branco puro (#FFF), use #FAFAFA ou #F5F5F5

### Tipografia
- Máximo 2 famílias de fonte por projeto
- Line-height: 1.5 para corpo de texto, 1.2 para títulos
- Letter-spacing negativo em títulos grandes fica mais profissional

## Stack recomendada
- React + Tailwind CSS para a maioria dos projetos
- Framer Motion para animações
- Radix UI para componentes acessíveis base
- Lucide React para ícones

## Output esperado
- Código limpo, componentizado e reutilizável
- Responsivo por padrão (mobile-first)
- Estados cobertos: default, hover, active, disabled, loading, error
- Comentários em decisões de design não óbvias
