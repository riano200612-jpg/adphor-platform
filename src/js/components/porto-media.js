const TYPES = new Map([
  ['image/png','image'],['image/jpeg','image'],['image/webp','image'],
  ['video/mp4','video'],['video/quicktime','video'],
  ['audio/mpeg','audio'],['audio/wav','audio'],['audio/x-wav','audio'],['audio/mp4','audio'],['audio/x-m4a','audio'],
  ['application/pdf','pdf'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document','office'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','office'],
]);
const MAX_BYTES = 50 * 1024 * 1024;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function validatePortoFile(file) {
  if (!TYPES.has(file.type)) throw new Error('Formato no permitido');
  if (file.size > MAX_BYTES) throw new Error('El archivo supera 50 MB');
  if (file.size === 0) throw new Error('El archivo está vacío');
  return TYPES.get(file.type);
}
/** Preview local aislado. Office requiere conversión SEGURA del lado servidor:
 * nunca insertar HTML de archivos DOCX/XLSX sin sanitizar.
 * La validación del cliente no reemplaza antivirus, MIME real y RLS.
 */
export function createPortoUploader(root,{ upload, onComplete=()=>{} }) {
  if (!root || typeof upload !== 'function') throw new TypeError('Cargador incompleto');
  root.innerHTML = '<section class="porto-uploader"><h3>Evidencias multimedia</h3><label>Seleccionar archivos <input type="file" multiple accept=".png,.jpg,.jpeg,.webp,.mp4,.mov,.mp3,.wav,.m4a,.pdf,.docx,.xlsx"></label><div class="porto-uploader__drop" role="region" aria-label="Zona para arrastrar archivos" tabindex="0">Arrastra archivos aquí</div><ul aria-live="polite"></ul></section>';
  const list = root.querySelector('ul'), input = root.querySelector('input'), drop = root.querySelector('.porto-uploader__drop');
  let active = true;
  async function process(files) {
    for (const file of files) {
      if (!active) return;
      const li = document.createElement('li'); list.append(li);
      let url;
      try {
        const kind = validatePortoFile(file);
        const name = document.createElement('strong'); name.textContent = file.name; li.append(name);
        url = URL.createObjectURL(file);
        const preview = kind === 'image' ? document.createElement('img') :
          kind === 'video' ? document.createElement('video') :
          kind === 'audio' ? document.createElement('audio') :
          kind === 'pdf' ? document.createElement('iframe') : null;
        if(preview) {
          preview.src=url; preview.style.maxWidth='100%';
          if(kind==='video'||kind==='audio') preview.controls=true;
          if(kind==='pdf') {preview.title='Vista previa PDF'; preview.setAttribute('sandbox','');}
          li.append(preview);
        } else {
          const note=document.createElement('p');note.textContent='Documento Office: vista previa segura disponible tras la conversión del servidor.';li.append(note);
        }
        const progress = document.createElement('progress'); progress.max=100; progress.value=0; li.append(progress);
        await upload(file,{onProgress: percent=>{progress.value=Math.max(0,Math.min(100,Number(percent)||0));}});
        progress.value=100; onComplete(file);
      } catch(error) {
        const problem=document.createElement('p'); problem.setAttribute('role','alert');
        problem.textContent=error.message || 'No se pudo cargar el archivo'; li.append(problem);
      } finally {
        if(url) URL.revokeObjectURL(url);
      }
    }
  }
  input.addEventListener('change',()=>process(input.files));
  drop.addEventListener('dragover', e=>{e.preventDefault();});
  drop.addEventListener('drop',e=>{e.preventDefault();process(e.dataTransfer.files);});
  return {destroy(){active=false;root.replaceChildren();}};
}
