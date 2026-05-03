export interface OsPdfData {
  osNumber: string;
  clientName: string;
  clientAddress: string;
  clientPhone: string;
  equipmentName: string;
  equipmentModel: string;
  equipmentSerial: string;
  equipmentBtu: string;
  technicianName: string;
  serviceDate: string;
  serviceType: string;
  diagnostico: string;
  servicosExecutados: string;
  photos: string[];
  technicianSignature: string;
  clientSignature: string;
  rgUrl: string;
  companyName: string;
  companyLogo: string;
  companyAddress: string;
  companyPhone: string;
  primaryColor: string;
}

export function renderOsPdf(data: OsPdfData): string {
  const {
    osNumber,
    clientName,
    clientAddress,
    clientPhone,
    equipmentName,
    equipmentModel,
    equipmentSerial,
    equipmentBtu,
    technicianName,
    serviceDate,
    serviceType,
    diagnostico,
    servicosExecutados,
    photos,
    technicianSignature,
    clientSignature,
    rgUrl,
    companyName,
    companyLogo,
    companyAddress,
    companyPhone,
    primaryColor,
  } = data;

  const photosHtml = photos.length > 0
    ? photos.map(p => `<img src="${p}" style="max-width:200px;max-height:150px;border:1px solid #ddd;margin:4px;" />`).join('')
    : '<p style="color:#888;font-size:12px;">Sem fotos</p>';

  const signatureTechnician = technicianSignature
    ? `<img src="${technicianSignature}" style="max-width:200px;max-height:60px;" />`
    : '<div style="border-bottom:1px solid #333;width:200px;height:60px;"></div>';

  const signatureClient = clientSignature
    ? `<img src="${clientSignature}" style="max-width:200px;max-height:60px;" />`
    : '<div style="border-bottom:1px solid #333;width:200px;height:60px;"></div>';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Ordem de Serviço ${osNumber}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial,sans-serif; font-size: 12px; color: #333; }
    .container { max-width: 800px; margin: 0 auto; padding: 20px; }
    .header { border-bottom: 3px solid ${primaryColor}; padding-bottom: 15px; margin-bottom: 20px; }
    .company-name { font-size: 24px; font-weight: bold; color: ${primaryColor}; }
    .os-number { font-size: 18px; color: #666; }
    .section { margin-bottom: 20px; border: 1px solid #ddd; padding: 15px; border-radius: 4px; }
    .section-title { font-size: 14px; font-weight: bold; color: ${primaryColor}; margin-bottom: 10px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
    .item { margin-bottom: 8px; }
    .item-label { font-size: 10px; color: #888; text-transform: uppercase; }
    .item-value { font-size: 13px; }
    .photos { display: flex; flex-wrap: wrap; gap: 8px; }
    .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 30px; }
    .signature-box { text-align: center; }
    .signature-label { font-size: 10px; color: #888; margin-top: 8px; }
    .qr-code { text-align: center; margin-top: 20px; }
    .qr-code img { width: 100px; }
    .footer { text-align: center; font-size: 10px; color: #888; margin-top: 30px; border-top: 1px solid #ddd; padding-top: 15px; }
    @media print { body { font-size: 11px; } }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div style="display:flex;justify-content:space-between;align-items:start;">
        <div>
          ${companyLogo ? `<img src="${companyLogo}" style="max-height:50px;margin-bottom:10px;" />` : ''}
          <div class="company-name">${companyName}</div>
          <div style="font-size:11px;color:#666;">${companyAddress}</div>
          <div style="font-size:11px;color:#666;">${companyPhone}</div>
        </div>
        <div style="text-align:right;">
          <div class="os-number">OS ${osNumber}</div>
          <div style="font-size:11px;color:#888;">${serviceDate}</div>
        </div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Dados do Cliente</div>
      <div class="grid">
        <div class="item"><div class="item-label">Nome</div><div class="item-value">${clientName}</div></div>
        <div class="item"><div class="item-label">Telefone</div><div class="item-value">${clientPhone || 'N/A'}</div></div>
        <div class="item" style="grid-column:1/-1;"><div class="item-label">Endereço</div><div class="item-value">${clientAddress || 'N/A'}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Equipamento</div>
      <div class="grid">
        <div class="item"><div class="item-label">Nome</div><div class="item-value">${equipmentName}</div></div>
        <div class="item"><div class="item-label">Modelo</div><div class="item-value">${equipmentModel || 'N/A'}</div></div>
        <div class="item"><div class="item-label">Nº Série</div><div class="item-value">${equipmentSerial || 'N/A'}</div></div>
        <div class="item"><div class="item-label">Capacidade</div><div class="item-value">${equipmentBtu || 'N/A'}</div></div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Serviço Executado</div>
      <div class="grid">
        <div class="item"><div class="item-label">Tipo</div><div class="item-value">${serviceType}</div></div>
        <div class="item"><div class="item-label">Técnico</div><div class="item-value">${technicianName}</div></div>
      </div>
      <div style="margin-top:15px;">
        <div class="item-label">Diagnóstico</div>
        <div class="item-value" style="background:#f9f9f9;padding:10px;border-radius:4px;white-space:pre-wrap;">${diagnostico}</div>
      </div>
      <div style="margin-top:15px;">
        <div class="item-label">Serviços Executados</div>
        <div class="item-value" style="background:#f9f9f9;padding:10px;border-radius:4px;white-space:pre-wrap;">${servicosExecutados}</div>
      </div>
    </div>

    <div class="section">
      <div class="section-title">Registro Fotográfico</div>
      <div class="photos">${photosHtml}</div>
    </div>

    <div class="signatures">
      <div class="signature-box">
        ${signatureTechnician}
        <div class="signature-label">Assinatura do Técnico</div>
      </div>
      <div class="signature-box">
        ${signatureClient}
        <div class="signature-label">Assinatura do Cliente</div>
      </div>
    </div>

    <div class="qr-code">
      <img src="${rgUrl}" alt="QR Code" />
      <div style="font-size:10px;color:#888;margin-top:5px;">Acesse o RG do equipamento</div>
    </div>

    <div class="footer">
      Documento gerado automaticamente em ${new Date().toLocaleString('pt-BR')}<br/>
      ${companyName} - CNPJ: ${companyAddress}
    </div>
  </div>
</body>
</html>`;
}
