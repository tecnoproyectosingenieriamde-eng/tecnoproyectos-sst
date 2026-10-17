import React, { useRef, useState } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';

export function App() {
  const signatureRef = useRef<SignatureCanvasRef>(null);
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [documentTitle, setDocumentTitle] = useState('Acta de Inducción y Soporle de EPP - SG-SST');
  const [savedSignature, setSavedSignature] = useState<string | null>(null);

  const handleClear = () => {
    signatureRef.current?.clear();
    setSavedSignature(null);
  };

  const handleUndo = () => {
    signatureRef.current?.undo();
  };

  const handleSave = () => {
    if (signatureRef.current?.isEmpty()) {
      alert('Por favor realice la firma electrónica en el recuadro antes de guardar.');
      return;
    }
    const dataURL = signatureRef.current?.toDataURL();
    setSavedSignature(dataURL || null);
    alert('¡Firma electrónica capturada y lista para asociar al documento del SG-SST!');
  };

  return (
    <div className="app-container">
      <div className="card" style={{ borderTop: '4px solid #1e3a8a' }}>
        <h1 className="title">TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
        <p style={{ color: '#555', marginBottom: '20px' }}>
          Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) — Módulo de Firma Electrónica (Ley 527 de 1999 / Decreto 1072 de 2015)[cite: 1, 4].
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', marginBottom: '20px' }}>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Nombre del Firmante:</label>
            <input 
              type="text" 
              value={signerName} 
              onChange={(e) => setSignerName(e.target.value)} 
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Cédula / Documento:</label>
            <input 
              type="text" 
              value={signerDoc} 
              onChange={(e) => setSignerDoc(e.target.value)} 
              style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>Documento a Firmar:</label>
          <input 
            type="text" 
            value={documentTitle} 
            onChange={(e) => setDocumentTitle(e.target.value)} 
            style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '5px' }}>
            Dibuje su Firma (Use su dedo, lápiz táctil o mouse):
          </label>
          <SignatureCanvas ref={signatureRef} />
        </div>

        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <button className="btn" onClick={handleSave} style={{ backgroundColor: '#16a34a' }}>
            Guardar Firma Electrónica
          </button>
          <button className="btn" onClick={handleUndo} style={{ backgroundColor: '#ca8a04' }}>
            Deshacer Trazo
          </button>
          <button className="btn" onClick={handleClear} style={{ backgroundColor: '#dc2626' }}>
            Limpiar Lienzo
          </button>
        </div>

        {savedSignature && (
          <div style={{ marginTop: '20px', padding: '15px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '6px' }}>
            <h3 style={{ color: '#166534', margin: '0 0 10px 0' }}>✅ Firma Capturada Exitosamente</h3>
            <p style={{ fontSize: '13px', margin: '0 0 10px 0' }}>
              Firmante: <strong>{signerName}</strong> (C.C. {signerDoc}) | Documento: {documentTitle}
            </p>
            <img src={savedSignature} alt="Firma Electrónica" style={{ border: '1px solid #ccc', background: '#fff', maxHeight: '100px' }} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
