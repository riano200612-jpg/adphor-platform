// Receives only the catalog returned for the authenticated user; never grants access.
export function chooseProject(projects, preferred) {
  return projects.some(p => p.id === preferred) ? preferred : (projects[0]?.id || '');
}
export function searchProjects(projects, query) {
  const normalize = value => String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').trim();
  const term = normalize(query);
  return projects.filter(p => normalize(p.name).includes(term));
}
export function mountProjectSelector(root, {projects, selected, onChange, selectId='project-select'}) {
  root.replaceChildren();
  const label = document.createElement('label'); label.htmlFor=selectId; label.textContent='COPROPIEDAD';
  const search = document.createElement('input'); search.type='search'; search.placeholder='Buscar copropiedad';
  search.setAttribute('aria-label','Buscar copropiedad'); search.autocomplete='off';
  const select=document.createElement('select'); select.id=selectId;
  const status=document.createElement('small'); status.setAttribute('role','status');
  const results=document.createElement('div');results.className='project-search-results';results.setAttribute('role','listbox');results.setAttribute('aria-label','Coincidencias de copropiedades');results.hidden=true;
  const resultsId=selectId+'-search-results';results.id=resultsId;
  search.setAttribute('aria-controls',resultsId);search.setAttribute('aria-expanded','false');
  let current=chooseProject(projects,selected);
  const selectProject=id=>{
    if(!projects.some(p=>p.id===id)) return;
    current=id;search.value='';render();onChange(id);
  };
  function render() {
    const visible=searchProjects(projects,search.value);
    select.replaceChildren();
    // Keep the current selection even when it does not match the search.
    const chosen=projects.find(p=>p.id===current);
    const options=chosen && !visible.some(p=>p.id===current) ? [chosen,...visible] : visible;
    for(const p of options) {const option=document.createElement('option');option.value=p.id;option.textContent=p.name;select.append(option);}
    select.value=current; select.disabled=!projects.length;
    status.textContent=`${visible.length} coincidencias · ${projects.length} copropiedades disponibles`;
    results.replaceChildren();
    const searching=search.value.trim().length>0;
    if(searching){
      for(const p of visible.slice(0,12)) {
        const button=document.createElement('button');button.type='button';button.className='project-search-result';
        button.setAttribute('role','option');button.setAttribute('aria-selected',String(p.id===current));
        button.textContent=p.name;button.addEventListener('click',()=>selectProject(p.id));results.append(button);
      }
      if(!visible.length){const empty=document.createElement('span');empty.className='project-search-empty';empty.textContent='Sin coincidencias';results.append(empty);}
      if(visible.length>12){const more=document.createElement('small');more.textContent=`Mostrando 12 de ${visible.length}; escribe más para precisar`;results.append(more);}
    }
    results.hidden=!searching;search.setAttribute('aria-expanded',String(searching));
  }
  search.addEventListener('input',render);
  search.addEventListener('keydown',event=>{
    if(event.key==='Escape'){search.value='';render();return;}
    if(event.key==='Enter' && search.value.trim()){
      const matches=searchProjects(projects,search.value);
      if(matches.length===1){event.preventDefault();selectProject(matches[0].id);}
    }
  });
  select.addEventListener('change',event=>{
    event.stopPropagation();
    selectProject(select.value);
  });
  root.append(label,search,results,select,status);render();
}
export function projectPreference(storage, userId, projectId) {
  if(!userId) return '';
  const key=`adphor.selected-project:${userId}`;
  try {
    if(projectId !== undefined) {storage.setItem(key,projectId);return projectId;}
    return storage.getItem(key) || '';
  } catch {return '';}
}
