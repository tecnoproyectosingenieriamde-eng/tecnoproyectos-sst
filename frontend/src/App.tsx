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
  const formPdfCanvasRef = useRef<HTMLCanvasElement>(null);

  // Datos globales del firmante
  const [signerName, setSignerName] = useState('Matilde Chamorro Simanca');
  const [signerDoc, setSignerDoc] = useState('1065622088');
  const [signerRole, setSignerRole] = useState('Responsable del SG-SST');

  // Catálogo desde Supabase
  const [documentos, setDocumentos] = useState<DocumentoSST[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState<boolean>(false);
  const [selectedFormat, setSelectedFormat] = useState<DocumentoSST | null>(null);

  // Controles de Posición y Tamaño de Firma
  const [formPosX, setFormPosX] = useState<number>(50);
  const [formPosY, setFormPosY] = useState<number>(85);
  const [formScale, setFormScale] = useState<number>(180);

  // Estados visuales del visor y PDF dinámico
  const [formPdfBytes, setFormPdfBytes] = useState<Uint8Array | null>(null);
  const [formPdfDocJs, setFormPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [formSignatureImage, setFormSignatureImage] = useState<string | null>(null);
  const [isFormProcessing, setIsFormProcessing] = useState<boolean>(false);
  const [signedFormUrl, setSignedFormUrl] = useState<string | null>(null);

  // --- DATOS FM-SST-46 (Inspección de Escalera) ---
  const [escId, setEscId] = useState('ESC-DIEL-01');
  const [escMarca, setEscMarca] = useState('Cuprum Dieléctrica');
  const [escUbicacion, setEscUbicacion] = useState('Cantagallo');
  const [escInspector, setEscInspector] = useState('Matilde Chamorro');
  const [escFecha, setEscFecha] = useState(new Date().toISOString().split('T')[0]);
  const [escItems, setEscItems] = useState([
    { n: 1, componente: 'Largueros', res: 'C' },
    { n: 2, componente: 'Peldaños', res: 'C' },
    { n: 3, componente: 'Zapatas antideslizantes', res: 'C' },
    { n: 4, componente: 'Seguros / ganchos de extensión', res: 'C' },
    { n: 5, componente: 'Cuerda de extensión', res: 'C' },
    { n: 6, componente: 'Polea / sistema de extensión', res: 'C' },
    { n: 7, componente: 'Guías y herrajes', res: 'C' },
    { n: 8, componente: 'Limpieza y condición dieléctrica', res: 'C' },
    { n: 9, componente: 'Etiquetas y advertencias', res: 'C' },
    { n: 10, componente: 'Base / nivelación', res: 'C' },
    { n: 11, componente: 'Longitud y solape', res: 'C' },
    { n: 12, componente: 'Ángulo de instalación', res: 'C' },
    { n: 13, componente: 'Aseguramiento', res: 'C' },
    { n: 14, componente: 'Entorno eléctrico', res: 'C' },
    { n: 15, componente: 'Historial / hoja de vida', res: 'C' }
  ]);
  const [escResultado, setEscResultado] = useState('APTA PARA USO');

  // --- DATOS FM-SST-47 (Inspección de EPP) ---
  const [eppFecha, setEppFecha] = useState(new Date().toISOString().split('T')[0]);
  const [eppLugar, setEppLugar] = useState('Cantagallo');
  const [eppItems, setEppItems] = useState([
    { elemento: 'Casco Tipo I Clase E + barbuquejo', res: 'C' },
    { elemento: 'Gafas de seguridad', res: 'C' },
    { elemento: 'Careta de esmerilado', res: 'C' },
    { elemento: 'Guantes aislantes eléctricos', res: 'C' },
    { elemento: 'Guantes anticorte / nitrilo', res: 'C' },
    { elemento: 'Calzado de seguridad EH', res: 'C' },
    { elemento: 'Arnés multipropósito dieléctrico', res: 'C' },
    { elemento: 'Eslinga de posicionamiento', res: 'C' },
    { elemento: 'Línea de vida vertical', res: 'C' },
    { elemento: 'Arrestador de caídas', res: 'C' },
    { elemento: 'Conectores / mosquetones', res: 'C' },
    { elemento: 'Anclaje / adaptador portátil', res: 'C' },
    { elemento: 'Ropa de trabajo manga larga', res: 'C' }
  ]);
  const [eppResultado, setEppResultado] = useState('EPP APTOS PARA USO');

  // --- DATOS FM-SST-15 (Inducción) ---
  const [indFecha, setIndFecha] = useState(new Date().toISOString().split('T')[0]);
  const [indHora, setIndHora] = useState('08:00');
  const [indCapacitador, setIndCapacitador] = useState('Matilde Chamorro');
  const [indTemas, setIndTemas] = useState([
    { item: 1, tema: 'Política de Seguridad y Salud en el Trabajo', socializado: 'Sí' },
    { item: 2, tema: 'Política de prevención alcohol, tabaco y SPA', socializado: 'Sí' },
    { item: 3, tema: 'Política de prevención acoso laboral y sexual', socializado: 'Sí' },
    { item: 4, tema: 'Objetivos y metas del SG-SST', socializado: 'Sí' },
    { item: 5, tema: 'Conceptos de Riesgo y Peligro', socializado: 'Sí' },
    { item: 6, tema: 'Auto reporte de condiciones de trabajo', socializado: 'Sí' },
    { item: 7, tema: 'COPASST y Comité de Convivencia', socializado: 'Sí' },
    { item: 8, tema: 'Plan de Emergencias y Red médica', socializado: 'Sí' },
    { item: 9, tema: 'Uso de Elementos de Protección Personal', socializado: 'Sí' },
    { item: 10, tema: 'Estándar prevención de caídas', socializado: 'Sí' }
  ]);

  // Estados Pestaña 1 (Firma Digital General)
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
      const viewport = page.getViewport({ scale: 1.0 });
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
      targetPage.drawImage(embeddedImage, { x: Math.max(10, realX), y: Math.max(15, realY + 12), width: sigWidth, height: sigHeight });

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const auditText = `FIRMADO ELECTRÓNICAMENTE | ${signerName} (C.C. ${signerDoc}) | ${new Date().toISOString()}`;
      targetPage.drawText(auditText, { x: Math.max(10, realX), y: Math.max(5, realY - 2), size: 5.5, font, color: rgb(0.3, 0.3, 0.3), opacity: 0.65 });

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
      setSignedDocumentUrl(URL.createObjectURL(blob));
      setIsProcessing(false);
      alert('¡Documento firmado y sellado exitosamente!');
    } catch (error) {
      console.error('Error al procesar PDF:', error);
      alert('Ocurrió un error al estampar la firma en el PDF.');
      setIsProcessing(false);
    }
  };

  // --- GENERADOR DEL PDF DEL FORMATO SELECCIONADO CON SUS TABLAS OFICIALES ---
  // CARGA LA PLANTILLA PDF OFICIAL REAL DESDE SUPABASE Y DIBUJA LOS DATOS ENCIMA
 // --- CARGAR PLANTILLA DESDE SUPABASE ---
  const handleSelectFormat = async (doc: DocumentoSST) => {
    setSelectedFormat(doc);
    setSignedFormUrl(null);
    setFormSignatureImage(null);
    try {
      let arrayBuffer: ArrayBuffer;

      // Descarga directa mediante la URL pública registrada en la base de datos
      const response = await fetch(doc.url_archivo);
      if (!response.ok) {
        throw new Error(`Error HTTP al descargar: ${response.status}`);
      }
      arrayBuffer = await response.arrayBuffer();

      // Validar que realmente se hayan descargado bytes
      if (!arrayBuffer || arrayBuffer.byteLength === 0) {
        throw new Error('El archivo descargado está vacío.');
      }

      // 2. Cargamos el documento PDF base con pdf-lib
      const pdfDoc = await PDFDocument.load(arrayBuffer);
      const pages = pdfDoc.getPages();
      const firstPage = pages[0];
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // 3. Estampamos los datos de cabecera según el código del formato
      if (doc.codigo === 'FM-SST-46') {
        firstPage.drawText(escId, { x: 130, y: 715, size: 8, font });
        firstPage.drawText(escMarca, { x: 270, y: 715, size: 8, font });
        firstPage.drawText(escUbicacion, { x: 430, y: 715, size: 8, font });
        firstPage.drawText(escFecha, { x: 430, y: 695, size: 8, font });
        firstPage.drawText(escResultado, { x: 200, y: 150, size: 9, font: boldFont, color: rgb(0.1, 0.4, 0.1) });
      } else if (doc.codigo === 'FM-SST-47') {
        firstPage.drawText(signerName, { x: 150, y: 715, size: 8, font });
        firstPage.drawText(eppFecha, { x: 430, y: 715, size: 8, font });
        firstPage.drawText(eppLugar, { x: 430, y: 695, size: 8, font });
        firstPage.drawText(eppResultado, { x: 200, y: 150, size: 9, font: boldFont, color: rgb(0.1, 0.4, 0.1) });
      } else if (doc.codigo === 'FM-SST-15') {
        firstPage.drawText(indFecha, { x: 100, y: 730, size: 8, font });
        firstPage.drawText(indHora, { x: 240, y: 730, size: 8, font });
        firstPage.drawText(indCapacitador, { x: 400, y: 730, size: 8, font });
        firstPage.drawText(signerName, { x: 130, y: 710, size: 8, font });
        firstPage.drawText(signerDoc, { x: 400, y: 710, size: 8, font });
      } else {
        firstPage.drawText(signerName, { x: 150, y: 710, size: 9, font });
        firstPage.drawText(signerDoc, { x: 400, y: 710, size: 9, font });
        firstPage.drawText(new Date().toLocaleDateString(), { x: 150, y: 690, size: 9, font });
      }

      // Guardamos los bytes modificados en el estado
      const pdfBytes = await pdfDoc.save();
      setFormPdfBytes(pdfBytes);

      // Renderizamos en el visor interactivo con pdfjs
      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      const loadedPdf = await loadingTask.promise;
      setFormPdfDocJs(loadedPdf);
    } catch (e: any) {
      console.error('Error cargando plantilla oficial:', e);
      alert(`Error cargando la plantilla oficial: ${e.message || e}`);
    }
  };

  // --- FIRMAR Y GUARDAR FORMATO DINÁMICO ---
  const handleSaveAndSignDynamicForm = async () => {
    if (!formSignatureImage || !selectedFormat) {
      alert('⚠️ Por favor dibuje y confirme su firma en la vista previa antes de registrar el formato.');
      return;
    }
    try {
      setIsFormProcessing(true);
      let pdfBytesToUse = formPdfBytes;

      // Si por alguna razón formPdfBytes está vacío, lo descargamos de nuevo mediante fetch en este momento
      if (!pdfBytesToUse) {
        const res = await fetch(selectedFormat.url_archivo);
        if (!res.ok) throw new Error('No se pudo descargar el archivo de respaldo.');
        pdfBytesToUse = await res.arrayBuffer();
      }

      const pdfDoc = await PDFDocument.load(pdfBytesToUse);
      const pages = pdfDoc.getPages();
      const targetPage = pages[0];
      const { width: pageWidth, height: pageHeight } = targetPage.getSize();
      const sigWidth = Number(formScale);
      const sigHeight = Number(formScale) * 0.45;
      const realX = (pageWidth - sigWidth) * (formPosX / 100);
      const realY = pageHeight - ((pageHeight - sigHeight) * (formPosY / 100)) - sigHeight;
      
      const base64Data = formSignatureImage.split(',')[1];
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
      const auditText = `FIRMADO SG-SST | ${signerName} (C.C. ${signerDoc}) | ${timestamp}`;
      targetPage.drawText(auditText, {
        x: Math.max(10, realX),
        y: Math.max(5, realY - 2),
        size: 5.5,
        font,
        color: rgb(0.2, 0.2, 0.2),
        opacity: 0.7,
      });
      
      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([signedPdfBytes as any], { type: 'application/pdf' });
      const signedUrl = URL.createObjectURL(blob);
      setSignedFormUrl(signedUrl);
      setIsFormProcessing(false);
      alert(`✅ ¡Formato ${selectedFormat?.codigo} firmado y listo para descargar!`);
    } catch (err: any) {
      console.error('DETALLE DEL ERROR AL FIRMAR FORMATO:', err);
      alert(`Ocurrió un error al procesar el formato: ${err.message || err}`);
      setIsFormProcessing(false);
    }
  };
  const procedimientosList = documentos.filter(d => d.tipo === 'procedimiento');
  const actasList = documentos.filter(d => d.tipo === 'acta');
  const formatosList = documentos.filter(d => d.tipo === 'formato');

  return (
    <div className="app-container" style={{ padding: '10px', maxWidth: '1200px', margin: '0 auto' }}>
      <div className="card" style={{ borderTop: '5px solid #1e3a8a', backgroundColor: '#ffffff', borderRadius: '12px', padding: '15px 20px', boxShadow: '0 4px 15px rgba(0,0,0,0.08)' }}>
        
        {/* ENCABEZADO */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '15px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <img src="https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg" alt="Logo Tecnoproyectos" style={{ width: '60px', height: '60px', borderRadius: '50%', objectFit: 'cover', border: '2px solid #1e3a8a' }} />
            <div>
              <h1 className="title" style={{ color: '#1e3a8a', margin: 0, fontSize: '18px', fontWeight: 'bold' }}>TECNOPROYECTOS INGENIERÍA S.A.S.</h1>
              <p style={{ color: '#4b5563', fontSize: '12px', margin: '2px 0 0 0' }}>Sistema de Gestión SG-SST (Decreto 1072 de 2015)</p>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '4px', borderRadius: '8px' }}>
            <button onClick={() => { setActiveTab('firma'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'firma' ? '#1e3a8a' : 'transparent', color: activeTab === 'firma' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>✍️ Firma PDF</button>
            <button onClick={() => { setActiveTab('procedimientos'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'procedimientos' ? '#1e3a8a' : 'transparent', color: activeTab === 'procedimientos' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📋 Procedimientos</button>
            <button onClick={() => { setActiveTab('actas'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'actas' ? '#1e3a8a' : 'transparent', color: activeTab === 'actas' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📄 Actas SST</button>
            <button onClick={() => { setActiveTab('formatos'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'formatos' ? '#1e3a8a' : 'transparent', color: activeTab === 'formatos' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📁 Formatos Interactivos</button>
          </div>
        </div>

        {/* PESTAÑA 1 */}
        {activeTab === 'firma' && (
          <div>
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>1. Datos del Firmante</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombre Completo:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} /></div>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula / Documento:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} /></div>
                <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cargo / Rol:</label><input type="text" value={signerRole} onChange={(e) => setSignerRole(e.target.value)} style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #cbd5e1' }} /></div>
              </div>
            </div>
            <div style={{ backgroundColor: '#f8fafc', padding: '12px 15px', borderRadius: '8px', border: '1px solid #e2e8f0', marginBottom: '15px' }}>
              <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>2. Cargar Documento PDF del SG-SST</h3>
              <input type="file" accept="application/pdf" onChange={handlePdfUpload} style={{ padding: '6px', border: '1px dashed #0284c7', borderRadius: '6px', width: '95%' }} />
              {pdfFile && <p style={{ color: '#16a34a', fontWeight: 'bold', fontSize: '12px', marginTop: '6px' }}>📄 Cargado: {pdfFile.name}</p>}
            </div>
            {pdfDocJs && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(290px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h3 style={{ margin: 0, fontSize: '14px', color: '#0f172a' }}>3. Vista Previa Hoja</h3>
                    <select value={selectedPage} onChange={(e) => setSelectedPage(Number(e.target.value))} style={{ padding: '3px 6px', borderRadius: '4px' }}>
                      {Array.from({ length: numPages }, (_, i) => i + 1).map((p) => (<option key={p} value={p}>Página {p} de {numPages}</option>))}
                    </select>
                  </div>
                  <div style={{ position: 'relative', border: '2px solid #0284c7', borderRadius: '6px', overflow: 'auto', maxHeight: '480px', backgroundColor: '#64748b', padding: '8px', textAlign: 'center' }}>
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <canvas ref={pdfCanvasRef} style={{ display: 'block', backgroundColor: '#fff', maxWidth: '100%', height: 'auto' }} />
                      {signatureImage && (
                        <div style={{ position: 'absolute', left: `${posXPercent}%`, top: `${posYPercent}%`, transform: 'translate(-50%, -50%)', border: '2px dashed #0284c7', backgroundColor: 'rgba(255,255,255,0.85)', padding: '3px', borderRadius: '4px', width: `${sigScale}px`, textAlign: 'center' }}>
                          <img src={signatureImage} alt="Firma" style={{ width: '100%', maxHeight: '50px', objectFit: 'contain' }} />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: '#0f172a' }}>4. Ajuste y Firma Táctil</h3>
                  <div style={{ backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Horizontal: {posXPercent}%</label>
                    <input type="range" min="0" max="100" value={posXPercent} onChange={(e) => setPosXPercent(Number(e.target.value))} style={{ width: '100%', marginBottom: '8px' }} />
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Vertical: {posYPercent}%</label>
                    <input type="range" min="0" max="100" value={posYPercent} onChange={(e) => setPosYPercent(Number(e.target.value))} style={{ width: '100%', marginBottom: '8px' }} />
                    <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tamaño: {sigScale}px</label>
                    <input type="range" min="100" max="300" step="10" value={sigScale} onChange={(e) => setSigScale(Number(e.target.value))} style={{ width: '100%' }} />
                  </div>
                  <div style={{ marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '4px' }}>Dibuje su Firma:</label>
                    <div style={{ minHeight: '180px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', touchAction: 'none' }}>
                      <SignatureCanvas ref={signatureRef} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                    <button className="btn" onClick={handleCaptureSignature} style={{ backgroundColor: '#0284c7', padding: '9px', fontSize: '12px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📌 Confirmar Trazo</button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" onClick={handleClearSignature} style={{ backgroundColor: '#dc2626', flex: 1, padding: '9px', fontSize: '12px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Limpiar</button>
                      <button className="btn" onClick={handleProcessDocumentSigning} disabled={isProcessing || !signatureImage} style={{ backgroundColor: signatureImage ? '#16a34a' : '#94a3b8', flex: 2, padding: '9px', fontSize: '12px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>{isProcessing ? 'Procesando...' : '⚡ Firmar y Estampar'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {signedDocumentUrl && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
                <h3 style={{ color: '#15803d', margin: '0 0 8px 0', fontSize: '15px' }}>✅ ¡Documento Firmado con Éxito!</h3>
                <a href={signedDocumentUrl} download="FIRMADO.pdf" className="btn" style={{ display: 'inline-block', backgroundColor: '#0284c7', fontSize: '14px', padding: '10px 20px', textDecoration: 'none', color: '#fff', borderRadius: '6px' }}>📥 Descargar PDF Firmado</a>
              </div>
            )}
          </div>
        )}

        {/* PESTAÑAS 2 Y 3 */}
        {activeTab === 'procedimientos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📋 Manuales y Procedimientos SG-SST</h2>
            {isLoadingDocs ? <p style={{ color: '#0284c7' }}>Cargando...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {procedimientosList.map(doc => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{doc.codigo}: {doc.titulo}</strong>
                    <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', color: '#fff', borderRadius: '4px' }}>Ver</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'actas' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📄 Actas de Conformación y Reunión SG-SST</h2>
            {isLoadingDocs ? <p style={{ color: '#0284c7' }}>Cargando...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {actasList.map(doc => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong>{doc.codigo}: {doc.titulo}</strong>
                    <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', color: '#fff', borderRadius: '4px' }}>Ver</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 4: FORMATOS INTERACTIVOS (Diligenciamiento en línea) */}
        {activeTab === 'formatos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📁 Formatos y Plantillas Diligenciables en Línea</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Seleccione un formato para rellenar sus tablas oficiales, marcar criterios y estampar su firma digitalmente.</p>

            {selectedFormat && (
              <div style={{ backgroundColor: '#ffffff', border: '2px solid #1e3a8a', padding: '20px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '10px', marginBottom: '15px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>FORMATO OFICIAL SG-SST TECNOPROYECTOS</span>
                    <h3 style={{ margin: '2px 0 0 0', color: '#1e3a8a', fontSize: '16px', fontWeight: 'bold' }}>{selectedFormat.codigo} - {selectedFormat.titulo}</h3>
                  </div>
                  <button onClick={() => setSelectedFormat(null)} style={{ border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>❌ Cerrar</button>
                </div>

                {/* FM-SST-46: TABLA DE ESCALERA */}
                {selectedFormat.codigo === 'FM-SST-46' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Inspección de Escalera (15 Criterios Oficiales)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>ID Escalera:</label><input type="text" value={escId} onChange={(e) => setEscId(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Marca / Serial:</label><input type="text" value={escMarca} onChange={(e) => setEscMarca(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Ubicación:</label><input type="text" value={escUbicacion} onChange={(e) => setEscUbicacion(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Resultado:</label>
                        <select value={escResultado} onChange={(e) => setEscResultado(e.target.value)} style={{ width: '98%', padding: '4px', fontSize: '11px' }}>
                          <option value="APTA PARA USO">APTA PARA USO</option><option value="NO APTA - RETIRAR">NO APTA - RETIRAR</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '6px', borderRadius: '4px' }}>
                      {escItems.map((it: any, idx: number) => (
                        <div key={it.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', gap: '10px' }}>
                          <span style={{ flex: 2 }}>{it.n}. <strong>{it.componente}</strong></span>
                          <select value={it.res} onChange={(e) => {
                            const newItems = [...escItems];
                            newItems[idx].res = e.target.value;
                            setEscItems(newItems);
                          }} style={{ fontSize: '11px', padding: '2px', flex: 1 }}>
                            <option value="C">C (Cumple)</option>
                            <option value="NC">NC (No Cumple)</option>
                            <option value="N.A.">N.A.</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FM-SST-47: TABLA DE EPP */}
                {selectedFormat.codigo === 'FM-SST-47' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Inspección de EPP y EPCC (13 Elementos)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Resultado General:</label>
                        <select value={eppResultado} onChange={(e) => setEppResultado(e.target.value)} style={{ width: '98%', padding: '4px', fontSize: '11px' }}>
                          <option value="EPP APTOS PARA USO">EPP APTOS PARA USO</option><option value="ELEMENTOS NO CONFORMES">EXISTEN NO CONFORMES</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '6px', borderRadius: '4px' }}>
                      {eppItems.map((it: any, idx: number) => (
                        <div key={it.elemento} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', gap: '10px' }}>
                          <span style={{ flex: 2 }}><strong>{it.elemento}</strong></span>
                          <select value={it.res} onChange={(e) => {
                            const newItems = [...eppItems];
                            newItems[idx].res = e.target.value;
                            setEppItems(newItems);
                          }} style={{ fontSize: '11px', padding: '2px', flex: 1 }}>
                            <option value="C">C</option><option value="NC">NC</option><option value="N.A.">N.A.</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* FM-SST-15: TABLA DE INDUCCIÓN */}
                {selectedFormat.codigo === 'FM-SST-15' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Registro de Inducción y Reinducción SST</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={indFecha} onChange={(e) => setIndFecha(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Capacitador:</label><input type="text" value={indCapacitador} onChange={(e) => setIndCapacitador(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                    </div>
                    <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '6px', borderRadius: '4px' }}>
                      {indTemas.map((it: any, idx: number) => (
                        <div key={it.item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '11px' }}>
                          <span>{it.item}. {it.tema}</span>
                          <select value={it.socializado} onChange={(e) => {
                            const newItems = [...indTemas];
                            newItems[idx].socializado = e.target.value;
                            setIndTemas(newItems);
                          }} style={{ fontSize: '11px', padding: '2px' }}>
                            <option value="Sí">Sí</option><option value="No">No</option><option value="N/A">N/A</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* BOTÓN ACTUALIZAR VISTA PREVIA */}
                <div style={{ marginBottom: '15px', textAlign: 'right' }}>
                  <button onClick={() => handleSelectFormat(selectedFormat)} className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 14px', fontSize: '11px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔄 Actualizar Vista Previa del Formato</button>
                </div>

                {/* VISOR Y FIRMA */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1e3a8a' }}>📄 Vista Previa del Formato</h4>
                    <div style={{ position: 'relative', border: '2px solid #0284c7', borderRadius: '6px', overflow: 'auto', maxHeight: '400px', backgroundColor: '#64748b', padding: '8px', textAlign: 'center' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <canvas ref={formPdfCanvasRef} style={{ display: 'block', backgroundColor: '#fff', maxWidth: '100%', height: 'auto' }} />
                        {formSignatureImage && (
                          <div style={{ position: 'absolute', left: `${formPosX}%`, top: `${formPosY}%`, transform: 'translate(-50%, -50%)', border: '2px dashed #0284c7', backgroundColor: 'rgba(255,255,255,0.85)', padding: '3px', borderRadius: '4px', width: `${formScale}px`, textAlign: 'center' }}>
                            <img src={formSignatureImage} alt="Firma" style={{ width: '100%', maxHeight: '45px', objectFit: 'contain' }} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1e3a8a' }}>✍️ Controles y Firma</h4>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Horizontal: {formPosX}%</label>
                      <input type="range" min="0" max="100" value={formPosX} onChange={(e) => setFormPosX(Number(e.target.value))} style={{ width: '100%', marginBottom: '6px' }} />
                      <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Vertical: {formPosY}%</label>
                      <input type="range" min="0" max="100" value={formPosY} onChange={(e) => setFormPosY(Number(e.target.value))} style={{ width: '100%', marginBottom: '6px' }} />
                      <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tamaño: {formScale}px</label>
                      <input type="range" min="100" max="300" step="10" value={formScale} onChange={(e) => setFormScale(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Dibuje su Firma:</label>
                      <div style={{ height: '110px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', touchAction: 'none' }}>
                        <SignatureCanvas ref={formSignatureRef} />
                      </div>
                    </div>
                    <button onClick={handleCaptureFormSignature} className="btn" style={{ backgroundColor: '#0284c7', padding: '7px', fontSize: '11px', width: '100%', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>📌 Confirmar Trazo en Vista Previa</button>
                  </div>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>🔒 Genera y descarga el PDF oficial completo con todas tus tablas rellenadas</span>
                  <button onClick={handleSaveAndSignDynamicForm} disabled={isFormProcessing || !formSignatureImage} className="btn" style={{ backgroundColor: formSignatureImage ? '#16a34a' : '#94a3b8', padding: '12px 20px', fontSize: '13px', fontWeight: 'bold', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    {isFormProcessing ? 'Procesando...' : '💾 Firmar y Descargar PDF Oficial'}
                  </button>
                </div>

                {signedFormUrl && (
                  <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
                    <h4 style={{ color: '#15803d', margin: '0 0 6px 0', fontSize: '14px' }}>✅ ¡Formato Firmado con Éxito!</h4>
                    <a href={signedFormUrl} download={`${selectedFormat.codigo}_FIRMADO.pdf`} className="btn" style={{ display: 'inline-block', backgroundColor: '#0284c7', fontSize: '13px', padding: '8px 16px', textDecoration: 'none', color: '#fff', borderRadius: '6px' }}>📥 Descargar PDF del Formato Firmado</a>
                  </div>
                )}
              </div>
            )}

            {isLoadingDocs ? <p style={{ color: '#0284c7', fontSize: '13px', textAlign: 'center' }}>⏳ Cargando formatos...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {formatosList.map((doc) => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Estructura oficial regulada | Plantilla: .{doc.extension}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleSelectFormat(doc)} className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✍️ Diligenciar y Firmar en Línea</button>
                      <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#16a34a', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', color: '#fff', borderRadius: '4px' }}>📥 Descargar Word</a>
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
