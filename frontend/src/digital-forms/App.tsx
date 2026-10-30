import { useState } from 'react'
import './styles.css'
import SignaturePad from './components/SignaturePad'
import InductionEvaluation from './components/InductionEvaluation'
import InductionRegister from './components/InductionRegister'
import IncidentReportForm from './components/IncidentReportForm'
import SafeWorkAnalysis from './components/SafeWorkAnalysis'
import LadderInspection from './components/LadderInspection'
import EppInspection from './components/EppInspection'
import EppDelivery from './components/EppDelivery'
import { Activity, ArrowLeft, ArrowRight, CalendarDays, ClipboardCheck, ClipboardList, Download, FileCheck2, FileText, MapPin, Menu, Search, ShieldCheck, UserRound, Users, X } from 'lucide-react'
import { downloadAttendancePdf, type AttendanceParticipant, type AttendanceRecord } from './services/attendancePdf'
import type { DigitalPdfHandler } from './types'

type FormItem = { code: string; title: string; category: string; description: string; icon: typeof ClipboardList; planned?: boolean }
const forms: FormItem[] = [
  { code: 'FM-SST-14', title: 'Registro de asistencia', category: 'Capacitación y asistencia', description: 'Registro de actividades, responsables y participantes.', icon: ClipboardList },
  { code: 'FM-SST-16', title: 'Evaluación de inducción SST', category: 'Inducción y evaluación', description: 'Evaluación de conocimientos y registro de resultados.', icon: ClipboardCheck },
  { code: 'FM-SST-15', title: 'Registro de inducción en SST', category: 'Inducción y capacitación', description: 'Registro de temas de inducción y validación de trabajadores participantes.', icon: FileText },
  { code: 'FM-SST-29', title: 'Autorreporte de actos inseguros', category: 'Reporte y prevención', description: 'Reporte de actos, condiciones inseguras, incidentes y oportunidades de mejora.', icon: ShieldCheck },
  { code: 'FM-SST-45', title: 'Análisis de Trabajo Seguro (ATS)', category: 'Trabajo seguro y alturas', description: 'Identificación de peligros, controles, verificaciones y autorización del trabajo.', icon: ClipboardCheck },
  { code: 'FM-SST-46', title: 'Inspección preoperacional de escalera', category: 'Inspecciones de equipos', description: 'Inspección preuso/periódica de escaleras, criterios de conformidad y resultado.', icon: ClipboardCheck },
  { code: 'FM-SST-32', title: 'Entrega de EPP y Dotación', category: 'Entrega de elementos', description: 'Registro de entrega de EPP y dotación, compromiso y firma del trabajador.', icon: ClipboardList },
  { code: 'FM-SST-47', title: 'Inspección de EPP y equipos de protección contra caídas', category: 'Inspecciones de equipos', description: 'Inspección de elementos de protección personal y sistemas contra caídas.', icon: ClipboardCheck },
]
const blankPerson = (): AttendanceParticipant => ({ name: '', identification: '', cargo: '', signature: '' })
const localDate = () => { const now = new Date(); const year = now.getFullYear(); const month = String(now.getMonth() + 1).padStart(2, '0'); const day = String(now.getDate()).padStart(2, '0'); return `${year}-${month}-${day}` }
const newRecord = (): AttendanceRecord => ({ activity: '', date: localDate(), location: '', responsible: '', facilitatorName: '', facilitatorSignature: '', observations: '', participants: [blankPerson()] })

type Props = { onPdfGenerated?: DigitalPdfHandler }

