import assert from 'node:assert/strict';
import test from 'node:test';
import {mountMissAdphorWelcome} from '../src/js/ui-miss-adphor-welcome.js';

function setupFakeDom({reducedMotion=false,rejectPlay=false}={}){
  const created=[];
  class El{
    constructor(tag){
      this.tag=tag;this.attrs={};this.listeners={};this.children=[];
      this.hidden=false;this.readyState=1;this.playCount=0;
      const flags=new Set();
      this.classList={add:n=>flags.add(n),remove:n=>flags.delete(n),contains:n=>flags.has(n)};
      created.push(this);
    }
    setAttribute(k,v){this.attrs[k]=v;}
    getAttribute(k){return this.attrs[k]??null;}
    removeAttribute(k){delete this.attrs[k];}
    append(...children){this.children.push(...children);}
    prepend(...children){this.children.unshift(...children);}
    after(c){this.next=c;}
    addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
    fire(k){return Promise.all((this.listeners[k]||[]).map(fn=>fn()));}
    pause(){this.paused=true;}
    play(){this.playCount++;return rejectPlay?Promise.reject(new Error('NotAllowedError')):Promise.resolve();}
    load(){this.loadCount=(this.loadCount||0)+1;}
    remove(){this.removed=true;}
  }
  const frame=new El('div'),portrait=new El('img'),form=new El('form');
  const shell=new El('main'),loginPanel=new El('section');
  portrait.setAttribute('src','/assets/branding/miss-adphor-qa-integral-bordado-oficial.webp');
  frame.querySelector=s=>s==='.client-avatar-image'?portrait:null;
  const root={querySelector:s=>s==='.client-avatar-frame'?frame:s==='#login-form'?form:s==='.login-shell'?shell:s==='.login-form-wrap'?loginPanel:null};
  const prev={document:globalThis.document,matchMedia:globalThis.matchMedia,sessionStorage:globalThis.sessionStorage};
  globalThis.document={createElement:tag=>new El(tag)};
  globalThis.matchMedia=()=>({matches:reducedMotion});
  globalThis.sessionStorage={setItem(){}};
  return {root,frame,portrait,form,shell,loginPanel,created,restore(){for(const [k,v] of Object.entries(prev)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}

test('autoplay is muted and only a single circular sound button is created',async()=>{
  const dom=setupFakeDom();
  try{
    const cleanup=mountMissAdphorWelcome(dom.root);
    const video=dom.created.find(e=>e.tag==='video');
    const buttons=dom.created.filter(e=>e.tag==='button');
    const sound=buttons[0];
    assert.ok(video);
    assert.equal(buttons.length,4);
    assert.equal(sound.className,'miss-welcome-sound');
    assert.equal(sound.attrs['aria-label'],'Activar sonido de Miss ADPHOR');
    assert.equal(sound.attrs['aria-pressed'],'false');
    assert.match(sound.innerHTML,/fa-volume-xmark/);
    assert.equal(video.autoplay,true);
    assert.equal(video.playsInline,true);
    assert.equal(video.loop,false);
    assert.equal(video.muted,true);
    assert.equal(video.playCount,1);
    assert.equal(dom.portrait.hidden,true);
    assert.equal(dom.form.disabled,undefined);

    // Visitor gesture enables audio and restarts the clip from its beginning.
    video.currentTime=3;
    await sound.fire('click');
    assert.equal(video.muted,false);
    assert.equal(video.currentTime,0);
    assert.equal(video.playCount,2);
    assert.equal(sound.attrs['aria-pressed'],'true');
    assert.equal(sound.attrs['aria-label'],'Silenciar video de Miss ADPHOR');
    assert.match(sound.innerHTML,/fa-volume-high/);
    await sound.fire('click');
    assert.equal(video.muted,true);
    assert.equal(sound.attrs['aria-pressed'],'false');

    await video.fire('ended');
    assert.equal(dom.portrait.hidden,false);
    assert.equal(dom.form.classList.contains('miss-welcome-ready'),true);
    assert.equal(buttons.length,4);
    // The same unobtrusive speaker button replays the clip after it ends.
    await sound.fire('click');
    assert.equal(video.playCount,3);
    assert.equal(video.muted,false);
    cleanup();
    assert.equal(video.removed,true);
    assert.equal(dom.portrait.hidden,false);
  }finally{dom.restore();}
});

test('reduced-motion users receive a still portrait until they tap the sound icon',async()=>{
  const dom=setupFakeDom({reducedMotion:true});
  try{
    mountMissAdphorWelcome(dom.root);
    const video=dom.created.find(e=>e.tag==='video');
    const sound=dom.created.find(e=>e.className==='miss-welcome-sound');
    assert.equal(video.autoplay,false);
    assert.equal(video.playCount,0);
    assert.equal(dom.portrait.hidden,false);
    await sound.fire('click');
    assert.equal(video.playCount,1);
    assert.equal(video.muted,false);
  }finally{dom.restore();}
});

test('autoplay rejection does not lock login and retains a manual sound button',async()=>{
  const dom=setupFakeDom({rejectPlay:true});
  try{
    mountMissAdphorWelcome(dom.root);
    await new Promise(resolve=>setImmediate(resolve));
    const video=dom.created.find(e=>e.tag==='video');
    const sound=dom.created.find(e=>e.className==='miss-welcome-sound');
    assert.equal(video.playCount,1);
    assert.equal(video.hidden,true);
    assert.equal(dom.portrait.hidden,false);
    assert.equal(dom.form.disabled,undefined);
    assert.equal(sound.attrs['aria-label'],'Activar sonido de Miss ADPHOR');
    await sound.fire('click');
    assert.equal(video.playCount,2);
    assert.equal(dom.portrait.hidden,false);
  }finally{dom.restore();}
});

test('media error falls back to original portrait; external video paths are rejected',async()=>{
  const dom=setupFakeDom();
  try{
    mountMissAdphorWelcome(dom.root);
    const video=dom.created.find(e=>e.tag==='video');
    await video.fire('error');
    assert.equal(dom.portrait.hidden,false);
    assert.equal(video.hidden,true);
    assert.equal(dom.created.filter(e=>e.tag==='button').length,4);
  }finally{dom.restore();}
  const other=setupFakeDom();
  try{
    mountMissAdphorWelcome(other.root,{videoPath:'https://flow-content.google/temporary.mp4'});
    assert.equal(other.created.some(e=>e.tag==='video'),false);
  }finally{other.restore();}
});


test('first-visit and existing-user choices preserve original login',async()=>{
  const dom=setupFakeDom({reducedMotion:true});
  try{
    const cleanup=mountMissAdphorWelcome(dom.root);
    const first=dom.created.find(e=>e.className==='miss-entry-first');
    const enter=dom.created.find(e=>e.className==='miss-entry-login');
    const guide=dom.created.find(e=>e.className==='miss-entry-guide');
    assert.ok(first);assert.ok(enter);assert.ok(guide);
    assert.equal(first.textContent,'Primera vez');
    assert.equal(enter.textContent,'Ingresar al portal');
    assert.equal(guide.hidden,true);
    assert.equal(dom.shell.classList.contains('miss-entry-is-cover'),true);
    assert.match(guide.innerHTML,/Video tutorial de ADPHOR/);
    assert.match(guide.innerHTML,/El video explicativo se incorporará aquí más adelante/);
    assert.match(guide.innerHTML,/código QR/);
    assert.match(guide.innerHTML,/correo personal/);
    assert.match(guide.innerHTML,/no está disponible para todas las cuentas/);
    assert.match(guide.innerHTML,/tutorial audiovisual completo sigue pendiente/);
    await first.fire('click');
    assert.equal(guide.hidden,false);
    assert.equal(first.attrs['aria-expanded'],'true');
    await enter.fire('click');
    assert.equal(guide.hidden,true);
    assert.equal(first.attrs['aria-expanded'],'false');
    assert.equal(dom.shell.classList.contains('miss-entry-is-cover'),false);
    assert.equal(dom.shell.classList.contains('miss-entry-is-login'),true);
    assert.equal(enter.attrs['aria-expanded'],'true');
    assert.equal(dom.form.disabled,undefined);
    const back=dom.created.find(e=>e.className==='miss-entry-back');
    assert.ok(back);
    await back.fire('click');
    assert.equal(dom.shell.classList.contains('miss-entry-is-cover'),true);
    assert.equal(dom.shell.classList.contains('miss-entry-is-login'),false);
    cleanup();
    assert.equal(dom.shell.classList.contains('miss-entry-is-cover'),false);
    assert.equal(guide.removed,true);
    assert.equal(first.removed,undefined);
  }finally{dom.restore();}
});
test('the welcome stays scoped to QA Integral',async()=>{
  const {shouldOfferMissWelcome}=await import('../src/js/ui-miss-adphor-welcome.js');
  assert.equal(shouldOfferMissWelcome({enabled:true,hostname:'qa-integral-claude-reviewed.adphor-platform.pages.dev'}),true);
  assert.equal(shouldOfferMissWelcome({enabled:true,hostname:'adphor-platform.pages.dev'}),false);
});


test('shows official ADPHOR identity without replacing the original portrait or video',async()=>{
  const {readFileSync}=await import('node:fs');
  const logo=readFileSync(new URL('../public/assets/branding/adphor-logo-oficial-v3.png',import.meta.url));
  assert.deepEqual([...logo.subarray(0,8)],[137,80,78,71,13,10,26,10]);
  const dom=setupFakeDom({reducedMotion:true});
  try{
    const stop=mountMissAdphorWelcome(dom.root);
    const image=dom.created.find(e=>e.tag==='img' && e.alt?.includes('Administradores Profesionales en Propiedad Horizontal'));
    const slogan=dom.created.find(e=>e.tag==='img' && e.alt==='Administramos sueños');
    assert.ok(image);assert.ok(slogan);
    assert.equal(slogan.src,'/assets/branding/adphor-eslogan-original.png');
    assert.equal(image.src,'/assets/branding/adphor-logo-oficial-v3.png');
    assert.equal(dom.portrait.getAttribute('src'),'/assets/branding/miss-adphor-qa-integral-bordado-oficial.webp');
    assert.equal(dom.form.disabled,undefined);
    const brand=dom.created.find(e=>e.className==='miss-qa-corporate-identity');
    assert.equal(dom.shell.children[0],brand);
    assert.deepEqual(brand.children,[image,slogan]);
    assert.equal(dom.form.children.includes(brand),false);
    stop();assert.equal(brand.removed,true);
  }finally{dom.restore();}
});

test('a recovery return starts directly at credentials, not a hidden form',async()=>{
  const dom=setupFakeDom({reducedMotion:true});
  try{
    const stop=mountMissAdphorWelcome(dom.root,{initialView:'login'});
    assert.equal(dom.shell.classList.contains('miss-entry-is-cover'),false);
    assert.equal(dom.shell.classList.contains('miss-entry-is-login'),true);
    const video=dom.created.find(e=>e.tag==='video');
    assert.equal(video.playCount,0);
    const enter=dom.created.find(e=>e.className==='miss-entry-login');
    assert.equal(enter.attrs['aria-expanded'],'true');
    const back=dom.created.find(e=>e.className==='miss-entry-back');
    await back.fire('click');
    assert.equal(dom.shell.classList.contains('miss-entry-is-cover'),true);
    stop();
  }finally{dom.restore();}
});
