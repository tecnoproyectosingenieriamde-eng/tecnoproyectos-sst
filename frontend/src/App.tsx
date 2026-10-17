import React, { useRef, useState } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export function App() {
  const signatureRef = useRef<SignatureCanvasRef>(null);
  
  // Datos del Firmante (TECNOPROYECTOS INGENIERÍA S.A.S.)
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');
  
  // Gestión del Documento PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  
  // Configuración de página y posición preestablecida
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [positionPreset, setPositionPreset] = useState<'bottom-right' | 'bottom-left' | 'bottom-center'>('bottom-right');
  
  // Estado de resultado
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState<string | null>(null);

  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfPreviewUrl(url);
      setSignedDocumentUrl(null);
    } else {
      alert('Por favor seleccione un archivo en formato PDF válido.');
    }
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
  };

  // Función inteligente de estampado basada en ubicaciones predefinidas
  const handleProcessDocumentSigning = async () => {
    if (!pdfFile) {
      alert('Primero debe cargar un documento PDF.');
      return;
    }
    if (signatureRef.current?.isEmpty()) {
      alert('Por favor realice su firma en el recuadro antes de procesar.');
      return;
    }

    try {
      setIsProcessing(true);

      // 1. Leer el PDF cargado
      const arrayBuffer = await pdfFile.arrayBuffer();
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      
      const pages = pdfDoc.getPages();
      if (selectedPage < 1 || selectedPage > pages.length) {
        alert(`Número de página inválido. El documento tiene ${pages.length} páginas.`);
        setIsProcessing(false);
        return;
      }

      const targetPage = pages[selectedPage - 1];
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();

      // 2. Calcular coordenadas exactas (X, Y) según el botón que elegiste
      let posX = 50;
      let posY = 100; // Distancia desde la parte inferior

      const sigWidth = 140;
      const sigHeight = 55;

      if (positionPreset === 'bottom-right') {
        posX = pageWidth - sigWidth - 60; // Margen derecho
        posY = 90;
      } else if (positionPreset === 'bottom-left') {
        posX = 60; // Margen izquierdo
        posY = 90;
      } else if (positionPreset === 'bottom-center') {
        posX = (pageWidth / 2) - (sigWidth / 2); // Centrado
        posY = 90;
      }

      // 3. Obtener la firma del canvas y convertirla a bytes binarios seguros
      const signatureDataUrl = signatureRef.current.toDataURL('image/png');
      const base64Data = signatureDataUrl.split(',')[1];
      const binaryString = atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const embeddedImage = await pdfDoc.embedPng(bytes);

      // 4. Dibujar la imagen de la firma en la posición calculada
      targetPage.drawImage(embeddedImage, {
        x: posX,
        y: posY,
        width: sigWidth,
        height: sigHeight,
      });

      // 5. Agregar texto de auditoría legal (Ley 527 de 1999)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timestamp = new Date().toISOString();
      const auditText = `FIRMADO ELECTRÓNICAMENTE | ${signerName} (C.C. ${signerDoc}) | ${timestamp}`;

      targetPage.drawText(auditText, {
        x: posX,
        y: Math.max(10, posY - 12),
        size: 6,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });

      // 6. Guardar el documento modificado
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const signedUrl = URL.createObjectURL(blob);

      setSignedDocumentUrl(signedUrl);
      setIsProcessing(false);
      alert('¡Documento firmado, sellado y listo para descargar con éxito!');
    } catch (error) {
      console.error('Error al estampar el PDF:', error);
      alert('Ocurrió un error al procesar y firmar el PDF.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff' }}>
        <h1 className="title" style={{ color: '#1e3a8a', margin: '0 0 5px 0' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
        <p style={{ color: '#4b5563', fontSize: '14px', margin: '0 0 15px 0' }}>
          Plataforma SG-SST — Módulo de Firma Electrónica y Estampado en PDF (Ley 527 de 1999)
        </p>

        {/* 1. DATOS DEL FIRMANTE */}
        <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>1. Datos del Firmante</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Nombre Completo:</label>
              <input 
                type="text" 
                value={signerName} 
                onChange={(e) => setSignerName(e.target.value)} 
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Cédula / Documento:</label>
              <input 
                type="text" 
                value={signerDoc} 
                onChange={(e) => setSignerDoc(e.target.value)} 
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Cargo / Rol:</label>
              <input 
                type="text" 
                value={signerRole} 
                onChange={(e) => setSignerRole(e.target.value)} 
                style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
              />
            </div>
          </div>
        </div>

        {/* 2. CARGAR PDF */}
        <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>2. Cargar Documento PDF del SG-SST</h3>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handlePdfUpload}
            style={{ padding: '8px', border: '1px dashed #0284c7', borderRadius: '6px', width: '95%', backgroundColor: '#ffffff' }}
          />
          {pdfFile && (
            <p style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px', marginTop: '8px' }}>
              📄 Documento cargado: {pdfFile.name}
            </p>
          )}
        </div>

        {/* 3. VISOR Y SELECCIÓN DE UBICACIÓN INTELIGENTE */}
        {pdfPreviewUrl && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '20px' }}>
            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>Vista Previa del PDF</h3>
              <iframe 
                src={pdfPreviewUrl} 
                title="Vista previa PDF" 
                style={{ width: '100%', height: '400px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>Ubicación de la Firma</h3>
              
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Número de Página:</label>
                <input 
                  type="number" 
                  min="1" 
                  value={selectedPage} 
                  onChange={(e) => setSelectedPage(Number(e.target.value))} 
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '15px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>¿Dónde ubicar la firma en la hoja?</label>
                <select 
                  value={positionPreset} 
                  onChange={(e) => setPositionPreset(e.target.value as any)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #cbd5e1', backgroundColor: '#fff', marginTop: '5px' }}
                >
                  <option value="bottom-right">Esquina Inferior Derecha (Estándar)</option>
                  <option value="bottom-left">Esquina Inferior Izquierda</option>
                  <option value="bottom-center">Centro Inferior</option>
                </select>
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Dibuje su Firma (Dedo / Mouse):</label>
                <SignatureCanvas ref={signatureRef} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  className="btn" 
                  onClick={handleProcessDocumentSigning} 
                  disabled={isProcessing}
                  style={{ backgroundColor: '#16a34a', flex: 1 }}
                >
                  {isProcessing ? 'Procesando...' : '⚡ Firmar y Estampar PDF'}
                </button>
                <button 
                  className="btn" 
                  onClick={handleClearSignature} 
                  style={{ backgroundColor: '#dc2626' }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 4. DESCARGAR PDF REAL FIRMADO */}
        {signedDocumentUrl && (
          <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
            <h3 style={{ color: '#15803d', margin: '0 0 10px 0' }}>✅ ¡Documento Firmado y Estampado con Éxito!</h3>
            <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 15px 0' }}>
              La firma y el sello de auditoría legal ya están incrustados en la posición seleccionada de forma permanente.
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
