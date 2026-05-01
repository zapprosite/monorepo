import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../entities/company.entity';
import { ServiceOrder } from '../entities/serviceOrder.entity';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

@Injectable()
export class PdfService {
  constructor(
    @InjectRepository(Company) private companyRepo: Repository<Company>,
  ) {}

  /**
   * make-pdf skill — renders HTML template to PDF using Puppeteer.
   * Saves PDF to /data/os/YYYY/MM/os-<number>.pdf and returns public URL.
   */
  async generateOsPdf(serviceOrder: ServiceOrder): Promise<string> {
    const company = await this.companyRepo.findOne({ where: {} });

    const primaryColor = company?.primaryColor ?? '#39FF14';
    const secondaryColor = company?.secondaryColor ?? '#0A0A0F';
    const companyName = company?.name ?? 'Assistência Técnica';
    const companyCnpj = company?.cnpj ?? '';
    const companyPhone = company?.phone ?? '';
    const companyAddress = company?.address ?? '';
    const logoUrl = company?.logoUrl ?? '';
    const responsibleSignature = company?.responsibleSignature ?? '';

    const client = serviceOrder.client;
    const equipamento = serviceOrder.equipamento;
    const technician = serviceOrder.technician;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const osNumber = serviceOrder.title ?? serviceOrder.id.slice(0, 8).toUpperCase();

    const dir = `/data/os/${year}/${month}`;
    fs.mkdirSync(dir, { recursive: true });
    const filename = `os-${osNumber.replace(/[^a-zA-Z0-9]/g, '-')}.pdf`;
    const filePath = path.join(dir, filename);

    const html = this.buildHtml({
      primaryColor,
      secondaryColor,
      companyName,
      companyCnpj,
      companyPhone,
      companyAddress,
      logoUrl,
      osNumber,
      clientName: client?.name ?? '—',
      clientAddress: (client as any)?.address ?? '',
      equipamentoName: equipamento?.name ?? '—',
      equipamentoModel: (equipamento as any)?.model ?? '—',
      equipamentoBrand: (equipamento as any)?.brand ?? '—',
      equipamentoSerial: (equipamento as any)?.serialNumber ?? '—',
      typeLabel: this.typeLabel(serviceOrder.type),
      technicianName: technician?.name ?? '—',
      description: serviceOrder.description ?? '',
      checklist: serviceOrder.checklist ?? [],
      photos: serviceOrder.photos ?? [],
      clientSignature: serviceOrder.signature ?? '',
      technicianSignature: responsibleSignature,
      finalCost: serviceOrder.cost != null ? `R$ ${Number(serviceOrder.cost).toFixed(2)}` : '',
      finalNotes: serviceOrder.notes ?? '',
      completedAt: serviceOrder.completedDate
        ? new Date(serviceOrder.completedDate).toLocaleString('pt-BR')
        : new Date().toLocaleString('pt-BR'),
      rgUrl: equipamento?.subdomain
        ? `https://${equipamento.subdomain}.zappro.site/equip/${equipamento.id}`
        : '',
    });

    const tmpHtml = `/tmp/os-${serviceOrder.id}.html`;
    fs.writeFileSync(tmpHtml, html, 'utf8');

    try {
      execSync(
        `npx puppeteer browsers install chromium 2>/dev/null; node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined, args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  await page.setContent(require('fs').readFileSync('${tmpHtml}', 'utf8'), { waitUntil: 'networkidle0' });
  await page.pdf({ path: '${filePath}', format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
  await browser.close();
  console.log('PDF_OK');
})();
"`,
        { stdio: 'pipe', timeout: 60000 },
      );
    } catch {
      // fallback: try system chromium if npx fails
      try {
        execSync(
          `node -e "
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox','--disable-dev-shm-usage','--headless'] });
  const page = await browser.newPage();
  await page.setContent(require('fs').readFileSync('${tmpHtml}', 'utf8'), { waitUntil: 'networkidle0' });
  await page.pdf({ path: '${filePath}', format: 'A4', margin: { top: '15mm', bottom: '15mm', left: '15mm', right: '15mm' } });
  await browser.close();
  console.log('PDF_OK');
})();
"`,
          { stdio: 'pipe', timeout: 60000, cwd: '/srv/monorepo/crm-mvp' },
        );
      } catch (e: any) {
        console.error('PDF generation failed:', e.message);
      }
    } finally {
      try { fs.unlinkSync(tmpHtml); } catch {}
    }

    // Return relative URL — API serves /data via a static route
    return `/pdfs/os/${year}/${month}/${filename}`;
  }

