// ADPHOR ONE · QA Integral presentation layer. No permission elevation or backend writes.
// The existing app's authorization-filtered navigation is the ONLY source of menu entries.
export const QA_INTEGRAL_HOST = 'qa-integral-claude-reviewed.adphor-platform.pages.dev';

export const ADPHOR_ONE_GROUPS = Object.freeze([
  Object.freeze({id:'daily',title:'Gestión diaria'}),
  Object.freeze({id:'operations',title:'Operación y seguimiento'}),
  Object.freeze({id:'people',title:'Equipo e inteligencia'}),
  Object.freeze({id:'administration',title:'Administración y control'}),
  Object.freeze({id:'other',title:'Otras herramientas autorizadas'})
]);

export const ADPHOR_ONE_MODULES = Object.freeze([
  Object.freeze({id:'agenda',title:'Calendario',icon:'calendar-days',tone:'navy',hint:'Agenda verificada',group:'daily'}),
  Object.freeze({id:'pqrs',title:'PQRS',icon:'message',tone:'champagne',hint:'Solicitudes y seguimiento',group:'daily'}),
  Object.freeze({id:'visits',title:'Visitas',icon:'clipboard-check',tone:'sage',hint:'Visitas y evidencias',group:'daily'}),
  Object.freeze({id:'meetings',title:'Reuniones',icon:'video',tone:'steel',hint:'Gestión de reuniones',group:'daily'}),
  Object.freeze({id:'tickets',title:'Bitácora',icon:'clipboard-list',tone:'slate',hint:'Novedades y evidencias',group:'daily'}),
  Object.freeze({id:'recorridos',title:'Recorridos',icon:'route',tone:'sage',hint:'Hallazgos y seguimiento',group:'daily'}),
  Object.freeze({id:'mine',title:'Mis tareas',icon:'list-check',tone:'sky',hint:'Actividades asignadas',group:'daily'}),
  Object.freeze({id:'dashboard',title:'Resumen',icon:'chart-simple',tone:'pearl',hint:'Panorama de la operación',group:'operations'}),
  Object.freeze({id:'unified',title:'Centro integrado',icon:'grip',tone:'navy',hint:'Operación conectada',group:'operations'}),
  Object.freeze({id:'properties',title:'Copropiedades',icon:'building',tone:'slate',hint:'Tus comunidades',group:'operations'}),
  Object.freeze({id:'areas',title:'Áreas',icon:'layer-group',tone:'sky',hint:'Consulta por área',group:'operations'}),
  Object.freeze({id:'reports',title:'Informes',icon:'chart-column',tone:'pearl',hint:'Indicadores e informes',group:'operations'}),
  Object.freeze({id:'staff',title:'Equipo administrativo',icon:'users',tone:'sky',hint:'Directorio autorizado',group:'people'}),
  Object.freeze({id:'corporate-staff',title:'Equipo corporativo',icon:'people-group',tone:'sage',hint:'Personal autorizado',group:'people'}),
  Object.freeze({id:'agent-history',title:'Agentes IA',icon:'wand-magic-sparkles',tone:'indigo',hint:'Borradores sujetos a revisión',group:'people'}),
  Object.freeze({id:'qa-source',title:'Auditoría histórica',icon:'file-shield',tone:'slate',hint:'Origen y trazabilidad',group:'administration'}),
  Object.freeze({id:'access-audit',title:'Usuarios y permisos',icon:'user-shield',tone:'navy',hint:'Administración autorizada',group:'administration'}),
  Object.freeze({id:'consultation',title:'Consulta de datos',icon:'database',tone:'indigo',hint:'Lectura autorizada',group:'administration'})
]);

export function isIntegralQaHost(hostname) {
  return hostname === QA_INTEGRAL_HOST ||
    /^[a-f0-9]{8}\.adphor-platform\.pages\.dev$/.test(String(hostname || ''));
}
// Kept as a public pure helper for permission-isolation tests.
export function visibleAdphorOneModules(availablePages) {
  const allowed = new Set(Array.isArray(availablePages) ? availablePages : []);
  return ADPHOR_ONE_MODULES.filter(module => allowed.has(module.id));
}

