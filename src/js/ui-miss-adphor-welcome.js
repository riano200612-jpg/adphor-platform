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
    controls.remove();
    portrait.hidden=false;
    frame.classList.remove('miss-welcome-playing');
  };
}
