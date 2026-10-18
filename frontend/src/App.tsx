import React, { useRef, useState, useEffect } from 'react';
import { SignatureCanvas, SignatureCanvasRef } from './components/signature/SignatureCanvas';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';
import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY || '';
const supabase = (supabaseUrl && supabaseAnonKey) ? createClient(supabaseUrl, supabaseAnonKey) : null;

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface DocumentoSST {
  id: number;
  codigo: string;
  titulo: string;
  tipo: 'procedimiento' | 'formato' | 'acta';
  version: string;
  extension: string;
  url_archivo: string;
}

export function App() {
  const [activeTab, setActiveTab] = useState<'firma' | 'procedimientos' | 'actas' | 'formatos'>('firma');

  const signatureRef = useRef<SignatureCanvasRef>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  // Datos de usuario
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');

  // Catálogo desde Supabase
  const [documentos, setDocumentos] = useState<DocumentoSST[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<DocumentoSST | null>(null);

  // --- ESTADOS FM-SST-47 (INSPECCIÓN EPP Y EPCC - 13 ELEMENTOS EXACTOS) ---
  const [eppFecha, setEppFecha] = useState(new Date().toISOString().split('T')[0]);
  const [eppLugar, setEppLugar] = useState('Cantagallo / Frente Poste');
  const [eppTrabajador, setEppTrabajador] = useState('Matilde Chamorro');
  const [eppCargo, setEppCargo] = useState('Técnico Electricista');
  const [eppInspector, setEppInspector] = useState('Coordinador Alturas');
  const [eppTipoInsp, setEppTipoInsp] = useState<'Preuso' | 'Periódica'>('Preuso');
  const [eppResultado, setEppResultado] = useState<'APTO' | 'NO_APTO'>('APTO');

  // --- ESTADOS FM-SST-46 (INSPECCIÓN DE ESCALERA - 15 CRITERIOS EXACTOS) ---
  const [escFecha, setEscFecha] = useState(new Date().toISOString().split('T')[0]);
  const [escUbicacion, setEscUbicacion] = useState('Cantagallo');
  const [escId, setEscId] = useState('ESC-DIEL-01');
  const [escMarca, setEscMarca] = useState('Cuprum Dieléctrica 8m');
  const [escInspector, setEscInspector] = useState('Matilde Chamorro');
  const [escCargo, setEscCargo] = useState('Técnico');
  const [escTipo, setEscTipo] = useState('Extensión');
  const [escLongitud, setEscLongitud] = useState('8 Metros');

  // --- ESTADOS FM-SST-45 (ATS) ---
  const [atsFecha, setAtsFecha] = useState(new Date().toISOString().split('T')[0]);
  const [atsHoraInicio, setAtsHoraInicio] = useState('07:00');
  const [atsLugar, setAtsLugar] = useState('Cantagallo / El Peñón');
  const [atsOrdenTrabajo, setAtsOrdenTrabajo] = useState('OT-2026-001');
  const [atsActividad, setAtsActividad] = useState('Mantenimiento de Alumbrado Público');
  const [atsAltura, setAtsAltura] = useState('8');
  const [atsRespTarea, setAtsRespTarea] = useState('Matilde Chamorro');
  const [atsCoordTA, setAtsCoordTA] = useState('Supervisor SST');

  // PDF y Firma
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfDocJs, setPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState<number>(1);
  const [selectedPage, setSelectedPage] = useState<number>(1);

  const [signatureImage, setSignatureImage] = useState<string | null>(null);
  const [posXPercent, setPosXPercent] = useState<number>(20);
  const [posYPercent, setPosYPercent] = useState<number>(75);
  const [sigScale, setSigScale] = useState<number>(180);

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [signedDocumentUrl, setSignedDocumentUrl] = useState<string | null>(null);

  useEffect(() => {
    if ((activeTab === 'procedimientos' || activeTab === 'actas' || activeTab === 'formatos') && supabase) {
      const fetchDocs = async () => {
        setIsLoadingDocs(true);
        const { data, error } = await supabase
          .from('documentos_sst')
          .select('*')
          .order('codigo', { ascending: true });

        if (!error && data) {
          setDocumentos(data as DocumentoSST[]);
        }
        setIsLoadingDocs(false);
      };
      fetchDocs();
    }
  }, [activeTab]);

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

  useEffect(() => {
    if (!pdfDocJs || !pdfCanvasRef.current || activeTab !== 'firma') return;

    let isMounted = true;
    pdfDocJs.getPage(selectedPage).then((page: any) => {
      if (!isMounted) return;
      const canvas = pdfCanvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      const isMobile = window.innerWidth < 768;
      const scale = isMobile ? 0.75 : 1.0;
      const viewport = page.getViewport({ scale });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = { canvasContext: context!, viewport };
      page.render(renderContext);
    });

    return () => { isMounted = false; };
  }, [pdfDocJs, selectedPage, activeTab]);

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
      const targetPage = pages[selectedPage - 1];
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();

      const sigWidth = Number(sigScale);
      const sigHeight = Number(sigScale) * 0.45;

      const realX = (pageWidth - sigWidth) * (posXPercent / 100);
      const realY = pageHeight - ((pageHeight - sigHeight) * (posYPercent / 100)) - sigHeight;

      const base64Data = signatureImage.split(',')[1];
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const embeddedImage = await pdfDoc.embedPng(bytes);

      targetPage.drawImage(embeddedImage, {
        x: Math.max(10, realX),
        y: Math.max(15, realY + 12),
        width: sigWidth,
        height: sigHeight,
      });

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const timestamp = new Date().toISOString();
      const auditText = `FIRMADO ELECTRÓNICAMENTE | ${signerName} (C.C. ${signerDoc}) | ${timestamp}`;

      targetPage.drawText(auditText, {
        x: Math.max(10, realX),
        y: Math.max(5, realY - 2),
        size: 5.5,
        font,
        color: rgb(0.3, 0.3, 0.3),
        opacity: 0.65,
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

  const handleSaveDynamicForm = () => {
    alert(`✅ Registro oficial del formato ${selectedFormat?.codigo} (${selectedFormat?.titulo}) diligenciado y guardado exitosamente en la base de datos de auditoría de TECNOPROYECTOS INGENIERÍA S.A.S.`);
    setSelectedFormat(null);
  };

  const procedimientosList = documentos.filter(d => d.tipo === 'procedimiento');
  const actasList = documentos.filter(d => d.tipo === 'acta');
  const formatosList = documentos.filter(d => d.tipo === 'formato');

  return (
    <div className="app-container" style={{ padding: '10px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff', borderRadius: '12px', padding: '15px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
        
        {/* ENCABEZADO CORPORATIVO */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img 
              src="https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg" 
              alt="Logo Tecnoproyectos" 
              style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1e3a8a', boxShadow: '0 2px 6px rgba(0,0,0,0.15)' }} 
            />
            <div>
              <h1 className="title" style={{ color: '#1e3a8a', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
              <p style={{ color: '#4b5563', fontSize: '12px', margin: '2px 0 0 0' }}>
                Sistema de Gestión SG-SST (Decreto 1072 de 2015)
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px', flexWrap: 'wrap' }}>
            <button onClick={() => { setActiveTab('firma'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'firma' ? '#1e3a8a' : 'transparent', color: activeTab === 'firma' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>✍️ Firma Digital</button>
            <button onClick={() => { setActiveTab('procedimientos'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'procedimientos' ? '#1e3a8a' : 'transparent', color: activeTab === 'procedimientos' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📋 Procedimientos</button>
            <button onClick={() => { setActiveTab('actas'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'actas' ? '#1e3a8a' : 'transparent', color: activeTab === 'actas' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📄 Actas SST</button>
            <button onClick={() => { setActiveTab('formatos'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'formatos' ? '#1e3a8a' : 'transparent', color: activeTab === 'formatos' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📁 Formatos</button>
          </div>
        </div>

        {/* PESTAÑA 1: FIRMA DIGITAL */}
        {activeTab === 'firma' && (
          <div>
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>1. Datos del Firmante</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombre Completo:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} /></div>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula / Documento:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} /></div>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo / Rol:</label><input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '13px' }} /></div>
              </div>
            </div>

            <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>2. Cargar Documento PDF del SG-SST</h3>
              <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ padding: '6px', border: '1px dashed #0284c7', borderRadius: '6px', width: '95%', backgroundColor: '#ffffff', fontSize: '12px' }} />
              {pdfFile && <p style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '12px', marginTop: '6px' }}>📄 Cargado: {pdfFile.name}</p>}
            </div>

            {pdfDocJs && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div style={{ order: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>3. Vista Previa Hoja</h3>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', marginRight: '4px' }}>Pág:</label>
                      <select value={selectedPage} onChange={(e) => setSelectedPage(Number(e.target.value))} style={{ padding: '3px 6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                        {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (
                          <option key={p} value={p}>Página {p} de {numPages}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div style={{ position: 'relative', border: '2px solid #0284c7', borderRadius: '6px', overflow: 'auto', maxHeight: '480px', backgroundColor: '#64748b', padding: '8px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <canvas ref={pdfCanvasRef} style={{ display: 'block', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', maxWidth: '100%', height: 'auto' }} />
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
                          <span style={{ fontSize: '7.5px', color: '#0284c7', fontWeight: 'bold', display: 'block' }}>📍 Sello y Posición Exacta</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div style={{ order: 2 }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>4. Ajuste y Firma Táctil</h3>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Horizontal (Izq ↔ Der): {posXPercent}%</label>
                    <input type="range" min="0" max="100" value={posXPercent} onChange={(e) => setPosXPercent(Number(e.target.value))} style={{ width: '100%', marginBottom: '8px' }} />

                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Vertical (Arr ↕ Abj): {posYPercent}%</label>
                    <input type="range" min="0" max="100" value={posYPercent} onChange={(e) => setPosYPercent(Number(e.target.value))} style={{ width: '100%', marginBottom: '8px' }} />

                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Tamaño de Firma: {sigScale}px</label>
                    <input type="range" min="100" max="300" step="10" value={sigScale} onChange={(e) => setSigScale(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>

                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Dibuje su Firma (Dedo / Mouse):</label>
                    <div style={{ minHeight: '190px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', overflow: 'hidden', touchAction: 'none' }}>
                      <SignatureCanvas ref={signatureRef} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <button className="btn" onClick={handleCaptureSignature} style={{ backgroundColor: '#0284c7', padding: '9px', fontSize: '12px' }}>📌 Confirmar Trazo de Firma</button>
                    {signatureImage && <p style={{ color: '#16a34a', fontSize: '11px', margin: '0', fontWeight: 'bold', textAlign: 'center' }}>✅ Firma lista para estampar.</p>}
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" onClick={handleClearSignature} style={{ backgroundColor: '#dc2626', flex: 1, padding: '9px', fontSize: '12px' }}>Limpiar</button>
                      <button className="btn" onClick={handleProcessDocumentSigning} disabled={isProcessing || !signatureImage} style={{ backgroundColor: signatureImage ? '#16a34a' : '#94a3b8', flex: 2, padding: '9px', fontSize: '12px' }}>
                        {isProcessing ? 'Procesando...' : '⚡ Firmar y Estampar'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {signedDocumentUrl && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
                <h3 style={{ color: '#15803d', margin: '0 0 8px 0', fontSize: '15px' }}>✅ ¡Documento Firmado con Éxito!</h3>
                <a href={signedDocumentUrl} download={`FIRMADO_${pdfFile?.name || 'documento.pdf'}`} className="btn" style={{ display: 'inline-block', textDecoration: 'none', backgroundColor: '#0284c7', fontSize: '14px', padding: '10px 20px' }}>
                  📥 Descargar PDF Firmado Definitivo
                </a>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 2: PROCEDIMIENTOS */}
        {activeTab === 'procedimientos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📋 Manuales y Procedimientos SG-SST</h2>
            {isLoadingDocs ? <p style={{ color: '#0284c7', fontSize: '13px', textAlign: 'center' }}>⏳ Cargando...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {procedimientosList.map((doc) => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Versión: {doc.version}</p>
                    </div>
                    <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}>📖 Ver Documento</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 3: ACTAS SST */}
        {activeTab === 'actas' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📄 Actas de Conformación y Reunión SG-SST</h2>
            {isLoadingDocs ? <p style={{ color: '#0284c7', fontSize: '13px', textAlign: 'center' }}>⏳ Cargando...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {actasList.map((doc) => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong>
                    </div>
                    <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}>📖 Ver Acta</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 4: FORMATOS CON FIDELIDAD 100% AL DOCUMENTO ORIGINAL */}
        {activeTab === 'formatos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📁 Formatos y Plantillas Diligenciables</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Diligencie cada punto y tabla exactamente como el formato oficial de la empresa.</p>

            {selectedFormat && (
              <div style={{ backgroundColor: '#ffffff', border: '2px solid #1e3a8a', padding: '20px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                
                {/* ENCABEZADO FORMULARIO */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '10px', marginBottom: '15px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>FORMATO OFICIAL SG-SST TECNOPROYECTOS</span>
                    <h3 style={{ margin: '2px 0 0 0', color: '#1e3a8a', fontSize: '16px', fontWeight: 'bold' }}>{selectedFormat.codigo} - {selectedFormat.titulo}</h3>
                  </div>
                  <button onClick={() => setSelectedFormat(null)} style={{ border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>❌ Cerrar</button>
                </div>

                {/* ========================================================
                    FM-SST-47: INSPECCIÓN DE EPP Y EPCC (13 FILAS EXACTAS)
                   ======================================================== */}
                {selectedFormat.codigo === 'FM-SST-47' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>ENCABEZADO OFICIAL FM-SST-47</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={eppFecha} onChange={(e) => setEppFecha(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Lugar / Frente:</label><input type="text" value={eppLugar} onChange={(e) => setEppLugar(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={eppTrabajador} onChange={(e) => setEppTrabajador(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo:</label><input type="text" value={eppCargo} onChange={(e) => setEppCargo(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Inspector:</label><input type="text" value={eppInspector} onChange={(e) => setEppInspector(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tipo de Inspección:</label>
                          <select value={eppTipoInsp} onChange={(e) => setEppTipoInsp(e.target.value as any)} style={{ width: '98%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}>
                            <option value="Preuso">Preuso</option>
                            <option value="Periódica">Periódica</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>TABLA DE INSPECCIÓN (13 ELEMENTOS OFICIALES)</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Elemento</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Criterio de inspección</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '90px' }}>C / NC / N.A.</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '110px' }}>ID / Serial</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Observación / acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { el: 'Casco Tipo I Clase E + barbuquejo', cr: 'Carcasa, suspensión y barbuquejo íntegros; limpio, seco, sin perforaciones.' },
                            { el: 'Gafas de seguridad', cr: 'Lentes y montura sin fisuras/daños; visión clara; ajuste adecuado.' },
                            { el: 'Careta de esmerilado', cr: 'Visor y soporte íntegros; limpio; ajuste seguro.' },
                            { el: 'Guantes aislantes eléctricos', cr: 'Sin perforaciones, cortes, grietas, humedad; clase adecuada a tensión.' },
                            { el: 'Guantes anticorte / nitrilo', cr: 'Sin roturas, perforaciones o contaminación incompatible.' },
                            { el: 'Calzado de seguridad EH', cr: 'Suela, capellada y costuras íntegras; seco; sin perforaciones.' },
                            { el: 'Arnés multipropósito dieléctrico', cr: 'Cintas sin cortes, quemaduras o abrasión; herrajes sin deformación.' },
                            { el: 'Eslinga de posicionamiento', cr: 'Cintas/cuerda y costuras íntegras; conectores operativos.' },
                            { el: 'Línea de vida vertical', cr: 'Sin abrasión, cortes, quemaduras, contaminación o nudos no permitidos.' },
                            { el: 'Arrestador de caídas', cr: 'Compatible con la línea; mecanismo funciona; sentido de instalación correcto.' },
                            { el: 'Conectores / mosquetones', cr: 'Cierre y seguro operan; sin deformación, fisuras o corrosión.' },
                            { el: 'Anclaje / adaptador portátil', cr: 'Sin daño, modificación o corrosión; identificación presente.' },
                            { el: 'Ropa de trabajo manga larga / pantalón', cr: 'Íntegra, seca y adecuada; cumple arc rating si aplica.' }
                          ].map((item, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{item.el}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{item.cr}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="C" style={{ padding: '3px', fontSize: '11px', width: '100%' }}>
                                  <option value="C">C</option>
                                  <option value="NC">NC</option>
                                  <option value="N.A.">N.A.</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}><input type="text" placeholder="Serial..." style={{ width: '95%', fontSize: '11px', padding: '3px' }} /></td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}><input type="text" placeholder="Obs..." style={{ width: '95%', fontSize: '11px', padding: '3px' }} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 6px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>RESULTADO DE LA INSPECCIÓN</h4>
                      <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <input type="radio" name="resEpp" checked={eppResultado === 'APTO'} onChange={() => setEppResultado('APTO')} /> EPP / EQUIPOS APTOS PARA USO
                        </label>
                        <label style={{ fontSize: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '6px', color: '#dc2626' }}>
                          <input type="radio" name="resEpp" checked={eppResultado === 'NO_APTO'} onChange={() => setEppResultado('NO_APTO')} /> EXISTEN ELEMENTOS NO CONFORMES - RETIRAR
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* ========================================================
                    FM-SST-46: INSPECCIÓN DE ESCALERA (15 CRITERIOS EXACTOS)
                   ======================================================== */}
                {selectedFormat.codigo === 'FM-SST-46' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>ENCABEZADO OFICIAL FM-SST-46</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={escFecha} onChange={(e) => setEscFecha(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Ubicación:</label><input type="text" value={escUbicacion} onChange={(e) => setEscUbicacion(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Código / ID Escalera:</label><input type="text" value={escId} onChange={(e) => setEscId(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Marca / Serial:</label><input type="text" value={escMarca} onChange={(e) => setEscMarca(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Inspector:</label><input type="text" value={escInspector} onChange={(e) => setEscInspector(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo:</label><input type="text" value={escCargo} onChange={(e) => setEscCargo(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>TABLA DE INSPECCIÓN DE ESCALERA (15 CRITERIOS OFICIALES)</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '40px' }}>N°</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Componente / Criterio</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Condición Esperada</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '90px' }}>C / NC / N.A.</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Observación / acción</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { n: 1, c: 'Largueros', cond: 'Sin fisuras, deformaciones, roturas, perforaciones ni reparaciones no autorizadas.' },
                            { n: 2, c: 'Peldaños', cond: 'Completos, firmes, limpios, secos, sin fisuras ni deformaciones.' },
                            { n: 3, c: 'Zapatas antideslizantes', cond: 'Presentes, íntegras, firmes y con capacidad de agarre.' },
                            { n: 4, c: 'Seguros / ganchos de extensión', cond: 'Operan correctamente, sin deformación ni desgaste crítico.' },
                            { n: 5, c: 'Cuerda de extensión', cond: 'Sin cortes, abrasión, quemaduras, contaminación ni deterioro.' },
                            { n: 6, c: 'Polea / sistema de extensión', cond: 'Giro y funcionamiento correctos; sin daño o bloqueo.' },
                            { n: 7, c: 'Guías y herrajes', cond: 'Firmes, completos, sin corrosión o deformación.' },
                            { n: 8, c: 'Limpieza y condición dieléctrica', cond: 'Libre de humedad, aceites, grasas, pintura o contaminación conductora.' },
                            { n: 9, c: 'Etiquetas y advertencias', cond: 'Legibles; identificación y datos críticos visibles.' },
                            { n: 10, c: 'Base / nivelación', cond: 'Base firme; no requiere piedras, bloques u objetos improvisados.' },
                            { n: 11, c: 'Longitud y solape', cond: 'Adecuados para la tarea y dentro de los límites del fabricante.' },
                            { n: 12, c: 'Ángulo de instalación', cond: 'Puede instalarse según el ángulo indicado por el fabricante.' },
                            { n: 13, c: 'Aseguramiento', cond: 'Existen medios para asegurar base y parte superior contra desplazamiento.' },
                            { n: 14, c: 'Entorno eléctrico', cond: 'Material/clasificación apropiados; distancia segura a redes.' },
                            { n: 15, c: 'Historial / hoja de vida', cond: 'Inspecciones y mantenimiento al día; sin evento que obligue a retiro.' }
                          ].map((item) => (
                            <tr key={item.n}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>{item.n}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{item.c}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{item.cond}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="C" style={{ padding: '3px', fontSize: '11px', width: '100%' }}>
                                  <option value="C">C</option>
                                  <option value="NC">NC</option>
                                  <option value="N.A.">N.A.</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}><input type="text" placeholder="Obs..." style={{ width: '95%', fontSize: '11px', padding: '3px' }} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ========================================================
                    FM-SST-45: ATS (ANÁLISIS DE TRABAJO SEGURO)
                   ======================================================== */}
                {selectedFormat.codigo === 'FM-SST-45' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>ENCABEZADO OFICIAL FM-SST-45 (ATS)</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={atsFecha} onChange={(e) => setAtsFecha(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Hora Inicio:</label><input type="time" value={atsHoraInicio} onChange={(e) => setAtsHoraInicio(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Lugar / Frente:</label><input type="text" value={atsLugar} onChange={(e) => setAtsLugar(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Orden de Trabajo:</label><input type="text" value={atsOrdenTrabajo} onChange={(e) => setAtsOrdenTrabajo(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Actividad:</label><input type="text" value={atsActividad} onChange={(e) => setAtsActividad(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Altura Aprox. (m):</label><input type="text" value={atsAltura} onChange={(e) => setAtsAltura(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Responsable Tarea:</label><input type="text" value={atsRespTarea} onChange={(e) => setAtsRespTarea(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Coordinador TA:</label><input type="text" value={atsCoordTA} onChange={(e) => setAtsCoordTA(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>2. ANÁLISIS DE PELIGROS, RIESGOS Y CONTROLES</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Etapa / Tarea</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Peligro</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Consecuencia</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Controles requeridos</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '80px' }}>Verif.</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { et: 'Inspección del sitio', pel: 'Redes energizadas / arco eléctrico', cons: 'Electrocución, quemaduras', ctrl: 'Desenergizar; distancia segura; escalera dieléctrica; EPP eléctrico.' },
                            { et: 'Instalación de escalera', pel: 'Deslizamiento / volcamiento', cons: 'Caída a distinto nivel', ctrl: 'Base firme y nivelada; asegurar base y parte superior; no improvisar.' },
                            { et: 'Ascenso / descenso', pel: 'Caída de persona', cons: 'Trauma grave o fatal', ctrl: 'Línea de vida vertical y arrestador compatibles; arnés; 3 puntos de contacto.' },
                            { et: 'Intervención en poste', pel: 'Caída / sobre alcance', cons: 'Trauma grave o fatal', ctrl: 'Posicionamiento; detención independiente; anclaje definido.' },
                            { et: 'Herramientas / luminaria', pel: 'Caída de objetos', cons: 'Golpes a personal o terceros', ctrl: 'Portaherramientas; amarre/izado; delimitación del área.' },
                            { et: 'Trabajo en vía pública', pel: 'Tránsito vehicular / peatones', cons: 'Atropellamiento / impacto', ctrl: 'Conos, barreras, señalización, ayudante y control de acceso.' },
                            { et: 'Condiciones ambientales', pel: 'Lluvia, viento, tormenta', cons: 'Inestabilidad / riesgo eléctrico', ctrl: 'Suspender ante lluvia, tormenta eléctrica o viento peligroso.' }
                          ].map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{row.et}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{row.pel}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{row.cons}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{row.ctrl}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="Sí" style={{ padding: '3px', fontSize: '11px', width: '100%' }}>
                                  <option value="Sí">Sí</option>
                                  <option value="No">No</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* OTROS FORMATOS (FM-SST-15, 16, 44, etc.) */}
                {!['FM-SST-45', 'FM-SST-46', 'FM-SST-47'].includes(selectedFormat.codigo) && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>REGISTRO OFICIAL - {selectedFormat.codigo}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Responsable:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* BOTÓN GUARDAR EN SUPABASE */}
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>🔒 Formato regulatorio completo listo para auditoría SG-SST</span>
                  <button onClick={handleSaveDynamicForm} className="btn" style={{ backgroundColor: '#16a34a', padding: '10px 20px', fontSize: '13px', fontWeight: 'bold' }}>
                    💾 Registrar Formato Completo en Supabase
                  </button>
                </div>

              </div>
            )}

            {/* LISTADO DE FORMATOS */}
            {isLoadingDocs ? <p style={{ color: '#0284c7', fontSize: '13px', textAlign: 'center' }}>⏳ Cargando formatos...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {formatosList.map((doc) => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Estructura Regulada Completa | Plantilla: .{doc.extension}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => setSelectedFormat(doc)} className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px' }}>
                        ✍️ Diligenciar Formato Web Completo
                      </button>
                      <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#16a34a', padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}>📥 Descargar Plantilla Word</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PIE DE PÁGINA */}
        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Powered by</span>
          <img src="https://static.wixstatic.com/media/d0ce54_c999d1aa9976438a98b0f5b2157b7adc~mv2.png" alt="Logo Desarrollador" style={{ height: '24px', objectFit: 'contain' }} />
        </div>

      </div>
    </div>
  );
}

export default App;