export default function DigitalFormsApp({ onPdfGenerated }: Props) {
  const [query, setQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeForm, setActiveForm] = useState<'FM-SST-14' | 'FM-SST-15' | 'FM-SST-16' | 'FM-SST-29' | 'FM-SST-45' | 'FM-SST-46' | 'FM-SST-47' | 'FM-SST-32' | null>(null)
  const [selectedForm, setSelectedForm] = useState<FormItem | null>(null)
  const [record, setRecord] = useState<AttendanceRecord>(newRecord)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const visibleForms = forms.filter((form) => (form.code + ' ' + form.title + ' ' + form.category).toLowerCase().includes(query.toLowerCase()))
  const update = (key: keyof Omit<AttendanceRecord, 'participants'>, value: string) => setRecord((old) => ({ ...old, [key]: value }))
  const updatePerson = (index: number, key: keyof AttendanceParticipant, value: string) => setRecord((old) => ({ ...old, participants: old.participants.map((p, i) => i === index ? { ...p, [key]: value } : p) }))
  const openForm = () => { setRecord(newRecord()); setNotice(''); setActiveForm('FM-SST-14') }
  const exportPdf = async () => {
    setBusy(true); setNotice('')
    try { const blob = await downloadAttendancePdf(record); try { await onPdfGenerated?.(blob, 'FM-SST-14', 'Registro de asistencia', record); setNotice('PDF generado y archivado. El formato sigue pendiente de validación visual oficial.') } catch { setNotice('PDF generado y descargado, pero no se pudo archivar en Supabase. Informe al administrador.') } }
    catch { setNotice('No se pudo generar el PDF. Intenta de nuevo.') }
    finally { setBusy(false) }
  }

  return <div className="digital-forms-root"><div className="app-shell">
    <aside className={'sidebar ' + (menuOpen ? 'sidebar-open' : '')}>
      <div className="brand"><div className="brand-mark"><Activity size={23} /></div><div><strong>TECNOPROYECTOS</strong><span>INGENIERÍA S.A.S.</span></div><button className="icon-button mobile-close" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)}><X size={20} /></button></div>
      <div className="workspace-label">MÓDULO INDEPENDIENTE</div>
      <nav className="side-nav" aria-label="Navegación principal">
        <a className={'nav-link ' + (!activeForm ? 'active' : '')} href="#inicio" onClick={() => { setActiveForm(null); setMenuOpen(false) }}><ClipboardList size={18} /> Formularios SST</a>
        <a className="nav-link" href="#formatos" onClick={() => { setActiveForm(null); setMenuOpen(false) }}><FileCheck2 size={18} /> Catálogo de formatos</a>
        <span className="nav-link disabled"><Users size={18} /> Registros <span className="nav-soon">Próximamente</span></span>
      </nav>
      <div className="sidebar-bottom"><div className="security-note"><ShieldCheck size={19} /><div><strong>Entorno de pruebas</strong><span>Sin conexión a producción</span></div></div><span className="version-label">Versión inicial · 0.2.0</span></div>
    </aside>
    {menuOpen && <button className="scrim" aria-label="Cerrar menú" onClick={() => setMenuOpen(false)} />}
    <main className="main-content" id="inicio">
      <header className="topbar"><button className="icon-button mobile-menu" aria-label="Abrir menú" onClick={() => setMenuOpen(true)}><Menu size={22} /></button><div className="breadcrumb">Sistema SST <span>/</span> {activeForm === 'FM-SST-14' ? 'Registro de asistencia' : activeForm === 'FM-SST-16' ? 'Evaluación de inducción SST' : 'Formularios digitales'}</div><div className="environment-pill"><span /> Entorno independiente</div></header>
      {activeForm === 'FM-SST-32' ? <EppDelivery onBack={() => setActiveForm(null)} onPdfGenerated={onPdfGenerated} /> : activeForm === 'FM-SST-47' ? <EppInspection onBack={() => setActiveForm(null)} onPdfGenerated={onPdfGenerated} /> : activeForm === 'FM-SST-46' ? <LadderInspection onBack={() => setActiveForm(null)} onPdfGenerated={onPdfGenerated} /> : activeForm === 'FM-SST-45' ? <SafeWorkAnalysis onBack={() => setActiveForm(null)} onPdfGenerated={onPdfGenerated} /> : activeForm === 'FM-SST-29' ? <IncidentReportForm onBack={() => setActiveForm(null)} onPdfGenerated={onPdfGenerated} /> : activeForm === 'FM-SST-15' ? <InductionRegister onBack={() => setActiveForm(null)} onPdfGenerated={onPdfGenerated} /> : activeForm === 'FM-SST-16' ? <InductionEvaluation onBack={() => setActiveForm(null)} onPdfGenerated={onPdfGenerated} /> : activeForm === 'FM-SST-14' ? <section className="attendance-page">
        <button className="back-link" onClick={() => setActiveForm(null)}><ArrowLeft size={16} /> Volver al catálogo</button>
        <div className="eyebrow"><span className="eyebrow-line" /> FORMULARIO EN DESARROLLO</div>
        <h1>Registro de <span>asistencia.</span></h1>
        <p className="welcome-copy">Completa los datos de la actividad, registra a los asistentes y captura sus firmas. Esta versión no guarda información en una base de datos.</p>
        <div className="draft-warning"><ShieldCheck size={20} /><div><strong>Formato en validación</strong><p>La estructura se está ajustando al formato FM-SST-14 original. El logotipo aún es provisional y el PDF requiere revisión final. Usa datos ficticios.</p></div></div>
        <form className="attendance-form" onSubmit={(event) => { event.preventDefault(); void exportPdf() }}>
          <div className="form-section-title"><span className="section-number">01</span><div><h2>Información de la actividad</h2><p>Completa los datos principales de la jornada.</p></div></div>
          <div className="fields-grid">
            <label className="field full"><span>Tema / actividad <b>*</b></span><input required maxLength={180} value={record.activity} onChange={(e) => update('activity', e.target.value)} placeholder="Ej. Inducción en Seguridad y Salud en el Trabajo" /></label>
            <label className="field"><span>Fecha <b>*</b></span><span className="input-with-icon"><CalendarDays size={17} /><input type="date" required value={record.date} onChange={(e) => update('date', e.target.value)} /></span></label>
            <label className="field"><span>Lugar de la actividad <b>*</b></span><span className="input-with-icon"><MapPin size={17} /><input required maxLength={120} value={record.location} onChange={(e) => update('location', e.target.value)} placeholder="Lugar o sede" /></span></label>
            <label className="field"><span>Responsable de la actividad <b>*</b></span><span className="input-with-icon"><UserRound size={17} /><input required maxLength={120} value={record.responsible} onChange={(e) => update('responsible', e.target.value)} placeholder="Responsable de la actividad" /></span></label>
            <label className="field"><span>Nombre del facilitador <b>*</b></span><input required maxLength={120} value={record.facilitatorName} onChange={(e) => update('facilitatorName', e.target.value)} placeholder="Nombre del facilitador" /></label>
            </div>
          <div className="form-section-title participant-heading"><span className="section-number">02</span><div><h2>Participantes</h2><p>Agrega una fila por persona. Registra el cargo y la firma de cada asistente.</p></div><span className="participant-count">{record.participants.length} fila(s)</span></div>
          <div className="participant-list">{record.participants.map((person, index) => <div className="participant-row" key={index}>
            <div className="participant-row-title"><span>PARTICIPANTE {String(index + 1).padStart(2, '0')}</span>{record.participants.length > 1 && <button type="button" className="remove-row" onClick={() => setRecord((old) => ({ ...old, participants: old.participants.filter((_, i) => i !== index) }))}>Quitar</button>}</div>
            <div className="fields-grid participant-fields">
              <label className="field"><span>Nombre completo <b>*</b></span><input required maxLength={120} value={person.name} onChange={(e) => updatePerson(index, 'name', e.target.value)} placeholder="Nombre de prueba" /></label>
              <label className="field"><span>Identificación <b>*</b></span><input required maxLength={40} value={person.identification} onChange={(e) => updatePerson(index, 'identification', e.target.value)} placeholder="Dato ficticio" /></label>
              <label className="field"><span>Cargo</span><input maxLength={100} value={person.cargo} onChange={(e) => updatePerson(index, 'cargo', e.target.value)} placeholder="Cargo del asistente" /></label>
              <SignaturePad label="Firma del asistente" value={person.signature} onChange={(value) => updatePerson(index, 'signature', value)} />
            </div>
          </div>)}</div>
          <button type="button" className="secondary-button add-participant" onClick={() => setRecord((old) => ({ ...old, participants: [...old.participants, blankPerson()] }))}><Users size={17} /> Agregar participante</button>
          <div className="form-section-title observations-heading"><span className="section-number">03</span><div><h2>Observaciones</h2><p>Información complementaria (opcional).</p></div></div>
          <label className="field"><span>Observaciones</span><textarea rows={3} maxLength={1000} value={record.observations} onChange={(e) => update('observations', e.target.value)} placeholder="Observaciones adicionales, si aplica" /></label>
          <div className="facilitator-signature"><SignaturePad label="Firma del facilitador" value={record.facilitatorSignature} onChange={(value) => update('facilitatorSignature', value)} /></div>
          {notice && <div className={'form-notice ' + (notice.startsWith('No se') ? 'error' : '')} role="status">{notice}</div>}
          <div className="form-actions"><button type="button" className="secondary-button" onClick={() => { setRecord(newRecord()); setNotice('') }}>Limpiar formulario</button><button type="submit" className="primary-button" disabled={busy}>{busy ? 'Generando PDF…' : 'Generar PDF preliminar'} <Download size={17} /></button></div>
        </form>
        <p className="prototype-disclaimer">Prototipo de desarrollo · No usar todavía para registros oficiales.</p>
      </section> : <>
        <section className="welcome-section"><div className="eyebrow"><span className="eyebrow-line" /> SEGURIDAD Y SALUD EN EL TRABAJO</div><h1>Formularios SST <span>digitales.</span></h1><p className="welcome-copy">Gestiona los formatos del Sistema de Seguridad y Salud en el Trabajo desde un solo lugar. Esta versión es un prototipo independiente para validar el flujo antes de conectar datos reales.</p><div className="welcome-meta"><div className="meta-icon"><ShieldCheck size={18} /></div><span>Desarrollo aislado</span><span className="meta-divider" /><span>Datos de prueba únicamente</span></div></section>
        <section className="stats-grid" aria-label="Resumen del módulo"><div className="stat-card"><div className="stat-icon green"><ClipboardList size={19} /></div><div><span>Formatos priorizados</span><strong>02</strong><small>Primera fase de desarrollo</small></div></div><div className="stat-card"><div className="stat-icon blue"><FileCheck2 size={19} /></div><div><span>Flujos iniciados</span><strong>01</strong><small>FM-SST-14 en prototipo</small></div></div><div className="stat-card"><div className="stat-icon amber"><Users size={19} /></div><div><span>Registros guardados</span><strong>—</strong><small>Persistencia aún no conectada</small></div></div></section>
        <section className="forms-section" id="formatos"><div className="section-heading"><div><span className="section-kicker">CATÁLOGO</span><h2>Formatos disponibles</h2><p>Selecciona un formato para abrirlo o revisar su estado.</p></div><label className="search-box"><Search size={18} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar formato..." aria-label="Buscar formato" /></label></div>
          <div className="forms-grid">{visibleForms.map((form) => { const Icon = form.icon; return <article className="form-card" key={form.code}><div className="card-topline"><div className="form-icon"><Icon size={21} /></div><span className={'status-tag ' + (form.planned ? 'planned' : '')}><span />{form.planned ? 'En planificación' : 'Prioridad inicial'}</span></div><div className="form-code">{form.code}</div><h3>{form.title}</h3><p>{form.description}</p><div className="card-footer"><span>{form.category}</span><button className="text-action" onClick={() => form.code === 'FM-SST-14' ? openForm() : form.code === 'FM-SST-15' ? (setActiveForm('FM-SST-15'), setSelectedForm(null)) : form.code === 'FM-SST-16' ? (setActiveForm('FM-SST-16'), setSelectedForm(null)) : form.code === 'FM-SST-29' ? (setActiveForm('FM-SST-29'), setSelectedForm(null)) : form.code === 'FM-SST-45' ? (setActiveForm('FM-SST-45'), setSelectedForm(null)) : form.code === 'FM-SST-46' ? (setActiveForm('FM-SST-46'), setSelectedForm(null)) : form.code === 'FM-SST-47' ? (setActiveForm('FM-SST-47'), setSelectedForm(null)) : form.code === 'FM-SST-32' ? (setActiveForm('FM-SST-32'), setSelectedForm(null)) : setSelectedForm(form)}>{form.code === 'FM-SST-14' || form.code === 'FM-SST-15' || form.code === 'FM-SST-16' || form.code === 'FM-SST-29' || form.code === 'FM-SST-45' || form.code === 'FM-SST-46' || form.code === 'FM-SST-47' || form.code === 'FM-SST-32' ? 'Abrir formulario' : 'Ver detalle'} <ArrowRight size={16} /></button></div></article> })}{visibleForms.length === 0 && <div className="empty-state">No encontramos formatos con “{query}”. Prueba otra búsqueda.</div>}</div>
        </section>
        <section className="roadmap-banner"><div className="roadmap-icon"><ShieldCheck size={22} /></div><div><strong>Diseñado para integrarse después</strong><p>Primero validamos formularios, permisos y generación de PDF en este entorno. La aplicación existente permanece intacta.</p></div><span className="roadmap-badge">FASE 1</span></section>
        <footer className="footer"><span>© Tecnoproyectos Ingeniería S.A.S.</span><span>Prototipo SST · No usar aún para registros oficiales</span></footer>
      </>}
    </main>
    {selectedForm && <div className="modal-backdrop" role="presentation" onClick={() => setSelectedForm(null)}><section className="detail-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title" onClick={(e) => e.stopPropagation()}><button className="icon-button modal-close" aria-label="Cerrar" onClick={() => setSelectedForm(null)}><X size={20} /></button><div className="modal-symbol"><selectedForm.icon size={25} /></div><span className="form-code">{selectedForm.code}</span><h2 id="modal-title">{selectedForm.title}</h2><p>{selectedForm.description}</p><div className="modal-info"><strong>Estado de implementación</strong><span>{selectedForm.planned ? 'En planificación' : 'Pendiente de desarrollo'}</span><small>Este formato se habilitará después de revisar la plantilla PDF original y definir sus campos y validaciones.</small></div><button className="primary-button" onClick={() => setSelectedForm(null)}>Entendido <ArrowRight size={17} /></button></section></div>}
  </div>
</div>
}
