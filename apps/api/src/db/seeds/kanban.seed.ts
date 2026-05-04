import { db } from '@backend/db/db';

export async function seedKanbanBoards() {
	console.log('🎯 Seeding Kanban demo data...');

	// Create 3 demo boards
	void db.kanbanBoards.create({
		boardId: 'board-comercial-001',
		teamId: 'team-demo-001',
		nome: 'Comercial',
		setor: 'Vendas',
		descricao: 'Pipeline de vendas e leads',
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	void db.kanbanBoards.create({
		boardId: 'board-tecnico-001',
		teamId: 'team-demo-001',
		nome: 'Técnico',
		setor: 'Suporte',
		descricao: 'Chamados técnicos e suporte',
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	void db.kanbanBoards.create({
		boardId: 'board-marketing-001',
		teamId: 'team-demo-001',
		nome: 'Marketing',
		setor: 'Marketing',
		descricao: 'Campanhas e conteúdo',
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	// Create columns for Comercial board
	void db.kanbanColumns.create({
		columnId: 'col-backlog-001',
		boardId: 'board-comercial-001',
		nome: 'Backlog',
		ordem: 0,
	});

	void db.kanbanColumns.create({
		columnId: 'col-progress-001',
		boardId: 'board-comercial-001',
		nome: 'Em Progresso',
		ordem: 1,
	});

	void db.kanbanColumns.create({
		columnId: 'col-done-001',
		boardId: 'board-comercial-001',
		nome: 'Concluído',
		ordem: 2,
	});

	// Create sample cards
	await db.kanbanCards.create({
		cardId: 'card-001',
		columnId: 'col-backlog-001',
		titulo: 'Lead: Empresa ABC',
		descricao: 'Contato inicial com CEO da empresa ABC',
		prioridade: 'Critica',
		status: 'Aberto',
		responsavelId: 'user-comercial-001',
		dataVencimento: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
		ordem: 0,
		createdAt: new Date(),
		updatedAt: new Date(),
	});

	console.log('✅ Kanban demo data seeded successfully');
}
