export async function seedSlices10To12() {
  console.log("🌱 Seeding Maintenance, Loyalty, Email demo data...");

  // Maintenance Plans (Slice 10)
  const maintenancePlans = [
    {
      id: "plan-001",
      nomeEmpresa: "Empresa A",
      tipoEquipamento: "ar-condicionado",
      periodicidadeDias: 90,
      horasEstimadas: 2,
      custoEstimado: 250,
    },
    {
      id: "plan-002",
      nomeEmpresa: "Empresa B",
      tipoEquipamento: "refrigerador",
      periodicidadeDias: 180,
      horasEstimadas: 3,
      custoEstimado: 350,
    },
  ];

  // Loyalty Scores (Slice 11)
  const loyaltyScores = [
    {
      id: "loyalty-001",
      clienteId: "client-001",
      pontos: 150,
      nivel: "prata",
      statusReativacao: "ativo",
    },
    {
      id: "loyalty-002",
      clienteId: "client-002",
      pontos: 75,
      nivel: "bronze",
      statusReativacao: "risco-60d",
    },
    {
      id: "loyalty-003",
      clienteId: "client-003",
      pontos: 350,
      nivel: "platinum",
      statusReativacao: "ativo",
    },
  ];

  // Email Templates (Slice 12)
  const emailTemplates = [
    {
      id: "template-001",
      nome: "Bem-vindo",
      assunto: "Bem-vindo ao nosso sistema!",
      corpo: "<h1>Bem-vindo!</h1><p>Ficamos felizes em ter você conosco.</p>",
      categoriTemplate: "bem-vindo",
    },
    {
      id: "template-002",
      nome: "Reativação",
      assunto: "Que saudade! Volte para nós",
      corpo: "<h1>Volte!</h1><p>Oferecemos 20% de desconto para você.</p>",
      categoriTemplate: "reativacao",
    },
  ];

  // Email Campaigns (Slice 12)
  const emailCampaigns = [
    {
      id: "campaign-001",
      nome: "Reativação 2026",
      tipoCampanha: "reativacao",
      statusCampanha: "rascunho",
      destinatariosJSON: ["cliente1@example.com", "cliente2@example.com"],
    },
  ];

  console.log("✅ Demo data ready for Slices 10-12");
  return {
    maintenancePlans,
    loyaltyScores,
    emailTemplates,
    emailCampaigns,
  };
}
