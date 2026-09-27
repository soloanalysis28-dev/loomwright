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
  if(!['none','rain','clouds'].includes(effect))effect='none';
  root.dataset.palette=palette;root.dataset.theme=theme;root.dataset.bgEffect=effect;
  const themeColor=document.querySelector('meta[name="theme-color"]'),background=getComputedStyle(root).getPropertyValue('--bg').trim();
  if(themeColor&&background)themeColor.content=background;
})();