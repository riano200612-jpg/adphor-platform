/**
 * Miss ADPHOR audiovisual welcome — opt-in and restricted to QA Integral hostname.
 * Never gates login, Supabase, MFA, or the existing Miss ADPHOR chat.
 */
export const MISS_WELCOME_VIDEO_PATH = '/assets/branding/miss-adphor-bienvenida-qa.mp4';
export const MISS_WELCOME_SESSION_KEY = 'adphor.qa.missWelcomeSeen.v1';

export function shouldOfferMissWelcome({enabled,hostname}={}) {
  return enabled === true && hostname === 'qa-integral-claude-reviewed.adphor-platform.pages.dev';
}

export function mountMissAdphorWelcome(root, options={}) {
  const frame = root?.querySelector?.('.client-avatar-frame');
  const portrait = frame?.querySelector?.('.client-avatar-image');
  if (!frame || !portrait || typeof document==='undefined') return () => {};
  if ((options.videoPath ?? MISS_WELCOME_VIDEO_PATH) !== MISS_WELCOME_VIDEO_PATH) return () => {};
  const controls = document.createElement('div');
  controls.className = 'miss-welcome-controls';
  controls.setAttribute('role','group');
  controls.setAttribute('aria-label','Presentación audiovisual de Miss ADPHOR');
  const playButton = document.createElement('button');
  playButton.type = 'button';
  playButton.className = 'miss-welcome-play';
  playButton.textContent = 'Escuchar bienvenida';
  playButton.setAttribute('aria-label','Reproducir bienvenida de Miss ADPHOR con sonido');
  const skipButton = document.createElement('button');
  skipButton.type = 'button';
  skipButton.className = 'miss-welcome-skip';
  skipButton.textContent = 'Omitir presentación';
  skipButton.hidden = true;
  const video = document.createElement('video');
  video.className = 'miss-welcome-video';
  video.preload = 'none';
  video.playsInline = true;
  video.autoplay = false;
  video.loop = false;
  video.muted = false;
  video.controls = false;
  video.hidden = true;
  video.setAttribute('aria-label','Video de presentación de Miss ADPHOR');
  video.setAttribute('disablepictureinpicture','');
  video.setAttribute('controlslist','nodownload noremoteplayback');
  const poster=portrait.getAttribute('src');
  if(poster) video.poster=poster;
  controls.append(playButton,skipButton);
  portrait.after(video);
  frame.append(controls);
  let disposed=false, pending=false, loaded=false;
  const remember=()=>{try{sessionStorage.setItem(MISS_WELCOME_SESSION_KEY,'1')}catch{/* optional */}};
  const showPortrait=()=>{
    if(disposed)return;
    video.pause();
    video.hidden=true;
    portrait.hidden=false;
    frame.classList.remove('miss-welcome-playing');
    skipButton.hidden=true;
    playButton.hidden=false;
    playButton.textContent='Repetir presentación';
    playButton.setAttribute('aria-label','Volver a reproducir bienvenida de Miss ADPHOR');
    remember();
    root.querySelector('#login-form')?.classList.add('miss-welcome-ready');
  };
  const onError=()=>{showPortrait();playButton.textContent='Volver a intentar bienvenida';};
  const play=async()=>{
    if(pending || disposed)return;
    pending=true;
    try {
      if(!loaded){video.src=MISS_WELCOME_VIDEO_PATH;video.load();loaded=true;}
      else if(video.readyState>0) video.currentTime=0;
      video.hidden=false;
      portrait.hidden=true;
      frame.classList.add('miss-welcome-playing');
      skipButton.hidden=false;
      playButton.hidden=true;
      await video.play();
    } catch {onError();}
    finally {pending=false;}
  };
  playButton.addEventListener('click',play);
  skipButton.addEventListener('click',showPortrait);
  video.addEventListener('ended',showPortrait);
  video.addEventListener('error',onError);
  if(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    playButton.textContent='Reproducir presentación (opcional)';
  }
  return ()=>{disposed=true;video.pause();video.removeAttribute('src');video.load();video.remove();controls.remove();portrait.hidden=false;frame.classList.remove('miss-welcome-playing');};
}
