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
  const formSignatureRef = useRef<SignatureCanvasRef>(null);
  const pdfCanvasRef = useRef<HTMLCanvasElement>(null);

  // Datos globales del usuario
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');

  // Catálogo desde Supabase
  const [documentos, setDocumentos] = useState<DocumentoSST[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<DocumentoSST | null>(null);

  // Controles de Posición y Tamaño de Firma para Formatos Web
  const [formPosX, setFormPosX] = useState<number>(50);
  const [formPosY, setFormPosY] = useState<number>(85);
  const [formScale, setFormScale] = useState<number>(180);

  // --- ESTADOS FM-SST-15 ---
  const [indFecha, setIndFecha] = useState(new Date().toISOString().split('T')[0]);
  const [indHora, setIndHora] = useState('08:00');
  const [indCapacitador, setIndCapacitador] = useState('Matilde Chamorro');

  // --- ESTADOS FM-SST-16 ---
  const [evalTipoInd, setEvalTipoInd] = useState<'Inducción' | 'Reinducción'>('Inducción');
  const [evalRespP1, setEvalRespP1] = useState('');
  const [evalRespP2, setEvalRespP2] = useState('');
  const [evalRespP3, setEvalRespP3] = useState('');
  const [evalRespP4, setEvalRespP4] = useState('');
  const [evalRespP5, setEvalRespP5] = useState('');

  // --- ESTADOS FM-SST-44 ---
  const [brigFNac, setBrigFNac] = useState('1990-01-01');
  const [brigTel, setBrigTel] = useState('3000000000');
  const [brigEmail, setBrigEmail] = useState('brigadista@tecnoproyectos.com');
  const [brigDir, setBrigDir] = useState('Calle Principal #10');
  const [brigCiudad, setBrigCiudad] = useState('Cantagallo');
  const [brigEps, setBrigEps] = useState('SURA EPS');
  const [brigArl, setBrigArl] = useState('ARL SURA');
  const [brigSangre, setBrigSangre] = useState('O+');
  const [brigTipoBrig, setBrigTipoBrig] = useState('Integral');

  // --- ESTADOS FM-SST-45 (ATS) ---
  const [atsFecha, setAtsFecha] = useState(new Date().toISOString().split('T')[0]);
  const [atsHoraInicio, setAtsHoraInicio] = useState('07:00');
  const [atsLugar, setAtsLugar] = useState('Cantagallo / El Peñón');
  const [atsOrdenTrabajo, setAtsOrdenTrabajo] = useState('OT-2026-001');
  const [atsActividad, setAtsActividad] = useState('Mantenimiento de Alumbrado Público');
  const [atsAltura, setAtsAltura] = useState('8');

  // --- ESTADOS FM-SST-46 (ESCALERA) ---
  const [escFecha, setEscFecha] = useState(new Date().toISOString().split('T')[0]);
  const [escUbicacion, setEscUbicacion] = useState('Cantagallo');
  const [escId, setEscId] = useState('ESC-DIEL-01');
  const [escMarca, setEscMarca] = useState('Cuprum Dieléctrica 8m');
  const [escInspector, setEscInspector] = useState('Matilde Chamorro');

  // --- ESTADOS FM-SST-47 (EPP) ---
  const [eppFecha, setEppFecha] = useState(new Date().toISOString().split('T')[0]);
  const [eppLugar, setEppLugar] = useState('Cantagallo');
  const [eppResultado, setEppResultado] = useState<'APTO' | 'NO_APTO'>('APTO');

  // PDF y Firma Independiente (Pestaña 1)
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

      page.render({ canvasContext: context!, viewport });
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

  // Guardar y firmar formato web en la tabla 'signatures' de Supabase
  const handleSaveAndSignDynamicForm = async () => {
    if (formSignatureRef.current?.isEmpty()) {
      alert('⚠️ Por favor capture su firma en el recuadro inferior antes de registrar el formato.');
      return;
    }

    if (supabase) {
      try {
        const { error } = await supabase.from('signatures').insert([
          {
            signer_name: signerName,
            signer_document: signerDoc,
          }
        ]);
        if (error) {
          console.error('Error al insertar en Supabase:', error.message);
        }
      } catch (err) {
        console.error('Supabase error:', err);
      }
    }

    alert(`✅ ¡Formato ${selectedFormat?.codigo} (${selectedFormat?.titulo}) diligenciado, firmado digitalmente y guardado exitosamente en la tabla 'signatures' de Supabase!`);
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
                    <div><strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong></div>
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
                    <div><strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong></div>
                    <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none' }}>📖 Ver Acta</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 4: FORMATOS CON 6 FORMATOS COMPLETOS Y POSICIONAMIENTO DE FIRMA */}
        {activeTab === 'formatos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📁 Formatos y Plantillas Diligenciables</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Diligencie cualquiera de los 6 formatos oficiales y ajuste la posición y tamaño de su firma en pantalla.</p>

            {selectedFormat && (
              <div style={{ backgroundColor: '#ffffff', border: '2px solid #1e3a8a', padding: '20px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '10px', marginBottom: '15px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>FORMATO OFICIAL SG-SST TECNOPROYECTOS</span>
                    <h3 style={{ margin: '2px 0 0 0', color: '#1e3a8a', fontSize: '16px', fontWeight: 'bold' }}>{selectedFormat.codigo} - {selectedFormat.titulo}</h3>
                  </div>
                  <button onClick={() => setSelectedFormat(null)} style={{ border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>❌ Cerrar</button>
                </div>

                {/* FM-SST-15: INDUCCIÓN */}
                {selectedFormat.codigo === 'FM-SST-15' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>DATOS DE LA ACTIVIDAD</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={indFecha} onChange={(e) => setIndFecha(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Hora:</label><input type="time" value={indHora} onChange={(e) => setIndHora(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo:</label><input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Capacitador:</label><input type="text" value={indCapacitador} onChange={(e) => setIndCapacitador(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>CONTENIDO DE LA INDUCCIÓN (18 TEMAS)</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff', minWidth: '600px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Actividad / Tema</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '120px' }}>¿Socializado? (Sí/No/NA)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            'Política de Seguridad y Salud en el Trabajo', 'Política de alcohol, tabaco y SPA', 'Política de acoso laboral y sexual',
                            'Otras políticas de la organización', 'Objetivos y metas del SG-SST', 'Conceptos de Riesgo y Peligro',
                            'Auto reporte de condiciones', 'Accidente de Trabajo y Enfermedad Laboral', 'Sistema de Seguridad Social Integral',
                            'Deberes y derechos de los trabajadores', 'COPASST y Comité de Convivencia', 'Plan y números de Emergencias',
                            'Red de Atención Médica', 'Clasificación de peligros y riesgos', 'Controles frente a peligros y riesgos',
                            'Estándar prevención de caídas', 'Uso de Elementos de Protección Personal', '¿Qué hacer en caso de accidente?'
                          ].map((t, i) => (
                            <tr key={i}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{t}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="Sí" style={{ padding: '3px', fontSize: '11px', width: '100%' }}>
                                  <option value="Sí">Sí</option><option value="No">No</option><option value="NA">NA</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* FM-SST-16: EVALUACIÓN */}
                {selectedFormat.codigo === 'FM-SST-16' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>EVALUACIÓN DE INDUCCIÓN</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombre:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo:</label><input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tipo:</label>
                          <select value={evalTipoInd} onChange={(e) => setEvalTipoInd(e.target.value as any)} style={{ width: '98%', padding: '5px', fontSize: '12px' }}>
                            <option value="Inducción">Inducción</option><option value="Reinducción">Reinducción</option>
                          </select>
                        </div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>PREGUNTAS DE EVALUACIÓN</h4>
                      <div style={{ display: 'grid', gap: '10px', fontSize: '11px' }}>
                        <div><p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>1. ¿Cuál es el objetivo de la política de SST?</p><input type="text" value={evalRespP1} onChange={(e) => setEvalRespP1(e.target.value)} style={{ width: '98%', padding: '5px' }} /></div>
                        <div><p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>2. TRES responsabilidades en SST:</p><input type="text" value={evalRespP2} onChange={(e) => setEvalRespP2(e.target.value)} style={{ width: '98%', padding: '5px' }} /></div>
                        <div><p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>3. DOS peligros de su actividad y su control:</p><input type="text" value={evalRespP3} onChange={(e) => setEvalRespP3(e.target.value)} style={{ width: '98%', padding: '5px' }} /></div>
                        <div><p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>4. DOS objetivos del SG-SST:</p><input type="text" value={evalRespP4} onChange={(e) => setEvalRespP4(e.target.value)} style={{ width: '98%', padding: '5px' }} /></div>
                        <div><p style={{ fontWeight: 'bold', margin: '0 0 4px 0' }}>5. Tres ejemplos de acto inseguro:</p><input type="text" value={evalRespP5} onChange={(e) => setEvalRespP5(e.target.value)} style={{ width: '98%', padding: '5px' }} /></div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FM-SST-44: HOJA DE VIDA BRIGADISTA */}
                {selectedFormat.codigo === 'FM-SST-44' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>HOJA DE VIDA BRIGADISTA</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombres:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha Nacimiento:</label><input type="date" value={brigFNac} onChange={(e) => setBrigFNac(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Teléfono:</label><input type="text" value={brigTel} onChange={(e) => setBrigTel(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>EPS:</label><input type="text" value={brigEps} onChange={(e) => setBrigEps(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>ARL:</label><input type="text" value={brigArl} onChange={(e) => setBrigArl(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Grupo Sanguíneo:</label><input type="text" value={brigSangre} onChange={(e) => setBrigSangre(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tipo Brigadista:</label>
                          <select value={brigTipoBrig} onChange={(e) => setBrigTipoBrig(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }}>
                            <option value="Integral">Integral</option>
                            <option value="Primeros auxilios">Primeros auxilios</option>
                            <option value="Evacuación">Evacuación</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FM-SST-45: ATS */}
                {selectedFormat.codigo === 'FM-SST-45' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>DATOS GENERALES ATS</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={atsFecha} onChange={(e) => setAtsFecha(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Lugar:</label><input type="text" value={atsLugar} onChange={(e) => setAtsLugar(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Orden de Trabajo:</label><input type="text" value={atsOrdenTrabajo} onChange={(e) => setAtsOrdenTrabajo(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Actividad:</label><input type="text" value={atsActividad} onChange={(e) => setAtsActividad(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Altura Aprox (m):</label><input type="text" value={atsAltura} onChange={(e) => setAtsAltura(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>7 ETAPAS Y CONTROLES DE PELIGROS</h4>
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
                            { et: 'Inspección del sitio', pel: 'Redes energizadas / arco', cons: 'Electrocución', ctrl: 'Desenergizar; distancia segura; escalera dieléctrica.' },
                            { et: 'Instalación de escalera', pel: 'Deslizamiento', cons: 'Caída a distinto nivel', ctrl: 'Base firme; asegurar base y parte superior.' },
                            { et: 'Ascenso / descenso', pel: 'Caída de persona', cons: 'Trauma grave', ctrl: 'Línea de vida vertical, arrestador, arnés, 3 puntos.' },
                            { et: 'Intervención en poste', pel: 'Caída / sobre alcance', cons: 'Trauma grave', ctrl: 'Posicionamiento, anclaje definido.' },
                            { et: 'Herramientas', pel: 'Caída de objetos', cons: 'Golpes', ctrl: 'Portaherramientas, delimitación de área.' },
                            { et: 'Vía pública', pel: 'Tránsito vehicular', cons: 'Atropellamiento', ctrl: 'Conos, señalización, ayudante.' },
                            { et: 'Condiciones climáticas', pel: 'Lluvia / tormenta', cons: 'Riesgo eléctrico', ctrl: 'Suspender ante lluvia o tormenta.' }
                          ].map((row, idx) => (
                            <tr key={idx}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{row.et}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{row.pel}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{row.cons}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>{row.ctrl}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="Sí" style={{ padding: '3px', fontSize: '11px', width: '100%' }}>
                                  <option value="Sí">Sí</option><option value="No">No</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* FM-SST-46: INSPECCIÓN ESCALERA */}
                {selectedFormat.codigo === 'FM-SST-46' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>INSPECCIÓN DE ESCALERA</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={escFecha} onChange={(e) => setEscFecha(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Ubicación:</label><input type="text" value={escUbicacion} onChange={(e) => setEscUbicacion(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Código / ID:</label><input type="text" value={escId} onChange={(e) => setEscId(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Marca / Serial:</label><input type="text" value={escMarca} onChange={(e) => setEscMarca(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Inspector:</label><input type="text" value={escInspector} onChange={(e) => setEscInspector(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>15 CRITERIOS REGLAMENTARIOS</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '40px' }}>N°</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Componente / Criterio</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Condición Esperada</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '90px' }}>Evaluación</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            'Largueros', 'Peldaños', 'Zapatas antideslizantes', 'Seguros y ganchos', 'Cuerda de extensión',
                            'Polea / sistema de extensión', 'Guías y herrajes', 'Condición dieléctrica', 'Etiquetas y advertencias',
                            'Base y nivelación', 'Longitud y solape', 'Ángulo de instalación', 'Aseguramiento', 'Entorno eléctrico', 'Historial'
                          ].map((c, i) => (
                            <tr key={i}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center', fontWeight: 'bold' }}>{i + 1}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{c}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Íntegro, sin daños ni fisuras.</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="C" style={{ padding: '3px', fontSize: '11px', width: '100%' }}>
                                  <option value="C">C</option><option value="NC">NC</option><option value="N.A.">N.A.</option>
                                </select>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* FM-SST-47: EPP */}
                {selectedFormat.codigo === 'FM-SST-47' && (
                  <div style={{ display: 'grid', gap: '15px' }}>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>INSPECCIÓN DE EPP Y EPCC</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={eppFecha} onChange={(e) => setEppFecha(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Lugar:</label><input type="text" value={eppLugar} onChange={(e) => setEppLugar(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                        <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', overflowX: 'auto' }}>
                      <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>13 ELEMENTOS OFICIALES</h4>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', backgroundColor: '#fff', minWidth: '700px' }}>
                        <thead>
                          <tr style={{ backgroundColor: '#1e3a8a', color: '#fff' }}>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Elemento</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Criterio de inspección</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '90px' }}>Estado</th>
                            <th style={{ padding: '6px', border: '1px solid #cbd5e1', width: '110px' }}>Serial</th>
                          </tr>
                        </thead>
                        <tbody>
                          {[
                            'Casco Tipo I Clase E + barbuquejo', 'Gafas de seguridad', 'Careta de esmerilado',
                            'Guantes aislantes eléctricos', 'Guantes anticorte / nitrilo', 'Calzado de seguridad EH',
                            'Arnés multipropósito dieléctrico', 'Eslinga de posicionamiento', 'Línea de vida vertical',
                            'Arrestador de caídas', 'Conectores / mosquetones', 'Anclaje / adaptador portátil', 'Ropa de trabajo'
                          ].map((el, i) => (
                            <tr key={i}>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', fontWeight: 'bold' }}>{el}</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}>Íntegro, sin daños visibles.</td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1', textAlign: 'center' }}>
                                <select defaultValue="C" style={{ padding: '3px', fontSize: '11px', width: '100%' }}>
                                  <option value="C">C</option><option value="NC">NC</option><option value="N.A.">N.A.</option>
                                </select>
                              </td>
                              <td style={{ padding: '6px', border: '1px solid #cbd5e1' }}><input type="text" placeholder="Serial..." style={{ width: '95%', padding: '3px' }} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* MÓDULO DE POSICIONAMIENTO Y FIRMA DIGITAL */}
                <div style={{ marginTop: '20px', backgroundColor: '#f8fafc', padding: '15px', borderRadius: '8px', border: '2px dashed #0284c7' }}>
                  <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', color: '#1e3a8a' }}>✍️ POSICIONAMIENTO Y FIRMA DIGITAL DEL FORMATO</h4>
                  <p style={{ fontSize: '11px', color: '#64748b', margin: '0 0 10px 0' }}>Ajuste la posición y el tamaño proporcional de su firma, luego dibújela en el recuadro:</p>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '12px', backgroundColor: '#f1f5f9', padding: '10px', borderRadius: '6px' }}>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block' }}>Horizontal: {formPosX}%</label>
                      <input type="range" min="0" max="100" value={formPosX} onChange={(e) => setFormPosX(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block' }}>Vertical: {formPosY}%</label>
                      <input type="range" min="0" max="100" value={formPosY} onChange={(e) => setFormPosY(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block' }}>Tamaño (Escala): {formScale}px</label>
                      <input type="range" min="100" max="300" step="10" value={formScale} onChange={(e) => setFormScale(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>

                  <div style={{ height: '160px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', touchAction: 'none' }}>
                    <SignatureCanvas ref={formSignatureRef} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
                    <button onClick={() => formSignatureRef.current?.clear()} style={{ padding: '5px 12px', fontSize: '11px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                      Limpiar Firma
                    </button>
                  </div>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>🔒 Registro automático en la tabla 'signatures' de Supabase</span>
                  <button onClick={handleSaveAndSignDynamicForm} className="btn" style={{ backgroundColor: '#16a34a', padding: '12px 24px', fontSize: '14px', fontWeight: 'bold', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    💾 Firmar y Registrar en Supabase
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
                        ✍️ Diligenciar y Firmar Web
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
          <img src="
