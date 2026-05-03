export interface EquipmentRgData {
	equipmentId: string;
	nome: string;
	tipo: string;
	marca: string | null;
	modelo: string | null;
	numeroDeSerie: string | null;
	capacidadeBtu: number | null;
	dataInstalacao: Date | null;
	ultimaManutencao: Date | null;
	ativo: boolean;
	sequenceNumber: number | null;
	clientName: string;
	clientAddress: string | null;
}

function formatDate(date: Date | null): string {
	if (!date) return 'N/A';
	return new Date(date).toLocaleDateString('pt-BR');
}

function formatDateTime(date: Date | null): string {
	if (!date) return 'N/A';
	return new Date(date).toLocaleString('pt-BR');
}

export function renderEquipmentPage(equipment: EquipmentRgData): string {
	const {
		nome,
		tipo,
		marca,
		modelo,
		numeroDeSerie,
		capacidadeBtu,
		dataInstalacao,
		ultimaManutencao,
		ativo,
		sequenceNumber,
		clientName,
		clientAddress,
	} = equipment;

	const isActive = ativo ? 'badge-ok' : 'badge-expired';
	const statusText = ativo ? 'Ativo' : 'Inativo';

	return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>${nome} - ${clientName}</title>
	<style>
		* { box-sizing: border-box; margin: 0; padding: 0; }
		body {
			font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
			background: #0A0A0F;
			color: #E0E0E0;
			min-height: 100vh;
			padding: 20px;
		}
		.container {
			max-width: 600px;
			margin: 0 auto;
		}
		.header {
			background: linear-gradient(135deg, #39FF14 0%, #00D4AA 100%);
			color: #0A0A0F;
			padding: 24px;
			border-radius: 12px;
			margin-bottom: 20px;
		}
		.header h1 {
			font-size: 1.5rem;
			font-weight: 700;
			margin-bottom: 4px;
		}
		.header p {
			font-size: 0.95rem;
			opacity: 0.85;
		}
		.card {
			background: #141418;
			border: 1px solid #252530;
			border-radius: 12px;
			padding: 20px;
			margin-bottom: 16px;
		}
		.card h2 {
			font-size: 1.1rem;
			color: #39FF14;
			margin-bottom: 16px;
			border-bottom: 1px solid #252530;
			padding-bottom: 8px;
		}
		.info-grid {
			display: grid;
			grid-template-columns: 1fr 1fr;
			gap: 12px;
		}
		.info-item {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.info-item.full-width {
			grid-column: 1 / -1;
		}
		.info-label {
			font-size: 0.75rem;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			color: #888;
		}
		.info-value {
			font-size: 0.95rem;
			color: #E0E0E0;
		}
		.badge {
			display: inline-block;
			padding: 4px 12px;
			border-radius: 20px;
			font-size: 0.8rem;
			font-weight: 600;
		}
		.badge-ok {
			background: rgba(57, 255, 20, 0.15);
			color: #39FF14;
		}
		.badge-expired {
			background: rgba(255, 50, 50, 0.15);
			color: #FF4444;
		}
		.status-row {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 16px;
		}
		.contact-btn {
			display: block;
			width: 100%;
			padding: 14px;
			background: linear-gradient(135deg, #39FF14 0%, #00D4AA 100%);
			color: #0A0A0F;
			text-align: center;
			text-decoration: none;
			border-radius: 8px;
			font-weight: 600;
			font-size: 1rem;
			margin-top: 16px;
			transition: opacity 0.2s;
		}
		.contact-btn:hover {
			opacity: 0.9;
		}
		.footer {
			text-align: center;
			padding: 20px;
			color: #555;
			font-size: 0.8rem;
		}
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<h1>${clientName}</h1>
			<p>${clientAddress || ''}</p>
		</div>

		<div class="card">
			<h2>Dados do Equipamento</h2>
			<div class="status-row">
				<span class="badge ${isActive}">${statusText}</span>
				${sequenceNumber ? `<span style="color:#888;font-size:0.85rem">RG: ${String(sequenceNumber).padStart(3, '0')}</span>` : ''}
			</div>
			<div class="info-grid">
				<div class="info-item">
					<span class="info-label">Nome</span>
					<span class="info-value">${nome}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Tipo</span>
					<span class="info-value">${tipo}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Marca</span>
					<span class="info-value">${marca || 'N/A'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Modelo</span>
					<span class="info-value">${modelo || 'N/A'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Nº de Série</span>
					<span class="info-value">${numeroDeSerie || 'N/A'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Capacidade</span>
					<span class="info-value">${capacidadeBtu ? `${capacidadeBtu} BTU` : 'N/A'}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Instalação</span>
					<span class="info-value">${formatDate(dataInstalacao)}</span>
				</div>
				<div class="info-item">
					<span class="info-label">Última Manutenção</span>
					<span class="info-value">${formatDate(ultimaManutencao)}</span>
				</div>
			</div>
		</div>

		<div class="card">
			<h2>Solicitar Serviço</h2>
			<p style="color:#888;font-size:0.9rem;margin-bottom:12px">
				Precisa de manutenção ou orçamento? Entre em contato conosco.
			</p>
			<a href="https://wa.me/55" class="contact-btn">
				Solicitar Orçamento via WhatsApp
			</a>
		</div>

		<div class="footer">
			<p>Gerado automaticamente em ${formatDateTime(new Date())}</p>
		</div>
	</div>
</body>
</html>`;
}
