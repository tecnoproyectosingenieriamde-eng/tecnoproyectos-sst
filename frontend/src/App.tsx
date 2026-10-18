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

  // Controles de Posición y Tamaño de Firma para Formatos Web
  const [formPosX, setFormPosX] = useState<number>(50);
  const [formPosY, setFormPosY] = useState<number>(85);
  const [formScale, setFormScale] = useState<number>(180);

  // Estados del visor gráfico del formato
  const [formPdfBytes, setFormPdfBytes] = useState<Uint8Array | null>(null);
  const [formPdfDocJs, setFormPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [formSignatureImage, setFormSignatureImage] = useState<string | null>(null);
  const [isFormProcessing, setIsFormProcessing] = useState<boolean>(false);
  const [signedFormUrl, setSignedFormUrl] = useState<string | null>(null);

  // --- ESTADOS ESPECÍFICOS FM-SST-15 ---
  const [indFecha, setIndFecha] = useState(new Date().toISOString().split('T')[0]);
  const [indHora, setIndHora] = useState('08:00');
  const [indCapacitador, setIndCapacitador] = useState('Matilde Chamorro');

  // --- ESTADOS ESPECÍFICOS FM-SST-16 ---
  const [evalTipoInd, setEvalTipoInd] = useState<'Inducción' | 'Reinducción'>('Inducción');
  const [evalRespP1, setEvalRespP1] = useState('Cumplir normatividad, prevenir lesiones y proteger la salud.');
  const [evalRespP2, setEvalRespP2] = useState('Autocuidado, reporte de condiciones y uso de EPP.');

  // --- ESTADOS ESPECÍFICOS FM-SST-44 ---
  const [brigTel, setBrigTel] = useState('3000000000');
  const [brigEps, setBrigEps] = useState('SURA EPS');
  const [brigArl, setBrigArl] = useState('ARL SURA');
  const [brigSangre, setBrigSangre] = useState('O+');
  const [brigTipoBrig, setBrigTipoBrig] = useState('Integral');

  // --- ESTADOS ESPECÍFICOS FM-SST-45 (ATS) ---
  const [atsFecha, setAtsFecha] = useState(new Date().toISOString().split('T')[0]);
  const [atsLugar, setAtsLugar] = useState('Cantagallo / El Peñón');
  const [atsOrdenTrabajo, setAtsOrdenTrabajo] = useState('OT-2026-001');
  const [atsActividad, setAtsActividad] = useState('Mantenimiento de Alumbrado Público');
  const [atsAltura, setAtsAltura] = useState('8');

  // --- ESTADOS ESPECÍFICOS FM-SST-46 (ESCALERA) ---
  const [escFecha, setEscFecha] = useState(new Date().toISOString().split('T')[0]);
  const [escUbicacion, setEscUbicacion] = useState('Cantagallo');
  const [escId, setEscId] = useState('ESC-DIEL-01');
  const [escMarca, setEscMarca] = useState('Cuprum Dieléctrica 8m');
  const [escInspector, setEscInspector] = useState('Matilde Chamorro');

  // --- ESTADOS ESPECÍFICOS FM-SST-47 (EPP) ---
  const [eppFecha, setEppFecha] = useState(new Date().toISOString().split('T')[0]);
  const [eppLugar, setEppLugar] = useState('Cantagallo');

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

  // Generador de tablas PDF completas para cada formato oficial de Tecnoproyectos
  const handleSelectFormat = async (doc: DocumentoSST) => {
    setSelectedFormat(doc);
    setSignedFormUrl(null);
    setFormSignatureImage(null);

    try {
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([595.28, 841.89]); // A4
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      // Encabezado corporativo institucional
      page.drawText('TECNOPROYECTOS INGENIERÍA S.A.S. - SISTEMA SG-SST', { x: 40, y: 815, size: 8.5, font: boldFont, color: rgb(0.1, 0.2, 0.5) });
      page.drawText(`FORMATO OFICIAL: ${doc.codigo} - ${doc.titulo}`, { x: 40, y: 800, size: 11, font: boldFont, color: rgb(0.1, 0.1, 0.1) });

      let currentY = 775;

      if (doc.codigo === 'FM-SST-15') {
        page.drawText(`Fecha: ${indFecha} | Hora: ${indHora} | Capacitador: ${indCapacitador}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 12;
        page.drawText(`Trabajador: ${signerName} | C.C.: ${signerDoc} | Cargo: ${signerRole}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        page.drawText('CONTENIDO SOCIALIZADO (18 Temas reglamentarios de Inducción y Reinducción SST):', { x: 40, y: currentY, size: 8.5, font: boldFont });
        currentY -= 12;
        const temas = [
          '1. Política de SST y Alcohol/Tabaco/SPA', '2. Objetivos y metas del SG-SST', '3. Conceptos de Peligro y Riesgo',
          '4. Auto reporte de condiciones de trabajo', '5. COPASST y Comité de Convivencia Laboral', '6. Plan y números de Emergencias',
          '7. Clasificación de peligros y EPP', '8. Prevención de caídas y Trabajo Seguro', '9. Accidentes de trabajo y Enfermedad laboral',
          '10. Sistema de Seguridad Social Integral', '11. Deberes y derechos de los trabajadores', '12. Red de Atención Médica y ARL'
        ];
        temas.forEach(t => {
          page.drawText(`${t} ..................................................................................................... [ SOCIALIZADO ]`, { x: 45, y: currentY, size: 7.5, font });
          currentY -= 11;
        });
      } else if (doc.codigo === 'FM-SST-16') {
        page.drawText(`EVALUACIÓN DE ${evalTipoInd.toUpperCase()} SG-SST | Colaborador: ${signerName} (C.C. ${signerDoc})`, { x: 40, y: currentY, size: 8.5, font: boldFont });
        currentY -= 14;
        page.drawText('1. ¿Cuál es el objetivo de la política de SST?: ' + evalRespP1, { x: 40, y: currentY, size: 7.5, font });
        currentY -= 12;
        page.drawText('2. Enuncie sus responsabilidades: ' + evalRespP2, { x: 40, y: currentY, size: 7.5, font });
        currentY -= 12;
        page.drawText('3. COPASST: Organismo de vigilancia y control .............................................................. [ VERDADERO ]', { x: 40, y: currentY, size: 7.5, font });
        currentY -= 12;
        page.drawText('4. Accidente de trabajo: Suceso repentino con lesión o muerte ........................................... [ CORRECTO ]', { x: 40, y: currentY, size: 7.5, font });
        currentY -= 12;
        page.drawText('5. Afiliación laboral: Sistema de seguridad social (ARL, EPS, AFP, Caja) .................................. [ CORRECTO ]', { x: 40, y: currentY, size: 7.5, font });
      } else if (doc.codigo === 'FM-SST-44') {
        page.drawText('HOJA DE VIDA BRIGADISTA DE EMERGENCIA', { x: 40, y: currentY, size: 9, font: boldFont });
        currentY -= 12;
        page.drawText(`Brigadista: ${signerName} | C.C.: ${signerDoc} | Tel: ${brigTel}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 12;
        page.drawText(`EPS: ${brigEps} | ARL: ${brigArl} | RH: ${brigSangre} | Tipo Brigada: ${brigTipoBrig}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        page.drawText('• Capacitaciones vigentes: Primeros Auxilios, Evacuación, Conatos de Incendio.', { x: 45, y: currentY, size: 7.5, font });
        currentY -= 11;
        page.drawText('• Dotación asignada: Chaleco identificativo, silbato, linterna y equipo básico.', { x: 45, y: currentY, size: 7.5, font });
        currentY -= 11;
        page.drawText('• Compromiso: Participar activamente en emergencias dentro de sus límites operativos.', { x: 45, y: currentY, size: 7.5, font });
      } else if (doc.codigo === 'FM-SST-45') {
        page.drawText('ANÁLISIS DE SEGURIDAD EN EL TRABAJO (ATS)', { x: 40, y: currentY, size: 9, font: boldFont });
        currentY -= 12;
        page.drawText(`Fecha: ${atsFecha} | Lugar: ${atsLugar} | Orden Trabajo: ${atsOrdenTrabajo}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 12;
        page.drawText(`Actividad: ${atsActividad} | Altura Aprox: ${atsAltura} metros`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        const atsEtapas = [
          '1. Inspección del sitio y redes eléctricas ................. [ CONTROLADO / DISTANCIA SEGURA ]',
          '2. Instalación de escalera dieléctrica ................... [ BASE FIRME / ASEGURADA ]',
          '3. Ascenso y uso de línea de vida ........................... [ ARNÉS / ARRESTADOR COMPATIBLE ]',
          '4. Intervención en poste y anclaje ......................... [ POSICIONAMIENTO SEGURO ]',
          '5. Control de herramientas y área pública ............... [ DELIMITADO / PORTAHERRAMIENTAS ]'
        ];
        atsEtapas.forEach(ae => {
          page.drawText(ae, { x: 45, y: currentY, size: 7.5, font });
          currentY -= 11;
        });
        currentY -= 4;
        page.drawText('RESULTADO DE VERIFICACIÓN: [ X ] TRABAJO AUTORIZADO Y SEGURO', { x: 40, y: currentY, size: 8.5, font: boldFont, color: rgb(0.1, 0.5, 0.1) });
      } else if (doc.codigo === 'FM-SST-46') {
        page.drawText('INSPECCIÓN TÉCNICA DE ESCALERA', { x: 40, y: currentY, size: 9, font: boldFont });
        currentY -= 12;
        page.drawText(`ID: ${escId} | Marca/Serial: ${escMarca} | Ubicación: ${escUbicacion}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 12;
        page.drawText(`Inspector: ${escInspector} | Fecha: ${escFecha}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        const criteriosEsc = [
          '1. Largueros íntegros sin fisuras', '2. Peldaños firmes y limpios', '3. Zapatas antideslizantes presentes',
          '4. Seguros y ganchos operativos', '5. Cuerda y polea en buen estado', '6. Condición dieléctrica adecuada',
          '7. Etiquetas y advertencias visibles', '8. Base nivelada sin improvisaciones', '9. Ángulo y solape correctos'
        ];
        criteriosEsc.forEach(ce => {
          page.drawText(`${ce} ................................................................................................... [ CUMPLE (C) ]`, { x: 45, y: currentY, size: 7.5, font });
          currentY -= 11;
        });
      } else if (doc.codigo === 'FM-SST-47') {
        page.drawText('INSPECCIÓN DE EPP Y EQUIPOS DE PROTECCIÓN CONTRA CAÍDAS', { x: 40, y: currentY, size: 9, font: boldFont });
        currentY -= 12;
        page.drawText(`Trabajador: ${signerName} | Fecha: ${eppFecha} | Frente: ${eppLugar}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        const epps = [
          'Casco Clase E con barbuquejo', 'Gafas de seguridad anti-rayas', 'Guantes dieléctricos certificados',
          'Calzado de seguridad dieléctrico EH', 'Arnés multipropósito dieléctrico', 'Eslinga de posicionamiento / restricción',
          'Línea de vida vertical y arrestador', 'Conectores y mosquetones operativos'
        ];
        epps.forEach(ep => {
          page.drawText(`${ep} ........................................................................................... [ APTO PARA USO ]`, { x: 45, y: currentY, size: 7.5, font });
          currentY -= 11;
        });
      }

      const pdfBytes = await pdfDoc.save();
      setFormPdfBytes(pdfBytes);

      const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
      const loadedPdf = await loadingTask.promise;
      setFormPdfDocJs(loadedPdf);
    } catch (e) {
      console.error('Error generando PDF de formato:', e);
    }
  };

  useEffect(() => {
    if (!formPdfDocJs || !formPdfCanvasRef.current || !selectedFormat) return;

    let isMounted = true;
    formPdfDocJs.getPage(1).then((page: any) => {
      if (!isMounted) return;
      const canvas = formPdfCanvasRef.current;
      if (!canvas) return;

      const context = canvas.getContext('2d');
      const viewport = page.getViewport({ scale: 1.0 });

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      page.render({ canvasContext: context!, viewport });
    });

    return () => { isMounted = false; };
  }, [formPdfDocJs, selectedFormat]);

  const handleCaptureSignature = () => {
    if (signatureRef.current?.isEmpty()) {
      alert('Por favor realice su firma en el recuadro primero.');
      return;
    }
    const dataUrl = signatureRef.current?.toDataURL();
    setSignatureImage(dataUrl || null);
  };

  const handleCaptureFormSignature = () => {
    if (formSignatureRef.current?.isEmpty()) {
      alert('⚠️ Por favor dibuje su firma en el recuadro.');
      return;
    }
    const dataUrl = formSignatureRef.current?.toDataURL();
    setFormSignatureImage(dataUrl || null);
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

  // Guardar en Supabase y estampar firma en el PDF del formato web
  const handleSaveAndSignDynamicForm = async () => {
    if (!formSignatureImage || !formPdfBytes) {
      alert('⚠️ Por favor capture y confirme su firma en el visor antes de registrar el formato.');
      return;
    }

    try {
      setIsFormProcessing(true);

      if (supabase) {
        const { error } = await supabase.from('signatures').insert([
          {
            signer_name: signerName,
            signer_document: signerDoc,
          }
        ]);
        if (error) {
          console.error('Error al insertar en Supabase (Verifique si RLS está desactivado):', error.message);
        }
      }

      const pdfDoc = await PDFDocument.load(formPdfBytes);
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
      alert(`✅ ¡Formato ${selectedFormat?.codigo} registrado en Supabase y firmado exitosamente!`);
    } catch (err) {
      console.error('Error procesando formato:', err);
      alert('Ocurrió un error al procesar el formato firmado.');
      setIsFormProcessing(false);
    }
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

        {/* PESTAÑA 4: FORMATOS CON OPCIONES COMPLETAS Y VISOR DE FIRMA */}
        {activeTab === 'formatos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📁 Formatos y Plantillas Diligenciables</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Diligencie los campos específicos de cada formato y posicione visualmente su firma antes de registrar en Supabase.</p>

            {selectedFormat && (
              <div style={{ backgroundColor: '#ffffff', border: '2px solid #1e3a8a', padding: '20px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '10px', marginBottom: '15px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>FORMATO OFICIAL SG-SST TECNOPROYECTOS</span>
                    <h3 style={{ margin: '2px 0 0 0', color: '#1e3a8a', fontSize: '16px', fontWeight: 'bold' }}>{selectedFormat.codigo} - {selectedFormat.titulo}</h3>
                  </div>
                  <button onClick={() => setSelectedFormat(null)} style={{ border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>❌ Cerrar</button>
                </div>

                {/* OPCIONES ESPECÍFICAS SEGÚN EL FORMATO SELECCIONADO */}
                {selectedFormat.codigo === 'FM-SST-15' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Opciones FM-SST-15 (Inducción y Reinducción)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={indFecha} onChange={(e) => setIndFecha(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Hora:</label><input type="time" value={indHora} onChange={(e) => setIndHora(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Capacitador:</label><input type="text" value={indCapacitador} onChange={(e) => setIndCapacitador(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                    </div>
                  </div>
                )}

                {selectedFormat.codigo === 'FM-SST-16' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Opciones FM-SST-16 (Evaluación de Inducción)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Tipo:</label>
                        <select value={evalTipoInd} onChange={(e) => setEvalTipoInd(e.target.value as any)} style={{ width: '98%', padding: '5px', fontSize: '12px' }}>
                          <option value="Inducción">Inducción</option><option value="Reinducción">Reinducción</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {selectedFormat.codigo === 'FM-SST-44' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Opciones FM-SST-44 (Hoja de Vida Brigadista)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Nombres:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Cédula:</label><input type="text" value={signerDoc} onChange={(e) => setSignerDoc(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Teléfono:</label><input type="text" value={brigTel} onChange={(e) => setBrigTel(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>EPS / ARL:</label><input type="text" value={brigEps} onChange={(e) => setBrigEps(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                    </div>
                  </div>
                )}

                {selectedFormat.codigo === 'FM-SST-45' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Opciones FM-SST-45 (ATS - Análisis de Trabajo Seguro)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={atsFecha} onChange={(e) => setAtsFecha(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Lugar:</label><input type="text" value={atsLugar} onChange={(e) => setAtsLugar(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Orden Trabajo:</label><input type="text" value={atsOrdenTrabajo} onChange={(e) => setAtsOrdenTrabajo(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Actividad:</label><input type="text" value={atsActividad} onChange={(e) => setAtsActividad(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                    </div>
                  </div>
                )}

                {selectedFormat.codigo === 'FM-SST-46' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Opciones FM-SST-46 (Inspección de Escalera)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Código ID:</label><input type="text" value={escId} onChange={(e) => setEscId(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Marca / Serial:</label><input type="text" value={escMarca} onChange={(e) => setEscMarca(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Inspector:</label><input type="text" value={escInspector} onChange={(e) => setEscInspector(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                    </div>
                  </div>
                )}

                {selectedFormat.codigo === 'FM-SST-47' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Opciones FM-SST-47 (Inspección de EPP)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Fecha:</label><input type="date" value={eppFecha} onChange={(e) => setEppFecha(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '5px', fontSize: '12px' }} /></div>
                    </div>
                  </div>
                )}

                {/* BOTÓN PARA ACTUALIZAR VISTA PREVIA TRAS CAMBIAR OPCIONES */}
                <div style={{ marginBottom: '15px', textAlign: 'right' }}>
                  <button onClick={() => handleSelectFormat(selectedFormat)} className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 14px', fontSize: '11px' }}>
                    🔄 Actualizar Vista Previa del Formato
                  </button>
                </div>

                {/* VISOR GRÁFICO Y POSICIONAMIENTO DE FIRMA */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1e3a8a' }}>📄 Vista Previa de la Tabla del Formato</h4>
                    <div style={{ position: 'relative', border: '2px solid #0284c7', borderRadius: '6px', overflow: 'auto', maxHeight: '420px', backgroundColor: '#64748b', padding: '8px', textAlign: 'center' }}>
                      <div style={{ position: 'relative', display: 'inline-block' }}>
                        <canvas ref={formPdfCanvasRef} style={{ display: 'block', backgroundColor: '#fff', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', maxWidth: '100%', height: 'auto' }} />
                        {formSignatureImage && (
                          <div style={{
                            position: 'absolute',
                            left: `${formPosX}%`,
                            top: `${formPosY}%`,
                            transform: 'translate(-50%, -50%)',
                            border: '2px dashed #0284c7',
                            backgroundColor: 'rgba(255, 255, 255, 0.85)',
                            padding: '3px',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
                            pointerEvents: 'none',
                            zIndex: 30,
                            width: `${formScale}px`,
                            textAlign: 'center'
                          }}>
                            <img src={formSignatureImage} alt="Firma" style={{ width: '100%', maxHeight: '45px', objectFit: 'contain', display: 'block' }} />
                            <span style={{ fontSize: '7.5px', color: '#0284c7', fontWeight: 'bold', display: 'block' }}>📍 Posición de Firma</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1e3a8a' }}>✍️ Controles y Firma</h4>
                    <div style={{ backgroundColor: '#f1f5f9', padding: '10px 12px', borderRadius: '6px', marginBottom: '12px', border: '1px solid #e2e8f0' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Horizontal: {formPosX}%</label>
                      <input type="range" min="0" max="100" value={formPosX} onChange={(e) => setFormPosX(Number(e.target.value))} style={{ width: '100%', marginBottom: '6px' }} />

                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Vertical: {formPosY}%</label>
                      <input type="range" min="0" max="100" value={formPosY} onChange={(e) => setFormPosY(Number(e.target.value))} style={{ width: '100%', marginBottom: '6px' }} />

                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '2px' }}>Tamaño: {formScale}px</label>
                      <input type="range" min="100" max="300" step="10" value={formScale} onChange={(e) => setFormScale(Number(e.target.value))} style={{ width: '100%' }} />
                    </div>

                    <div style={{ marginBottom: '8px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 'bold', display: 'block', marginBottom: '3px' }}>Dibuje su Firma:</label>
                      <div style={{ height: '120px', width: '100%', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#ffffff', touchAction: 'none' }}>
                        <SignatureCanvas ref={formSignatureRef} />
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexDirection: 'column' }}>
                      <button onClick={handleCaptureFormSignature} className="btn" style={{ backgroundColor: '#0284c7', padding: '7px', fontSize: '11px' }}>📌 Confirmar Trazo en Vista Previa</button>
                      <button onClick={() => formSignatureRef.current?.clear()} style={{ padding: '4px', fontSize: '11px', backgroundColor: '#dc2626', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Limpiar Firma</button>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '20px', paddingTop: '15px', borderTop: '2px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>🔒 Guarda en Supabase y descarga el PDF oficial completo con tablas</span>
                  <button onClick={handleSaveAndSignDynamicForm} disabled={isFormProcessing || !formSignatureImage} className="btn" style={{ backgroundColor: formSignatureImage ? '#16a34a' : '#94a3b8', padding: '12px 20px', fontSize: '13px', fontWeight: 'bold', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    {isFormProcessing ? 'Procesando...' : '💾 Firmar, Registrar en Supabase y Descargar'}
                  </button>
                </div>

                {signedFormUrl && (
                  <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
                    <h4 style={{ color: '#15803d', margin: '0 0 6px 0', fontSize: '14px' }}>✅ ¡Formato Registrado en Supabase y Firmado con Éxito!</h4>
                    <a href={signedFormUrl} download={`${selectedFormat.codigo}_FIRMADO.pdf`} className="btn" style={{ display: 'inline-block', textDecoration: 'none', backgroundColor: '#0284c7', fontSize: '13px', padding: '8px 16px' }}>
                      📥 Descargar PDF del Formato Firmado
                    </a>
                  </div>
                )}

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
                      <button onClick={() => handleSelectFormat(doc)} className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px' }}>
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
          <img src="https://static.wixstatic.com/media/d0ce54_c999d1aa9976438a98b0f5b2157b7adc~mv2.png" alt="Logo Desarrollador" style={{ height: '24px', objectFit: 'contain' }} />
        </div>

      </div>
    </div>
  );
}

export default App;
