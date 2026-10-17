import React, { useRef, useState, useEffect } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export function App() {
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  // Datos del Firmante
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');

  // Gestión del Archivo PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  // Configuración de Firma y Posicionamiento
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  
  // Posición de la firma en porcentaje (%) de la hoja
  const [posXPercent, setPosXPercent] = useState<number>(60);
  const [posYPercent, setPosYPercent] = useState<number>(80);

  // Estado de Resultado
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState<string | null>(null);

  // Carga de PDF
  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfPreviewUrl(url);
      setSignedDocumentUrl(null);
    } else {
      alert('Por favor seleccione un archivo PDF válido.');
    }
  };

  const handleCaptureSignature = () => {
    if (signatureRef.current?.isEmpty()) {
      alert('Por favor realice su firma en el recuadro primero.');
      return;
    }
    const dataUrl = signatureRef.current?.toDataURL();
    setSignatureImage(dataUrl || null);
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
    setSignatureImage(null);
  };

  // Dibujar el mapa de ubicación interactivo
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Fondo representando la hoja de papel PDF
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Dibujar líneas simuladas de documento
    ctx.fillStyle = '#e2e8f0';
    for (let i = 20; i < canvas.height - 20; i += 18) {
      ctx.fillRect(20, i, canvas.width - 40, 6);
    }

    // Dibujar el recuadro donde va a quedar la firma
    const boxW = 100;
    const boxH = 40;
    const boxX = (canvas.width - boxW) * (posXPercent / 100);
    const boxY = (canvas.height - boxH) * (posYPercent / 100);

    // Sombra del sello
    ctx.fillStyle = 'rgba(2, 132, 199, 0.15)';
    ctx.fillRect(boxX, boxY, boxW, boxH);

    // Borde del sello
    ctx.strokeStyle = '#0284c7';
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeRect(boxX, boxY, boxW, boxH);
    ctx.setLineDash([]);

    // Dibujar la firma dentro si ya se capturó
    if (signatureImage) {
      const img = new Image();
      img.src = signatureImage;
      img.onload = () => {
        ctx.drawImage(img, boxX + 5, boxY + 5, boxW - 10, boxH - 10);
      };
    } else {
      ctx.fillStyle = '#0284c7';
      ctx.font = '10px sans-serif';
      ctx.fillText('📍 Firma aquí', boxX + 15, boxY + 24);
    }
  }, [posXPercent, posYPercent, signatureImage, pdfPreviewUrl]);

  // Función de Estampado sobre PDF
  const handleProcessDocumentSigning = async () => {
    if (!pdfFile || !signatureImage) {
      alert('Por favor asegúrese de haber cargado el PDF y capturado la firma.');
      return;
    }

    try {
      setIsProcessing(true);

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);

      const pages = pdfDoc.getPages();
      if (selectedPage < 1 || selectedPage > pages.length) {
        alert(`Página inválida. El documento tiene ${pages.length} páginas.`);
        setIsProcessing(false);
        return;
      }

      const targetPage = pages[selectedPage - 1];
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();

      const sigWidth = 140;
      const sigHeight = 55;

      const realX = (pageWidth - sigWidth) * (posXPercent / 100);
      const realY = pageHeight - ((pageHeight - sigHeight) * (posYPercent / 100)) - sigHeight;

      // Convertir imagen Base64 a bytes binarios
      const base64Data = signatureImage.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const embeddedImage = await pdfDoc.embedPng(bytes);

      // Estampar la Firma en el PDF Real
      targetPage.drawImage(embeddedImage, {
        x: Math.max(10, realX),
        y: Math.max(10, realY),
        width: sigWidth,
        height: sigHeight,
      });

      // Estampar Texto de Trazabilidad Legal
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timestamp = new Date().toISOString();
      const auditText = `FIRMADO ELECTRÓNICAMENTE | ${signerName} (C.C. ${signerDoc}) | Fecha: ${timestamp}`;

      targetPage.drawText(auditText, {
        x: Math.max(10, realX),
        y: Math.max(5, realY - 10),
        size: 6,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });

      // Generar Archivo Firmado
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const signedUrl = URL.createObjectURL(blob);

      setSignedDocumentUrl(signedUrl);
      setIsProcessing(false);
      alert('¡Documento firmado y sellado exitosamente!');
    } catch (error) {
      console.error('Error al procesar PDF:', error);
      alert('Ocurrió un error al estampar la firma en el PDF.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff' }}>
        <h1 className="title" style={{ color: '#1e3a8a', margin: '0 0 5px 0' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
        <p style={{ color: '#4b5563', fontSize: '14px', margin: '0 0 15px 0' }}>
          Sistema SG-SST — Módulo de Firma Electrónica y Estampado Directo sobre PDF
        </p>

        {/* 1. DATOS DEL FIRMANTE */}
        <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>1. Datos del Firmante</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nombre Completo:</label>
              <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Cédula / Documento:</label>
              <input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Cargo / Rol:</label>
              <input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} />
            </div>
          </div>
        </div>

        {/* 2. CARGAR ARCHIVO PDF */}
        <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>2. Cargar Documento PDF del SG-SST</h3>
          <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ padding: '8px', border: '1px dashed #0284c7', borderRadius: '6px', width: '95%', backgroundColor: '#ffffff' }} />
          {pdfFile && <p style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px', marginTop: '8px' }}>📄 Documento cargado: {pdfFile.name}</p>}
        </div>

        {/* 3. VISOR Y MAPA VISUAL */}
        {pdfPreviewUrl && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: '20px', marginBottom: '20px' }}>
            
            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>3. Vista Previa del Documento</h3>
              <div style={{ border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', height: '420px', marginBottom: '10px' }}>
                <iframe src={pdfPreviewUrl} title="Vista previa PDF" style={{ width: '100%', height: '100%', border: 'none' }} />
              </div>
            </div>

            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>4. Ubicador en Tiempo Real y Firma</h3>
              
              <div style={{ display: 'flex', gap: '15px', backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                
                {/* MAPA VISUAL DE LA HOJA */}
                <div style={{ textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Mapa de la Hoja</span>
                  <canvas 
                    ref={previewCanvasRef} 
                    width={140} 
                    height={180} 
                    style={{ border: '1px solid #94a3b8', borderRadius: '4px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }} 
                  />
                </div>

                {/* CONTROLES DESLIZANTES */}
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                    Página donde va la firma:
                  </label>
                  <input 
                    type="number" 
                    min="1" 
                    value={selectedPage} 
                    onChange={(e) => setSelectedPage(Number(e.target.value))} 
                    style={{ width: '100%', padding: '4px', borderRadius: '4px', border: '1px solid #cbd5e1', marginBottom: '8px' }} 
                  />

                  <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                    Horizontal (Izquierda ↔ Derecha): {posXPercent}%
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={posXPercent} 
                    onChange={(e) => setPosXPercent(Number(e.target.value))} 
                    style={{ width: '100%', marginBottom: '8px' }} 
                  />

                  <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                    Vertical (Arriba ↕ Abajo): {posYPercent}%
                  </label>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={posYPercent} 
                    onChange={(e) => setPosYPercent(Number(e.target.value))} 
                    style={{ width: '100%' }} 
                  />
                </div>

              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Dibuje su Firma (Dedo / Mouse):</label>
                <SignatureCanvas ref={signatureRef} />
              </div>

              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <button className="btn" onClick={handleCaptureSignature} style={{ backgroundColor: '#0284c7' }}>
                  📌 Confirmar Trazo de Firma
                </button>

                {signatureImage && (
                  <p style={{ color: '#16a34a', fontSize: '12px', margin: '0', fontWeight: 'bold' }}>
                    ✅ Firma capturada y visible en el Mapa.
                  </p>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn" onClick={handleClearSignature} style={{ backgroundColor: '#dc2626', flex: 1 }}>
                    Limpiar
                  </button>
                  <button 
                    className="btn" 
                    onClick={handleProcessDocumentSigning} 
                    disabled={isProcessing || !signatureImage} 
                    style={{ backgroundColor: signatureImage ? '#16a34a' : '#94a3b8', flex: 2 }}
                  >
                    {isProcessing ? 'Procesando...' : '⚡ Firmar y Estampar PDF'}
                  </button>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* 4. DESCARGAR PDF RESULTANTE */}
        {signedDocumentUrl && (
          <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ color: '#15803d', margin: '0 0 10px 0' }}>✅ ¡Documento Firmado y Estampado con Éxito!</h3>
            <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 15px 0' }}>
              El archivo PDF ahora contiene la firma incrustada y el sello de auditoría legal.
            </p>
            <a 
              href={signedDocumentUrl} 
              download={`FIRMADO_${pdfFile?.name || 'documento.pdf'}`}
              className="btn" 
              style={{ display: 'inline-block', textDecoration: 'none', backgroundColor: '#0284c7', fontSize: '16px', padding: '12px 24px' }}
            >
              📥 Descargar PDF Firmado Definitivo
            </a>
          </div>
        )}

      </div>
    </div>
  );
}

export default App;
