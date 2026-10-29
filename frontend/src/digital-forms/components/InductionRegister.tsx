import { useState, type CSSProperties, type FormEvent } from 'react'
import { ArrowLeft, Download, Plus, Trash2, ShieldCheck } from 'lucide-react'
import SignaturePad from './SignaturePad'
import { downloadInductionRegisterPdf, type InductionRegisterRecord, type InductionTopic } from '../services/inductionRegisterPdf'

const topics = [
  'Política de Seguridad y Salud en el Trabajo',
  'Política para la prevención y promoción frente al consumo de alcohol, tabaco y sustancias psicoactivas',
  'Política para la prevención del acoso laboral y acoso sexual laboral',
  'Otras políticas de la organización',
  'Objetivos y metas del sistema de gestión de la seguridad y salud en el trabajo (SG-SST)',
  'Conceptos de Riesgo y Peligro',
  'Concepto de auto reporte de condiciones',
  'Concepto de accidente de Trabajo y Enfermedad Laboral',
  'Sistema de Seguridad Social Integral',
  'Deberes y derechos de los trabajadores',
  'Comité Paritario de SST y Comité de Convivencia Laboral',
  'Plan y números de Emergencias',
  'Red de Atención Médica',
  'Clasificación de peligros y riesgos',
  'Controles frente a los peligros y riesgos',
  'Estándar para la prevención de caídas al mismo y diferente nivel',
  'Uso de Elementos de Protección Personal',
  '¿Qué hacer en caso de un accidente?',
  'Reporte e investigación de accidentes',
  'Incapacidades y ausencias',
]
const blankTopic = (name: string): InductionTopic => ({ name, response: '' })
const blankParticipant = () => ({ name: '', identification: '', signature: '' })
const today = () => { const d = new Date(); return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-') }
const initialRecord = (): InductionRegisterRecord => ({ date: today(), time: '08:00 AM', cargo: '', trainer: 'Matilde Chamorro Simanca', topics: topics.map(blankTopic), participants: [blankParticipant()] })
type Props = { onBack: () => void }

export default function InductionRegister({ onBack }: Props) {
  const [record, setRecord] = useState<InductionRegisterRecord>(initialRecord)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const update = (key: 'date'|'time'|'cargo'|'trainer', value: string) => setRecord(old => ({ ...old, [key]: value }))
  const updateTopic = (index: number, response: string) => setRecord(old => ({ ...old, topics: old.topics.map((t,i) => i === index ? {...t,response} : t) }))
  const updateParticipant = (index: number, key: 'name'|'identification'|'signature', value: string) => setRecord(old => ({...old, participants: old.participants.map((p,i) => i === index ? {...p,[key]:value} : p)}))
  const exportPdf = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setNotice('')
    try { await downloadInductionRegisterPdf(record); setNotice('PDF preliminar generado. Revisa el diseño antes de usarlo como registro oficial.') }
    catch { setNotice('No se pudo generar el PDF. Intenta nuevamente.') }
    finally { setBusy(false) }
  }
  const blue = '#145a9e'
  const fieldStyle: CSSProperties = { width:'100%', boxSizing:'border-box', padding:'10px 12px', border:'1px solid #cbd9e8', borderRadius:7, background:'#fff', font:'inherit', color:'#182b3e' }
  const labelStyle: CSSProperties = { display:'grid', gap:7, fontSize:13, fontWeight:600, color:'#263f58' }
  const panelStyle: CSSProperties = { background:'#fff', border:'1px solid #d6e2ef', borderRadius:12, padding:20, marginTop:18, boxShadow:'0 2px 8px rgba(20,90,158,.06)' }
  const topicBlocks = [record.topics.slice(0,10), record.topics.slice(10,20)]
  return <section className="attendance-page">
    <button className="back-link" type="button" onClick={onBack}><ArrowLeft size={16}/> Volver al catálogo</button>
    <div className="eyebrow"><span className="eyebrow-line"/> FORMULARIO EN DESARROLLO</div>
    <h1>Registro de inducción <span style={{color:blue}}>SST.</span></h1>
    <p className="welcome-copy">FM-SST-15 · Versión 01 · Diligencia los datos, valida los temas tratados y registra a cada trabajador participante.</p>
    <div className="draft-warning" style={{borderColor:'#9dbfe0',background:'#edf5fc',color:'#164d80'}}><ShieldCheck size={20}/><div><strong>Formato en validación</strong><p>Usa datos ficticios. Este prototipo no guarda información en una base de datos y el PDF generado requiere revisión visual contra la plantilla institucional.</p></div></div>
    <form onSubmit={exportPdf}>
      <div style={panelStyle}>
        <div style={{display:'flex',alignItems:'center',gap:14,borderBottom:'2px solid #145a9e',paddingBottom:12,marginBottom:16}}>
          <img src="https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg" alt="Logo de TECNOPROYECTOS INGENIERÍA S.A.S." style={{width:104,height:68,objectFit:'contain',border:'1px solid #b9cfe4',padding:4,borderRadius:3,background:'#fff'}}/>
          <div style={{color:blue,fontSize:12,fontWeight:700,lineHeight:1.5}}>SISTEMA DE GESTIÓN INTEGRADO<br/>GESTIÓN DE LA SEGURIDAD Y SALUD EN EL TRABAJO<br/><span style={{fontSize:11}}>REGISTRO DE INDUCCIÓN EN SEGURIDAD Y SALUD EN EL TRABAJO · FM-SST-15</span></div>
        </div>
        <h2 style={{marginTop:0,color:blue}}>01 · Datos de la actividad</h2>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(210px,1fr))',gap:16}}>
          <label style={labelStyle}>Fecha<input style={fieldStyle} type="date" required value={record.date} onChange={e=>update('date',e.target.value)}/></label>
          <label style={labelStyle}>Hora<input style={fieldStyle} required maxLength={30} value={record.time} onChange={e=>update('time',e.target.value)} placeholder="08:00 AM"/></label>
          <label style={labelStyle}>Cargo del trabajador<input style={fieldStyle} required maxLength={120} value={record.cargo} onChange={e=>update('cargo',e.target.value)} placeholder="Cargo del trabajador"/></label>
          <label style={labelStyle}>Nombre del capacitador<input style={fieldStyle} required maxLength={120} value={record.trainer} onChange={e=>update('trainer',e.target.value)}/></label>
        </div>
      </div>
      <div style={panelStyle}>
        <h2 style={{marginTop:0,color:blue}}>02 · Contenido de la inducción</h2>
        <p style={{color:'#526b82',fontSize:13}}>Marca una casilla por tema. Los 20 temas se presentan en dos bloques paralelos.</p>
        <div style={{display:'grid',gridTemplateColumns:'repeat(2,minmax(0,1fr))',gap:12,alignItems:'start'}}>
          {topicBlocks.map((block,blockIndex)=><div key={blockIndex} style={{minWidth:0,border:'1px solid #cbd9e8',borderRadius:5,overflow:'hidden'}}>
            <div style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 27px 27px 32px',background:'#dceaf7',color:'#164d80',fontSize:10,fontWeight:700,textAlign:'center',padding:'8px 5px',borderBottom:'1px solid #a9c5e1'}}>
              <span style={{textAlign:'left'}}>TEMA</span><span>SÍ</span><span>NO</span><span>N/A</span>
            </div>
            {block.map((topic,localIndex)=>{const index=blockIndex*10+localIndex;return <div key={topic.name} style={{display:'grid',gridTemplateColumns:'minmax(0,1fr) 27px 27px 32px',alignItems:'stretch',borderBottom:localIndex===block.length-1?'0':'1px solid #dce5ed',background:localIndex%2?'#f6f9fc':'#fff',fontSize:11}}>
              <div style={{padding:'7px 5px',lineHeight:1.3,color:'#263f58'}}>{index+1}. {topic.name}</div>
              {['Sí','No','N/A'].map(option=><label key={option} title={option+' — '+topic.name} style={{display:'flex',justifyContent:'center',alignItems:'center',borderLeft:'1px solid #e0e8f0',cursor:'pointer'}}><input aria-label={option+': '+topic.name} type="radio" name={'topic-'+index} checked={topic.response===option} onChange={()=>updateTopic(index,option)} style={{accentColor:blue,width:13,height:13,margin:0}}/></label>)}
            </div>})}
          </div>)}
        </div>
        <p style={{fontSize:12,color:'#855d16',marginBottom:0}}>Nota de validación: se recibieron 20 temas enumerados, aunque la descripción menciona 22. No se inventaron los dos temas faltantes.</p>
      </div>
      <div style={panelStyle}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:12,flexWrap:'wrap'}}><div><h2 style={{margin:'0 0 5px',color:blue}}>03 · Trabajadores participantes</h2><p style={{margin:0,color:'#526b82',fontSize:13}}>Registra nombre, documento y firma.</p></div><button className="secondary-button" type="button" onClick={()=>setRecord(old=>({...old,participants:[...old.participants,blankParticipant()]}))}><Plus size={16}/> Agregar trabajador</button></div>
        {record.participants.map((p,index)=><div key={index} style={{border:'1px solid #cbd9e8',borderRadius:8,padding:14,marginTop:14,background:'#f8fbfe'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12,color:blue}}><strong>TRABAJADOR {String(index+1).padStart(2,'0')}</strong>{record.participants.length>1&&<button type="button" className="remove-row" onClick={()=>setRecord(old=>({...old,participants:old.participants.filter((_,i)=>i!==index)}))}><Trash2 size={14}/> Quitar</button>}</div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(190px,1fr))',gap:14,alignItems:'start'}}>
            <label style={labelStyle}>Nombre completo<input style={fieldStyle} required maxLength={140} value={p.name} onChange={e=>updateParticipant(index,'name',e.target.value)}/></label>
            <label style={labelStyle}>Cédula / documento<input style={fieldStyle} required maxLength={50} value={p.identification} onChange={e=>updateParticipant(index,'identification',e.target.value)}/></label>
            <SignaturePad label="Firma del colaborador" value={p.signature} onChange={value=>updateParticipant(index,'signature',value)}/>
          </div>
        </div>)}
      </div>
      {notice && <div className="form-notice" role="status">{notice}</div>}
      <div className="form-actions"><button type="button" className="secondary-button" onClick={()=>{setRecord(initialRecord());setNotice('')}}>Limpiar formulario</button><button type="submit" className="primary-button" disabled={busy}>{busy?'Generando PDF…':'Generar PDF preliminar'} <Download size={17}/></button></div>
    </form>
    <p className="prototype-disclaimer">Prototipo de desarrollo · No usar todavía para registros oficiales.</p>
  </section>
}
