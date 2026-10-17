import React, { useRef, useState, useEffect } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configurar el worker de PDF.js desde CDN oficial
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

export function App() {
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Datos del Firmante
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');

  // Gestión de PDF y renderizado
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDocJs, setPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  
  // Estado de la firma capturada y su posición sobre el visor (en píxeles de pantalla)
  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [sigPosition, setSigPosition] = useState<{ x: number; y: number }>({ x: 50, y: 50 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Dimensiones del lienzo del PDF renderizado en pantalla
  const [canvasDimensions, setCanvasDimensions] = useState<{ width: number; height: number }>({ width: 0, height: 0 });

  // Estado de proceso y descarga
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
      setSelectedPage(1);
    } else {
      alert('Por favor seleccione un archivo PDF válido.');
    }
  };

  // 2. Renderizar la página del PDF en el lienzo HTML5
  useEffect(() => {
    if (!pdfDocJs || !pdfCanvasRef.current) return;

    let isMounted = true;
    pdfDocJs.getPage(selectedPage).then((page) => {
      if (!isMounted) return;
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 1.2 });

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

  // Capturar firma trazada y mostrarla en la capa flotante
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

  // Lógica para arrastrar el recuadro de la firma sobre la hoja PDF
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!signatureImage) return;
    setIsDragging(true);
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    
    let newX = e.clientX - containerRect.left - dragOffset.x;
    let newY = e.clientY - containerRect.top - dragOffset.y;

    // Limitar movimiento dentro de los bordes del canvas
    newX = Math.max(0, Math.min(newX, canvasDimensions.width - 150));
    newY = Math.max(0, Math.min(newY, canvasDimensions.height - 60));

    setSigPosition({ x: newX, y: newY });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 3. Estampar la firma sobre el archivo PDF final
  const handleProcessDocumentSigning = async () => {
    if (!pdfFile || !signatureImage) {
      alert('Asegúrese de haber cargado el PDF, capturado la firma y ubicado el sello sobre la hoja.');
      return;
    }

    try {
      setIsProcessing(true);

      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const pages = pdfDoc.getPages();
      const targetPage = pages[selectedPage - 1];
      const { width: pdfWidth, height: pdfHeight } = targetPage.getSize();

      // Mapear escala entre pantalla y PDF real
      const scaleX = pdfWidth / canvasDimensions.width;
      const scaleY = pdfHeight / canvasDimensions.height;

      const realX = sigPosition.x * scaleX;
      const realWidth = 140 * scaleX;
      const realHeight = 60 * scaleY;
      
      // Inversión de eje Y para la especificación del estándar PDF
      const realY = pdfHeight - (sigPosition.y * scaleY) - realHeight;

      // Convertir imagen Base64 a bytes
      const base64Data = signatureImage.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const embeddedImage = await pdfDoc.embedPng(bytes);

      // Estampar Imagen
      targetPage.drawImage(embeddedImage, {
        x: realX,
        y: realY,
        width: realWidth,
        height: realHeight,
      });

      // Estampar Texto de Auditoría
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timestamp = new Date().toISOString();
      const auditText = `FIRMADO ELECTRÓNICAMENTE | ${signerName} (C.C. ${signerDoc}) | ${timestamp}`;

      targetPage.drawText(auditText, {
        x: realX,
        y: Math.max(10, realY - 12),
        size: Math.max(6, 6 * scaleX),
        font,
        color: rgb(0.15, 0.15, 0.15),
      });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const signedUrl = URL.createObjectURL(blob);

      setSignedDocumentUrl(signedUrl);
      setIsProcessing(false);
      alert('¡Documento firmado y sellado exactamente en la posición seleccionada!');
    } catch (error) {
      console.error('Error al firmar PDF:', error);
      alert('Error al procesar la firma en el PDF.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff' }}>
        <h1 className="title" style={{ color: '#1e3a8a', margin: '0 0 5px 0' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
        <p style={{ color: '#4b5563', fontSize: '14px', margin: '0 0 15px 0' }}>
          Plataforma SG-SST — Firma Electrónica con Posicionamiento Arrastrable sobre PDF
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

        {/* 2. CARGAR DOCUMENTO */}
        <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>2. Cargar Documento PDF</h3>
          <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ padding: '8px', border: '1px dashed #0284c7', borderRadius: '6px', width: '95%', backgroundColor: '#ffffff' }} />
          {pdfFile && <p style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px', marginTop: '8px' }}>📄 Cargar: {pdfFile.name}</p>}
        </div>

        {/* 3. CAPTURA Y VISOR DE ARRASTRE */}
        {pdfDocJs && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', marginBottom: '20px' }}>
            
            {/* LIENZO INTERACTIVO DEL PDF */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>3. Arrastre la Firma a la Posición Deseada</h3>
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

              <div 
                ref={containerRef}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                style={{ 
                  position: 'relative', 
                  border: '2px solid #cbd5e1', 
                  borderRadius: '6px', 
                  overflow: 'auto', 
                  maxHeight: '600px', 
                  backgroundColor: '#64748b',
                  display: 'flex',
                  justifyContent: 'center',
                  padding: '10px'
                }}
              >
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <canvas ref={pdfCanvasRef} style={{ display: 'block', backgroundColor: '#fff', boxShadow: '0 4px 6px rgba(0,0,0,0.3)' }} />
                  
                  {/* CUADRO FLOTANTE ARRASTRABLE DE LA FIRMA */}
                  {signatureImage && (
                    <div
                      onMouseDown={handleMouseDown}
                      style={{
                        position: 'absolute',
                        left: `${sigPosition.x}px`,
                        top: `${sigPosition.y}px`,
                        width: '150px',
                        height: '60px',
                        border: '2px dashed #0284c7',
                        backgroundColor: 'rgba(56, 189, 248, 0.25)',
                        cursor: 'grab',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        userSelect: 'none',
                        zIndex: 10
                      }}
                    >
                      <img src={signatureImage} alt="Firma" style={{ maxHeight: '100%', maxWidth: '100%', pointerEvents: 'none' }} />
                      <span style={{ position: 'absolute', bottom: '-18px', left: 0, fontSize: '9px', background: '#0284c7', color: '#fff', padding: '1px 4px', borderRadius: '2px' }}>
                        ✋ Arrástrame aquí
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* PANEL DE TRAZO DE FIRMA */}
            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>4. Trazar Firma</h3>
              <div style={{ marginBottom: '10px' }}>
                <SignatureCanvas ref={signatureRef} />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button className="btn" onClick={handleCaptureSignature} style={{ backgroundColor: '#0284c7' }}>
                  📌 Usar y Colocar Firma en Hoja
                </button>
                <button className="btn" onClick={handleClearSignature} style={{ backgroundColor: '#dc2626' }}>
                  Limpiar Lienzo
                </button>
                
                <hr style={{ margin: '10px 0', border: 'none', borderTop: '1px solid #e2e8f0' }} />

                <button 
                  className="btn" 
                  onClick={handleProcessDocumentSigning} 
                  disabled={isProcessing || !signatureImage}
                  style={{ backgroundColor: signatureImage ? '#16a34a' : '#94a3b8', padding: '12px' }}
                >
                  {isProcessing ? 'Procesando...' : '⚡ Estampar y Finalizar PDF'}
                </button>
              </div>
            </div>

          </div>
        )}

        {/* 4. DESCARGA DEL ARCHIVO FINAL */}
        {signedDocumentUrl && (
          <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ color: '#15803d', margin: '0 0 10px 0' }}>✅ ¡Documento Firmado con Éxito!</h3>
            <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 15px 0' }}>
              La firma se ha insertado exactamente en la posición donde ubicaste el recuadro azul sobre la hoja.
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
