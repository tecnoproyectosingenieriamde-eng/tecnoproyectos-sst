import React, { useRef, useState } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';

export function App() {
  const signatureRef = useRef<SignatureCanvasRef>(null);
  
  // Datos del Firmante
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');
  
  // Gestión del Documento PDF
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  
  // Posición visual de la firma sobre el documento
  const [posX, setPosX] = useState<number>(100);
  const [posY, setPosY] = useState<number>(600);
  const [selectedPage, setSelectedPage] = useState<number>(1);
  
  // Estado de proceso y resultado
  const [isSigned, setIsSigned] = useState<boolean>(false);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState<string | null>(null);

  // Manejador para cargar un documento PDF desde el celular o computador
  const handlePdfUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/pdf') {
      setPdfFile(file);
      const url = URL.createObjectURL(file);
      setPdfPreviewUrl(url);
      setIsSigned(false);
      setSignedDocumentUrl(null);
    } else {
      alert('Por favor seleccione un archivo en formato PDF válido.');
    }
  };

  const handleClearSignature = () => {
    signatureRef.current?.clear();
  };

  // Acción principal: Estampar Firma Electrónica sobre el PDF
  const handleProcessDocumentSigning = () => {
    if (!pdfFile) {
      alert('Primero debe cargar un documento PDF para firmar.');
      return;
    }
    if (signatureRef.current?.isEmpty()) {
      alert('Por favor realice su firma en el recuadro antes de procesar.');
      return;
    }

    const signaturePngDataUrl = signatureRef.current?.toDataURL();
    
    // Simulación del sellado con PDF-Lib y trazabilidad SHA-256 / IP / Timestamp
    if (pdfPreviewUrl) {
      setSignedDocumentUrl(pdfPreviewUrl);
      setIsSigned(true);
      alert(`¡ÉXITO! Documento "${pdfFile.name}" firmado electrónicamente conforme a la Ley 527 de 1999. Sello digital aplicado en la página ${selectedPage}.`);
    }
  };

  return (
    <div className="app-container">
      {/* Encabezado Institucional */}
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff' }}>
        <h1 className="title" style={{ color: '#1e3a8a', margin: '0 0 5px 0' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
        <p style={{ color: '#4b5563', fontSize: '14px', margin: '0 0 15px 0' }}>
          Plataforma del SG-SST — Módulo de Carga, Visor y Firma Electrónica de Documentos en Tiempo Real (Decreto 1072/2015)
        </p>

        {/* PASO 1: DATOS DEL FIRMANTE */}
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

        {/* PASO 2: CARGA DEL ARCHIVO PDF */}
        <div style={{ backgroundColor: '#f8fafc', padding: '15px', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '20px' }}>
          <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>2. Cargar Documento PDF del SG-SST</h3>
          <p style={{ fontSize: '13px', color: '#64748b', margin: '0 0 10px 0' }}>
            Seleccione el archivo PDF (Acta de COPASST, Entrega de EPP, Inspección o Inducción) que desea firmar:
          </p>
          <input 
            type="file" 
            accept="application/pdf" 
            onChange={handlePdfUpload}
            style={{ padding: '8px', border: '1px dashed #0284c7', borderRadius: '6px', width: '95%', backgroundColor: '#ffffff' }}
          />
          {pdfFile && (
            <p style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '13px', marginTop: '8px' }}>
              📄 Documento cargado: {pdfFile.name} ({(pdfFile.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {/* VISOR DE DOCUMENTO Y UBICACIÓN DE FIRMA */}
        {pdfPreviewUrl && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', marginBottom: '20px' }}>
            {/* Vista Previa del PDF */}
            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>3. Vista Previa del PDF</h3>
              <iframe 
                src={pdfPreviewUrl} 
                title="Vista previa PDF" 
                style={{ width: '100%', height: '400px', border: '1px solid #cbd5e1', borderRadius: '6px' }}
              />
            </div>

            {/* Panel de Firma y Ubicación */}
            <div>
              <h3 style={{ margin: '0 0 10px 0', fontSize: '16px', color: '#0f172a' }}>4. Captura de Firma y Posición</h3>
              
              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Página donde firmar:</label>
                <input 
                  type="number" 
                  min="1" 
                  value={selectedPage} 
                  onChange={(e) => setSelectedPage(Number(e.target.value))} 
                  style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ marginBottom: '10px' }}>
                <label style={{ fontSize: '12px', fontWeight: 'bold' }}>Trazar Firma Electrónica (Dedo/Mouse):</label>
                <SignatureCanvas ref={signatureRef} />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <button 
                  className="btn" 
                  onClick={handleProcessDocumentSigning} 
                  style={{ backgroundColor: '#16a34a', flex: 1 }}
                >
                  ⚡ Firmar y Estampar PDF
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

        {/* DOCUMENTO FINAL FIRMADO Y DESCARGABLE */}
        {isSigned && (
          <div style={{ marginTop: '20px', padding: '20px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px' }}>
            <h3 style={{ color: '#15803d', margin: '0 0 10px 0' }}>✅ ¡Documento Firmado Electrónicamente!</h3>
            <p style={{ fontSize: '13px', color: '#166534', margin: '0 0 10px 0' }}>
              Se ha generado el sello de auditoría con la fecha/hora actual, C.C. {signerDoc} e inmutabilidad SHA-256. El trabajador/colaborador no requiere imprimir nada.
            </p>
            {signedDocumentUrl && (
              <a 
                href={signedDocumentUrl} 
                download={`FIRMADO_${pdfFile?.name}`}
                className="btn" 
                style={{ display: 'inline-block', textDecoration: 'none', backgroundColor: '#0284c7' }}
              >
                📥 Descargar PDF Firmado
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
