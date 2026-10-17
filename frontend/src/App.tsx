import React, { useRef, useState, useEffect } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar worker de PDF.js desde CDN oficial
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export function App() {
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  // Datos del Firmante
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');

  // Gestión de PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDocJs, setPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [selectedPage, setSelectedPage] = useState<number>(1);

  // Firma, Posición y Escala
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [posXPercent, setPosXPercent] = useState<number>(20);
  const [posYPercent, setPosYPercent] = useState<number>(75);
  const [sigScale, setSigScale] = useState<number>(180);

  // Estado de Resultado
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState<string | null>(null);

  // Carga de PDF
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

  // Renderizar la página del PDF en Canvas
  useEffect(() => {
    if (!pdfDocJs || !pdfCanvasRef.current) return;

    let isMounted = true;
    pdfDocJs.getPage(selectedPage).then((page: any) => {
      if (!isMounted) return;
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      // Escala adaptativa según ancho de pantalla
      const isMobile = window.innerWidth < 768;
      const scale = isMobile ? 0.75 : 1.0;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

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

  // Estampado con Texto Legal en Formato Marca de Agua (Semitransparente)
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

      // 1. Estampar Trazo de Firma (100% Opaco para Nitidez)
      targetPage.drawImage(embeddedImage, {
        x: Math.max(10, realX),
        y: Math.max(15, realY + 12),
        width: sigWidth,
        height: sigHeight,
      });

      // 2. Estampar Texto de Auditoría con Efecto Marca de Agua (Transparencia / Opacity)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timestamp = new Date().toISOString();
      const auditText = `FIRMADO ELECTRÓNICAMENTE | ${signerName} (C.C. ${signerDoc}) | ${timestamp}`;

      targetPage.drawText(auditText, {
        x: Math.max(10, realX),
        y: Math.max(5, realY - 2),
        size: 5.5,
        font,
        color: rgb(0.3, 0.3, 0.3), // Gris medio
        opacity: 0.65, // Marca de agua legible que no tapa texto preexistente
      });

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
    <div className="app-container" style={{ padding: '10px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff', borderRadius: '12px', padding: '15px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
        
        {/* ENCABEZADO CON LOGO REDONDO TECNOPROYECTOS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <img 
            src="https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg" 
            alt="Logo Tecnoproyectos" 
            style={{ width: '65px', height: '65px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1e3a8a', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} 
          />
          <div>
            <h1 className="title" style={{ color: '#1e3a8a', margin: 0, fontSize: '20px', fontWeight: 'bold' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
            <p style={{ color: '#4b5563', fontSize: '13px', margin: '2px 0 0 0' }}>
              Plataforma SG-SST — Firma Electrónica Segura (Ley 527 de 1999)
            </p>
          </div>
        </div>

        {/* 1. DATOS DEL FIRMANTE */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>1. Datos del Firmante</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombre Completo:</label>
              <input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula / Documento:</label>
              <input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo / Rol:</label>
              <input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} />
            </div>
          </div>
        </div>

        {/* 2. CARGAR ARCHIVO PDF */}
        <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>2. Cargar Documento PDF del SG-SST</h3>
          <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ padding: '6px', border: '1px dashed #0284c7', borderRadius: '6px', width: '95%', backgroundColor: '#ffffff', fontSize: '12px' }} />
          {pdfFile && <p style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '12px', marginTop: '6px' }}>📄 Cargado: {pdfFile.name}</p>}
        </div>

        {/* 3. VISOR CANVAS + CONTROLES ADAPTATIVOS PARA MÓVIL */}
        {pdfDocJs && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '15px', marginBottom: '15px' }}>
            
            {/* VISTA PREVIA HOJA */}
            <div style={{ order: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>3. Vista Previa Hoja</h3>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '4px' }}>Pág:</label>
                  <select 
                    value={selectedPage} 
                    onChange={(e) => setSelectedPage(Number(e.target.value))}
                    style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}
                  >
                    {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                      <option key={p} value={p}>Página {p} de {numPages}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ position: 'relative', border: '2px solid #0284c7', borderRadius: '6px', overflow: 'auto', maxHeight: '480px', backgroundColor: '#64748b', padding: '8px', textAlign: 'center' }}>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <canvas ref={pdfCanvasRef} style={{ display: 'block', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', maxWidth: '100%', height: 'auto' }} />

                  {/* Sello de firma flotante */}
                  {signatureImage && (
                    <div style={{
                      position: 'absolute',
                      left: `${posXPercent}%`,
                      top: `${posYPercent}%`,
                      transform: 'translate(-50%, -50%)',
                      border: '2px dashed #0284c7',
                      backgroundColor: 'rgba(255, 255, 255, 0.85)',
                      padding: '3px',
                      borderRadius: '4px',
                      boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                      pointerEvents: 'none',
                      zIndex: 30,
                      width: `${sigScale}px`,
                      textAlign: 'center'
                    }}>
                      <img src={signatureImage} alt="Firma" style={{ width: '100%', maxHeight: '50px', objectFit: 'contain', display: 'block' }} />
                      <span style={{ fontSize: '7.5px', color: '#0284c7', fontWeight: 'bold', display: 'block' }}>
                        📍 Marca y Posición Exacta
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* CONTROLES Y LIENZO TÁCTIL MÓVIL */}
            <div style={{ order: 2 }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>4. Ajuste y Firma Táctil</h3>
              
              <div style={{ backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
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
                  style={{ width: '100%', marginBottom: '8px' }} 
                />

                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>
                  Tamaño de Firma: {sigScale}px
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

              {/* LIENZO DE FIRMA TÁCTIL CÓMODO Y AMPLIO */}
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>
                  Dibuje su Firma (Trazo Táctil o Mouse):
                </label>
                <div style={{ minHeight: '200px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', touchAction: 'none' }}>
                  <SignatureCanvas ref={signatureRef} />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                <button className="btn" onClick={handleCaptureSignature} style={{ backgroundColor: '#0284c7', padding: '10px', fontSize: '13px' }}>
                  📌 Confirmar Trazo de Firma
                </button>

                {signatureImage && (
                  <p style={{ color: '#16a34a', fontSize: '11px', margin: '0', fontWeight: 'bold', textAlign: 'center' }}>
                    ✅ Firma lista. Ajuste la posición en la vista previa.
                  </p>
                )}

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button className="btn" onClick={handleClearSignature} style={{ backgroundColor: '#dc2626', flex: 1, padding: '10px', fontSize: '13px' }}>
                    Limpiar
                  </button>
                  <button 
                    className="btn" 
                    onClick={handleProcessDocumentSigning} 
                    disabled={isProcessing || !signatureImage} 
                    style={{ backgroundColor: signatureImage ? '#16a34a' : '#94a3b8', flex: 2, padding: '10px', fontSize: '13px' }}
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
          <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ color: '#15803d', margin: '0 0 8px 0', fontSize: '16px' }}>✅ ¡Documento Firmado y Estampado con Éxito!</h3>
            <p style={{ fontSize: '12px', color: '#166534', margin: '0 0 12px 0' }}>
              El PDF contiene la firma y la marca de agua legal transparente correctamente aplicadas.
            </p>
            <a 
              href={signedDocumentUrl} 
              download={`FIRMADO_${pdfFile?.name || 'documento.pdf'}`}
              className="btn" 
              style={{ display: 'inline-block', textDecoration: 'none', backgroundColor: '#0284c7', fontSize: '14px', padding: '10px 20px' }}
            >
              📥 Descargar PDF Firmado Definitivo
            </a>
          </div>
        )}

        {/* PIE DE PÁGINA CORPORATIVO (POWERED BY) */}
        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Powered by</span>
          <img 
            src="https://static.wixstatic.com/media/d0ce54_c999d1aa9976438a98b0f5b2157b7adc~mv2.png" 
            alt="Logo Desarrollador" 
            style={{ height: '24px', objectFit: 'contain' }} 
          />
        </div>

      </div>
    </div>
  );
}

export default App;
