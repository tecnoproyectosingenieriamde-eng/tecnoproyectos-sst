import React, { useRef, useState, useEffect } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js desde CDN oficial
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export function App() {
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  // Datos del Firmante (TECNOPROYECTOS INGENIERÍA S.A.S.)
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');

  // Gestión del Archivo PDF y renderizado
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDocJs, setPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [selectedPage, setSelectedPage] = useState<number>(1);

  // Configuración de Firma, Posición y Tamaño
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [posXPercent, setPosXPercent] = useState<number>(20);
  const [posYPercent, setPosYPercent] = useState<number>(75);
  const [sigScale, setSigScale] = useState<number>(180);

  // Estado del lienzo canvas
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Estado de Resultado
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState<string | null>(null);

  // 1. Cargar archivo PDF
  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      setSignedDocumentUrl(null);
      
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const loadedPdf = await loadingTask.promise;
      
      setPdfDocJs(loadedPdf);
      setNumPages(loadedPdf.numPages);
      setSelectedPage(loadedPdf.numPages > 5 ? 6 : 1);
    } else {
      alert('Por favor seleccione un archivo PDF válido.');
    }
  };

  // 2. Renderizar la página del PDF en el lienzo Canvas
  useEffect(() => {
    if (!pdfDocJs || !pdfCanvasRef.current) return;

    let isMounted = true;
    pdfDocJs.getPage(selectedPage).then((page: any) => {
      if (!isMounted) return;
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 1.0 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;
      setCanvasDimensions({ width: viewport.width, height: viewport.height });

      const renderContext = {
        canvasContext: context!,
        viewport: viewport,
      };
      page.render(renderContext);
    });

    return () => {
      isMounted = false;
    };
  }, [pdfDocJs, selectedPage]);

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

  // 3. Estampado con separación perfecta entre la firma y el texto legal
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

      const sigWidth = Number(sigScale);
      const sigHeight = Number(sigScale) * 0.45;

      const realX = (pageWidth - sigWidth) * (posXPercent / 100);
      const realY = pageHeight - ((pageHeight - sigHeight) * (posYPercent / 100)) - sigHeight;

      // Convertir Base64 a Bytes
      const base64Data = signatureImage.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const embeddedImage = await pdfDoc.embedPng(bytes);

      // Estampar Firma ligeramente más arriba
      targetPage.drawImage(embeddedImage, {
        x: Math.max(10, realX),
        y: Math.max(15, realY + 12),
        width: sigWidth,
        height: sigHeight,
      });

      // Estampar Texto de Auditoría Legal (Ley 527 / Decreto 1072) bien separado abajo
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timestamp = new Date().toISOString();
      const auditText = `FIRMADO ELECTRÓNICAMENTE | ${signerName} (C.C. ${signerDoc}) | ${timestamp}`;

      targetPage.drawText(auditText, {
        x: Math.max(10, realX),
        y: Math.max(5, realY - 2),
        size: 5.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      const signedUrl = URL.createObjectURL(blob);

      setSignedDocumentUrl(signedUrl);
      setIsProcessing(false);
      alert('¡Documento firmado y sellado exitosamente con separación perfecta!');
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
          Sistema SG-SST — Módulo de Firma Electrónica con Alineación y Sello Legal
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

        {/* 3. VISOR CANVAS CON MARCA SUPERPUESTA */}
        {pdfDocJs && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '20px' }}>
            
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>3. Vista Previa Hoja Completa</h3>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', marginRight: '5px' }}>Página:</label>
                  <select 
                    value={selectedPage} 
                    onChange={(e) => setSelectedPage(Number(e.target.value))}
                    style={{ padding: '4px 8px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                  >
                    {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>Página {p} de {numPages}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ position: 'relative', border: '2px solid #0284c7', borderRadius: '6px', overflow: 'auto', maxHeight: '520px', backgroundColor: '#64748b', padding: '10px', textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <canvas ref={pdfCanvasRef} style={{ display: 'block', backgroundColor: '#fff', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }} />

                  {/* Sello de firma flotante */}
                  {signatureImage && (
                    <div style={{
                      position: 'absolute',
                      left: `${posXPercent}%`,
                      top: `${posYPercent}%`,
                      transform: 'translate(-50%, -50%)',
                      border: '2px dashed #0284c7',
                      backgroundColor: 'rgba(255, 255, 255, 0.85)',
                      padding: '4px',
                      borderRadius: '4px',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.3)',
                      pointerEvents: 'none',
                      zIndex: 30,
                      width: `${sigScale}px`,
                      textAlign: 'center'
                    }}>
                      <img src={signatureImage} alt="Firma" style={{ width: '100%', maxHeight: '60px', objectFit: 'contain', display: 'block' }} />
                      <span style={{ fontSize: '8px', color: '#0284c7', fontWeight: 'bold', display: 'block' }}>
                        📍 Posición Exacta
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CONTROLES DE POSICIONAMIENTO Y FIRMA */}
            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>4. Ajuste de Posición, Tamaño y Firma</h3>
              
              <div style={{ backgroundColor: '#f1f5f9', padding: '12px', borderRadius: '6px', marginBottom: '15px', border: '1px solid #e2e8f0' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Posición Horizontal (Izquierda ↔ Derecha): {posXPercent}%
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={posXPercent} 
                  onChange={(e) => setPosXPercent(Number(e.target.value))} 
                  style={{ width: '100%', marginBottom: '10px' }} 
                />

                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Posición Vertical (Arriba ↕ Abajo): {posYPercent}%
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="100" 
                  value={posYPercent} 
                  onChange={(e) => setPosYPercent(Number(e.target.value))} 
                  style={{ width: '100%', marginBottom: '10px' }} 
                />

                <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Tamaño / Escala de la Firma: {sigScale}px
                </label>
                <input 
                  type="range" 
                  min="100" 
                  max="300" 
                  step="10"
                  value={sigScale} 
                  onChange={(e) => setSigScale(Number(e.target.value))} 
                  style={{ width: '100%' }} 
                />
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
                    ✅ Firma activa sobre la hoja.
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
              El archivo PDF ahora contiene la firma incrustada y el sello de auditoría ordenado correctamente.
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
