import { useRef, useState } from 'react'
import { ArrowLeft, Printer } from 'lucide-react'

type Criterion = { name: string; expected: string; status: 'C' | 'NC' | 'N/A' | ''; observation: string }
const criteria: Omit<Criterion, 'status' | 'observation'>[] = [
  { name: 'Largueros', expected: 'Sin fisuras, deformaciones, roturas, perforaciones ni reparaciones no autorizadas.' },
  { name: 'Peldaños', expected: 'Completos, firmes, limpios, secos, sin fisuras ni deformaciones.' },
  { name: 'Zapatas antideslizantes', expected: 'Presentes, íntegras, firmes y con capacidad de agarre.' },
  { name: 'Seguros / ganchos de extensión', expected: 'Operan correctamente, sin deformación ni desgaste crítico.' },
  { name: 'Cuerda de extensión', expected: 'Sin cortes, abrasión, quemaduras, contaminación ni deterioro.' },
  { name: 'Polea / sistema de extensión', expected: 'Giro y funcionamiento correctos; sin daño o bloqueo.' },
  { name: 'Guías y herrajes', expected: 'Firmes, completos, sin corrosión o deformación que comprometa el uso.' },
  { name: 'Limpieza y condición dieléctrica', expected: 'Libre de humedad, aceites, grasas, pintura o contaminación conductora.' },
  { name: 'Etiquetas y advertencias', expected: 'Legibles; identificación y datos críticos visibles.' },
  { name: 'Base / nivelación', expected: 'Base firme; no requiere piedras, bloques u objetos improvisados.' },
  { name: 'Longitud y solape', expected: 'Adecuados para la tarea y dentro de los límites del fabricante.' },
  { name: 'Ángulo de instalación', expected: 'Puede instalarse según el ángulo indicado por el fabricante.' },
  { name: 'Aseguramiento', expected: 'Existen medios para asegurar base y parte superior contra desplazamiento.' },
  { name: 'Entorno eléctrico', expected: 'Material/clasificación apropiados; distancia segura a redes puede mantenerse.' },
  { name: 'Historial / hoja de vida', expected: 'Inspecciones y mantenimiento al día; sin evento que obligue a retiro.' },
]
const emptyRows = (): Criterion[] => criteria.map(c => ({ ...c, status: '', observation: '' }))
const logoUrl = 'https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg'

function SignaturePad({ label }: { label: string }) {
 const canvasRef = useRef<HTMLCanvasElement>(null)
 const drawing = useRef(false)
 const point = (event: React.PointerEvent<HTMLCanvasElement>) => {
   const canvas = canvasRef.current
   if (!canvas) return null
   const rect = canvas.getBoundingClientRect()
   const scaleX = canvas.width / rect.width
   const scaleY = canvas.height / rect.height
   return { x: (event.clientX - rect.left) * scaleX, y: (event.clientY - rect.top) * scaleY }
 }
 const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
   const canvas = canvasRef.current
   const ctx = canvas?.getContext('2d')
   const p = point(event)
   if (!canvas || !ctx || !p) return
   drawing.current = true
   canvas.setPointerCapture(event.pointerId)
   ctx.beginPath()
   ctx.moveTo(p.x, p.y)
 }
 const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
   if (!drawing.current) return
   const ctx = canvasRef.current?.getContext('2d')
   const p = point(event)
   if (!ctx || !p) return
   ctx.lineWidth = 2
   ctx.lineCap = 'round'
   ctx.lineJoin = 'round'
   ctx.strokeStyle = '#111'
   ctx.lineTo(p.x, p.y)
   ctx.stroke()
 }
 const clear = () => {
   const canvas = canvasRef.current
   const ctx = canvas?.getContext('2d')
   if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
 }
 return <div className="ladder-signature-field"><strong>{label}</strong><canvas ref={canvasRef} width={600} height={100} aria-label={label} role="img" onPointerDown={start} onPointerMove={move} onPointerUp={() => { drawing.current = false }} onPointerCancel={() => { drawing.current = false }} /><button type="button" className="no-print ladder-clear-signature" onClick={clear}>Borrar firma</button></div>
}

