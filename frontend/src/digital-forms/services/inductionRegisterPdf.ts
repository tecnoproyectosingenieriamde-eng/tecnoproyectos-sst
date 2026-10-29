import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib'

export type InductionTopic = { name: string; response: string }
export type InductionParticipant = { name: string; identification: string; signature: string }
export type InductionRegisterRecord = { date: string; time: string; cargo: string; trainer: string; topics: InductionTopic[]; participants: InductionParticipant[] }
const LOGO_URL = 'https://static.wixstatic.com/media/d0ce54_5945f241b1534afeb1a98e9e645f4482~mv2.jpg'
const clean = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9-_]+/g,'-').replace(/^-|-$/g,'').slice(0,50)||'registro'
const dateText = (value:string) => { const p=value.split('-'); return p.length===3 ? p[2]+'/'+p[1]+'/'+p[0] : value }
function sigBytes(value:string):Uint8Array|null { if(!value.startsWith('data:image/png;base64,')) return null; const raw=atob(value.slice('data:image/png;base64,'.length)); return Uint8Array.from(raw,c=>c.charCodeAt(0)) }
function drawCheck(page:PDFPage,x:number,top:number,size:number,checked:boolean,H:number){page.drawRectangle({x,y:H-top-size,width:size,height:size,borderColor:rgb(0,0,0),borderWidth:.65,color:rgb(1,1,1)});if(checked){page.drawLine({start:{x:x+2,y:H-top-size/2},end:{x:x+size*.42,y:H-top-size+2},thickness:1.1,color:rgb(0,0,0)});page.drawLine({start:{x:x+size*.42,y:H-top-size+2},end:{x:x+size-1,y:H-top-2},thickness:1.1,color:rgb(0,0,0)})}}
export async function downloadInductionRegisterPdf(record:InductionRegisterRecord) {
 const pdf=await PDFDocument.create(), regular=await pdf.embedFont(StandardFonts.Helvetica), bold=await pdf.embedFont(StandardFonts.HelveticaBold)
 const W=595.28,H=841.89,left=20,right=W-20,width=right-left,ink=rgb(0,0,0),line=rgb(0,0,0),blue=rgb(0,0,0),muted=rgb(0,0,0)
 let page={} as PDFPage, y=0
 const text=(v:string,x:number,top:number,size=7,font:PDFFont=regular,maxWidth=right-x,color=ink)=>page.drawText(v||'',{x,y:H-top-size,size,font,color,maxWidth:Math.max(10,maxWidth)})
 const rect=(x:number,top:number,w:number,h:number,fill=false)=>page.drawRectangle({x,y:H-top-h,width:w,height:h,borderColor:line,borderWidth:.55,...(fill?{color:rgb(1,1,1)}:{})})
 const wrap=(value:string,font:PDFFont,size:number,max:number)=>{const out:string[]=[];let cur='';for(const word of (value||'').split(/\s+/)){const next=cur?cur+' '+word:word;if(cur&&font.widthOfTextAtSize(next,size)>max){out.push(cur);cur=word}else cur=next}if(cur)out.push(cur);return out}
 let logoBytes:Uint8Array|null=null
 try { const response=await fetch(LOGO_URL); if(response.ok) logoBytes=new Uint8Array(await response.arrayBuffer()) } catch { /* El documento mantiene el recuadro del logo si no hay conexión. */ }
 let logo=null
 if(logoBytes){try{logo=await pdf.embedJpg(logoBytes)}catch{try{logo=await pdf.embedPng(logoBytes)}catch{logo=null}}}
 const header=()=>{page=pdf.addPage([W,H]);const logoW=78,titleW=330,metaW=width-logoW-titleW;rect(left,12,width,54);rect(left,12,logoW,54);if(logo){const scale=Math.min((logoW-10)/logo.width,44/logo.height);page.drawImage(logo,{x:left+5,y:H-17-logo.height*scale,width:logo.width*scale,height:logo.height*scale})}else{text('LOGO',left+18,34,8,bold,45,blue)}rect(left+logoW,12,titleW,54);text('SISTEMA DE GESTIÓN INTEGRADO',left+logoW+7,18,7.2,bold,titleW-14,blue);text('GESTIÓN DE LA SEGURIDAD Y SALUD EN EL TRABAJO',left+logoW+7,29,5.9,bold,titleW-14,blue);text('REGISTRO DE INDUCCIÓN EN SEGURIDAD Y SALUD EN EL TRABAJO',left+logoW+7,40,5.6,bold,titleW-14,blue);rect(left+logoW+titleW,12,metaW,54);text('Código: FM-SST-15',left+logoW+titleW+4,19,5.7,regular,metaW-8);text('Versión: 01',left+logoW+titleW+4,31,5.7,regular,metaW-8);text('Fecha: 22/06/2026',left+logoW+titleW+4,43,5.2,regular,metaW-8);y=70}
 const section=(label:string)=>{rect(left,y,width,11);text(label,left+4,y+2,6.8,bold,width-8,blue);y+=11}
 const cell=(value:string,x:number,top:number,w:number,h:number,size=6.4,font:PDFFont=regular,fill=false,color=ink)=>{rect(x,top,w,h,fill);const lines=wrap(value,font,size,w-6);const maxLines=Math.max(1,Math.floor((h-4)/(size+1.5)));lines.slice(0,maxLines).forEach((v,i)=>text(v,x+3,top+2+i*(size+1.5),size,font,w-6,color))}
 header()
 section('DATOS DE LA ACTIVIDAD')
 const cols=[width*.16,width*.13,width*.28,width*.43], vals=[['FECHA',dateText(record.date)],['HORA',record.time],['CARGO DEL TRABAJADOR',record.cargo],['NOMBRE DEL CAPACITADOR',record.trainer]]
 let x=left; vals.forEach((v,i)=>{cell(v[0],x,y,cols[i],10,5.2,bold,false,blue);cell(v[1],x,y+10,cols[i],13,5.8);x+=cols[i]});y+=23
 section('CONTENIDO DE LA INDUCCIÓN')
 const gap=0,blockW=width/2,topicW=blockW-60,checkW=20,headerH=12
 for(let block=0;block<2;block++){
   const bx=left+block*(blockW+gap)
   cell('TEMA',bx,y,topicW,headerH,6.1,bold,true,blue)
   let cx=bx+topicW;['SÍ','NO','N/A'].forEach(v=>{cell(v,cx,y,checkW,headerH,5.3,bold,false,blue);cx+=checkW})
 }
 y+=headerH
 const rows=Array.from({length:10},(_,i)=>i)
 for(const row of rows){
   const rowTopics=[record.topics[row],record.topics[row+10]]
   const wraps=rowTopics.map((t,i)=>wrap(String(i===0?row+1:row+11)+'. '+(t?.name||''),regular,5.5,topicW-6))
   const rh=Math.max(18,...wraps.map(lines=>Math.min(24,lines.length*6+4)))
   for(let block=0;block<2;block++){
     const bx=left+block*(blockW+gap),topic=rowTopics[block],number=row+(block*10)
     rect(bx,y,topicW,rh,false)
     const numberText=String(number+1)+'.'
     text(numberText,bx+3,y+2,5.5,bold,14)
     const topicLines=wrap(topic?.name||'',regular,5.5,topicW-23)
     topicLines.slice(0,Math.max(1,Math.floor((rh-4)/7))).forEach((lineText,lineIndex)=>text(lineText,bx+20,y+2+lineIndex*7,5.5,regular,topicW-23))
     let cx=bx+topicW
     ;['Sí','No','N/A'].forEach((option)=>{rect(cx,y,checkW,rh,false);drawCheck(page,cx+(checkW-8)/2,y+(rh-8)/2,8,topic?.response===option,H);cx+=checkW})
   }
   y+=rh
 }
 y+=5
 section('TRABAJADORES PARTICIPANTES')
 const pw=[width*.37,width*.25,width*.38],pxs=[left,left+width*.37,left+width*.62],headH=12
 ;['NOMBRE','CÉDULA / DOCUMENTO','FIRMA'].forEach((v,i)=>cell(v,pxs[i],y,pw[i],headH,5.5,bold,false,blue))
 y+=headH
 for(const p of record.participants){
   const h=20
   if(y+h>H-34){header();section('TRABAJADORES PARTICIPANTES (CONTINUACIÓN)');;['NOMBRE','CÉDULA / DOCUMENTO','FIRMA'].forEach((v,i)=>cell(v,pxs[i],y,pw[i],headH,5.5,bold,false,blue));y+=headH}
   cell(p.name,pxs[0],y,pw[0],h,5.7);cell(p.identification,pxs[1],y,pw[1],h,5.7);rect(pxs[2],y,pw[2],h)
   const bytes=sigBytes(p.signature);if(bytes){try{const image=await pdf.embedPng(bytes);const scale=Math.min((pw[2]-8)/(image.width),(h-4)/(image.height));page.drawImage(image,{x:pxs[2]+4,y:H-y-h+2,width:image.width*scale,height:image.height*scale})}catch{}}
   y+=h
 }
 const pages=pdf.getPages();pages.forEach((p,i)=>{const footer='TECNOPROYECTOS INGENIERÍA S.A.S.  |  BORRADOR DIGITAL PARA VALIDACIÓN INTERNA  |  NO ES REGISTRO OFICIAL';const footerSize=Math.min(7, width*0.92/regular.widthOfTextAtSize(footer,1));p.drawText(footer,{x:left+(width-regular.widthOfTextAtSize(footer,footerSize))/2,y:9,size:footerSize,font:regular,color:muted});const label='Página '+(i+1)+' de '+pages.length;p.drawText(label,{x:right-regular.widthOfTextAtSize(label,5.7),y:20,size:5.7,font:regular,color:muted})})
 const bytes=await pdf.save(),blob=new Blob([new Uint8Array(bytes)],{type:'application/pdf'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='FM-SST-15-'+clean(record.trainer)+'.pdf';document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(url)
}
