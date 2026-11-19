/**
 * Miss ADPHOR QA Integral welcome: a large, unobstructed video with one
 * accessible speaker button. No production/login/MFA or original asset changes.
 */
export const MISS_WELCOME_VIDEO_PATH = '/assets/branding/miss-adphor-bienvenida-qa.mp4';
export const MISS_WELCOME_SESSION_KEY = 'adphor.qa.missWelcomeSeen.v1';

export function shouldOfferMissWelcome({enabled,hostname}={}) {
  return enabled === true && hostname === 'qa-integral-claude-reviewed.adphor-platform.pages.dev';
}

export function mountMissAdphorWelcome(root, options={}) {
  const frame=root?.querySelector?.('.client-avatar-frame');
  const portrait=frame?.querySelector?.('.client-avatar-image');
  if(!frame || !portrait || typeof document==='undefined')return ()=>{};
  if((options.videoPath ?? MISS_WELCOME_VIDEO_PATH)!==MISS_WELCOME_VIDEO_PATH)return ()=>{};

  const reducedMotion=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches===true;
  const video=document.createElement('video');
  video.className='miss-welcome-video';
  video.preload=reducedMotion?'none':'auto';
  video.playsInline=true;
  video.setAttribute('playsinline','');
  video.autoplay=!reducedMotion;
  video.loop=false;
  video.controls=false;
  video.hidden=true;
  video.setAttribute('aria-label','Video de presentación de Miss ADPHOR');
  video.setAttribute('disablepictureinpicture','');
  video.setAttribute('controlslist','nodownload noremoteplayback');
  const poster=portrait.getAttribute('src');
  if(poster)video.poster=poster;

  const controls=document.createElement('div');
  controls.className='miss-welcome-controls';
  const soundButton=document.createElement('button');
  soundButton.type='button';
  soundButton.className='miss-welcome-sound';
  controls.append(soundButton);
  portrait.after(video);
  frame.append(controls);

  // Exact corporate master asset from José's Drive, not a generated replacement.
  const identity=document.createElement('div');
  identity.className='miss-qa-corporate-identity';
  identity.setAttribute('role','group');
  identity.setAttribute('aria-label','Identidad corporativa ADPHOR');
  const corporateLogo=document.createElement('img');
  corporateLogo.src='/assets/branding/adphor-logo-oficial-v3.png';
  corporateLogo.alt='ADPHOR. Administradores Profesionales en Propiedad Horizontal';
  corporateLogo.loading='eager';corporateLogo.decoding='async';
  const motto=document.createElement('p');motto.textContent='Administramos sueños';
  identity.append(corporateLogo,motto);
  const mobileIdentity=globalThis.matchMedia?.('(max-width:580px)')?.matches===true;
  const mobileBrand=mobileIdentity?root.querySelector?.('.login-story > .brand'):null;
  const originalMobileBrandMarkup=mobileBrand?.innerHTML;
  const eyebrow=mobileBrand?null:root.querySelector?.('.login-form-wrap .eyebrow');
  // Preserve the login-story child ordering used by the existing QA layout CSS.
  if(mobileBrand)mobileBrand.replaceChildren(identity);
  else if(eyebrow){eyebrow.hidden=true;eyebrow.after(identity);}
  else root.querySelector?.('#login-form')?.append?.(identity);

  // Two entry choices requested by José in the 18 November ADPHOR meeting.
  // The original corporate portrait, MP4 and login are deliberately untouched.
  const actions=document.createElement('div');
  actions.className='miss-entry-actions';
  actions.setAttribute('role','group');
  actions.setAttribute('aria-label','Opciones de ingreso a ADPHOR');
  const firstTime=document.createElement('button');
  firstTime.type='button';firstTime.className='miss-entry-first';
  firstTime.textContent='Primera vez';firstTime.setAttribute('aria-expanded','false');
  const enter=document.createElement('button');
  enter.type='button';enter.className='miss-entry-login';
  enter.textContent='Ingresar al portal';
  actions.append(firstTime,enter);frame.after(actions);
  const guide=document.createElement('dialog');
  guide.className='miss-entry-guide';guide.id='miss-entry-guide';guide.hidden=true;
  guide.setAttribute('aria-modal','true');
  guide.setAttribute('aria-label','Guía de primer ingreso de Miss ADPHOR');
  guide.innerHTML=`<h2 tabindex="-1">Tu primera vez en ADPHOR</h2>
    <p>Miss ADPHOR te acompaña para comenzar con seguridad.</p>
    <ol>
      <li>Ingresa el usuario y la contraseña temporal que te entregaron.</li>
      <li>Cuando la plataforma te lo solicite, crea tu contraseña personal.</li>
      <li>Si usas una aplicación autenticadora, escanea el código QR y escribe el código que aparezca en la aplicación.</li>
      <li>Si tu cuenta tiene habilitada la opción de correo personal, solicita e ingresa el código recibido. Esta opción no está disponible para todas las cuentas.</li>
      <li>Si olvidaste tu contraseña, selecciona «¿Olvidaste tu contraseña?».</li>
    </ol>
    <p>Este es un tutorial escrito de primer ingreso. El video existente es de bienvenida; el tutorial audiovisual completo sigue pendiente.</p>
    <button class="miss-entry-guide-close" type="button">Cerrar guía</button>`;
  actions.after(guide);
  firstTime.setAttribute('aria-controls',guide.id);
  const closeGuide=()=>{
    if(typeof guide.close==='function' && guide.open)guide.close();
    guide.hidden=true;firstTime.setAttribute('aria-expanded','false');
  };
  guide.querySelector?.('.miss-entry-guide-close')?.addEventListener('click',closeGuide);
  guide.addEventListener('close',()=>{guide.hidden=true;firstTime.setAttribute('aria-expanded','false');});

  let disposed=false,pending=false,loaded=false;
  const updateSound=(muted)=>{
    video.muted=muted;
    video.defaultMuted=muted;
    if(muted)video.setAttribute('muted','');
    else video.removeAttribute('muted');
    soundButton.setAttribute('aria-pressed',String(!muted));
    const label=muted?'Activar sonido de Miss ADPHOR':'Silenciar video de Miss ADPHOR';
    soundButton.setAttribute('aria-label',label);
    soundButton.title=label;
    // Icons are trusted constants; no dynamic user content is injected.
    soundButton.innerHTML=muted
      ? '<i class="fa-solid fa-volume-xmark" aria-hidden="true"></i>'
      : '<i class="fa-solid fa-volume-high" aria-hidden="true"></i>';
  };
  updateSound(true);

  const remember=()=>{try{globalThis.sessionStorage?.setItem(MISS_WELCOME_SESSION_KEY,'1');}catch{/*optional*/}};
  const showPortrait=()=>{
    if(disposed)return;
    video.pause();
    video.autoplay=false;
    video.hidden=true;
    portrait.hidden=false;
    frame.classList.remove('miss-welcome-playing');
    updateSound(true);
    remember();
    root.querySelector('#login-form')?.classList.add('miss-welcome-ready');
  };
  const play=async(withSound)=>{
    if(pending||disposed)return;
    pending=true;
    try{
      updateSound(!withSound);
      if(!loaded){video.src=MISS_WELCOME_VIDEO_PATH;video.load();loaded=true;}
      else if(video.readyState>0)video.currentTime=0;
      video.hidden=false;
      portrait.hidden=true;
      frame.classList.add('miss-welcome-playing');
      await video.play();
    }catch{
      // The page and login remain usable if the browser blocks autoplay.
      showPortrait();
    }finally{pending=false;}
  };
  soundButton.addEventListener('click',async()=>{
    if(disposed)return;
    if(video.hidden){await play(true);return;}
    if(video.muted){
      updateSound(false);
      try{
        if(video.readyState>0)video.currentTime=0;
        await video.play();
      }catch{updateSound(true);}
    }else updateSound(true);
  });

  firstTime.addEventListener('click',()=>{
    if(disposed)return;
    guide.hidden=false;
    if(typeof guide.showModal==='function' && !guide.open)guide.showModal();
    firstTime.setAttribute('aria-expanded','true');
    guide.querySelector?.('h2')?.focus?.();
    void play(true);
  });
  enter.addEventListener('click',()=>{
    if(disposed)return;
    closeGuide();
    const field=root.querySelector('#login-form [name="email"]')
      ?? root.querySelector('#login-form [name="profile"]')
      ?? root.querySelector('#login-form input');
    const form=root.querySelector('#login-form');
    (field??form)?.scrollIntoView?.({behavior:reducedMotion?'instant':'smooth',block:'center'});
    (field??form)?.focus?.({preventScroll:true});
  });
  video.addEventListener('ended',showPortrait);
  video.addEventListener('error',showPortrait);
  if(!reducedMotion)void play(false);
  // With reduced motion enabled the original portrait stays visible; the
  // speaker button allows starting the presentation on an explicit tap.
  return ()=>{
    disposed=true;
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    closeGuide();controls.remove();actions.remove();guide.remove();
    identity.remove();if(mobileBrand)mobileBrand.innerHTML=originalMobileBrandMarkup;
    if(eyebrow)eyebrow.hidden=false;
    portrait.hidden=false;
    frame.classList.remove('miss-welcome-playing');
  };
}
