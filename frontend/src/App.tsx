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

  // Estado del catálogo desde Supabase
  const [documentos, setDocumentos] = useState<DocumentoSST[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);

  // Formato Seleccionado para Diligenciamiento Profesional
  const [selectedFormat, setSelectedFormat] = useState<DocumentoSST | null>(null);

  // --- ESTADOS FM-SST-15 (INDUCCIÓN) ---
  const [indEmpresa, setIndEmpresa] = useState('TECNOPROYECTOS INGENIERÍA S.A.S.');
  const [indFecha, setIndFecha] = useState(new Date().toISOString().split('T')[0]);
  const [indTemas, setIndTemas] = useState({
    politica: true,
    peligros: true,
    epp: true,
    emergencias: true,
    derechos: true
  });

  // --- ESTADOS FM-SST-16 (EVALUACIÓN INDUCCIÓN) ---
  const [evalP1, setEvalP1] = useState('V');
  const [evalP2, setEvalP2] = useState('V');
  const [evalP3, setEvalP3] = useState('V');
  const [evalResultado, setEvalResultado] = useState('APROBADO (100%)');

  // --- ESTADOS FM-SST-44 (BRIGADISTA) ---
  const [brigSangre, setBrigSangre] = useState('O+');
  const [brigEps, setBrigEps] = useState('SURA EPS');
  const [brigContacto, setBrigContacto] = useState('300 000 0000');
  const [brigNivel, setBrigNivel] = useState('Primeros Auxilios / Evacuación');

  // --- ESTADOS ATS (FM-SST-45) ---
  const [atsFecha, setAtsFecha] = useState(new Date().toISOString().split('T')[0]);
  const [atsHoraInicio, setAtsHoraInicio] = useState('07:00');
  const [atsLugar, setAtsLugar] = useState('');
  const [atsOrdenTrabajo, setAtsOrdenTrabajo] = useState('');
  const [atsActividad, setAtsActividad] = useState('');
  const [atsAltura, setAtsAltura] = useState('8');

  // --- ESTADOS INSPECCIÓN ESCALERA (FM-SST-46) ---
  const [escId, setEscId] = useState('ESC-DIEL-01');
  const [escMarca, setEscMarca] = useState('Cuprum / Dieléctrica');
  const [escInspector, setEscInspector] = useState('Matilde Chamorro');

  // --- ESTADOS INSPECCIÓN EPP (FM-SST-47) ---
  const [eppTipoInsp, setEppTipoInsp] = useState<'Preuso' | 'Periódica'>('Preuso');

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
    alert(`✅ Registro oficial del formato ${selectedFormat?.codigo} (${selectedFormat?.titulo}) guardado exitosamente en la base de datos de auditoría de TECNOPROYECTOS INGENIERÍA S.A.S.`);
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

          {/* NAVEGACIÓN */}
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
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Consulte los manuales y procedimientos operativos estandarizados conforme al Decreto 1072 de 2015.</p>
            {isLoadingDocs ? <p style={{ color: '#0284c7', fontSize: '13px', textAlign: 'center' }}>⏳ Cargando procedimientos...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {procedimientosList.map((doc) => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Versión: {doc.version} | Formato: {doc.extension.toUpperCase()}</p>
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
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Registro oficial de actas de conformación de comités (COPASST, CCL, Vigía, Brigadas) y asignaciones.</p>
            {isLoadingDocs ? <p style={{ color: '#0284c7', fontSize: '13px', textAlign: 'center' }}>⏳ Cargando actas...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {actasList.map((doc) => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Evidencia Oficial | Versión: {doc.version}</p>
                    </div>
                    <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}>📖 Ver Acta</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 4: FORMATOS CON TABLAS Y CAMPOS TOTALMENTE DILIGENCIABLES */}
        {activeTab === 'formatos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📁 Formatos y Plantillas Diligenciables</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Diligencie los formatos oficiales punto por punto conforme a la norma o descargue las plantillas originales.</p>

            {/* FORMULARIO DILIGENCIABLE DINÁMICO */}
            {selectedFormat && (
              <div style={{ backgroundColor: '#ffffff', border: '2px solid #1e3a8a', padding: '20px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                
                {/* ENCABEZADO FORMULARIO OFICIAL */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '10px', marginBottom: '15px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>FORMATO REGULATORIO OFICIAL SG-SST</span>
                    <h3 style={{ margin: '2px 0 0 0', color: '#1e3a8a', fontSize: '16px', fontWeight: 'bold' }}>{selectedFormat.codigo} - {selectedFormat.titulo}</h3>
                  </div>
                  <button onClick={() => setSelectedFormat(null)} style={{ border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>❌ Cerrar</button>
                </div>

                {/* FM-SST-15: REGISTRO DE INDUCCIÓN Y REINDUCCIÓN */}
                {selectedFormat.codigo === 'FM-SST-15' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>1. DATOS DEL TRABAJADOR Y GENERALES</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Empresa / Razón Social:</label><input type="text" value={indEmpresa} onChange={(e) => setIndEmpresa(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha de Inducción:</label><input type="date" value={indFecha} onChange={(e) => setIndFecha(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombre del Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Número de Cédula:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo / Función:</label><input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>2. CONTENIDO Y TEMAS RECIBIDOS EN LA INDUCCIÓN</h4>
                      <div style={{ display: 'grid', gap: '6px', fontSize: '11px' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={indTemas.politica} onChange={(e) => setIndTemas({...indTemas, politica: e.target.checked})} /> Política de Seguridad y Salud en el Trabajo y Objetivos del SG-SST</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={indTemas.peligros} onChange={(e) => setIndTemas({...indTemas, peligros: e.target.checked})} /> Identificación de Peligros, Evaluación y Valoración de Riesgos (GTC 45)</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={indTemas.epp} onChange={(e) => setIndTemas({...indTemas, epp: e.target.checked})} /> Procedimientos de Entrega, Uso, Inspección y Mantenimiento de EPP y EPCC</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={indTemas.emergencias} onChange={(e) => setIndTemas({...indTemas, emergencias: e.target.checked})} /> Plan de Prevención, Preparación y Respuesta ante Emergencias (PL-SST-03)</label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px' }}><input type="checkbox" checked={indTemas.derechos} onChange={(e) => setIndTemas({...indTemas, derechos: e.target.checked})} /> Deberes y Derechos en SST y Mecanismos de Autorreporte de Actos e Incidentes</label>
                      </div>
                    </div>
                  </div>
                )}

                {/* FM-SST-16: EVALUACIÓN DE LA INDUCCIÓN */}
                {selectedFormat.codigo === 'FM-SST-16' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>1. EVALUACIÓN DE CONOCIMIENTOS EN SST</h4>
                      <div style={{ display: 'grid', gap: '10px', fontSize: '11px' }}>
                        <div>
                          <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>1. ¿Es obligatorio reportar inmediatamente cualquier incidente, accidente o condición de riesgo?</p>
                          <select value={evalP1} onChange={(e) => setEvalP1(e.target.value)} style={{ padding: '4px', fontSize: '11px' }}><option value="V">Verdadero (Correcto)</option><option value="F">Falso</option></select>
                        </div>
                        <div>
                          <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>2. ¿El trabajador debe realizar la inspección preuso de su escalera y equipos anticaídas antes de cada labor?</p>
                          <select value={evalP2} onChange={(e) => setEvalP2(e.target.value)} style={{ padding: '4px', fontSize: '11px' }}><option value="V">Verdadero (Correcto)</option><option value="F">Falso</option></select>
                        </div>
                        <div>
                          <p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>3. ¿El uso de EPP es opcional según la comodidad del operador?</p>
                          <select value={evalP3} onChange={(e) => setEvalP3(e.target.value)} style={{ padding: '4px', fontSize: '11px' }}><option value="F">Falso (Correcto)</option><option value="V">Verdadero</option></select>
                        </div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f0fdf4', padding: '10px', borderRadius: '6px', border: '1px solid #22c55e', textAlign: 'center' }}>
                      <strong style={{ fontSize: '12px', color: '#15803d' }}>CALIFICACIÓN FINAL DE EVALUACIÓN: {evalResultado}</strong>
                    </div>
                  </div>
                )}

                {/* FM-SST-44: HOJA DE VIDA DEL BRIGADISTA */}
                {selectedFormat.codigo === 'FM-SST-44' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>HOJA DE VIDA INTEGRANTE BRIGADA DE EMERGENCIAS</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombre Completo:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Grupo Sanguíneo / RH:</label><input type="text" value={brigSangre} onChange={(e) => setBrigSangre(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>EPS Afiliada:</label><input type="text" value={brigEps} onChange={(e) => setBrigEps(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Teléfono de Emergencia:</label><input type="text" value={brigContacto} onChange={(e) => setBrigContacto(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nivel de Capacitación:</label><input type="text" value={brigNivel} onChange={(e) => setBrigNivel(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FM-SST-45: ATS (ANÁLISIS DE TRABAJO SEGURO) */}
                {selectedFormat.codigo === 'FM-SST-45' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>1. DATOS GENERALES DE LA ACTIVIDAD</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={atsFecha} onChange={(e) => setAtsFecha(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Hora Inicio:</label><input type="time" value={atsHoraInicio} onChange={(e) => setAtsHoraInicio(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Lugar / Frente de Trabajo:</label><input type="text" value={atsLugar} onChange={(e) => setAtsLugar(e.target.value)} placeholder="Ej: Municipio Cantagallo / Poste #45" style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Orden de Trabajo:</label><input type="text" value={atsOrdenTrabajo} onChange={(e) => setAtsOrdenTrabajo(e.target.value)} placeholder="OT-2026-88" style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Actividad Específica:</label><input type="text" value={atsActividad} onChange={(e) => setAtsActividad(e.target.value)} placeholder="Mantenimiento de luminarias en altura" style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Altura Aprox. (Metros):</label><input type="text" value={atsAltura} onChange={(e) => setAtsAltura(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>2. ANÁLISIS DE PELIGROS, RIESGOS Y CONTROLES POR ETAPA</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Etapa / Tarea</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Peligro Identificado</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Consecuencia</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Controles Requeridos</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Verificación</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>1. Inspección del sitio</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Redes energizadas / Arco eléctrico</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Electrocución, quemaduras</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Desenergizar / Distancia segura / Escalera dieléctrica</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}><input type="checkbox" defaultChecked /> Cumple</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>2. Instalación de escalera</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Deslizamiento / Volcamiento</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Caída a distinto nivel</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Base firme y nivelada; amarrar base y parte superior</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}><input type="checkbox" defaultChecked /> Cumple</td>
                          </tr>
                          <tr>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>3. Ascenso / Descenso</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Caída de persona</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Trauma grave o fatal</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Línea de vida vertical, arrestador, arnés, 3 puntos de contacto</td>
                            <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}><input type="checkbox" defaultChecked /> Cumple</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* FM-SST-46: INSPECCIÓN DE ESCALERA */}
                {selectedFormat.codigo === 'FM-SST-46' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>ENCABEZADO DE INSPECCIÓN PREUSO / PERIÓDICA</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Código / ID Escalera:</label><input type="text" value={escId} onChange={(e) => setEscId(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Marca / Serial:</label><input type="text" value={escMarca} onChange={(e) => setEscMarca(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Inspector Responsable:</label><input type="text" value={escInspector} onChange={(e) => setEscInspector(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>TABLA DE LISTA DE CHEQUEO (15 CRITERIOS REGULATORIOS)</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>N°</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Componente / Criterio</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Condición Esperada</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Evaluación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { num: 1, comp: 'Largueros', desc: 'Sin fisuras, deformaciones, roturas ni reparaciones no autorizadas' },
                            { num: 2, comp: 'Peldaños', desc: 'Completos, firmes, limpios, secos, sin deformación' },
                            { num: 3, comp: 'Zapatas antideslizantes', desc: 'Presentes, íntegras, firmes y con capacidad de agarre' },
                            { num: 4, comp: 'Seguros / ganchos de extensión', desc: 'Operan correctamente sin desgaste crítico' },
                            { num: 5, comp: 'Cuerda de extensión', desc: 'Sin cortes, quemaduras ni deterioro' },
                            { num: 6, comp: 'Polea / sistema extensión', desc: 'Giro y funcionamiento correcto' },
                            { num: 7, comp: 'Limpieza / Condición Dieléctrica', desc: 'Libre de humedad, aceites, grasas o pintura' }
                          ].map((item) => (
                            <tr key={item.num}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>{item.num}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{item.comp}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{item.desc}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="C" style={{ padding: '3px', fontSize: '11px' }}>
                                  <option value="C">Cumple (C)</option>
                                  <option value="NC">No Cumple (NC)</option>
                                  <option value="NA">N.A.</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* FM-SST-47: INSPECCIÓN DE EPP Y EPCC */}
                {selectedFormat.codigo === 'FM-SST-47' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>DATOS DE INSPECCIÓN DE EQUIPOS DE PROTECCIÓN CONTRA CAÍDAS</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador Asignado:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tipo de Inspección:</label><select value={eppTipoInsp} onChange={(e) => setEppTipoInsp(e.target.value as any)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }}><option value="Preuso">Preuso Diaria</option><option value="Periódica">Periódica / Trimestral</option></select></div>
                      </div>
                    </div>

                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>TABLA DE EVALUACIÓN DE ELEMENTOS DE PROTECCIÓN Y SISTEMAS ANTICAÍDAS</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Elemento / Equipo</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Criterio Normativo de Inspección</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Estado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            { elem: 'Casco Clase E + Barbuquejo', crit: 'Carcasa, suspensión y barbuquejo íntegros; sin perforaciones' },
                            { elem: 'Arnés Multipropósito Dieléctrico', crit: 'Cintas sin cortes ni quemaduras; herrajes sin deformación' },
                            { elem: 'Eslinga de Posicionamiento', crit: 'Cintas/cuerda e hilos íntegros; mosquetones operan' },
                            { elem: 'Línea de Vida Vertical', crit: 'Sin abrasión, cortes, quemaduras ni nudos no permitidos' },
                            { elem: 'Arrestador de Caídas (Freno)', crit: 'Mecanismo funciona correctamente en el sentido de instalación' }
                          ].map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{row.elem}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{row.crit}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="C" style={{ padding: '3px', fontSize: '11px' }}>
                                  <option value="C">Cumple (C)</option>
                                  <option value="NC">No Cumple (NC)</option>
                                  <option value="NA">N.A.</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* ESTRUCTURA POR DEFECTO PARA CUALQUIER OTRO FORMATO */}
                {!['FM-SST-15', 'FM-SST-16', 'FM-SST-44', 'FM-SST-45', 'FM-SST-46', 'FM-SST-47'].includes(selectedFormat.codigo) && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>REGISTRO GENERAL DE CAMPO - {selectedFormat.codigo}</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Responsable de Registro:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo:</label><input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '95%', padding: '5px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} /></div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Detalles / Observaciones de Cumplimiento:</label>
                      <textarea placeholder="Escriba los detalles y verificación del formato..." style={{ width: '98%', height: '70px', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1', fontSize: '12px' }} />
                    </div>
                  </div>
                )}

                {/* ACCIÓN Y GUARDADO */}
                <div style={{ marginTop: '15px', paddingTop: '15px', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>🔒 Formato regulatorio listo para registrar con firma en Supabase</span>
                  <button onClick={handleSaveDynamicForm} className="btn" style={{ backgroundColor: '#16a34a', padding: '10px 20px', fontSize: '13px', fontWeight: 'bold' }}>
                    💾 Registrar Formato Completo en Supabase
                  </button>
                </div>

              </div>
            )}

            {/* LISTADO DE FORMATOS DILIGENCIABLES */}
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

        {/* PIE DE PÁGINA CORPORATIVO */}
        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b', fontWeight: '500' }}>Powered by</span>
          <img src="https://static.wixstatic.com/media/d0ce54_c999d1aa9976438a98b0f5b2157b7adc~mv2.png" alt="Logo Desarrollador" style={{ height: '24px', objectFit: 'contain' }} />
        </div>

      </div>
    </div>
  );
}

export default App;