// Catalog exactly matches the allowed menu: do not infer roles from names or e-mails.
// Future pages already permitted by the app are also included as circular buttons.
export function completeAdphorOneCatalog(navItems) {
  if (!Array.isArray(navItems)) return [];
  const source = new Map();
  for (const item of navItems) {
    if (!item || typeof item.id !== 'string' || !item.id.trim() || source.has(item.id)) continue;
    source.set(item.id, {
      label: typeof item.label === 'string' ? item.label : item.id,
      icon: typeof item.icon === 'string' ? item.icon : 'fa-solid fa-circle'
    });
  }
  const known = ADPHOR_ONE_MODULES.filter(module => source.has(module.id));
  const unknown = [...source.entries()]
    .filter(([id]) => !ADPHOR_ONE_MODULES.some(module => module.id === id))
    .map(([id,item]) => ({
      id,title:item.label,icon:item.icon,tone:'steel',hint:'Abrir herramienta',group:'other'
    }));
  return [...known,...unknown];
}
function createOrb(doc,module) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'module-card adphor-one-orb';
  button.dataset.page = module.id;
  const icon = doc.createElement('i');
  icon.className = 'fa-solid fa-' + module.icon;
  icon.setAttribute('aria-hidden','true');
  const text = doc.createElement('span');
  const label = doc.createElement('strong');
  label.textContent = module.title;
  const description = doc.createElement('small');
  description.textContent = module.hint;
  text.append(label,description);
  button.append(icon,text);
  return button;
}
function createHero(doc) {
  const hero = doc.createElement('section');
  hero.className = 'adphor-one-hero';
  hero.setAttribute('aria-label','Todas las herramientas disponibles de ADPHOR');
  const eyebrow = doc.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'ADPHOR ONE · MI ESPACIO DIGITAL';
  const title = doc.createElement('h2');
  title.textContent = 'Todas tus herramientas, en un solo lugar.';
  const subtitle = doc.createElement('p');
  subtitle.className = 'adphor-one-hero-subtitle';
  subtitle.textContent = 'Accede directamente a cada módulo habilitado para tu sesión.';
  hero.append(eyebrow,title,subtitle);
  return hero;
}
export function enhanceAdphorOneDashboard(doc) {
  const page = doc?.querySelector?.('#page-content');
  if (!page) return false;
  const intro = page.querySelector('.dashboard-intro');
  const grid = page.querySelector('.module-grid');
  if (!intro || !grid) {
    page.classList.remove('adphor-one-home');
    return false;
  }
  if (grid.dataset.adphorOneReady === 'true') return false;
  const source = [...doc.querySelectorAll('.sidebar nav button[data-page]')].map(button=>({
    id:button.dataset.page,
    label:button.getAttribute('aria-label') || button.textContent.trim(),
    icon:button.querySelector('i')?.className || 'fa-solid fa-circle'
  }));
  const catalog = completeAdphorOneCatalog(source);
  if (!catalog.length) return false; // no authorized menu: no enhancement
  const existing = new Map([...grid.querySelectorAll('.module-card[data-page]')].map(button=>[button.dataset.page,button]));
  const sections = [];
  for (const group of ADPHOR_ONE_GROUPS) {
    const modules = catalog.filter(module=>module.group===group.id);
    if (!modules.length) continue;
    const section = doc.createElement('section');
    section.className = 'adphor-one-module-section';
    section.setAttribute('aria-label',group.title);
    const title = doc.createElement('h3');
    title.className = 'adphor-one-module-heading';
    title.textContent = group.title;
    const orbs = doc.createElement('div');
    orbs.className = 'adphor-one-group-grid';
    for(const module of modules) {
      const button = existing.get(module.id) || createOrb(doc,module);
      button.dataset.uiTone = module.tone;
      button.classList.add('adphor-one-tile');
      const icon = button.querySelector('i');
      if(icon) {
        // Unknown future routes inherit the icon from the existing authorized nav.
        icon.className = group.id==='other' ? module.icon : 'fa-solid fa-'+module.icon;
        icon.setAttribute('aria-hidden','true');
      }
      const label = button.querySelector('strong');
      if(label) label.textContent = module.title;
      // Keep original live PQRS/meeting <small> counters and async updates intact.
      orbs.append(button);
    }
    section.append(title,orbs);
    sections.push(section);
  }
  if (!sections.length) return false;
  grid.replaceChildren(...sections);
  grid.classList.add('adphor-one-grid');
  grid.dataset.adphorOneReady = 'true';
  page.classList.add('adphor-one-home');
  // All navigation first; original dashboard, statistics, and history follow below.
  page.prepend(createHero(doc),grid);
  return true;
}
export function enhanceAdphorOneShell(doc) {
  const shell = doc?.querySelector?.('.app-shell');
  const sidebar = shell?.querySelector?.('.sidebar');
  const topbar = shell?.querySelector?.('.workspace > .topbar');
  const actions = topbar?.querySelector?.('.topbar-actions');
  if (!shell || !sidebar || !topbar || !actions) return false;
  if (shell.dataset.adphorOneLayout === 'ready') return false;
  const buttons = [...sidebar.querySelectorAll('nav button[data-page]')];
  if (!buttons.length) return false;
  const active = buttons.find(button => button.getAttribute('aria-current') === 'page')?.dataset.page || 'dashboard';
  const brand = doc.createElement('a');
  brand.href = '#';
  brand.className = 'adphor-one-topbrand';
  brand.dataset.page = 'dashboard';
  brand.setAttribute('aria-label','ADPHOR: volver al inicio');
  const brandIcon = doc.createElement('i');
  brandIcon.className = 'fa-solid fa-building';
  brandIcon.setAttribute('aria-hidden','true');
  const brandName = doc.createElement('strong');
  brandName.textContent = 'ADPHOR';
  const brandLegal = doc.createElement('small');
  brandLegal.textContent = 'S.A.S.';
  brand.append(brandIcon,brandName,brandLegal);
  topbar.insertBefore(brand,topbar.firstChild);
  if (active !== 'dashboard') {
    const goHome = doc.createElement('button');
    goHome.type = 'button';
    goHome.className = 'adphor-one-go-home';
    goHome.dataset.page = 'dashboard';
    goHome.textContent = '← Inicio';
    goHome.setAttribute('aria-label','Volver a la pantalla de inicio');
    actions.prepend(goHome);
  }
  // No sidebar or overflow menu: the entire permitted navigation appears as circles on Inicio.
  shell.classList.add('adphor-one-shell');
  shell.dataset.adphorOneLayout = 'ready';
  return true;
}
function startAdphorOne() {
  if (!isIntegralQaHost(globalThis.location?.hostname)) return;
  const root = document.getElementById('root');
  if (!root || typeof MutationObserver === 'undefined') return;
  const enhance = () => { enhanceAdphorOneShell(document); enhanceAdphorOneDashboard(document); };
  const observer = new MutationObserver(enhance);
  observer.observe(root,{childList:true,subtree:true});
  enhance();
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAdphorOne,{once:true});
  else startAdphorOne();
}
