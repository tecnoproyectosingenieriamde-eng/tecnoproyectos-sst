import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
export type IncidentReport = {
 reportDate:string;reportTime:string;reportChannel:string;reporterName:string;reporterRole:string;engagementType:string;process:string;specificLocation:string;reserveIdentity:string;contact:string;contractor:string;
 reportType:string;priority:string;imminentRisk:string;affectedArea:string;exposedPeople:string;eventDate:string;eventTime:string;relatedTo:string;
 description:string;observedCauses:string;consequences:string;immediateControl:string;controlApplied:string;controlOwner:string;controlDate:string;evidence:string;
 receivedBy:string;receivedDate:string;finalClassification:string;riskLevel:string;investigation:string;matrixAction:string;analysis:string;requiredAction:string;
 actionCode:string;followUpOwner:string;plannedCloseDate:string;status:string;closeDate:string;effectiveness:string;closureNotes:string;
 reportedName:string;reportedRole:string;reportedDate:string;reviewedName:string;reviewedRole:string;reviewedDate:string;closedName:string;closedRole:string;closedDate:string
}
const LOGO_URL='https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg'
const date=(s:string|null|undefined)=>{if(!s||!s.trim())return '';const p=s.trim().split('-');return p.length===3&&p.every(Boolean)?p[2]+'/'+p[1]+'/'+p[0]:s.trim()}
export async function downloadIncidentReportPdf(r:IncidentReport){
 const pdf=await PDFDocument.create(),font=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),W=595.28,H=841.89
 let page=pdf.addPage([W,H]),y=28
 const blue=rgb(0.88,0.93,0.98),border=rgb(0.35,0.42,0.50)
 let logo: Awaited<ReturnType<typeof pdf.embedJpg>>|null=null
 try { const response=await fetch(LOGO_URL); if(response.ok) logo=await pdf.embedJpg(new Uint8Array(await response.arrayBuffer())) } catch { /* El PDF conserva el encabezado aunque no haya conexión. */ }
 const safe=(s:string)=>String(s??'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^\x20-\x7E]/g,'')
 const draw=(s:string,x:number,top:number,size=8,f=font)=>page.drawText(safe(s),{x,y:H-top-size,size,font:f,color:rgb(0,0,0),maxWidth:520})
 const wrap=(s:string,max:number,size=8)=>{const out:string[]=[];let cur='';for(const word of safe(s).split(/\s+/)){const next=cur?cur+' '+word:word;if(cur&&font.widthOfTextAtSize(next,size)>max){out.push(cur);cur=word}else cur=next}if(cur)out.push(cur);return out}
 const newPage=()=>{page=pdf.addPage([W,H]);y=28}
 const header=()=>{const x=25,top=24,w=545,h=52,logoW=82,metaW=92,titleW=w-logoW-metaW;page.drawRectangle({x,y:H-top-h,width:w,height:h,borderColor:border,borderWidth:.7});page.drawRectangle({x,y:H-top-h,width:logoW,height:h,borderColor:border,borderWidth:.5});if(logo){const scale=Math.min((logoW-8)/logo.width,42/logo.height);page.drawImage(logo,{x:x+4,y:H-top-5-logo.height*scale,width:logo.width*scale,height:logo.height*scale})}else draw('TECNOPROYECTOS',x+5,top+21,6,bold);page.drawRectangle({x:x+logoW,y:H-top-h,width:titleW,height:h,borderColor:border,borderWidth:.5});draw('SISTEMA DE GESTION INTEGRADO',x+logoW+6,top+7,7.5,bold);draw('GESTION DE LA SEGURIDAD Y SALUD EN EL TRABAJO',x+logoW+6,top+18,6.1,bold);draw('AUTORREPORTE DE ACTOS, CONDICIONES INSEGURAS, INCIDENTES Y OPORTUNIDADES DE MEJORA',x+logoW+6,top+29,5.0,bold);page.drawRectangle({x:x+logoW+titleW,y:H-top-h,width:metaW,height:h,borderColor:border,borderWidth:.5});draw('Codigo: FM-SST-29',x+logoW+titleW+4,top+9,5.6);draw('Version: 01',x+logoW+titleW+4,top+21,5.6);draw('Fecha: 22/06/2026',x+logoW+titleW+4,top+33,5.2);y=84}
 const section=(s:string)=>{if(y>H-80)newPage();page.drawRectangle({x:25,y:H-y-15,width:545,height:15,borderColor:border,borderWidth:.5,color:blue});draw(s,30,y+3,8,bold);y+=19}
 const field=(label:string,value:string)=>{const lines=wrap(value,510,7.5),h=Math.max(25,Math.min(80,lines.length*9+13));if(y+h>H-42)newPage();page.drawRectangle({x:25,y:H-y-h,width:545,height:h,borderColor:border,borderWidth:.4});draw(label.toUpperCase(),30,y+3,6.2,bold);lines.slice(0,Math.floor((h-12)/9)).forEach((l,i)=>draw(l,30,y+12+i*9,7.5));y+=h}
 const grid=(items:[string,string][],cols=2)=>{const cw=545/cols,labelW=cols===4?58:88;for(let i=0;i<items.length;i+=cols){const row=items.slice(i,i+cols),h=32;if(y+h>H-55)newPage();row.forEach(([label,value],j)=>{const x=25+j*cw;page.drawRectangle({x,y:H-y-h,width:cw,height:h,borderColor:border,borderWidth:.4});page.drawRectangle({x,y:H-y-h,width:labelW,height:h,borderColor:border,borderWidth:.3,color:blue});draw(label.toUpperCase(),x+4,y+4,5.3,bold);wrap(value,cw-labelW-8,6.8).slice(0,2).forEach((line,i)=>draw(line,x+labelW+4,y+5+i*9,6.8));});y+=h}}
 header()
 section('1. INFORMACION GENERAL DEL REPORTE')
 grid([['Fecha del reporte',date(r.reportDate)],['Hora',r.reportTime],['Medio de reporte',r.reportChannel],['Nombre de quien reporta',r.reserveIdentity==='Sí'?'RESERVA DE IDENTIDAD':r.reporterName],['Cargo / rol',r.reporterRole],['Tipo de vinculacion',r.engagementType],['Proceso / proyecto / sede',r.process],['Lugar especifico',r.specificLocation],['Reserva de identidad',r.reserveIdentity],['Telefono / correo',r.reserveIdentity==='Sí'?'RESERVADO':r.contact],['Empresa contratista',r.contractor]],2)
 section('2. CLASIFICACION DEL REPORTE')
 grid([['Tipo de reporte',r.reportType],['Prioridad inicial',r.priority],['Riesgo inminente',r.imminentRisk],['Area o actividad afectada',r.affectedArea],['Personal expuesto',r.exposedPeople],['Fecha del evento',date(r.eventDate)],['Hora del evento',r.eventTime],['Relacionado con',r.relatedTo]],2)
 section('3. DESCRIPCION DEL REPORTE');field('Descripcion clara del acto, condicion, incidente u oportunidad de mejora',r.description);field('Posibles causas observadas',r.observedCauses);field('Consecuencia real o potencial',r.consequences)
 section('4. ACCION INMEDIATA O CONTROL TEMPORAL');for(const [k,v] of [['Se aplico control inmediato',r.immediateControl],['Control aplicado',r.controlApplied],['Responsable del control inmediato',r.controlOwner],['Fecha de aplicacion',date(r.controlDate)],['Evidencia disponible',r.evidence]] as string[][])field(k,v)
 section('5. ANALISIS Y GESTION POR EL RESPONSABLE DEL SG-SST');for(const [k,v] of [['Recibido por',r.receivedBy],['Fecha de recepcion',date(r.receivedDate)],['Clasificacion final',r.finalClassification],['Nivel de riesgo / criticidad',r.riskLevel],['Requiere investigacion',r.investigation],['Requiere accion en matriz',r.matrixAction],['Analisis del SG-SST',r.analysis],['Accion requerida o decision tomada',r.requiredAction]] as string[][])field(k,v)
 section('6. SEGUIMIENTO Y CIERRE');for(const [k,v] of [['Codigo accion asociada',r.actionCode],['Responsable de seguimiento',r.followUpOwner],['Fecha programada de cierre',date(r.plannedCloseDate)],['Estado del reporte',r.status],['Fecha de cierre',date(r.closeDate)],['Verificacion de eficacia',r.effectiveness],['Observaciones de cierre',r.closureNotes]] as string[][])field(k,v)
 section('7. FIRMAS / VALIDACION')
 const signers=[['REPORTO',r.reportedName,r.reportedRole,date(r.reportedDate)],['REVISO SG-SST',r.reviewedName,r.reviewedRole,date(r.reviewedDate)],['CERRO / VALIDO',r.closedName,r.closedRole,date(r.closedDate)]]
 const sigH=92,sigW=545/3
 if(y+sigH+42>H-28)newPage()
 // Las tres celdas comparten exactamente la misma geometria y coordenada vertical para la fecha.
 const signatureTop=y,signatureDateTop=signatureTop+84
 signers.forEach(([role,name,job,when],i)=>{const x=25+i*sigW;page.drawRectangle({x,y:H-signatureTop-sigH,width:sigW,height:sigH,borderColor:border,borderWidth:.5});page.drawRectangle({x,y:H-signatureTop-16,width:sigW,height:16,borderColor:border,borderWidth:.4,color:blue});draw(role,x+4,signatureTop+4,6.2,bold);draw('Nombre:',x+4,signatureTop+22,6,bold);draw(name,x+4,signatureTop+31,7);draw('Cargo:',x+4,signatureTop+43,6,bold);draw(job,x+4,signatureTop+52,7);draw('Firma:',x+4,signatureTop+64,6,bold);page.drawRectangle({x:x+4,y:H-signatureTop-84,width:sigW-8,height:15,borderColor:border,borderWidth:.5});draw('Fecha: '+when,x+4,signatureDateTop,6);})
 y+=sigH+5
 const legal='Nota: Los reportes criticos relacionados con riesgo inminente, accidente grave, emergencia, incumplimiento legal o condicion que pueda causar dano deben comunicarse de forma inmediata al jefe directo, coordinador, Responsable del SG-SST o Gerencia, y gestionarse con prioridad.'
 const legalLines=wrap(legal,535,6.2),legalH=legalLines.length*7.5+8
 if(y+legalH>H-38)newPage()
 page.drawRectangle({x:25,y:H-y-legalH,width:545,height:legalH,borderColor:border,borderWidth:.5,color:blue})
 legalLines.forEach((line,i)=>draw(line,30,y+4+i*7.5,6.2))
 y+=legalH
 const pages=pdf.getPages();pages.forEach((p,i)=>{p.drawText('BORRADOR DIGITAL PARA VALIDACION INTERNA - NO ES REGISTRO OFICIAL',{x:25,y:18,size:6,font,color:rgb(0,0,0)});p.drawText('Pagina '+(i+1)+' de '+pages.length,{x:510,y:18,size:6,font,color:rgb(0,0,0)})})
 const bytes=await pdf.save(),url=URL.createObjectURL(new Blob([new Uint8Array(bytes)],{type:'application/pdf'})),a=document.createElement('a');a.href=url;a.download='FM-SST-29-'+(r.reportDate||'reporte')+'.pdf';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
}
