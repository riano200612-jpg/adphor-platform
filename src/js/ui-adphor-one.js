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

/** Build a compact list from the application's *already permitted* navigation.
 * The circular dashboard remains the primary navigation, not the sidebar. */
export function secondaryAdphorOnePages(navItems, isHome = true) {
  const primary = new Set(ADPHOR_ONE_MODULES.map(item => item.id));
  return (Array.isArray(navItems) ? navItems : []).filter(item =>
    item && item.id && item.id !== 'dashboard' &&
    (!isHome || !primary.has(item.id))
  );
}
function navigationLink(doc, item, active) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = 'adphor-one-menu-item';
  button.dataset.page = item.id; // use native app handler and existing authorization
  if (item.id === active) button.setAttribute('aria-current','page');
  const icon = doc.createElement('i');
  icon.className = item.icon || 'fa-solid fa-circle';
  icon.setAttribute('aria-hidden','true');
  const label = doc.createElement('span');
  label.textContent = item.label;
  button.append(icon,label);
  return button;
}
export function enhanceAdphorOneShell(doc) {
  const shell = doc?.querySelector?.('.app-shell');
  const sidebar = shell?.querySelector?.('.sidebar');
  const topbar = shell?.querySelector?.('.workspace > .topbar');
  const actions = topbar?.querySelector?.('.topbar-actions');
  if (!shell || !sidebar || !topbar || !actions) return false;
  if (shell.dataset.adphorOneLayout === 'ready') return false;
  // Copy only pages that the original, role-filtered navigation has authorized.
  const buttons = [...sidebar.querySelectorAll('nav button[data-page]')];
  if (!buttons.length) return false;
  const navigation = buttons.map(button => ({
    id: button.dataset.page,
    label: button.getAttribute('aria-label') || button.textContent.trim(),
    icon: button.querySelector('i')?.className || 'fa-solid fa-circle'
  }));
  const active = buttons.find(button => button.getAttribute('aria-current') === 'page')?.dataset.page || 'dashboard';
  const home = active === 'dashboard';
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
  if (!home) {
    const goHome = doc.createElement('button');
    goHome.type = 'button';
    goHome.className = 'adphor-one-go-home';
    goHome.dataset.page = 'dashboard';
    goHome.textContent = '← Inicio';
    goHome.setAttribute('aria-label','Volver a la pantalla de inicio');
    actions.prepend(goHome);
  }
  const more = secondaryAdphorOnePages(navigation, home);
  if (more.length) {
    const details = doc.createElement('details');
    details.className = 'adphor-one-more';
    const summary = doc.createElement('summary');
    summary.setAttribute('aria-label',home ? 'Otras funciones autorizadas' : 'Herramientas autorizadas');
    const summaryIcon = doc.createElement('i');
    summaryIcon.className = 'fa-solid fa-grip';
    summaryIcon.setAttribute('aria-hidden','true');
    const summaryLabel = doc.createElement('span');
    summaryLabel.textContent = home ? 'Otras funciones' : 'Herramientas';
    summary.append(summaryIcon,summaryLabel);
    const list = doc.createElement('nav');
    list.className = 'adphor-one-more-list';
    list.setAttribute('aria-label','Herramientas autorizadas');
    for (const item of more) list.append(navigationLink(doc,item,active));
    details.append(summary,list);
    actions.prepend(details);
  }
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
