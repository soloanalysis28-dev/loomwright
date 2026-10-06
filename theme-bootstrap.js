(function(){
  const root=document.documentElement;
  const read=value=>{try{return JSON.parse(localStorage.getItem(value)||'null')}catch(_){return null}};
  let settings=read('loomwright_app_settings_v1');
  if(!settings||typeof settings!=='object'){
    const legacy=read('loomwright_state'),store=read('loomwright_projects_v1'),project=store?.projects?.find(item=>item.id===store.activeProjectId)||store?.projects?.[0];
    settings=project?.data?.settings||legacy?.settings||{};
  }
  let palette=settings.palette,theme=settings.theme,effect=settings.bgEffect||'none';
  if(!['sage','parchment','slate','forest','ink'].includes(palette))palette='sage';
  if(!['auto','light','dark'].includes(theme))theme='light';
  if(palette==='parchment'&&theme==='auto'){palette='sage';theme='light'}
  else if(theme==='auto')theme=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  if(!['none','rain','clouds','snow'].includes(effect))effect='none';
  root.dataset.palette=palette;root.dataset.theme=theme;root.dataset.bgEffect=effect;
  const themeColor=document.querySelector('meta[name="theme-color"]'),background=getComputedStyle(root).getPropertyValue('--bg').trim();
  if(themeColor&&background)themeColor.content=background;

  function ensureAtmosphere(){
    const sel=document.getElementById('bg-effect-select');
    if(sel){
      const rainOpt=sel.querySelector('option[value="rain"]');
      if(rainOpt)rainOpt.textContent='Water ripples';
      if(!sel.querySelector('option[value="snow"]')){
        const opt=document.createElement('option');
        opt.value='snow';
        opt.textContent='Snow';
        sel.appendChild(opt);
      }
      if(effect)sel.value=effect;
    }
    const bg=document.getElementById('bg-effect');
    if(bg){
      const rain=bg.querySelector('.bg-rain');
      if(rain&&!rain.querySelector('.ripple')){
        for(let i=1;i<=12;i++){
          const rip=document.createElement('div');
          rip.className=`ripple rip${i}`;
          rain.appendChild(rip);
        }
      }
      if(!bg.querySelector('.bg-snow')){
        const layer=document.createElement('div');
        layer.className='bg-layer bg-snow';
        for(let i=1;i<=20;i++){
          const span=document.createElement('span');
          span.className=`flake f${i}`;
          layer.appendChild(span);
        }
        bg.appendChild(layer);
      }
    }
  }
  if(document.readyState==='loading'){
    document.addEventListener('DOMContentLoaded',ensureAtmosphere);
  }else{
    ensureAtmosphere();
  }
})();
