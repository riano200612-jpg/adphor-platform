// ADPHOR ONE · presentation-only enhancement for the single approved QA Integral.
// No credentials, API writes, synthetic records, permission changes or navigation overrides.
export const QA_INTEGRAL_HOST = 'qa-integral-claude-reviewed.adphor-platform.pages.dev';
export const ADPHOR_ONE_MODULES = Object.freeze([
  Object.freeze({id:'agenda',title:'Calendario',icon:'calendar-days',tone:'navy',hint:'Agenda verificada'}),
  Object.freeze({id:'pqrs',title:'PQRS',icon:'message',tone:'champagne',hint:'Solicitudes y seguimiento'}),
  Object.freeze({id:'visits',title:'Visitas',icon:'clipboard-check',tone:'sage',hint:'Visitas y evidencias'}),
  Object.freeze({id:'corporate-staff',title:'Equipo',icon:'people-group',tone:'sky',hint:'Personal autorizado'}),
  Object.freeze({id:'properties',title:'Copropiedades',icon:'building',tone:'slate',hint:'Tus comunidades'}),
  Object.freeze({id:'reports',title:'Informes',icon:'chart-column',tone:'pearl',hint:'Indicadores e informes'}),
  Object.freeze({id:'meetings',title:'Reuniones',icon:'video',tone:'steel',hint:'Gestión de reuniones'}),
  Object.freeze({id:'agent-history',title:'Agentes IA',icon:'wand-magic-sparkles',tone:'indigo',hint:'Borradores auditables'})
]);

export function isIntegralQaHost(hostname) {
  return hostname === QA_INTEGRAL_HOST ||
    /^[a-f0-9]{8}\.adphor-platform\.pages\.dev$/.test(String(hostname || ''));
}
export function visibleAdphorOneModules(availablePages) {
  const allowed = new Set(Array.isArray(availablePages) ? availablePages : []);
  return ADPHOR_ONE_MODULES.filter(module => allowed.has(module.id));
}
function createOrb(doc, module) {
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
  hero.setAttribute('aria-label','Accesos a los módulos de ADPHOR');
  const eyebrow = doc.createElement('p');
  eyebrow.className = 'eyebrow';
  eyebrow.textContent = 'ADPHOR ONE · MI ESPACIO DIGITAL';
  const title = doc.createElement('h2');
  title.textContent = 'Todo lo que necesitas, a un toque.';
  const subtitle = doc.createElement('p');
  subtitle.className = 'adphor-one-hero-subtitle';
  subtitle.textContent = 'Elige una herramienta. Tus datos, permisos e historial se mantienen.';
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
  const availablePages = Array.from(doc.querySelectorAll('.sidebar nav [data-page]'), button => button.dataset.page);
  const modules = visibleAdphorOneModules(availablePages);
  if (!modules.length) return false; // fail closed when the authorization-derived nav is absent
  const existing = new Map(Array.from(grid.querySelectorAll('.module-card[data-page]'), button => [button.dataset.page,button]));
  for (const module of modules) {
    const button = existing.get(module.id) || createOrb(doc,module);
    button.dataset.uiTone = module.tone;
    button.classList.add('adphor-one-tile');
    const icon = button.querySelector('i');
    if (icon) icon.className = 'fa-solid fa-' + module.icon;
    const label = button.querySelector('strong');
    if (label) label.textContent = module.title; // display label only, leave live status <small> intact
    grid.append(button); // reorders existing buttons without recreating their listeners or live status
  }
  page.classList.add('adphor-one-home');
  grid.classList.add('adphor-one-grid');
  grid.dataset.adphorOneReady = 'true';
  intro.after(createHero(doc),grid);
  return true;
}
function startAdphorOne() {
  if (!isIntegralQaHost(globalThis.location?.hostname)) return;
  const root = document.getElementById('root');
  if (!root || typeof MutationObserver === 'undefined') return;
  const observer = new MutationObserver(() => enhanceAdphorOneDashboard(document));
  observer.observe(root,{childList:true,subtree:true});
  enhanceAdphorOneDashboard(document);
}
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startAdphorOne,{once:true});
  else startAdphorOne();
}
