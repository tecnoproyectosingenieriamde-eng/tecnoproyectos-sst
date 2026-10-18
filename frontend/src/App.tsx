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
  const [formPosY, setFormPosY] = useState<number>(88);
  const [formScale, setFormScale] = useState<number>(180);

  // Estados visuales del visor
  const [formPdfBytes, setFormPdfBytes] = useState<Uint8Array | null>(null);
  const [formPdfDocJs, setFormPdfDocJs] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [formSignatureImage, setFormSignatureImage] = useState<string | null>(null);
  const [isFormProcessing, setIsFormProcessing] = useState<boolean>(false);
  const [signedFormUrl, setSignedFormUrl] = useState<string | null>(null);

  // --- FM-SST-15: DATOS DE INDUCCIÓN Y REINDUCCIÓN (10 Temas con Sí/No/NA) ---
  const [indFecha, setIndFecha] = useState(new Date().toISOString().split('T')[0]);
  const [indHora, setIndHora] = useState('08:00');
  const [indCapacitador, setIndCapacitador] = useState('Matilde Chamorro');
  const [indCargoTrabajador, setIndCargoTrabajador] = useState('Técnico Liniero / Operativo');
  const [indTemas, setIndTemas] = useState([
    { item: 1, tema: 'Política de Seguridad y Salud en el Trabajo', socializado: 'Sí', obs: '' },
    { item: 2, tema: 'Política de prevención alcohol, tabaco y SPA', socializado: 'Sí', obs: '' },
    { item: 3, tema: 'Política de prevención acoso laboral y sexual', socializado: 'Sí', obs: '' },
    { item: 4, tema: 'Objetivos y metas del SG-SST', socializado: 'Sí', obs: '' },
    { item: 5, tema: 'Conceptos de Riesgo y Peligro', socializado: 'Sí', obs: '' },
    { item: 6, tema: 'Concepto de auto reporte de condiciones', socializado: 'Sí', obs: '' },
    { item: 7, tema: 'COPASST y Comité de Convivencia Laboral', socializado: 'Sí', obs: '' },
    { item: 8, tema: 'Plan y números de Emergencias', socializado: 'Sí', obs: '' },
    { item: 9, tema: 'Uso de Elementos de Protección Personal', socializado: 'Sí', obs: '' },
    { item: 10, tema: 'Estándar prevención de caídas (Trabajo Seguro)', socializado: 'Sí', obs: '' }
  ]);

  // --- FM-SST-16: EVALUACIÓN DE INDUCCIÓN (Preguntas y F/V) ---
  const [evalTipo, setEvalTipo] = useState<'Inducción' | 'Reinducción'>('Inducción');
  const [evalResp1, setEvalResp1] = useState('Proteger la integridad y salud de los trabajadores.');
  const [evalResp2, setEvalResp2] = useState('1. Autocuidado\n2. Reportar condiciones\n3. Usar EPP');
  const [evalResp3, setEvalResp3] = useState('1. Postes energizados\n2. Caída de altura');
  const [evalCopasstV, setEvalCopasstV] = useState(true);
  const [evalAccidenteF, setEvalAccidenteF] = useState(true);
  const [evalPuntajeTotal, setEvalPuntajeTotal] = useState('18 / 18 APROBADO');

  // --- FM-SST-44: HOJA DE VIDA BRIGADISTA ---
  const [brigTel, setBrigTel] = useState('3000000000');
  const [brigCorreo, setBrigCorreo] = useState('matilde.chamorro@tecnoproyectos.com');
  const [brigEps, setBrigEps] = useState('SURA EPS');
  const [brigArl, setBrigArl] = useState('ARL SURA');
  const [brigRh, setBrigRh] = useState('O+');
  const [brigTipo, setBrigTipo] = useState('Integral');
  const [brigRol, setBrigRol] = useState('Brigadista');

  // --- FM-SST-45: ATS (ANÁLISIS DE SEGURIDAD EN EL TRABAJO) ---
  const [atsFecha, setAtsFecha] = useState(new Date().toISOString().split('T')[0]);
  const [atsHora, setAtsHora] = useState('07:30');
  const [atsLugar, setAtsLugar] = useState('Cantagallo / Frente de Redes');
  const [atsOt, setAtsOt] = useState('OT-2026-0045');
  const [atsActividad, setAtsActividad] = useState('Mantenimiento correctivo en postes');
  const [atsAltura, setAtsAltura] = useState('8 metros');
  const [atsAutorizado, setAtsAutorizado] = useState('TRABAJO AUTORIZADO');

  // --- FM-SST-46: INSPECCIÓN DE ESCALERA (15 Criterios Exactos) ---
  const [escInspector, setEscInspector] = useState('Matilde Chamorro');
  const [escFecha, setEscFecha] = useState(new Date().toISOString().split('T')[0]);
  const [eppFecha, setEppFecha] = useState(new Date().toISOString().split('T')[0]);
  const [eppLugar, setEppLugar] = useState('Cantagallo');
  const [escId, setEscId] = useState('ESC-DIEL-01');
  const [escMarca, setEscMarca] = useState('Cuprum Dieléctrica');
  const [escUbicacion, setEscUbicacion] = useState('Cantagallo');
  const [escItems, setEscItems] = useState([
    { n: 1, componente: 'Largueros', esperado: 'Sin fisuras, deformaciones ni roturas', res: 'C', obs: '' },
    { n: 2, componente: 'Peldaños', esperado: 'Completos, firmes, limpios y secos', res: 'C', obs: '' },
    { n: 3, componente: 'Zapatas antideslizantes', esperado: 'Presentes, íntegras y con agarre', res: 'C', obs: '' },
    { n: 4, componente: 'Seguros / ganchos de extensión', esperado: 'Operan correctamente sin desgaste', res: 'C', obs: '' },
    { n: 5, componente: 'Cuerda de extensión', esperado: 'Sin cortes, abrasión ni quemaduras', res: 'C', obs: '' },
    { n: 6, componente: 'Polea / sistema de extensión', esperado: 'Giro y funcionamiento correctos', res: 'C', obs: '' },
    { n: 7, componente: 'Guías y herrajes', esperado: 'Firmes, sin corrosión ni deformación', res: 'C', obs: '' },
    { n: 8, componente: 'Limpieza y condición dieléctrica', esperado: 'Libre de humedad, grasa o pintura', res: 'C', obs: '' },
    { n: 9, componente: 'Etiquetas y advertencias', esperado: 'Legibles y visibles', res: 'C', obs: '' },
    { n: 10, componente: 'Base / nivelación', esperado: 'Base firme; sin objetos improvisados', res: 'C', obs: '' },
    { n: 11, componente: 'Longitud y solape', esperado: 'Adecuados para la tarea', res: 'C', obs: '' },
    { n: 12, componente: 'Ángulo de instalación', esperado: 'Según indicación del fabricante', res: 'C', obs: '' },
    { n: 13, componente: 'Aseguramiento', res: 'Criterios contra desplazamiento', res: 'C', obs: '' },
    { n: 14, componente: 'Entorno eléctrico', esperado: 'Distancia segura a redes', res: 'C', obs: '' },
    { n: 15, componente: 'Historial / hoja de vida', res: 'Inspecciones al día', res: 'C', obs: '' }
  ]);
  const [escResultadoFinal, setEscResultadoFinal] = useState('APTA PARA USO');

  // --- FM-SST-47: INSPECCIÓN DE EPP Y EPCC (13 Elementos Exactos) ---
  const [eppItems, setEppItems] = useState([
    { elemento: 'Casco Tipo I Clase E + barbuquejo', criterio: 'Carcasa y suspensión íntegras', res: 'C' },
    { elemento: 'Gafas de seguridad', criterio: 'Lentes sin fisuras; visión clara', res: 'C' },
    { elemento: 'Careta de esmerilado', criterio: 'Visor y soporte íntegros', res: 'C' },
    { elemento: 'Guantes aislantes eléctricos', criterio: 'Sin perforaciones; clase adecuada', res: 'C' },
    { elemento: 'Guantes anticorte / nitrilo', criterio: 'Sin roturas ni contaminación', res: 'C' },
    { elemento: 'Calzado de seguridad EH', criterio: 'Suela y capellada íntegras y secas', res: 'C' },
    { elemento: 'Arnés multipropósito dieléctrico', criterio: 'Cintas y costuras sin abrasión', res: 'C' },
    { elemento: 'Eslinga de posicionamiento', criterio: 'Conectores operativos; sin quemaduras', res: 'C' },
    { elemento: 'Línea de vida vertical', criterio: 'Sin nudos no permitidos ni abrasión', res: 'C' },
    { elemento: 'Arrestador de caídas', criterio: 'Mecanismo y sentido correctos', res: 'C' },
    { elemento: 'Conectores / mosquetones', criterio: 'Cierre y seguro operan bien', res: 'C' },
    { elemento: 'Anclaje / adaptador portátil', criterio: 'Sin daño ni modificación', res: 'C' },
    { elemento: 'Ropa de trabajo manga larga', criterio: 'Íntegra; arc rating cumplido', res: 'C' }
  ]);
  const [eppResultadoFinal, setEppResultadoFinal] = useState('EPP APTOS PARA USO');

  // Estados de carga de PDF general (Pestaña 1)
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
          setDocumentos(data as DocumentoSST[] );
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
  // GENERADOR DE PDF OFICIAL CON LAS TABLAS EXACTAS DE CADA FORMATO
  const handleSelectFormat = async (doc: DocumentoSST) => {
    setSelectedFormat(doc);
    setSignedFormUrl(null);
    setFormSignatureImage(null);

    try {
      const pdfDoc = await PDFDocument.create();
      let page = pdfDoc.addPage([595.28, 841.89]); // A4
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      page.drawText('TECNOPROYECTOS INGENIERÍA S.A.S. - SISTEMA SG-SST (Decreto 1072 de 2015)', { x: 40, y: 818, size: 8, font: boldFont, color: rgb(0.1, 0.2, 0.5) });
      page.drawText(`FORMATO OFICIAL: ${doc.codigo} - ${doc.titulo}`, { x: 40, y: 804, size: 10, font: boldFont, color: rgb(0.1, 0.1, 0.1) });

      let currentY = 780;

      if (doc.codigo === 'FM-SST-15') {
        page.drawText(`Fecha: ${indFecha} | Hora: ${indHora} | Capacitador: ${indCapacitador}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 12;
        page.drawText(`Trabajador: ${signerName} | C.C.: ${signerDoc} | Cargo: ${indCargoTrabajador}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        page.drawText('TABLA DE VERIFICACIÓN - CONTENIDO DE INDUCCIÓN Y REINDUCCIÓN SST:', { x: 40, y: currentY, size: 8.5, font: boldFont });
        currentY -= 14;
        indItems.forEach(it => {
          page.drawText(`${it.item}. ${it.tema} ..................................................................... [ ${it.socializado} ]`, { x: 45, y: currentY, size: 7.5, font });
          currentY -= 12;
        });
      } else if (doc.codigo === 'FM-SST-46') {
        page.drawText(`ID ESCALERA: ${escId} | MARCA: ${escMarca} | UBICACIÓN: ${escUbicacion}`, { x: 40, y: currentY, size: 8.5, font: boldFont });
        currentY -= 12;
        page.drawText(`INSPECTOR: ${escInspector} | FECHA: ${escFecha}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        page.drawText('N°   Componente / Criterio esperado                                                  C / NC / N.A.', { x: 40, y: currentY, size: 7.5, font: boldFont });
        currentY -= 12;
        escItems.forEach(it => {
          if (currentY > 60) {
            page.drawText(`${it.n}.  ${it.componente} - ${it.esperado} .................................... [ ${it.res} ]`, { x: 40, y: currentY, size: 7, font });
            currentY -= 11;
          }
        });
        currentY -= 4;
        page.drawText(`RESULTADO DE INSPECCIÓN: [ X ] ${escResultadoFinal}`, { x: 40, y: currentY, size: 8.5, font: boldFont, color: rgb(0.1, 0.5, 0.1) });
      } else if (doc.codigo === 'FM-SST-47') {
        page.drawText(`INSPECCIÓN DE EPP Y EPCC | Trabajador: ${signerName} (C.C. ${signerDoc})`, { x: 40, y: currentY, size: 8.5, font: boldFont });
        currentY -= 12;
        page.drawText(`Fecha: ${eppFecha} | Frente de Trabajo: ${eppLugar}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        page.drawText('Elemento de Protección / Criterio técnico                                            Estado (C/NC)', { x: 40, y: currentY, size: 7.5, font: boldFont });
        currentY -= 12;
        eppItems.forEach(it => {
          if (currentY > 60) {
            page.drawText(`• ${it.elemento} (${it.criterio}) ......................................... [ ${it.res} ]`, { x: 40, y: currentY, size: 7, font });
            currentY -= 11;
          }
        });
        currentY -= 4;
        page.drawText(`ESTADO GENERAL: [ X ] ${eppResultadoFinal}`, { x: 40, y: currentY, size: 8.5, font: boldFont, color: rgb(0.1, 0.5, 0.1) });
      } else if (doc.codigo === 'FM-SST-16') {
        page.drawText(`EVALUACIÓN DE ${evalTipo.toUpperCase()} SST | Colaborador: ${signerName} (C.C. ${signerDoc})`, { x: 40, y: currentY, size: 9, font: boldFont });
        currentY -= 14;
        page.drawText('1. Objetivo de la política: ' + evalResp1, { x: 45, y: currentY, size: 7.5, font });
        currentY -= 12;
        page.drawText('2. Responsabilidades: ' + evalResp2, { x: 45, y: currentY, size: 7.5, font });
        currentY -= 12;
        page.drawText('3. Peligros y controles: ' + evalResp3, { x: 45, y: currentY, size: 7.5, font });
        currentY -= 14;
        page.drawText(`CALIFICACIÓN FINAL: [ APROBADO ] - Puntaje: ${evalPuntajeTotal}`, { x: 40, y: currentY, size: 9, font: boldFont, color: rgb(0.1, 0.5, 0.1) });
      } else if (doc.codigo === 'FM-SST-44') {
        page.drawText('HOJA DE VIDA BRIGADISTA DE EMERGENCIA', { x: 40, y: currentY, size: 9, font: boldFont });
        currentY -= 14;
        page.drawText(`Brigadista: ${signerName} | C.C.: ${signerDoc} | Tel: ${brigTel} | Correo: ${brigCorreo}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 12;
        page.drawText(`EPS: ${brigEps} | ARL: ${brigArl} | RH: ${brigRh} | Tipo: ${brigTipo} | Rol: ${brigRol}`, { x: 40, y: currentY, size: 8, font });
      } else if (doc.codigo === 'FM-SST-45') {
        page.drawText('ANÁLISIS DE SEGURIDAD EN EL TRABAJO (ATS)', { x: 40, y: currentY, size: 9, font: boldFont });
        currentY -= 14;
        page.drawText(`Fecha: ${atsFecha} | Hora: ${atsHora} | Lugar: ${atsLugar} | OT: ${atsOt}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 12;
        page.drawText(`Actividad: ${atsActividad} | Altura Aprox: ${atsAltura}`, { x: 40, y: currentY, size: 8, font });
        currentY -= 16;
        page.drawText(`RESULTADO ATS: [ X ] ${atsAutorizado}`, { x: 40, y: currentY, size: 8.5, font: boldFont, color: rgb(0.1, 0.5, 0.1) });
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

  const handleCaptureFormSignature = () => {
    if (formSignatureRef.current?.isEmpty()) {
      alert('⚠️ Por favor dibuje su firma en el recuadro.');
      return;
    }
    const dataUrl = formSignatureRef.current?.toDataURL();
    setFormSignatureImage(dataUrl || null);
  };

  const handleSaveAndSignDynamicForm = async () => {
    if (!formSignatureImage || !formPdfBytes) {
      alert('⚠️ Por favor capture y confirme su firma en el visor antes de registrar el formato.');
      return;
    }
    try {
      setIsFormProcessing(true);
      if (supabase) {
        await supabase.from('signatures').insert([{ signer_name: signerName, signer_document: signerDoc }]);
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
      targetPage.drawImage(embeddedImage, { x: Math.max(10, realX), y: Math.max(15, realY + 12), width: sigWidth, height: sigHeight });

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const auditText = `FIRMADO SG-SST | ${signerName} (C.C. ${signerDoc}) | ${new Date().toISOString()}`;
      targetPage.drawText(auditText, { x: Math.max(10, realX), y: Math.max(5, realY - 2), size: 5.5, font, color: rgb(0.2, 0.2, 0.2), opacity: 0.7 });

      const signedPdfBytes = await pdfDoc.save();
      const blob = new Blob([signedPdfBytes as any], { type: 'application/pdf' });
      setSignedFormUrl(URL.createObjectURL(blob));
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
            <button onClick={() => { setActiveTab('firma'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'firma' ? '#1e3a8a' : 'transparent', color: activeTab === 'firma' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>✍️ Firma Digital</button>
            <button onClick={() => { setActiveTab('procedimientos'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'procedimientos' ? '#1e3a8a' : 'transparent', color: activeTab === 'procedimientos' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📋 Procedimientos</button>
            <button onClick={() => { setActiveTab('actas'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'actas' ? '#1e3a8a' : 'transparent', color: activeTab === 'actas' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📄 Actas SST</button>
            <button onClick={() => { setActiveTab('formatos'); setSelectedFormat(null); }} style={{ padding: '8px 12px', borderRadius: '6px', border: 'none', backgroundColor: activeTab === 'formatos' ? '#1e3a8a' : 'transparent', color: activeTab === 'formatos' ? '#fff' : '#475569', fontSize: '12px', fontWeight: 'bold', cursor: 'pointer' }}>📁 Formatos</button>
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
                    <button className="btn" onClick={handleCaptureSignature} style={{ backgroundColor: '#0284c7', padding: '9px', fontSize: '12px' }}>📌 Confirmar Trazo</button>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button className="btn" onClick={handleClearSignature} style={{ backgroundColor: '#dc2626', flex: 1, padding: '9px', fontSize: '12px' }}>Limpiar</button>
                      <button className="btn" onClick={handleProcessDocumentSigning} disabled={isProcessing || !signatureImage} style={{ backgroundColor: signatureImage ? '#16a34a' : '#94a3b8', flex: 2, padding: '9px', fontSize: '12px' }}>{isProcessing ? 'Procesando...' : '⚡ Firmar y Estampar'}</button>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {signedDocumentUrl && (
              <div style={{ marginTop: '15px', padding: '15px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
                <h3 style={{ color: '#15803d', margin: '0 0 8px 0', fontSize: '15px' }}>✅ ¡Documento Firmado con Éxito!</h3>
                <a href={signedDocumentUrl} download="FIRMADO.pdf" className="btn" style={{ display: 'inline-block', backgroundColor: '#0284c7', fontSize: '14px', padding: '10px 20px', textDecoration: 'none', color: '#fff' }}>📥 Descargar PDF Firmado</a>
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
                    <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', color: '#fff' }}>Ver</a>
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
                    <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', color: '#fff' }}>Ver</a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* PESTAÑA 4: FORMATOS CON LAS TABLAS OFICIALES EXACTAS */}
        {activeTab === 'formatos' && (
          <div style={{ padding: '15px 0' }}>
            <h2 style={{ color: '#1e3a8a', fontSize: '17px', marginBottom: '8px' }}>📁 Formatos y Plantillas Diligenciables</h2>
            <p style={{ color: '#475569', fontSize: '12px', marginBottom: '15px' }}>Diligencie cada campo y tabla oficial en línea tal como el original.</p>

            {selectedFormat && (
              <div style={{ backgroundColor: '#ffffff', border: '2px solid #1e3a8a', padding: '20px', borderRadius: '10px', marginBottom: '25px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #1e3a8a', paddingBottom: '10px', marginBottom: '15px' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 'bold', color: '#0284c7' }}>FORMATO OFICIAL SG-SST TECNOPROYECTOS</span>
                    <h3 style={{ margin: '2px 0 0 0', color: '#1e3a8a', fontSize: '16px', fontWeight: 'bold' }}>{selectedFormat.codigo} - {selectedFormat.titulo}</h3>
                  </div>
                  <button onClick={() => setSelectedFormat(null)} style={{ border: 'none', backgroundColor: '#fee2e2', color: '#dc2626', padding: '6px 12px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>❌ Cerrar</button>
                </div>

                {/* FM-SST-46: TABLA DE 15 CRITERIOS DE ESCALERA */}
                {selectedFormat.codigo === 'FM-SST-46' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Inspección de Escalera (15 Criterios Oficiales)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>ID Escalera:</label><input type="text" value={escId} onChange={(e) => setEscId(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Marca / Serial:</label><input type="text" value={escMarca} onChange={(e) => setEscMarca(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Ubicación:</label><input type="text" value={escUbicacion} onChange={(e) => setEscUbicacion(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Resultado:</label>
                        <select value={escResultadoFinal} onChange={(e) => setEscResultadoFinal(e.target.value)} style={{ width: '98%', padding: '4px', fontSize: '11px' }}>
                          <option value="APTA PARA USO">APTA PARA USO</option><option value="NO APTA - RETIRAR">NO APTA - RETIRAR</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '6px', borderRadius: '4px' }}>
                      {escItems.map((it, idx) => (
                        <div key={it.n} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', gap: '10px' }}>
                          <span style={{ flex: 2 }}>{it.n}. <strong>{it.componente}</strong> ({it.esperado})</span>
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

                {/* FM-SST-47: TABLA DE 13 EPPs */}
                {selectedFormat.codigo === 'FM-SST-47' && (
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginBottom: '15px' }}>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '12px', color: '#1e3a8a', textTransform: 'uppercase' }}>Inspección de EPP y EPCC (13 Elementos)</h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px', marginBottom: '10px' }}>
                      <div><label style={{ fontSize: '11px', fontWeight: 'bold' }}>Trabajador:</label><input type="text" value={signerName} onChange={(e) => setSignerName(e.target.value)} style={{ width: '95%', padding: '4px', fontSize: '11px' }} /></div>
                      <div>
                        <label style={{ fontSize: '11px', fontWeight: 'bold' }}>Resultado General:</label>
                        <select value={eppResultadoFinal} onChange={(e) => setEppResultadoFinal(e.target.value)} style={{ width: '98%', padding: '4px', fontSize: '11px' }}>
                          <option value="EPP APTOS PARA USO">EPP APTOS PARA USO</option><option value="ELEMENTOS NO CONFORMES">EXISTEN NO CONFORMES</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid #cbd5e1', backgroundColor: '#fff', padding: '6px', borderRadius: '4px' }}>
                      {eppItems.map((it, idx) => (
                        <div key={it.elemento} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', gap: '10px' }}>
                          <span style={{ flex: 2 }}><strong>{it.elemento}</strong> ({it.criterio})</span>
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
                      {indTemas.map((it, idx) => (
  <div key={it.item} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 6px', borderBottom: '1px solid #f1f5f9', fontSize: '11px' }}>
    <span>{it.item}. {it.tema}</span>
    <select value={it.socializado} onChange={(e: any) => {
      const newItems = [...indTemas];
      newItems[idx].socializado = e.target.value;
      setIndTemas(newItems);
    }} style={{ fontSize: '11px', padding: '2px' }}>
      <option value="Sí">Sí</option><option value="No">No</option><option value="N/A">N/A</option>
    </select>
  </div>
))}

                {/* BOTÓN ACTUALIZAR VISTA PREVIA Y FIRMA */}
                <div style={{ marginBottom: '15px', textAlign: 'right' }}>
                  <button onClick={() => handleSelectFormat(selectedFormat)} className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 14px', fontSize: '11px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>🔄 Actualizar Vista Previa del Formato</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '15px', marginBottom: '15px' }}>
                  <div>
                    <h4 style={{ margin: '0 0 8px 0', fontSize: '13px', color: '#1e3a8a' }}>📄 Vista Previa del Documento</h4>
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
                  <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 'bold' }}>🔒 Guarda en Supabase y descarga el PDF oficial completo con todas tus tablas</span>
                  <button onClick={handleSaveAndSignDynamicForm} disabled={isFormProcessing || !formSignatureImage} className="btn" style={{ backgroundColor: formSignatureImage ? '#16a34a' : '#94a3b8', padding: '12px 20px', fontSize: '13px', fontWeight: 'bold', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
                    {isFormProcessing ? 'Procesando...' : '💾 Firmar, Registrar en Supabase y Descargar'}
                  </button>
                </div>

                {signedFormUrl && (
                  <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#f0fdf4', border: '2px solid #22c55e', borderRadius: '8px', textAlign: 'center' }}>
                    <h4 style={{ color: '#15803d', margin: '0 0 6px 0', fontSize: '14px' }}>✅ ¡Formato Registrado y Firmado con Éxito!</h4>
                    <a href={signedFormUrl} download={`${selectedFormat.codigo}_FIRMADO.pdf`} className="btn" style={{ display: 'inline-block', backgroundColor: '#0284c7', fontSize: '13px', padding: '8px 16px', textDecoration: 'none', color: '#fff' }}>📥 Descargar PDF del Formato Firmado</a>
                  </div>
                )}
              </div>
            )}
{isLoadingDocs ? <p style={{ color: '#0284c7' }}>Cargando formatos...</p> : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {formatosList.map((doc) => (
                  <div key={doc.id} style={{ padding: '12px', border: '1px solid #e2e8f0', borderRadius: '6px', backgroundColor: '#f8fafc', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>{doc.codigo}: {doc.titulo}</strong>
                      <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: '#64748b' }}>Estructura Regulada Completa | Plantilla: .{doc.extension}</p>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleSelectFormat(doc)} className="btn" style={{ backgroundColor: '#0284c7', padding: '6px 12px', fontSize: '12px', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>✍️ Diligenciar y Firmar Web</button>
                      <a href={doc.url_archivo} target="_blank" rel="noreferrer" className="btn" style={{ backgroundColor: '#16a34a', padding: '6px 12px', fontSize: '12px', textDecoration: 'none', color: '#fff' }}>📥 Descargar Plantilla Word</a>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div style={{ marginTop: '25px', paddingTop: '15px', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: '#64748b' }}>Powered by</span>
          <img src="https://static.wixstatic.com/media/d0ce54_c999d1aa9976438a98b0f5b2157b7adc~mv2.png" alt="Logo Desarrollador" style={{ height: '24px', objectFit: 'contain' }} />
        </div>
      </div>
    </div>
  );
}

export default App;
            
