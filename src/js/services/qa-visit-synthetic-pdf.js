const QA_INTEGRAL_HOST='qa-integral-claude-reviewed.adphor-platform.pages.dev';
export const QA_SYNTHETIC_VISIT_PDF_NAME='ADPHOR-QA-SINTETICO-NO-REAL.pdf';

export function canPrepareSyntheticVisitPdf({hostname,row,canWrite}={}){
 return hostname===QA_INTEGRAL_HOST && canWrite===true
  && ['programada','en_ejecucion'].includes(row?.status)
  && typeof row?.motive==='string'
  && /^\[QA E2E [0-9]{4}-[0-9]{2}-[0-9]{2}\]/.test(row.motive)
  && row.motive.includes('SIN VISITA REAL');
}

// This is an original, anonymous PDF fixture generated in-browser.
// No user documents, server credentials or external downloads are involved.
export function syntheticVisitPdfBytes(){
 const encoder=new TextEncoder();
 const content='BT /F1 15 Tf 65 750 Td (ADPHOR QA - ARCHIVO SINTETICO - NO REAL) Tj ET';
 const objects=[
  '<< /Type /Catalog /Pages 2 0 R >>',
  '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
  '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
  '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  '<< /Length '+encoder.encode(content).length+' >>\nstream\n'+content+'\nendstream'
 ];
 let pdf='%PDF-1.4\n';
 const offsets=[0];
 for(let i=0;i<objects.length;i++){
  offsets.push(encoder.encode(pdf).length);
  pdf+=(i+1)+' 0 obj\n'+objects[i]+'\nendobj\n';
 }
 const startxref=encoder.encode(pdf).length;
 pdf+='xref\n0 '+(objects.length+1)+'\n0000000000 65535 f \n';
 for(const offset of offsets.slice(1))pdf+=String(offset).padStart(10,'0')+' 00000 n \n';
 pdf+='trailer\n<< /Size '+(objects.length+1)+' /Root 1 0 R >>\nstartxref\n'+startxref+'\n%%EOF\n';
 return encoder.encode(pdf);
}

export function createSyntheticVisitPdfFile(FileClass=globalThis.File){
 if(typeof FileClass!=='function')throw Error('El navegador no puede crear archivos PDF locales.');
 return new FileClass([syntheticVisitPdfBytes()],QA_SYNTHETIC_VISIT_PDF_NAME,{type:'application/pdf'});
}
