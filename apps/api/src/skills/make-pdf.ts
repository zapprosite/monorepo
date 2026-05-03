import puppeteer from 'puppeteer';
import QRCode from 'qrcode';
import { renderOsPdf, type OsPdfData } from '@backend/templates/os-pdf.html';

export interface MakePdfOptions {
  data: OsPdfData;
}

export async function makePdf(options: MakePdfOptions): Promise<string> {
  const { data } = options;

  // Generate QR code for RG URL
  let qrCodeDataUrl = '';
  try {
    qrCodeDataUrl = await QRCode.toDataURL(data.rgUrl || 'https://zappro.site', {
      width: 200,
      margin: 2,
      color: { dark: '#000000', light: '#FFFFFF' },
    });
  } catch {
    qrCodeDataUrl = '';
  }

  // Render HTML with QR code
  const html = renderOsPdf({ ...data, rgUrl: qrCodeDataUrl });

  // Launch browser and generate PDF
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });

    const pdfBuffer = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
    });

    // Convert to base64 for storage
    const base64 = Buffer.from(pdfBuffer).toString('base64');

    // In production, upload to storage and return URL
    // For now, return data URL
    return `data:application/pdf;base64,${base64}`;
  } finally {
    await browser.close();
  }
}
