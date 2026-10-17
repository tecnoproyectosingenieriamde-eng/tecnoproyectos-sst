import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import crypto from 'crypto';

export interface SignaturePosition {
  pageNumber: number; // Inicia en 1
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SignerAuditInfo {
  fullName: string;
  documentNumber: string;
  signedAt: Date;
  ipAddress: string;
}

export async function signPdfDocument(
  sourcePdfBuffer: Buffer,
  signaturePngBuffer: Buffer,
  position: SignaturePosition,
  signer: SignerAuditInfo
): Promise<{
  signedPdfBuffer: Buffer;
  documentHash: string;
  signatureHash: string;
}> {
  const pdfDoc = await PDFDocument.load(sourcePdfBuffer);
  const pages = pdfDoc.getPages();

  if (position.pageNumber < 1 || position.pageNumber > pages.length) {
    throw new Error(`Número de página inválido: ${position.pageNumber}`);
  }

  const page = pages[position.pageNumber - 1];
  const { height: pageHeight } = page.getSize();

  // Inversión técnica obligatoria de coordenadas (HTML Top-Left -> PDF Bottom-Left)
  const correctedY = pageHeight - position.y - position.height;

  // Insertar la imagen de la firma trazada
  const embeddedImage = await pdfDoc.embedPng(signaturePngBuffer);
  page.drawImage(embeddedImage, {
    x: position.x,
    y: correctedY,
    width: position.width,
    height: position.height,
  });

  // Estampado de auditoría e inmutabilidad legal
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const formattedDate = signer.signedAt.toISOString();
  const stampText = `FIRMADO ELECTRÓNICAMENTE | Nombre: ${signer.fullName} | C.C.: ${signer.documentNumber} | Fecha: ${formattedDate} | IP: ${signer.ipAddress}`;

  page.drawText(stampText, {
    x: position.x,
    y: Math.max(10, correctedY - 10),
    size: 6,
    font,
    color: rgb(0.15, 0.15, 0.15),
  });

  const pdfBytes = await pdfDoc.save();
  const signedPdfBuffer = Buffer.from(pdfBytes);

  // Cálculo de Hashes SHA-256 inmutables
  const documentHash = crypto.createHash('sha256').update(signedPdfBuffer).digest('hex');
  const signatureHash = crypto.createHash('sha256').update(signaturePngBuffer).digest('hex');

  return {
    signedPdfBuffer,
    documentHash,
    signatureHash,
  };
}
