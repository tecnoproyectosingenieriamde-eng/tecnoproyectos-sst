import React, { useRef, useState } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export function App() {
  const signatureRef = useRef<SignatureCanvasRef>(null);
  
  // Datos del Firmante (Predeterminados para TECNOPROYECTOS)
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');
  
  // Gestión del Documento PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  
  // Configuración de posición de la firma
  const [selectedPage, setSelectedPage] = useState<number>(1);
  const [posX, setPosX] = useState<number>(100);
  const [posY, setPosY] = useState<number>(150);
  
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

  // Función real de estampado con pdf-lib en el navegador
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

      // 2. Obtener la imagen de la firma desde el canvas
      const signatureDataUrl = signatureRef.current.toDataURL('image/png');
      const signatureImageBytes = await fetch(signatureDataUrl).then((res) => res.arrayBuffer());
      const embeddedImage = await pdfDoc.embedPng(signatureImageBytes);

      // 3. Dibujar la imagen de la firma en el PDF
      targetPage.drawImage(embeddedImage, {
        x: Number(posX),
        y: Number(posY),
        width: 140,
        height: 60,
      });

      // 4. Agregar texto de auditoría y trazabilidad legal (Ley 527 / Decreto 1072)
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timestamp = new Date().toISOString();
      const auditText = `FIRMADO ELECTRÓNICAMENTE | Nombre: ${signerName} | C.C.: ${signerDoc} | Fecha: ${timestamp}`;

      targetPage.drawText(auditText, {
        x: Number(posX),
        y: Math.max(10, Number(posY) - 12),
        size: 6,
        font,
        color: rgb(0.15, 0.15, 0.15),
      });

      // 5. Guardar el documento modificado
      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const signedUrl = URL.createObjectURL(blob);

      setSignedDocumentUrl(signedUrl);
      setIsProcessing(false);
      alert('¡Documento firmado y sellado electrónicamente con éxito!');
    } catch (error) {
      console.error(error);
      alert('Ocurrió un error al procesar y firmar el PDF.');
      setIsProcessing(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff' }}>
        <h1 className="title" style={{ color: '#1e3a8a', margin: '0 0 5px 0' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
        <p style={{ color: '#4b5563', fontSize: '14px', margin: '0 0 15px 0' }}>
          Sistema SG-SST — Módulo de Firma Electrónica con Estampado Directo en PDF (Ley 527 de 1999)
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

        {/* 3. VISOR Y CONFIGURACIÓN DE POSICIÓN */}
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
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>Posición y Firma</h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '5px', marginBottom: '10px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Página:</label>
                  <input type="number" min="1" value={selectedPage} onChange={(e) => setSelectedPage(Number(e.target.value))} style={{ width: '100%', padding: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Pos X (Izquierda):</label>
                  <input type="number" value={posX} onChange={(e) => setPosX(Number(e.target.value))} style={{ width: '100%', padding: '4px' }} />
                </div>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Pos Y (Altura):</label>
                  <input type="number" value={posY} onChange={(e) => setPosY(Number(e.target.value))} style={{ width: '100%', padding: '4px' }} />
                </div>
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
              El archivo PDF ahora contiene tu trazo real y el sello de auditoría legal incorporados en el documento.
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
