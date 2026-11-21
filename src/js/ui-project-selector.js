// Receives only the catalog returned for the authenticated user; never grants access.
export function chooseProject(projects, preferred) {
  return projects.some(p => p.id === preferred) ? preferred : (projects[0]?.id || '');
}
export function searchProjects(projects, query) {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  const term = normalize(query);
  return projects.filter(p => normalize(p.name).includes(term));
}
export function mountProjectSelector(root, {projects, selected, onChange}) {
  root.replaceChildren();
  const label = document.createElement('label'); label.htmlFor='project-select'; label.textContent='COPROPIEDAD';
  const search = document.createElement('input'); search.type='search'; search.placeholder='Buscar copropiedad';
  search.setAttribute('aria-label','Buscar copropiedad'); search.autocomplete='off';
  const select=document.createElement('select'); select.id='project-select';
  const status=document.createElement('small'); status.setAttribute('role','status');
  let current=chooseProject(projects,selected);
  function render() {
    const visible=searchProjects(projects,search.value);
    select.replaceChildren();
    // Keep the current selection even when it does not match the search.
    const chosen=projects.find(p=>p.id===current);
    const options=chosen && !visible.some(p=>p.id===current) ? [chosen,...visible] : visible;
    for(const p of options) {const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}
    select.value=current; select.disabled=!projects.length;
    status.textContent=`${visible.length} coincidencias · ${projects.length} copropiedades disponibles`;
  }
  search.addEventListener('input',render);
  select.addEventListener('change',event=>{
    event.stopPropagation();
    if(!projects.some(p=>p.id===select.value)) return;
    current=select.value; onChange(current);
  });
  root.append(label,search,select,status);render();
}
export function projectPreference(storage, userId, projectId) {
  if(!userId) return '';
  const key=`adphor.selected-project:${userId}`;
  try {
    if(projectId !== undefined) {storage.setItem(key,projectId);return projectId;}
    return storage.getItem(key) || '';
  } catch {return '';}
}
