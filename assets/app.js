(() => {
 'use strict';
 const storage={get(k){try{return localStorage.getItem('as-'+k)}catch{return null}},set(k,v){try{localStorage.setItem('as-'+k,v)}catch{}}};
 const systemDark=matchMedia('(prefers-color-scheme: dark)'),systemMotion=matchMedia('(prefers-reduced-motion: reduce)');
 let lang=['ru','kk','en'].includes(storage.get('language'))?storage.get('language'):'ru';
 let theme=['system','light','dark'].includes(storage.get('theme'))?storage.get('theme'):'system';
 let motion=storage.get('motion')!=='off'&&!systemMotion.matches;
 let filter='all',stage=0,revealObserver,scrollTick=false,toastTimer,printDetails=[];
 const q=(s)=>document.querySelector(s),qa=s=>[...document.querySelectorAll(s)];
 const d=()=>RESUME_DATA[lang],u=()=>UI[lang];
 function settings(){document.documentElement.dataset.theme=theme==='system'?(systemDark.matches?'dark':'light'):theme;document.documentElement.dataset.motion=motion?'on':'off';q('#theme-select').value=theme;q('#motion-toggle').checked=motion;q('#motion-toggle').disabled=systemMotion.matches;q('#motion-label').textContent=motion?u().motionOn:u().motionOff;}
 function toast(t){q('#toast').textContent=t;q('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>q('#toast')?.classList.remove('visible'),2600)}
 async function copy(value,message){try{if(!navigator.clipboard)throw new Error('clipboard');await navigator.clipboard.writeText(value);toast(message)}catch{const dialog=q('#copy-dialog');q('#copy-value').value=value;dialog.showModal();q('#copy-value').focus();q('#copy-value').select();}}
 function closeMenu(focus=false){q('#navigation').classList.remove('open');q('#menu-toggle').setAttribute('aria-expanded','false');if(focus)q('#menu-toggle').focus();}
 function closeSettings(focus=false){q('#settings-panel').hidden=true;q('#settings-toggle').setAttribute('aria-expanded','false');if(focus)q('#settings-toggle').focus();}
 function setStage(index,focus=false){stage=index;qa('[data-stage]').forEach((b,i)=>{b.classList.toggle('selected',i===stage);b.setAttribute('aria-selected',String(i===stage));b.tabIndex=i===stage?0:-1});const panel=q('#stage-panel');panel.setAttribute('aria-labelledby','stage-'+stage);panel.innerHTML=`<span class="mono stage-index">${u().step} ${String(stage+1).padStart(2,'0')} / 05</span><h3>${esc(d().steps[stage].title)}</h3><p>${esc(d().steps[stage].description)}</p>`;if(motion)panel.animate([{opacity:.5,transform:'translateY(8px)'},{opacity:1,transform:'translateY(0)'}],{duration:350,easing:'ease-out'});if(focus)q('#stage-'+stage).focus();}
 function filterCourses(){const search=q('#course-search').value.toLocaleLowerCase(lang).trim();let count=0;qa('[data-course]').forEach(row=>{const c=d().courses[Number(row.dataset.course)];const terms=[c.name,c.org,c.year].join(' ').toLocaleLowerCase(lang);const visible=(!search||search.split(/\s+/).every(part=>terms.includes(part)))&&(filter==='all'||c.highlight);row.hidden=!visible;if(visible)count++});q('.course-count').textContent=`${u().found} ${count} ${u().of} ${d().courses.length}`;q('.no-results').hidden=count>0;q('.clear-search').hidden=!search;}
 function scrollUpdate(){scrollTick=false;const root=document.documentElement;const total=root.scrollHeight-innerHeight;q('.page-progress i').style.transform=`scaleX(${total?Math.min(1,scrollY/total):0})`;const timeline=q('.timeline');const r=timeline.getBoundingClientRect();const progress=Math.max(0,Math.min(1,(innerHeight*.7-r.top)/r.height));q('.timeline-track i').style.transform=`scaleY(${progress})`;let active='home';qa('main>section').forEach(s=>{if(s.getBoundingClientRect().top<innerHeight*.3)active=s.id});if(innerWidth>680&&innerWidth<=1050){if(active==='process')active='skills';if(active==='education')active='learning'}qa('#navigation a').forEach(a=>{const yes=a.hash==='#'+active;a.classList.toggle('active',yes);if(yes)a.setAttribute('aria-current','location');else a.removeAttribute('aria-current')});}
 function init(){
  settings();document.documentElement.lang=lang;document.title=u().shareTitle;
  q('meta[name="description"]').content=d().intro;q('meta[property="og:title"]').content=u().shareTitle;q('meta[property="og:description"]').content=d().intro;q('meta[property="og:locale"]').content={ru:'ru_RU',kk:'kk_KZ',en:'en_US'}[lang];
  q('#language').addEventListener('change',e=>{const section=qa('main>section').filter(s=>s.getBoundingClientRect().top<160).pop();const sectionId=section?.id;const position=section?scrollY-section.offsetTop:scrollY;lang=e.target.value;storage.set('language',lang);filter='all';stage=0;revealObserver?.disconnect();q('#app').innerHTML=renderResume(d(),lang);init();q('#language').focus({preventScroll:true});scrollTo({top:sectionId?q('#'+sectionId).offsetTop+position:position,behavior:'instant'})});
  q('#menu-toggle').addEventListener('click',()=>{const open=q('#navigation').classList.toggle('open');q('#menu-toggle').setAttribute('aria-expanded',String(open));closeSettings()});
  qa('#navigation a').forEach(a=>a.addEventListener('click',()=>closeMenu()));
  q('#settings-toggle').addEventListener('click',()=>{const panel=q('#settings-panel');panel.hidden=!panel.hidden;q('#settings-toggle').setAttribute('aria-expanded',String(!panel.hidden));closeMenu()});
  q('#theme-select').addEventListener('change',e=>{theme=e.target.value;storage.set('theme',theme);settings();toast(u().status)});
  q('#motion-toggle').addEventListener('change',e=>{motion=e.target.checked&&!systemMotion.matches;if(!motion)document.getAnimations().forEach(a=>a.finish());storage.set('motion',motion?'on':'off');settings();toast(u().status)});
  qa('[data-stage]').forEach(b=>{b.addEventListener('click',()=>setStage(Number(b.dataset.stage)));b.addEventListener('keydown',e=>{let index=stage;if(['ArrowRight','ArrowDown'].includes(e.key))index=(stage+1)%5;else if(['ArrowLeft','ArrowUp'].includes(e.key))index=(stage+4)%5;else if(e.key==='Home')index=0;else if(e.key==='End')index=4;else return;e.preventDefault();setStage(index,true)});});
  qa('.skill-details').forEach(details=>{let animation;details.querySelector('summary').addEventListener('click',e=>{if(!motion)return;e.preventDefault();animation?.cancel();const start=details.offsetHeight,opening=!details.open;const summaryHeight=details.querySelector('summary').offsetHeight+1;if(opening)details.open=true;const end=opening?details.offsetHeight:summaryHeight;details.style.overflow='hidden';animation=details.animate({height:[start+'px',end+'px']},{duration:380,easing:'cubic-bezier(.2,.8,.2,1)'});animation.onfinish=()=>{if(!opening)details.open=false;details.style.overflow='';animation=null;};});});
  q('#course-search').addEventListener('input',filterCourses);q('.clear-search').addEventListener('click',()=>{q('#course-search').value='';filterCourses();q('#course-search').focus()});
  qa('[data-filter]').forEach(b=>b.addEventListener('click',()=>{filter=b.dataset.filter;qa('[data-filter]').forEach(x=>{const yes=x===b;x.classList.toggle('active',yes);x.setAttribute('aria-pressed',String(yes))});filterCourses()}));
  q('[data-copy=email]').addEventListener('click',()=>copy('adil04@Inbox.ru',u().copiedEmail));q('[data-copy=phone]').addEventListener('click',()=>copy('+7 708 551 3925',u().copiedPhone));
  const shareUrl=()=>{const url=new URL(location.href);url.hash='';return url.href};
  q('#share-button').addEventListener('click',()=>{q('#share-value').value=shareUrl();q('#native-share').hidden=!navigator.share;q('#share-dialog').showModal();q('#share-value').focus();q('#share-value').select()});
  q('#copy-share').addEventListener('click',()=>{q('#share-dialog').close();copy(shareUrl(),u().copiedLink)});
  q('#close-share').addEventListener('click',()=>q('#share-dialog').close());
  q('#native-share').addEventListener('click',async()=>{try{await navigator.share({title:u().shareTitle,text:d().tagline,url:shareUrl()})}catch(e){if(e.name!=='AbortError'){q('#share-dialog').close();copy(shareUrl(),u().copiedLink)}}});
  q('#close-dialog').addEventListener('click',()=>q('#copy-dialog').close());q('#copy-dialog').addEventListener('click',e=>{if(e.target===q('#copy-dialog')){const r=e.target.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)e.target.close()}});
  q('#print-button').addEventListener('click',()=>window.print());
  revealObserver=new IntersectionObserver(entries=>{entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in-view');revealObserver.unobserve(e.target)}})},{threshold:.12});qa('.section-top,.skill-card,.job,.process-steps,.education-grid,.extras-grid').forEach(el=>{el.classList.add('reveal');revealObserver.observe(el)});
  scrollUpdate();
 }
 if(lang!=='ru')q('#app').innerHTML=renderResume(d(),lang);
 init();
 if(location.hash)requestAnimationFrame(()=>{const target=document.getElementById(location.hash.slice(1));target?.scrollIntoView({behavior:'instant'})});
 document.addEventListener('click',e=>{if(!e.target.closest('#settings-panel,#settings-toggle'))closeSettings();if(!e.target.closest('#navigation,#menu-toggle'))closeMenu()});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!q('#settings-panel').hidden)closeSettings(true);if(q('#navigation').classList.contains('open'))closeMenu(true)}});
 addEventListener('scroll',()=>{if(!scrollTick){scrollTick=true;requestAnimationFrame(scrollUpdate)}},{passive:true});addEventListener('resize',scrollUpdate);
 systemDark.addEventListener('change',settings);systemMotion.addEventListener('change',()=>{motion=storage.get('motion')!=='off'&&!systemMotion.matches;if(!motion)document.getAnimations().forEach(a=>a.finish());settings()});
 addEventListener('beforeprint',()=>{printDetails=qa('details').map(el=>[el,el.open]);printDetails.forEach(([el])=>el.open=true);if(!q('.print-stages')){const ol=document.createElement('ol');ol.className='print-stages';ol.hidden=true;ol.innerHTML=d().steps.map(s=>`<li><strong>${esc(s.title)}.</strong> ${esc(s.description)}</li>`).join('');q('#process').append(ol)}});
 addEventListener('afterprint',()=>printDetails.forEach(([el,open])=>el.open=open));
})();
