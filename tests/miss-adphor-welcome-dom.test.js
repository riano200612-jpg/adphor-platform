import assert from 'node:assert/strict';
import test from 'node:test';
import {mountMissAdphorWelcome} from '../src/js/ui-miss-adphor-welcome.js';

function setupFakeDom({reducedMotion=false,rejectPlay=false}={}){
  const created=[];
  class El{
    constructor(tag){
      this.tag=tag; this.attrs={}; this.listeners={}; this.children=[];
      this.hidden=false;this.readyState=1;this.playCount=0;
      const flags=new Set();
      this.classList={add:n=>flags.add(n),remove:n=>flags.delete(n),contains:n=>flags.has(n)};
      created.push(this);
    }
    setAttribute(k,v){this.attrs[k]=v;}
    getAttribute(k){return this.attrs[k]??null;}
    removeAttribute(k){delete this.attrs[k];}
    append(...c){this.children.push(...c);}
    after(c){this.next=c;}
    addEventListener(k,fn){(this.listeners[k]??=[]).push(fn);}
    fire(k){return Promise.all((this.listeners[k]||[]).map(fn=>fn()));}
    pause(){this.paused=true;}
    play(){this.playCount++;return rejectPlay?Promise.reject(new Error('NotAllowedError')):Promise.resolve();}
    load(){this.loadCount=(this.loadCount||0)+1;}
    remove(){this.removed=true;}
  }
  const frame=new El('div'),portrait=new El('img'),form=new El('form');
  portrait.setAttribute('src','/assets/branding/miss-adphor-qa-integral(4).webp');
  frame.querySelector=s=>s==='.client-avatar-image'?portrait:null;
  const root={querySelector:s=>s==='.client-avatar-frame'?frame:s==='#login-form'?form:null};
  const prev={document:globalThis.document,matchMedia:globalThis.matchMedia,window:globalThis.window,sessionStorage:globalThis.sessionStorage};
  globalThis.document={createElement:tag=>new El(tag)};
  globalThis.matchMedia=()=>({matches:reducedMotion});
  globalThis.window={matchMedia:globalThis.matchMedia};
  globalThis.sessionStorage={setItem(){}};
  return {root,frame,portrait,form,created,restore(){for(const [k,v] of Object.entries(prev)){if(v===undefined)delete globalThis[k];else globalThis[k]=v;}}};
}

test('welcome autoplays muted, can activate audio, skip/replay, and never locks login',async()=>{
  const dom=setupFakeDom();
  try{
    const cleanup=mountMissAdphorWelcome(dom.root);
    const video=dom.created.find(e=>e.tag==='video');
    const sound=dom.created.find(e=>e.textContent==='Activar sonido');
    const skip=dom.created.find(e=>e.textContent==='Omitir presentación');
    assert.ok(video && sound && skip);
    assert.equal(video.autoplay,true);
    assert.equal(video.playsInline,true);
    assert.equal(video.playCount,1);
    assert.equal(video.muted,true);
    assert.equal(dom.portrait.hidden,true);
    assert.equal(dom.form.disabled,undefined);
    assert.equal(skip.hidden,false);
    video.currentTime=3;
    await sound.fire('click');
    assert.equal(video.muted,false);
    assert.equal(video.currentTime,0);
    assert.equal(sound.textContent,'Silenciar video');
    await skip.fire('click');
    assert.equal(dom.portrait.hidden,false);
    assert.equal(dom.form.classList.contains('miss-welcome-ready'),true);
    await sound.fire('click');
    assert.equal(video.playCount,2);
    assert.equal(video.muted,false);
    await video.fire('ended');
    assert.equal(dom.portrait.hidden,false);
    cleanup();
    assert.equal(video.removed,true);
  }finally{dom.restore();}
});

test('reduced motion preference disables autoplay but allows visitor-initiated playback',async()=>{
  const dom=setupFakeDom({reducedMotion:true});
  try{
    mountMissAdphorWelcome(dom.root);
    const video=dom.created.find(e=>e.tag==='video');
    const play=dom.created.find(e=>e.textContent==='Reproducir presentación (opcional)');
    assert.ok(play);
    assert.equal(video.playCount,0);
    assert.equal(video.autoplay,false);
    assert.equal(dom.portrait.hidden,false);
    await play.fire('click');
    assert.equal(video.playCount,1);
    assert.equal(video.muted,false);
  }finally{dom.restore();}
});

test('blocked autoplay restores portrait and leaves manual play available',async()=>{
  const dom=setupFakeDom({rejectPlay:true});
  try{
    mountMissAdphorWelcome(dom.root);
    await new Promise(resolve=>setImmediate(resolve));
    const video=dom.created.find(e=>e.tag==='video');
    const button=dom.created.find(e=>e.textContent==='Volver a intentar bienvenida');
    assert.ok(button);
    assert.equal(video.playCount,1);
    assert.equal(dom.portrait.hidden,false);
    assert.equal(video.hidden,true);
  }finally{dom.restore();}
});
test('rejects external or unapproved media paths',()=>{
  const dom=setupFakeDom();
  try{
    mountMissAdphorWelcome(dom.root,{videoPath:'https://flow-content.google/temporary.mp4'});
    assert.equal(dom.created.some(e=>e.tag==='video'),false);
  }finally{dom.restore();}
});