  private buildHtml(data: {
    primaryColor: string;
    secondaryColor: string;
    companyName: string;
    companyCnpj: string;
    companyPhone: string;
    companyAddress: string;
    logoUrl: string;
    osNumber: string;
    clientName: string;
    clientAddress: string;
    equipamentoName: string;
    equipamentoModel: string;
    equipamentoBrand: string;
    equipamentoSerial: string;
    typeLabel: string;
    technicianName: string;
    description: string;
    checklist: { id: string; label: string; checked: boolean }[];
    photos: { id: string; data: string; caption: string }[];
    clientSignature: string;
    technicianSignature: string;
    finalCost: string;
    finalNotes: string;
    completedAt: string;
    rgUrl: string;
  }): string {
    const checklistRows = data.checklist
      .map(
        (item) => `<tr>
        <td style="padding:6px 10px;${item.checked ? 'color:#16a34a;' : 'color:#dc2626;'}">
          ${item.checked ? '☑' : '☐'} ${item.label}
        </td>
        <td style="padding:6px 10px;text-align:center;">${item.checked ? 'Sim' : 'Não'}</td>
      </tr>`,
      )
      .join('');

    const photosHtml = data.photos
      .slice(0, 6)
      .map(
        (photo) => `<div style="text-align:center;">
        <img src="${photo.data}" style="width:100%;max-width:200px;border-radius:4px;border:1px solid #ddd;margin-bottom:4px;" />
        ${photo.caption ? `<p style="font-size:11px;color:#666;">${photo.caption}</p>` : ''}
      </div>`,
      )
      .join('');

    return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page { size: A4; margin: 15mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter','Helvetica Neue',Helvetica,Arial,sans-serif; color: #1a1a2e; font-size: 13px; line-height: 1.5; }
  .header { background: ${data.primaryColor}; color: ${data.secondaryColor}; padding: 20px 24px; }
  .header-logo { max-height: 56px; margin-bottom: 10px; }
  .header h1 { font-size: 20px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
  .header p { font-size: 12px; opacity: 0.9; }
  .section { margin: 16px 0; padding: 0 4px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${data.primaryColor}; border-bottom: 2px solid ${data.primaryColor}; padding-bottom: 4px; margin-bottom: 10px; }
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; }
  .info-item label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.08em; color: #888; }
  .info-item p { font-size: 13px; font-weight: 500; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  table th { background: ${data.primaryColor}20; padding: 6px 10px; text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; color: #555; }
  table td { padding: 6px 10px; border-bottom: 1px solid #f0f0f0; }
  .photos-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .signature-row { display: flex; justify-content: space-between; margin-top: 40px; gap: 24px; }
  .signature-box { flex: 1; border-top: 1px solid #333; padding-top: 8px; text-align: center; }
  .signature-box img { max-height: 64px; }
  .signature-box p { font-size: 11px; color: #555; margin-top: 4px; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #eee; font-size: 10px; color: #999; display: flex; justify-content: space-between; align-items: center; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; background: ${data.primaryColor}20; color: ${data.primaryColor}; }
  .description-box { background: #fafafa; border-left: 3px solid ${data.primaryColor}; padding: 10px 14px; border-radius: 0 4px 4px 0; font-size: 13px; }
  @media print { .no-print { display: none; } }
</style>
</head>
<body>

<div class="header">
  ${data.logoUrl ? `<img src="${data.logoUrl}" class="header-logo" alt="logo">` : ''}
  <h1>Ordem de Serviço</h1>
  <p>${data.companyName}${data.companyCnpj ? ' — CNPJ: ' + data.companyCnpj : ''}</p>
  <p>${[data.companyPhone, data.companyAddress].filter(Boolean).join(' · ')}</p>
</div>

<div class="section">
  <div class="info-grid">
    <div class="info-item"><label>OS Nº</label><p>#${data.osNumber} <span class="badge">${data.typeLabel}</span></p></div>
    <div class="info-item"><label>Data Conclusão</label><p>${data.completedAt}</p></div>
    <div class="info-item"><label>Cliente</label><p>${data.clientName}</p></div>
    <div class="info-item"><label>Endereço</label><p>${data.clientAddress || '—'}</p></div>
    <div class="info-item"><label>Equipamento</label><p>${data.equipamentoName}</p></div>
    <div class="info-item"><label>Modelo / Série</label><p>${[data.equipamentoBrand, data.equipamentoModel, data.equipamentoSerial].filter(Boolean).join(' / ') || '—'}</p></div>
    <div class="info-item"><label>Técnico</label><p>${data.technicianName}</p></div>
    <div class="info-item"><label>Valor Final</label><p>${data.finalCost || '—'}</p></div>
  </div>
</div>

${data.description ? `<div class="section">
  <div class="section-title">Descrição do Serviço</div>
  <div class="description-box">${data.description}</div>
</div>` : ''}

${data.checklist.length > 0 ? `<div class="section">
  <div class="section-title">Checklist de Execução</div>
  <table>
    <thead><tr><th>Item</th><th style="width:60px;text-align:center;">Verificado</th></tr></thead>
    <tbody>${checklistRows}</tbody>
  </table>
</div>` : ''}

${data.photos.length > 0 ? `<div class="section">
  <div class="section-title">Fotos do Serviço</div>
  <div class="photos-grid">${photosHtml}</div>
</div>` : ''}

${data.finalNotes ? `<div class="section">
  <div class="section-title">Observações Finais</div>
  <div class="description-box">${data.finalNotes}</div>
</div>` : ''}

<div class="signature-row">
  <div class="signature-box">
    ${data.technicianSignature ? `<img src="${data.technicianSignature}" alt="assinatura">` : ''}
    <p>${data.technicianName}<br><small>Técnico Responsável</small></p>
  </div>
  <div class="signature-box">
    ${data.clientSignature ? `<img src="${data.clientSignature}" alt="assinatura">` : ''}
    <p>${data.clientName}<br><small>Cliente</small></p>
  </div>
</div>

${data.rgUrl ? `<div class="footer">
  <span>Histórico do equipamento: ${data.rgUrl}</span>
  <span>Gerado em ${new Date().toLocaleString('pt-BR')}</span>
</div>` : ''}

</body>
</html>`;
  }

  private typeLabel(type: string): string {
    const labels: Record<string, string> = {
      instalacao: 'Instalação',
      manutencao: 'Manutenção',
      reparo: 'Reparo',
      visita_tecnica: 'Visita Técnica',
      emergencia: 'Emergência',
    };
    return labels[type] ?? type;
  }
}
