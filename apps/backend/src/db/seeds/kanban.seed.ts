import { db } from "@backend/db";
import { kanbanBoards, kanbanColumns, kanbanCards } from "@backend/modules/kanban";

export async function seedKanbanBoards() {
  console.log("🎯 Seeding Kanban demo data...");

  // Create 3 demo boards
  const comercialBoard = await db.insertInto(kanbanBoards).values({
    id: "board-comercial-001",
    nome: "Comercial",
    setor: "Vendas",
    descricao: "Pipeline de vendas e leads",
    usuarioIdCriacao: "user-admin-001",
    dataCriacao: new Date(),
    dataAtualizacao: new Date(),
  });

  const tecnicoBoard = await db.insertInto(kanbanBoards).values({
    id: "board-tecnico-001",
    nome: "Técnico",
    setor: "Suporte",
    descricao: "Chamados técnicos e suporte",
    usuarioIdCriacao: "user-admin-001",
    dataCriacao: new Date(),
    dataAtualizacao: new Date(),
  });

  const marketingBoard = await db.insertInto(kanbanBoards).values({
    id: "board-marketing-001",
    nome: "Marketing",
    setor: "Marketing",
    descricao: "Campanhas e conteúdo",
    usuarioIdCriacao: "user-admin-001",
    dataCriacao: new Date(),
    dataAtualizacao: new Date(),
  });

  // Create columns for Comercial board
  const colBklog = await db.insertInto(kanbanColumns).values({
    id: "col-backlog-001",
    boardId: "board-comercial-001",
    nome: "Backlog",
    ordem: 0,
    cor: "#95A3A6",
    dataCriacao: new Date(),
    dataAtualizacao: new Date(),
  });

  const colEmProgresso = await db.insertInto(kanbanColumns).values({
    id: "col-progress-001",
    boardId: "board-comercial-001",
    nome: "Em Progresso",
    ordem: 1,
    cor: "#3498DB",
    dataCriacao: new Date(),
    dataAtualizacao: new Date(),
  });

  const colConcluido = await db.insertInto(kanbanColumns).values({
    id: "col-done-001",
    boardId: "board-comercial-001",
    nome: "Concluído",
    ordem: 2,
    cor: "#27AE60",
    dataCriacao: new Date(),
    dataAtualizacao: new Date(),
  });

  // Create sample cards
  await db.insertInto(kanbanCards).values({
    id: "card-001",
    boardId: "board-comercial-001",
    colunaId: "col-backlog-001",
    titulo: "Lead: Empresa ABC",
    descricao: "Contato inicial com CEO da empresa ABC",
    prioridade: "HIGH",
    statusCard: "Backlog",
    atribuidoParaUserId: "user-comercial-001",
    dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    slaHoras: 24,
    checklist: JSON.stringify([
      { titulo: "Enviar proposta", completo: false },
      { titulo: "Agendar reunião", completo: false },
    ]),
    tags: ["urgent", "client-important"],
    entidadeLinkedTipo: "LEAD",
    entidadeLinkedId: "lead-abc-001",
    ordem: 0,
    usuarioIdCriacao: "user-comercial-001",
    dataCriacao: new Date(),
    dataAtualizacao: new Date(),
  });

  console.log("✅ Kanban demo data seeded successfully");
}
