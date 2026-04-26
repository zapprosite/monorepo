---
name: SPEC-FIT-MVP
description: Fitness tracker MVP - musculacao, dieta, agua, suplementos, manipulados
status: active
owner: SRE-Platform
created: 2026-04-25
---

# SPEC-FIT-MVP — Fitness Tracker MVP

## Problema

Rastrear rotina de musculação, dieta, água, suplementos e medicamentos manipulados de forma simples e automatizada.

## Funcionalidades

### F1: Treino
- Lista de exercícios por grupo muscular
- Séries, repetições, peso
- Tracking de progressão

### F2: Dieta
- Refeições do dia (café, almoço, janta, lanches)
- Macros: proteína, carb, gordura
- Calorias estimadas

### F3: Água
- Meta diária em ml
- Tracking de copos/bebidas
- Alertas de hidratação

### F4: Suplementos
- Lista de suplementos (creatina, WPI, BCAA, etc)
- Horários de tomada
- Dosagem

### F5: Manipulados
- Medicamentos manipulados
- Dosagem e horários
- Estoque baixo alerta

## Tech Stack

- Bash scripts (CLI)
- JSON storage (local)
- Claude Code CLI para automação

## Tasks

### T1: Setup estrutura
Criar estrutura de diretórios e arquivos base

### T2: CRUD exercícios
Script para adicionar/listar/editar exercícios

### T3: CRUD dieta
Script para gerenciar refeições e macros

### T4: Track água
Script para logging de água diária

### T5: Track suplementos
Script para suplementos e manipulados

### T6: Dashboard
Script que mostra resumo do dia

### T7: Integração cron
Cron para lembretes automáticos

## Acceptance Criteria

1. `fit.sh` mostra dashboard com tudo
2. `fit.sh treino add` adiciona exercício
3. `fit.sh agua log 500` registra água
4. `fit.sh supra add` adiciona suplemento
5. Tudo persiste em JSON local