function Header() {
  return <header className="ladder-header">
    <div className="ladder-logo"><img src={logoUrl} alt="Logotipo TecnoProyectos" /></div>
    <div className="ladder-titles"><strong>SISTEMA DE GESTIÓN INTEGRADO</strong><strong>GESTIÓN DE LA SEGURIDAD Y SALUD EN EL TRABAJO</strong><strong>INSPECCIÓN PREOPERACIONAL DE ESCALERA</strong></div>
    <div className="ladder-meta"><span>Código: FM-SST-46</span><span>Versión: 01</span><span>Fecha: 22/06/2026</span></div>
  </header>
}
export default function LadderInspection({ onBack }: { onBack: () => void }) {
 const [date,setDate]=useState(''); const [location,setLocation]=useState(''); const [ladderId,setLadderId]=useState(''); const [brand,setBrand]=useState(''); const [inspector,setInspector]=useState(''); const [role,setRole]=useState(''); const [kind,setKind]=useState(''); const [lengthCapacity,setLengthCapacity]=useState(''); const [rows,setRows]=useState<Criterion[]>(emptyRows); const [result,setResult]=useState(''); const [coordinator,setCoordinator]=useState(''); const [corrective,setCorrective]=useState(''); const [closeDate,setCloseDate]=useState('')
 const updateStatus=(index:number,status:Criterion['status'])=>setRows(old=>old.map((r,i)=>i===index?{...r,status}:r))
 const updateObservation=(index:number,observation:string)=>setRows(old=>old.map((r,i)=>i===index?{...r,observation}:r))
 const renderRows=(slice:Criterion[],offset:number)=><table className="ladder-table"><colgroup><col style={{width:'7.5%'}}/><col style={{width:'31%'}}/><col style={{width:'19%'}}/><col style={{width:'20%'}}/><col style={{width:'22.5%'}}/></colgroup><thead><tr><th>N.º</th><th>Componente / criterio</th><th>Condición esperada</th><th>C/NC/N.A.</th><th>Observación / acción</th></tr></thead><tbody>{slice.map((r,i)=><tr key={offset+i}><td>{offset+i+1}</td><td>{r.name}</td><td>{r.expected}</td><td><div className="ladder-status">{(['C','NC','N/A'] as const).map(v=><label key={v}><input type="radio" name={`criterion-${offset+i}`} checked={r.status===v} onChange={()=>updateStatus(offset+i,v)}/><span>{v}</span></label>)}</div></td><td><textarea aria-label={`Observación criterio ${offset+i+1}`} value={r.observation} onChange={e=>updateObservation(offset+i,e.target.value)}/></td></tr>)}</tbody></table>
 return <section className="ladder-editor">
 <div className="ladder-toolbar no-print"><button className="back-link" onClick={onBack}><ArrowLeft size={16}/> Volver al catálogo</button><div><strong>FM-SST-46</strong><span> · Formulario preliminar editable</span></div><button className="primary-button" onClick={()=>window.print()}><Printer size={16}/> Imprimir / guardar PDF</button></div>
 <div className="ladder-paper">
 <section className="ladder-page"><Header/><div className="ladder-ident"><label>Fecha:<input type="date" value={date} onChange={e=>setDate(e.target.value)}/></label><label>Ubicación:<input value={location} onChange={e=>setLocation(e.target.value)}/></label><label>Código / ID escalera:<input value={ladderId} onChange={e=>setLadderId(e.target.value)}/></label><label>Marca / serial:<input value={brand} onChange={e=>setBrand(e.target.value)}/></label><label>Inspector:<input value={inspector} onChange={e=>setInspector(e.target.value)}/></label><label>Cargo:<input value={role} onChange={e=>setRole(e.target.value)}/></label><label>Tipo:<select value={kind} onChange={e=>setKind(e.target.value)}><option value="">Seleccionar…</option><option>Simple</option><option>Extensible</option><option>Tipo tijera</option><option>Multipropósito</option><option>Otra</option></select></label><label>Longitud / capacidad:<input value={lengthCapacity} onChange={e=>setLengthCapacity(e.target.value)}/></label></div><h2 className="ladder-section-title">1. INSPECCIÓN PREUSO / PERIÓDICA</h2>{renderRows(rows.slice(0,11),0)}<div className="ladder-page-number">Página1 de 2</div></section>
 <section className="ladder-page ladder-page-two"><Header/>{renderRows(rows.slice(11),11)}<div className="ladder-result"><h2 className="ladder-section-title">2. RESULTADO DE LA INSPECCIÓN</h2><div className="ladder-result-options"><label><input type="radio" name="ladder-result" checked={result==='APTA'} onChange={()=>setResult('APTA')}/> APTA PARA USO</label><label><input type="radio" name="ladder-result" checked={result==='NO_APTA'} onChange={()=>setResult('NO_APTA')}/> NO APTA - RETIRAR DE SERVICIO / IDENTIFICAR Y SEGREGAR</label></div><p>Criterio de retiro inmediato: daño en largueros o peldaños, zapatas/seguros defectuosos, cuerda o polea dañada, deformación, contaminación conductora, reparación no autorizada o cualquier duda sobre su integridad.</p></div><div className="ladder-signatures"><label>Inspector<input value={inspector} onChange={e=>setInspector(e.target.value)}/></label><SignaturePad label="Firma del inspector" /><label>Responsable / coordinador<input value={coordinator} onChange={e=>setCoordinator(e.target.value)}/></label><SignaturePad label="Firma del responsable / coordinador" /><label>Acción correctiva / mantenimiento<input value={corrective} onChange={e=>setCorrective(e.target.value)}/></label><label>Fecha cierre<input type="date" value={closeDate} onChange={e=>setCloseDate(e.target.value)}/></label></div><div className="ladder-page-number">Página2 de 2</div></section>
 </div><p className="ladder-disclaimer no-print">Versión inicial para revisión visual. La información se mantiene en esta sesión; aún no hay guardado permanente de inspecciones.</p>
 </section>
}
