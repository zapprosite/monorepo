import { db } from "@backend/db/db";

export async function seedCRM() {
	console.log("Seeding CRM data...");

	// Check if already seeded
	const existingLeads = await db.leads.select("leadId").limit(1);
	if (existingLeads.length > 0) {
		console.log("CRM already seeded, skipping.");
		return;
	}

	// --- Leads ---
	const lead1 = await db.leads.create({
		nome: "Supermercado BomPreço",
		email: "manutencao@bompreco.com.br",
		telefone: "(11) 98765-4321",
		status: "Qualificado",
		origem: "Indicação",
		observacoes: "Tem 8 splits e 2 câmaras frias. Contrato PMOC em vista.",
	});

	const lead2 = await db.leads.create({
		nome: "Clínica Dr. Marcos",
		email: "clinica@drmarcos.com.br",
		telefone: "(11) 94321-8765",
		status: "Proposta",
		origem: "Site",
		observacoes: "Ambiente hospitalar, exige manutenção preventiva rigorosa.",
	});

	// --- Clients ---
	const client1 = await db.clients.create({
		nome: "Restaurante Sabor & Arte",
		email: "contato@saborarte.com.br",
		telefone: "(11) 3456-7890",
		tipo: "Pessoa Jurídica",
		cpfCnpj: "12.345.678/0001-90",
	});

	const client2 = await db.clients.create({
		nome: "Maria Aparecida Santos",
		email: "maria.santos@gmail.com",
		telefone: "(11) 99887-6543",
		tipo: "Pessoa Física",
	});

	const client3 = await db.clients.create({
		nome: "Escritório JM Advogados",
		email: "admin@jmadvogados.com.br",
		telefone: "(11) 3210-5678",
		tipo: "Pessoa Jurídica",
		cpfCnpj: "98.765.432/0001-10",
	});

	// --- Contracts ---
	await db.contracts.create({
		clienteId: client1.clientId,
		tipo: "PMOC",
		status: "Ativo",
		dataInicio: "2025-01-01",
		dataFim: "2025-12-31",
		valor: 890,
		frequencia: "Mensal",
		descricao: "PMOC obrigatório para 6 splits e 1 câmara fria.",
		observacoes: "Visitas no primeiro sábado de cada mês.",
	});

	await db.contracts.create({
		clienteId: client2.clientId,
		tipo: "Residencial",
		status: "Ativo",
		dataInicio: "2025-03-01",
		dataFim: "2026-02-28",
		valor: 149,
		frequencia: "Mensal",
		descricao: "Plano residencial — 2 splits.",
	});

	await db.contracts.create({
		clienteId: client3.clientId,
		tipo: "Comercial",
		status: "Rascunho",
		dataInicio: "2025-04-01",
		valor: 2400,
		frequencia: "Semestral",
		descricao: "Manutenção preventiva e corretiva — 12 equipamentos.",
	});

	// --- Schedules ---
	const today = new Date();
	const tomorrow = new Date(today);
	tomorrow.setDate(today.getDate() + 1);
	const nextWeek = new Date(today);
	nextWeek.setDate(today.getDate() + 7);

	await db.schedules.create({
		clienteId: client1.clientId,
		dataHora: tomorrow.toISOString().slice(0, 16),
		tipo: "Manutenção Preventiva",
		status: "Confirmado",
		duracaoMinutos: 120,
		descricao: "Limpeza e revisão mensal PMOC.",
	});

	await db.schedules.create({
		clienteId: client2.clientId,
		dataHora: nextWeek.toISOString().slice(0, 16),
		tipo: "Manutenção Preventiva",
		status: "Agendado",
		duracaoMinutos: 60,
		descricao: "Revisão semestral residencial.",
	});

	// --- Reminders ---
	const in3days = new Date(today);
	in3days.setDate(today.getDate() + 3);
	const in10days = new Date(today);
	in10days.setDate(today.getDate() + 10);

	await db.reminders.create({
		clienteId: client1.clientId,
		tipo: "Ligação",
		status: "Pendente",
		dataLembrete: in3days.toISOString().slice(0, 10),
		titulo: "Confirmar visita PMOC de amanhã",
		descricao: "Ligar para o responsável e confirmar horário de acesso.",
	});

	await db.reminders.create({
		clienteId: client3.clientId,
		tipo: "Email",
		status: "Pendente",
		dataLembrete: in10days.toISOString().slice(0, 10),
		titulo: "Enviar proposta de contrato comercial",
		descricao: "Proposta já aprovada internamente. Aguardando assinatura.",
	});

	// --- Editorial ---
	const futureDate = new Date(today);
	futureDate.setDate(today.getDate() + 5);
	const futureDate2 = new Date(today);
	futureDate2.setDate(today.getDate() + 12);

	await db.editorialItems.create({
		titulo: "5 sinais que seu ar-condicionado precisa de manutenção",
		canal: "Instagram",
		formato: "Carrossel",
		status: "Em Produção",
		dataPublicacao: futureDate.toISOString().slice(0, 10),
		pauta: "Educar sobre sinais de alerta: cheiro ruim, gotejamento, ruído, calor excessivo, conta alta de energia.",
		cta: "Agende sua revisão pelo link na bio!",
	});

	await db.editorialItems.create({
		titulo: "PMOC: entenda a lei e proteja seu negócio",
		canal: "LinkedIn",
		formato: "Post",
		status: "Aprovado",
		dataPublicacao: futureDate2.toISOString().slice(0, 10),
		pauta: "Explicar a obrigatoriedade do PMOC para ambientes comerciais acima de 5TR.",
		copy: "A Lei 13.589/2018 exige manutenção preventiva obrigatória para sistemas de climatização. Você está em conformidade?",
		cta: "Entre em contato e solicite seu plano PMOC.",
	});

	console.log("CRM seeding complete:", {
		leads: 2,
		clients: 3,
		contracts: 3,
		schedules: 2,
		reminders: 2,
		editorial: 2,
	});
}
