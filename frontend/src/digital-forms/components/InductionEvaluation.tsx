import { useState } from 'react'
import { ArrowLeft, Download, Printer, ShieldCheck } from 'lucide-react'
import SignaturePad from './SignaturePad'
import { downloadInductionPdf, type InductionPdfQuestion } from '../services/inductionPdf'

type Props = { onBack: () => void }
const DEFAULT_ARL = 'Positiva'
const openQuestions = [
  { key: 'policy', label: '¿Cuál es el objetivo de la política de seguridad y salud en el trabajo de TECNOPROYECTOS INGENIERIA S.A.S.?', rows: 3 },
  { key: 'responsibilities', label: 'Enuncie TRES de sus responsabilidades en seguridad y salud en el trabajo.', rows: 3 },
  { key: 'hazards', label: 'Enuncie DOS peligros de acuerdo con su actividad dentro de la empresa, y genere un mecanismo de control.', rows: 4 },
  { key: 'objectives', label: 'Enuncie DOS objetivos del sistema de gestión de seguridad y salud en el trabajo de TECNOPROYECTOS INGENIERIA S.A.S.', rows: 3 },
  { key: 'unsafeActs', label: 'Tres ejemplos de acto inseguro de acuerdo con la actividad que usted desarrolla dentro de la empresa.', rows: 3 },
]
const trueFalse = [
  { key: 'copasst', label: 'COPASST: Un organismo de vigilancia y control del cumplimiento de las normas en seguridad y salud en el trabajo.' },
  { key: 'illness', label: 'Enfermedad laboral es aquella causada de manera directa por el ejercicio de la labor que realice una persona o como consecuencia de un accidente laboral, produciendo desde una incapacidad hasta la muerte.' },
]
const multipleChoice = [
  { key: 'accident', label: 'ACCIDENTE DE TRABAJO', options: [
    'Todo suceso repentino que sobrevenga por causa o con ocasión del trabajo, y que produzca en el trabajador una lesión orgánica, una perturbación funcional, una invalidez o la muerte.',
    'Condición contraída como resultado de la exposición a factores de riesgo inherentes a la actividad laboral.',
    'Todo aquello que potencialmente puede causar un daño al trabajador en el desarrollo de sus funciones.',
  ]},
  { key: 'coexistence', label: 'COMITÉ DE CONVIVENCIA LABORAL', options: [
    'Un grupo de trabajadores que evalúan riesgos.',
    'Un comité organizado por el empleador para juzgar trabajadores.',
    'Un organismo dedicado a la prevención del acoso laboral y riesgos psicosociales.',
  ]},
  { key: 'report', label: 'REPORTE DE ACCIDENTE DE TRABAJO', options: [
    'Debe hacerse dentro de las 72 horas siguientes al suceso y debe comunicarse a un compañero.',
    'Debe hacerse de manera inmediata y debe comunicarse al jefe inmediato y al área de seguridad y salud en el trabajo.',
    'No debo reportarlo ya que me pasó a mí.',
  ]},
  { key: 'risk', label: 'RIESGO', options: [
    'Desviación de los procedimientos de trabajo seguro.',
    'Requisito de seguridad y salud en el trabajo impuesto por el trabajador y que está presente en las actividades diarias.',
    'Combinación de la probabilidad de que ocurra uno o más eventos de características negativas debido a la exposición a un determinado peligro y la severidad del daño que puede ser causado por este.',
  ]},
  { key: 'unsafeCondition', label: 'CONDICIÓN INSEGURA', options: [
    'Aquellos factores físicos o circunstancias del medio de trabajo que pueden facilitar la ocurrencia de accidentes o incidentes.',
    'Evento ocurrido en el trayecto de la casa al trabajo y que produce una lesión en el trabajador.',
    'Adelantar un vehículo en línea continua.',
  ]},
  { key: 'emergency', label: 'PLAN DE EMERGENCIA', options: [
    'Cómo guardar la dotación en mi lugar de trabajo.',
    'Qué sitios de interés visitar para conseguir clientes.',
    'Qué hacer en caso de una emergencia que se presente en el desarrollo de sus actividades laborales.',
  ]},
  { key: 'socialSecurity', label: 'EN LA CONTRATACIÓN LABORAL ¿USTED QUEDA AFILIADO A?', options: [
    'Seguro de responsabilidad civil, EPS y Seguro todo riesgo.',
    'Sistema de seguridad social (ARL, EPS, AFP, CAJA DE COMPENSACIÓN).',
    'Sistema de vigilancia privada, SOAT y ARL.',
  ]},
]
export default function InductionEvaluation({ onBack }: Props) {
  const [name, setName] = useState('')
  const [cargo, setCargo] = useState('')
  const [kind, setKind] = useState<'Inducción' | 'Re-inducción'>('Inducción')
  const [date, setDate] = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}` })
  const [answers, setAnswers] = useState<Record<string,string>>({})
  const [arL, setArL] = useState(DEFAULT_ARL)
  const [signature, setSignature] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const setAnswer = (key: string, value: string) => setAnswers(old => ({ ...old, [key]: value }))
  const exportPdf = async () => {
    setBusy(true)
    setNotice('')
    const questions: InductionPdfQuestion[] = [
      ...openQuestions.map((q, i) => ({ number: i + 1, prompt: q.label, answer: answers[q.key] || '', group: 'open' as const })),
      ...trueFalse.map((q, i) => ({ number: i + 6, prompt: q.label, answer: answers[q.key] === 'F' ? 'Falso' : answers[q.key] === 'V' ? 'Verdadero' : '', group: 'trueFalse' as const, selected: answers[q.key] || '' })),
      ...multipleChoice.map((q, i) => {
        const selected = answers[q.key]
        const selectedIndex = selected ? selected.charCodeAt(0) - 65 : -1
        return { number: i + 8, prompt: q.label, answer: selectedIndex >= 0 && selectedIndex < q.options.length ? String.fromCharCode(65 + selectedIndex) + ') ' + q.options[selectedIndex] : '', options: q.options, group: 'multiple' as const, selected: selected || '' }
      }),
      { number: 15, prompt: '¿A qué ARL quedará usted afiliado?', answer: arL, group: 'arl' as const },
    ]
    try {
      await downloadInductionPdf({ name, cargo, kind, date, arl: arL, signature, questions })
      setNotice('PDF generado. Revisa el archivo descargado; este documento sigue siendo un prototipo y no debe usarse como registro oficial.')
    } catch {
      setNotice('No se pudo generar el PDF. Intenta nuevamente.')
    } finally {
      setBusy(false)
    }
  }
  return <section className="attendance-page induction-page">
    <button className="back-link no-print" onClick={onBack}><ArrowLeft size={16} /> Volver al catálogo</button>
    <div className="eyebrow"><span className="eyebrow-line" /> FORMULARIO EN DESARROLLO</div>
    <h1>Evaluación de <span>inducción SST.</span></h1>
    <p className="welcome-copy">Formulario digital basado en FM-SST-16, versión 01 (22/06/2026). Las respuestas se mantienen temporalmente en este navegador y no se guardan en una base de datos.</p>
    <div className="draft-warning no-print"><ShieldCheck size={20} /><div><strong>Formato en validación</strong><p>Todas las preguntas tienen el mismo valor: 1 punto por respuesta correcta. El formato establece aprobación con mínimo 12 puntos. Las preguntas abiertas requieren revisión humana; por eso el formulario no calcula todavía una nota automática. La ARL aparece inicialmente como Positiva, pero puedes editarla si cambia.</p></div></div>
    <form className="attendance-form" onSubmit={e => { e.preventDefault(); void exportPdf() }}>
      <div className="form-section-title"><span className="section-number">01</span><div><h2>Datos del colaborador</h2><p>Información de identificación y realización de la inducción.</p></div></div>
      <div className="fields-grid">
        <label className="field"><span>Nombre <b>*</b></span><input required maxLength={150} value={name} onChange={e=>setName(e.target.value)} /></label>
        <label className="field"><span>Cargo <b>*</b></span><input required maxLength={100} value={cargo} onChange={e=>setCargo(e.target.value)} /></label>
        <label className="field"><span>Tipo de proceso</span><select value={kind} onChange={e=>setKind(e.target.value as 'Inducción'|'Re-inducción')}><option>Inducción</option><option>Re-inducción</option></select></label>
        <label className="field"><span>Fecha de realización <b>*</b></span><input required type="date" value={date} onChange={e=>setDate(e.target.value)} /></label>
      </div>
      <div className="form-section-title participant-heading"><span className="section-number">02</span><div><h2>Preguntas abiertas</h2><p>Diligencie en el espacio en blanco las respuestas adecuadas a cada pregunta.</p></div></div>
      <div className="induction-questions">{openQuestions.map((q,i)=><label className="field induction-open-question" key={q.key}><span><b>{i+1}.</b> {q.label}</span><textarea required rows={q.rows} maxLength={2000} value={answers[q.key]||''} onChange={e=>setAnswer(q.key,e.target.value)} /></label>)}</div>
      <div className="form-section-title participant-heading"><span className="section-number">03</span><div><h2>Falso o verdadero</h2><p>Seleccione una respuesta para cada afirmación.</p></div></div>
      <div className="induction-questions">{trueFalse.map((q,i)=><fieldset className="choice-fieldset" key={q.key}><legend>{i+6}. {q.label}</legend><div className="radio-options"><label><input required type="radio" name={q.key} value="F" checked={answers[q.key]==='F'} onChange={e=>setAnswer(q.key,e.target.value)} /> Falso</label><label><input type="radio" name={q.key} value="V" checked={answers[q.key]==='V'} onChange={e=>setAnswer(q.key,e.target.value)} /> Verdadero</label></div></fieldset>)}</div>
      <div className="form-section-title participant-heading"><span className="section-number">04</span><div><h2>Selección múltiple</h2><p>De las tres opciones, marque la respuesta que considere correcta.</p></div></div>
      <div className="induction-questions">{multipleChoice.map((q,i)=><fieldset className="choice-fieldset" key={q.key}><legend>{i+8}. {q.label}</legend><div className="multiple-options">{q.options.map((option,j)=><label key={j}><input required type="radio" name={q.key} value={String.fromCharCode(65+j)} checked={answers[q.key]===String.fromCharCode(65+j)} onChange={e=>setAnswer(q.key,e.target.value)} /><span><b>{String.fromCharCode(97+j)})</b> {option}</span></label>)}</div></fieldset>)}
      <label className="field"><span><b>15.</b> ¿A qué ARL quedará usted afiliado? <b>*</b></span><input required maxLength={150} value={arL} onChange={e=>setArL(e.target.value)} /></label></div>
      <div className="form-section-title participant-heading"><span className="section-number">05</span><div><h2>Compromiso y firma</h2><p>Compromiso transcrito del formato original.</p></div></div>
      <p className="commitment-text">Yo <strong>{name || '________________________________'}</strong>, me comprometo a cumplir y aplicar todas las normas y requerimientos de seguridad, salud en el trabajo y medio ambiente, al igual que las políticas internas de TECNOPROYECTOS INGENIERIA S.A.S., reportar todo acto y condición insegura, accidente de trabajo y enfermedad laboral.</p>
      <div className="signature-print-wrap"><SignaturePad label="Firma del colaborador" value={signature} onChange={setSignature} /></div>
      {notice && <div className={'form-notice no-print ' + (notice.startsWith('No se') ? 'error' : '')} role="status">{notice}</div>}
      <div className="form-actions no-print"><button type="button" className="secondary-button" onClick={()=>{setName('');setCargo('');setKind('Inducción');setAnswers({});setArL(DEFAULT_ARL);setSignature('');setNotice('')}}>Limpiar formulario</button><button type="button" className="secondary-button" onClick={()=>window.print()}><Printer size={17}/> Imprimir / guardar como PDF</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Generando PDF…' : 'Generar PDF'} <Download size={17}/></button></div>
    </form>
    <p className="prototype-disclaimer no-print">Prototipo de desarrollo · No usar todavía para evaluaciones oficiales.</p>
  </section>
}
