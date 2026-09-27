import './vendor/mammoth/mammoth.browser.min.js';
import DOMPurify from './vendor/dompurify/purify.es.mjs';
import { unzipSync } from './vendor/fflate/browser.js';
import * as pdfjsLib from './vendor/pdfjs/build/pdf.min.mjs';
const mammoth=window.mammoth;
window.pdfjsLib=pdfjsLib;
pdfjsLib.GlobalWorkerOptions.workerSrc=new URL('./vendor/pdfjs/build/pdf.worker.min.mjs',import.meta.url).href;
const PDF_CMAP_URL=new URL('./vendor/pdfjs/cmaps/',import.meta.url).href;
const PDF_STANDARD_FONT_URL=new URL('./vendor/pdfjs/standard_fonts/',import.meta.url).href;

const DEFAULT_STATE={sections:[{id:1,title:'Chapter 1',html:'<p></p>'}],activeId:1,charNotes:{},charStatus:{},finaliseChecklist:{},charIgnore:{},charMerge:{},webPositions:{},webNodes:[]};
const PROJECTS_STORAGE_KEY='loomwright_projects_v1',ACTIVE_PROJECT_KEY='loomwright_active_project_v1',APP_SETTINGS_KEY='loomwright_app_settings_v1';
const ONLINE_SYNC_ENABLED=false; // Reserved for a later, explicit online-save feature; offline mode is the only active storage.
const DEFAULT_BOOK={title:'',subtitle:'',author:'',coverStyle:'botanical',trim:'trade',font:'serif',dedication:'',includeToc:true,includeCopyright:true};
const CHARACTER_STATUSES=[['unknown','Unknown'],['alive','Alive'],['dead','Dead'],['injured','Injured'],['missing','Missing'],['presumed-dead','Presumed dead'],['captured','Captured'],['recovering','Recovering']];
const SAFE_RICH_TAGS=['p','br','div','span','strong','b','em','i','u','s','strike','sub','sup','h1','h2','h3','h4','h5','h6','blockquote','ul','ol','li','font'];
const SAFE_RICH_ATTRS=['style','title','color','face','size','dir'];
const SAFE_STYLE_PROPS=['font-family','font-size','font-weight','font-style','text-decoration','text-align','color','background-color','line-height','vertical-align'];
function sanitizeInlineStyle(value){const source=document.createElement('span');source.style.cssText=String(value||'');const target=document.createElement('span');for(const prop of SAFE_STYLE_PROPS){const v=source.style.getPropertyValue(prop).trim();if(v&&v.length<160&&!/(?:url\s*\(|expression\s*\(|@import|javascript:|behavior\s*:|-moz-binding)/i.test(v)&&!/[<>;]/.test(v))target.style.setProperty(prop,v)}return target.getAttribute('style')||''}
DOMPurify.addHook('uponSanitizeAttribute',(_node,data)=>{if(data.attrName==='style'){data.attrValue=sanitizeInlineStyle(data.attrValue);if(!data.attrValue)data.keepAttr=false}});
function sanitizeRichHtml(value){try{return DOMPurify.sanitize(String(value??''),{ALLOWED_TAGS:SAFE_RICH_TAGS,ALLOWED_ATTR:SAFE_RICH_ATTRS,ALLOW_DATA_ATTR:false,ALLOW_ARIA_ATTR:false,RETURN_TRUSTED_TYPE:false,FORBID_TAGS:['script','style','iframe','object','embed','svg','math','video','audio','form','input','button'],FORBID_ATTR:['src','srcset','href','xlink:href','action','formaction']})}catch(_){return escapeHtml(value)}}
const MAX_IMPORT_BYTES=20*1024*1024;
function setImportSafetyStatus(message,state='ok'){const el=document.getElementById('import-safety-status');if(el){el.textContent=message;el.dataset.state=state}}
function asciiFromBytes(bytes){return new TextDecoder('latin1').decode(bytes)}
async function screenImportFile(file){
  const ext=(file.name.match(/\.([a-z0-9]+)$/i)||[])[1]?.toLowerCase();
  if(!['txt','docx','pdf'].includes(ext))throw new Error('Only .txt, .docx and .pdf files are accepted.');
  if(!file.size||file.size>MAX_IMPORT_BYTES)throw new Error('Choose a non-empty file smaller than 20 MB.');
  const bytes=new Uint8Array(await file.arrayBuffer()),notes=[];
  if(ext==='txt'){
    if(bytes.subarray(0,Math.min(bytes.length,4096)).includes(0))throw new Error('This does not look like a plain-text file.');
    try{new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch(_){throw new Error('This text file is not valid UTF-8. Save it as UTF-8 and try again.')}
    return {ext,bytes,notes};
  }
  if(ext==='pdf'){
    const head=asciiFromBytes(bytes.subarray(0,Math.min(bytes.length,1024)));
    if(!head.includes('%PDF-'))throw new Error('This file does not have a PDF signature.');
    const headSample=asciiFromBytes(bytes.subarray(0,Math.min(bytes.length,2*1024*1024)));
    if(/\/(?:JavaScript|JS|Launch|OpenAction|EmbeddedFile|RichMedia|GoToE)\b/i.test(headSample))notes.push('The PDF has active-content markers. Loomwright will extract text only and won’t run its scripts or open embedded files.');
    return {ext,bytes,notes};
  }
  if(bytes[0]!==0x50||bytes[1]!==0x4b)throw new Error('This Word file is not a valid DOCX archive.');
  let count=0,uncompressedTotal=0,hasMacro=false,hasEmbedded=false,externalRelationship=false;
  let files;
  try{
    files=unzipSync(bytes,{filter:meta=>{
      count++;if(count>800)throw new Error('The Word file contains too many parts.');
      const name=String(meta.name||''),isRelationship=/(?:^|\/)_(?:rels)\/.*\.rels$/i.test(name)||/^_rels\/.*\.rels$/i.test(name);uncompressedTotal+=Number(meta.originalSize)||0;
      if(name.split('/').includes('..'))throw new Error('The Word file contains an unsafe internal path.');
      if(uncompressedTotal>50*1024*1024)throw new Error('The Word file expands beyond the safe 50 MB limit.');
      if(Number(meta.originalSize)>1024*1024&&(Number(meta.originalSize)/Math.max(1,Number(meta.size)||0))>500)throw new Error('The Word file contains an unusually compressed part.');
      if(isRelationship&&(Number(meta.originalSize)||0)>1024*1024)throw new Error('The Word file’s link information is unusually large.');
      if(/(?:^|\/)vbaProject\.bin$/i.test(name)||/\.(?:docm|dotm)$/i.test(name))hasMacro=true;
      if(/(?:^|\/)(?:embeddings|activex)(?:\/|$)|(?:^|\/)oleObject\d*\.bin$/i.test(name))hasEmbedded=true;
      return isRelationship||/^\[Content_Types\]\.xml$/i.test(name);
    }});
  }catch(error){throw new Error(error?.message?.includes('safe 50 MB')||error?.message?.includes('too many parts')?error.message:'The Word file could not be safely checked. It may be damaged or encrypted.')}
  const contentTypes=Object.entries(files||{}).find(([name])=>/^\[Content_Types\]\.xml$/i.test(name))?.[1];if(contentTypes&&/macroEnabled|vbaProject/i.test(new TextDecoder().decode(contentTypes)))hasMacro=true;
  if(hasMacro)throw new Error('This Word file contains a macro. Loomwright will not import macro-enabled documents. Save a macro-free .docx copy and try again.');
  if(hasEmbedded)throw new Error('This Word file contains an embedded object or ActiveX component. For safety, those documents are not imported.');
  for(const [name,data] of Object.entries(files||{}))if(/\.rels$/i.test(name)&&/TargetMode\s*=\s*["']External["']/i.test(new TextDecoder().decode(data)))externalRelationship=true;
  if(externalRelationship)notes.push('The Word file refers to outside links. Links and embedded images are removed; only cleaned writing is imported.');
  return {ext,bytes,notes};
}
function newProjectId(){return 'project-'+(window.crypto?.randomUUID?crypto.randomUUID():Date.now()+'-'+Math.random().toString(36).slice(2,9))}
function newProjectState(){return {...DEFAULT_STATE,sections:[{id:1,title:'Chapter 1',html:'<p></p>'}],charNotes:{},charStatus:{},finaliseChecklist:{},charIgnore:{},charMerge:{},webNodes:[],book:{...DEFAULT_BOOK}}}
function normalizeSettings(settings){const next={palette:'sage',theme:'light',bgEffect:'none',...(settings||{})};if(!['sage','parchment','slate','forest','ink'].includes(next.palette))next.palette='sage';if(!['auto','light','dark'].includes(next.theme))next.theme='light';if(!['none','rain','clouds'].includes(next.bgEffect))next.bgEffect='none';if(next.palette==='parchment'&&next.theme==='auto'){next.palette='sage';next.theme='light'}return next}
function normalizeProjectState(value){const next=value&&typeof value==='object'?value:newProjectState();if(!Array.isArray(next.sections)||!next.sections.length)next.sections=newProjectState().sections;next.sections=next.sections.filter(s=>s&&typeof s==='object').map(s=>({...s,html:sanitizeRichHtml(s.html||'')}));if(!next.sections.length)next.sections=newProjectState().sections;delete next.settings;next.charNotes=next.charNotes||{};next.charStatus=next.charStatus||{};next.finaliseChecklist=next.finaliseChecklist||{};next.charIgnore=next.charIgnore||{};next.charMerge=next.charMerge||{};next.webPositions=next.webPositions||{};next.webNodes=Array.isArray(next.webNodes)?next.webNodes.filter(node=>node&&['place','event','object','thread'].includes(node.type)&&String(node.label||'').trim()).map(node=>({id:String(node.id||newProjectId()),type:node.type,label:String(node.label).trim().slice(0,80)})):[];next.book={...DEFAULT_BOOK,...(next.book||{})};return next}
let legacyState=null,projectStore=null;
try{legacyState=JSON.parse(localStorage.getItem('loomwright_state')||'null')}catch(e){}
try{projectStore=JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY)||'null')}catch(e){}
const initialActiveId=projectStore?.activeProjectId||localStorage.getItem(ACTIVE_PROJECT_KEY)||'';
const initialActiveProject=projectStore?.projects?.find(p=>p.id===initialActiveId);
let appSettings,appSettingsStoredAtBoot=false,appSettingsTouched=false;
try{const savedAppSettings=JSON.parse(localStorage.getItem(APP_SETTINGS_KEY)||'null');appSettingsStoredAtBoot=!!(savedAppSettings&&typeof savedAppSettings==='object');appSettings=normalizeSettings(savedAppSettings||initialActiveProject?.data?.settings||legacyState?.settings)}catch(e){appSettings=normalizeSettings(null)}
let projects=Array.isArray(projectStore?.projects)?projectStore.projects:[];
let activeProjectId=initialActiveId;
if(!projects.length){activeProjectId=newProjectId();projects=[{id:activeProjectId,name:'My First Project',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),data:normalizeProjectState(legacyState)}]}
projects=projects.filter(p=>p&&p.id).map(p=>({...p,name:String(p.name||'Untitled Project'),createdAt:p.createdAt||new Date().toISOString(),updatedAt:p.updatedAt||p.createdAt||new Date().toISOString(),data:normalizeProjectState(p.data)}));
if(!projects.length){activeProjectId=newProjectId();projects=[{id:activeProjectId,name:'My First Project',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),data:newProjectState()}]}
if(!projects.some(p=>p.id===activeProjectId))activeProjectId=projects[0].id;
let state=projects.find(p=>p.id===activeProjectId).data;
let offlineDb=null,offlineSaveTimer=null,offlineStorageReady=false;
function openOfflineDatabase(){return new Promise((resolve,reject)=>{if(!window.indexedDB){reject(new Error('IndexedDB unavailable'));return}const request=indexedDB.open('loomwright-offline-library',1);request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains('library'))request.result.createObjectStore('library')};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error||new Error('Could not open offline storage'))})}
function indexedRead(){return new Promise((resolve,reject)=>{const tx=offlineDb.transaction('library','readonly'),request=tx.objectStore('library').get('projects');request.onsuccess=()=>resolve(request.result||null);request.onerror=()=>reject(request.error)})}
function indexedWrite(record){return new Promise((resolve,reject)=>{if(!offlineDb){resolve();return}const tx=offlineDb.transaction('library','readwrite');tx.objectStore('library').put(record,'projects');tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Offline save failed'))})}
function currentProjectRecord(){return {version:2,activeProjectId,appSettings,projects,savedAt:Date.now()}}
function persistProjectStore(){const record=currentProjectRecord(),hasIndexedDB=!!offlineDb,localRecord=hasIndexedDB?{...record,projects:projects.map(({id,name,createdAt,updatedAt})=>({id,name,createdAt,updatedAt}))}:record;try{localStorage.setItem(PROJECTS_STORAGE_KEY,JSON.stringify(localRecord));localStorage.setItem(ACTIVE_PROJECT_KEY,activeProjectId);if(!hasIndexedDB)localStorage.setItem('loomwright_state',JSON.stringify(state))}catch(e){if(hasIndexedDB)toast('Saved in offline storage; browser backup limit reached.');else toast('Browser storage is full. Export a copy from Finalise.')}if(offlineDb){clearTimeout(offlineSaveTimer);offlineSaveTimer=setTimeout(()=>indexedWrite(record).catch(()=>toast('Offline save needs attention; export a copy from Finalise.')),180)}}
async function initializeOfflineStorage(){
  try{
    offlineDb=await openOfflineDatabase();let localRecord=null;
    try{localRecord=JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY)||'null')}catch(e){}
    const localHasContent=Array.isArray(localRecord?.projects)&&localRecord.projects.some(p=>p.data&&Array.isArray(p.data.sections)),stored=await indexedRead(),useIndexed=stored&&Array.isArray(stored.projects)&&(!localHasContent||(stored.savedAt||0)>(localRecord?.savedAt||0));
    if(useIndexed&&!appSettingsStoredAtBoot&&!appSettingsTouched){const oldActive=stored.projects.find(p=>p.id===(stored.activeProjectId||activeProjectId)),storedSettings=stored.appSettings||oldActive?.data?.settings;if(storedSettings)appSettings=normalizeSettings(storedSettings)}
    let loadedIndexed=false;
    if(useIndexed){projects=stored.projects.filter(p=>p&&p.id).map(p=>({...p,data:normalizeProjectState(p.data)}));if(!projects.length)throw new Error('Offline library is empty');activeProjectId=stored.activeProjectId||projects[0].id;if(!projects.some(p=>p.id===activeProjectId))activeProjectId=projects[0].id;state=projects.find(p=>p.id===activeProjectId).data;loadedIndexed=true}
    offlineStorageReady=true;persistAppSettings();persistProjectStore();if(loadedIndexed)refreshProjectViews();else applyTheme();setSyncStatus('Offline · this device',false);
  }catch(e){offlineDb=null;offlineStorageReady=true;persistAppSettings();persistProjectStore();setSyncStatus('Offline · this browser',false)}
}
state.sections.forEach(s=>{if(s.text!==undefined&&!s.html){s.html=s.text.split(/\n\n+/).map(p=>'<p>'+escapeHtml(p)+'</p>').join('');delete s.text}});
function escapeHtml(value){return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;')}

let dbRef=null,dbSaveTimer=null,introTimer=null;
function setSyncStatus(msg,ok){const el=document.getElementById('sync-status');el.textContent=(ok?'● ':'○ ')+msg}
let deferredInstallPrompt=null;
function setOfflineAppStatus(message){const el=document.getElementById('offline-app-status');if(el)el.textContent=message}
async function offlineCacheCount(){const names=(await caches.keys()).filter(name=>name.startsWith('loomwright-offline-'));let count=0;for(const name of names)count+=(await (await caches.open(name)).keys()).length;return count}
function updateInstallButton(){const button=document.getElementById('install-app');if(button)button.hidden=!deferredInstallPrompt}
async function prepareOfflineApp(){
  if(isLocalPreview()){setOfflineAppStatus('Local preview · refresh this tab after app files change.');return}
  if(!('serviceWorker'in navigator)||!window.isSecureContext){setOfflineAppStatus('To install and open while offline, use Loomwright from a secure website address (https) once. Your browser-saved books still work here.');return}
  const button=document.getElementById('prepare-offline');if(button)button.disabled=true;setOfflineAppStatus('Saving the app files on this device… no manuscript is sent.');
  try{
    const swUrl=new URL('./sw.js',import.meta.url),scopeUrl=new URL('./',import.meta.url),registration=await navigator.serviceWorker.register(swUrl,{scope:scopeUrl.pathname});
    const ready=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('This browser took too long to prepare the offline copy.')) ,45000))]);
    if(registration.installing||registration.waiting||registration.active){}
    const count=await offlineCacheCount();if(count<10)throw new Error('The local app files did not finish saving. Check your connection, then try again.');
    setOfflineAppStatus(`Ready for offline use on this device · ${count} app files saved. Open Loomwright once while connected again after future app updates.`);navigator.serviceWorker.controller?.postMessage({type:'CLIENT_READY'});
  }catch(error){setOfflineAppStatus(error?.message||'Offline preparation could not finish. Try again while connected.');}
  finally{if(button)button.disabled=false}
}
function setupOfflineApp(){
  const prepare=document.getElementById('prepare-offline'),install=document.getElementById('install-app');
  prepare?.addEventListener('click',prepareOfflineApp);
  install?.addEventListener('click',async()=>{if(!deferredInstallPrompt)return;deferredInstallPrompt.prompt();await deferredInstallPrompt.userChoice;deferredInstallPrompt=null;updateInstallButton()});
  window.addEventListener('beforeinstallprompt',event=>{event.preventDefault();deferredInstallPrompt=event;updateInstallButton()});
  window.addEventListener('appinstalled',()=>{deferredInstallPrompt=null;updateInstallButton();setOfflineAppStatus('Loomwright is installed. Use “Prepare offline” once while connected to save all app files.')});
  if(isLocalPreview()){setOfflineAppStatus('Local preview · refresh this tab after app files change.');clearOfflinePreviewCache();return}
  if(!('serviceWorker'in navigator)||!window.isSecureContext){setOfflineAppStatus('Offline installation needs a secure website address. Open Loomwright once while connected, then prepare the offline copy.');return}
  navigator.serviceWorker.register(new URL('./sw.js',import.meta.url),{scope:new URL('./',import.meta.url).pathname}).then(async()=>{await navigator.serviceWorker.ready;const count=await offlineCacheCount();if(count>=10)setOfflineAppStatus(`Offline copy ready · ${count} app files saved on this device.`);else setOfflineAppStatus('The app can be prepared for offline use from this setting.');}).catch(()=>setOfflineAppStatus('Offline preparation could not start. Reopen Loomwright while connected and try again.'));
}
function isLocalPreview(){return ['localhost','127.0.0.1','::1'].includes(location.hostname)}
async function clearOfflinePreviewCache(){
  if(!('serviceWorker'in navigator))return;
  const registrations=await navigator.serviceWorker.getRegistrations();
  await Promise.all(registrations.filter(registration=>new URL(registration.scope).origin===location.origin).map(registration=>registration.unregister()));
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('loomwright-offline-')).map(name=>caches.delete(name)));
}
async function initDB(){
  try{
    if(!ONLINE_SYNC_ENABLED||!window.claude)return;
    dbRef=await claude.use('db');if(!dbRef)return;
    const doc=await dbRef.doc('data/state').get();
    if(doc&&doc.exists&&doc.data&&Array.isArray(doc.data.sections)&&doc.data.sections.length){
      const remoteProject={...doc.data},remoteSettings=remoteProject.settings;delete remoteProject.settings;
      if(remoteSettings&&!appSettingsStoredAtBoot&&!appSettingsTouched){appSettings=normalizeSettings(remoteSettings);persistAppSettings()}
      state=normalizeProjectState({...DEFAULT_STATE,...remoteProject,charNotes:doc.data.charNotes||{},finaliseChecklist:doc.data.finaliseChecklist||{},charIgnore:doc.data.charIgnore||{},charMerge:doc.data.charMerge||{}});
      localStorage.setItem('loomwright_state',JSON.stringify(state));renderSidebar();renderEditor();applyTheme();renderHome();
      if(remoteSettings)await dbRef.doc('data/state').set(state);
    }else{await dbRef.doc('data/state').set(state)}
    setSyncStatus('Synced',true);
  }catch(e){setSyncStatus('Local only',false)}
}
function save(){
  delete state.settings;const project=projects.find(p=>p.id===activeProjectId);if(project){project.data=state;project.updatedAt=new Date().toISOString()}
  persistProjectStore();
  if(ONLINE_SYNC_ENABLED&&dbRef){clearTimeout(dbSaveTimer);dbSaveTimer=setTimeout(async()=>{try{await dbRef.doc('data/state').set(state);setSyncStatus('Synced',true)}catch(e){setSyncStatus('Sync failed',false)}},800)}
}
function persistAppSettings(){try{localStorage.setItem(APP_SETTINGS_KEY,JSON.stringify(appSettings));appSettingsStoredAtBoot=true;return true}catch(e){toast('Appearance settings could not be saved in this browser.');return false}}
function updateAppSetting(key,value){appSettings[key]=value;appSettingsTouched=true;persistAppSettings();persistProjectStore();applyTheme()}
function applyTheme(){
  let resolved=appSettings.theme;
  if(resolved==='auto')resolved=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';
  document.documentElement.setAttribute('data-theme',resolved);document.documentElement.setAttribute('data-palette',appSettings.palette);document.documentElement.setAttribute('data-bg-effect',appSettings.bgEffect||'none');
  const palette=document.getElementById('palette-select'),theme=document.getElementById('theme-select'),bgfx=document.getElementById('bg-effect-select');
  if(palette)palette.value=appSettings.palette;if(theme)theme.value=appSettings.theme;if(bgfx)bgfx.value=appSettings.bgEffect||'none';
}
function textOf(html){
  const d=document.createElement('div');d.innerHTML=sanitizeRichHtml(html);
  d.querySelectorAll('p,div,li,h1,h2,br').forEach(el=>el.insertAdjacentText('afterend','\n'));
  return d.textContent||'';
}
function wc(html){const t=textOf(html).trim();return t?t.split(/\s+/).length:0}
function totalWords(){return state.sections.reduce((n,s)=>n+wc(s.html||''),0)}
function totalCharacters(){return detectCharacters().length}

function switchView(name){
  document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.view===name));
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+name));
  if(name==='home')renderHome();if(name==='projects')renderProjects();if(name==='write')showWriteLibrary();if(name==='metrics')renderMetrics();if(name==='characters')renderCharacters();if(name==='web')renderWeb();if(name==='ai')renderAI();if(name==='finalise')renderFinalise();if(name==='settings')applyTheme();
  window.scrollTo({top:0,behavior:window.matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
document.querySelectorAll('.tab').forEach(t=>t.addEventListener('click',()=>switchView(t.dataset.view)));
document.querySelectorAll('[data-open-view]').forEach(b=>b.addEventListener('click',()=>switchView(b.dataset.openView)));

function renderHome(){
  const words=totalWords(),sections=state.sections.length,characters=totalCharacters();
  document.getElementById('home-word-count').textContent=words.toLocaleString();document.getElementById('home-section-count').textContent=sections.toLocaleString();document.getElementById('home-character-count').textContent=characters.toLocaleString();
  const done=Object.values(state.finaliseChecklist).filter(Boolean).length,total=FINALISE_ITEMS.length,pct=Math.round(done/total*100);
  document.getElementById('home-finalise-progress').style.width=pct+'%';document.getElementById('home-finalise-label').textContent=`${done} of ${total} ready`;
  document.getElementById('totalstats').textContent=words.toLocaleString()+' words';
  const project=projects.find(p=>p.id===activeProjectId);document.getElementById('project-current-name').textContent=project?.name||'Untitled Project';document.getElementById('project-home-count').textContent=`${projects.length} project${projects.length===1?'':'s'} saved on this device`;
}
function renderDocumentList(){
  const list=document.getElementById('document-list');
  if(!list)return;
  list.innerHTML='';
  const count=document.getElementById('write-document-count');
  if(count)count.textContent=`${state.sections.length} ${state.sections.length===1?'document':'documents'}`;
  state.sections.forEach(section=>{
    const item=document.createElement('button');
    item.type='button';
    item.className='document-item'+(String(section.id)===String(state.activeId)?' active':'');
    item.setAttribute('data-id',String(section.id));
    item.innerHTML=`<div class="doc-thumb">${escapeHtml((section.title||'Untitled').trim().slice(0,1).toUpperCase()||'U')}</div><div class="doc-meta"><span class="doc-title">${escapeHtml(section.title||'Untitled')}</span><span class="doc-subtle">${wc(section.html||'')} words</span></div>`;
    item.addEventListener('click',()=>openSection(section.id));
    list.appendChild(item);
  });
}
function showWriteLibrary(){
  document.getElementById('write-library').hidden=false;
  document.getElementById('write-workspace').hidden=true;
  renderDocumentList();
}
function showWriteWorkspace(){
  document.getElementById('write-library').hidden=true;
  document.getElementById('write-workspace').hidden=false;
  renderSidebar();
  renderEditor();
}
function openSection(id){
  const section=state.sections.find(item=>String(item.id)===String(id));
  if(!section)return;
  state.activeId=section.id;
  save();
  showWriteWorkspace();
}
function createBlankDocument(){
  addSection();
  showWriteWorkspace();
  document.getElementById('title-input')?.focus();
}
function getChapterMetrics(){
  const names=detectCharacters().map(([name])=>name);
  return state.sections.map(section=>{
    const text=textOf(section.html||''),words=wc(section.html||''),characterMentions={};
    names.forEach(name=>{
      const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
      const matches=text.match(new RegExp(`\\b${escaped}\\b`,'gi'));
      if(matches)characterMentions[name]=matches.length;
    });
    return {title:section.title||'Untitled',words,pageEstimate:Math.ceil(words/250),characterMentions,characterCount:Object.keys(characterMentions).length};
  });
}
function renderMetrics(){
  const shell=document.getElementById('metrics-shell');
  if(!shell)return;
  const chapters=getChapterMetrics(),totalWords=chapters.reduce((sum,item)=>sum+item.words,0),totalPages=chapters.reduce((sum,item)=>sum+item.pageEstimate,0);
  const maxWords=Math.max(...chapters.map(item=>item.words),0),maxPages=Math.max(...chapters.map(item=>item.pageEstimate),0);
  const avgWords=chapters.length?Math.round(totalWords/chapters.length):0;
  const characters=detectCharacters().slice(0,8),mostActive=characters[0];
  const barRows=(items,max)=>items.map(item=>`<div class="bar-row"><span>${escapeHtml(item.title)}</span><div class="bar-track"><div class="bar-fill" style="width:${Math.max(0,max?item.value/max*100:0)}%"></div></div><span class="bar-value">${item.value}</span></div>`).join('');
  const chapterHeaders=chapters.map(chapter=>`<th scope="col">${escapeHtml(chapter.title)}</th>`).join('');
  const characterRows=characters.map(([name])=>`<tr><th scope="row">${escapeHtml(name)}</th>${chapters.map(chapter=>`<td>${chapter.characterMentions[name]||'—'}</td>`).join('')}</tr>`).join('');
  shell.innerHTML=`<div class="metrics-summary">
      <div class="metric-pill"><span class="label">Drafted</span><span class="value">${totalWords.toLocaleString()}</span><span class="detail">Words</span></div>
      <div class="metric-pill"><span class="label">Layout</span><span class="value">${totalPages}</span><span class="detail">Estimated pages at 250 words per page</span></div>
      <div class="metric-pill"><span class="label">Average</span><span class="value">${avgWords.toLocaleString()}</span><span class="detail">Words per chapter</span></div>
      <div class="metric-pill"><span class="label">Lead</span><span class="value">${mostActive?escapeHtml(mostActive[0]):'—'}</span><span class="detail">${mostActive?`${mostActive[1].count} mentions`:'No active names yet'}</span></div>
    </div>
    <div class="metric-grid">
      <article class="metric-card"><h3>Word count per chapter</h3><div class="bar-chart">${barRows(chapters.map(chapter=>({title:chapter.title,value:chapter.words})),maxWords)}</div></article>
      <article class="metric-card"><h3>Distinct characters per chapter</h3><div class="bar-chart">${barRows(chapters.map(chapter=>({title:chapter.title,value:chapter.characterCount})),Math.max(...chapters.map(chapter=>chapter.characterCount),0))}</div></article>
      <article class="metric-card"><h3>Estimated pages per chapter</h3><div class="bar-chart">${barRows(chapters.map(chapter=>({title:chapter.title,value:chapter.pageEstimate})),maxPages)}</div></article>
      <article class="metric-card"><h3>Character mentions by chapter</h3><div class="metric-table-wrap"><table class="metric-table"><thead><tr><th scope="col">Character</th>${chapterHeaders}</tr></thead><tbody>${characterRows||`<tr><td colspan="${chapters.length+1}">Recurring characters will appear here as your draft develops.</td></tr>`}</tbody></table></div></article>
      <article class="metric-card"><h3>Story rhythm</h3><div class="bar-chart">${barRows([{title:'Longest chapter',value:maxWords},{title:'Sections',value:chapters.length},{title:'Recurring characters',value:characters.length}],Math.max(maxWords,chapters.length,characters.length,1))}</div></article>
    </div>`;
}
function formatProjectDate(value){const date=new Date(value||Date.now());return Number.isNaN(date.getTime())?'Recently edited':date.toLocaleDateString(undefined,{year:'numeric',month:'short',day:'numeric'})}
function renderProjects(){
  const grid=document.getElementById('project-grid');grid.innerHTML='';
  projects.forEach(project=>{
    const card=document.createElement('article');card.className='project-card'+(project.id===activeProjectId?' current':'');
    const title=document.createElement('h3');title.textContent=project.name;card.appendChild(title);
    const meta=document.createElement('div');meta.className='project-card-meta';const projectData=project.data||newProjectState();meta.textContent=`${projectData.sections?.length||0} section${(projectData.sections?.length||0)===1?'':'s'} · ${(projectData.sections||[]).reduce((n,s)=>n+wc(s.html||''),0).toLocaleString()} words · Edited ${formatProjectDate(project.updatedAt)}`;card.appendChild(meta);
    if(project.id===activeProjectId){const badge=document.createElement('span');badge.className='progress-label';badge.textContent='Current project';card.appendChild(badge)}
    const actions=document.createElement('div');actions.className='project-actions';
    const open=document.createElement('button');open.type='button';open.className=project.id===activeProjectId?'primary-button':'secondary-button';open.textContent=project.id===activeProjectId?'Open current':'Open project';open.onclick=()=>activateProject(project.id);actions.appendChild(open);
    const rename=document.createElement('button');rename.type='button';rename.className='secondary-button';rename.textContent='Rename';rename.onclick=()=>renameProject(project.id);actions.appendChild(rename);
    const remove=document.createElement('button');remove.type='button';remove.className='del';remove.textContent='Delete';remove.disabled=projects.length<2;remove.title=projects.length<2?'Keep at least one project':'Delete this project from this browser';remove.onclick=()=>deleteProject(project.id);actions.appendChild(remove);
    card.appendChild(actions);grid.appendChild(card);
  });
  if(!projects.length)grid.innerHTML='<div class="project-empty">No projects yet. Create one above to start a book.</div>';
}
function refreshProjectViews(){renderSidebar();renderEditor();applyTheme();renderHome();renderProjects();renderFinalise()}
function activateProject(id){const project=projects.find(p=>p.id===id);if(!project)return;const changed=id!==activeProjectId;if(changed){save();activeProjectId=id;state=project.data;persistProjectStore();refreshProjectViews()}switchView('write');if(changed)toast('Opened '+project.name+'.')}
function createProject(name){const clean=String(name||'').trim().slice(0,80);if(!clean){toast('Add a name for the project.');return}save();const now=new Date().toISOString(),project={id:newProjectId(),name:clean,createdAt:now,updatedAt:now,data:newProjectState()};projects.unshift(project);activeProjectId=project.id;state=project.data;persistProjectStore();refreshProjectViews();switchView('home');toast('Created '+clean+'.')}
function renameProject(id){const project=projects.find(p=>p.id===id);if(!project)return;const value=window.prompt('Rename this project',project.name);if(value===null)return;const clean=value.trim().slice(0,80);if(!clean){toast('Project name cannot be empty.');return}project.name=clean;project.updatedAt=new Date().toISOString();persistProjectStore();renderProjects();renderHome();renderBookPreview();toast('Project renamed.')}
function deleteProject(id){if(projects.length<2){toast('Keep at least one project in your library.');return}const project=projects.find(p=>p.id===id);if(!project||!window.confirm(`Delete “${project.name}” and its writing from this browser? This cannot be undone.`))return;projects=projects.filter(p=>p.id!==id);if(activeProjectId===id){activeProjectId=projects[0].id;state=projects[0].data}persistProjectStore();refreshProjectViews();switchView('projects');toast('Project deleted from this browser.')}
function renderSidebar(){
  const sel=document.getElementById('section-select');sel.innerHTML='';
  state.sections.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=`${s.title||'Untitled'} (${wc(s.html||'')}w)`;sel.appendChild(o)});
  sel.value=state.activeId;sel.onchange=()=>{state.activeId=Number(sel.value);save();renderEditor();renderDocumentList()};
  document.getElementById('totalstats').textContent=totalWords().toLocaleString()+' words';
  renderDocumentList();
}
function cmd(command,value=null){document.execCommand(command,false,value);document.getElementById('content-editable')?.focus()}
const BOOK_FONTS=[
  {group:'Manuscript standard',fonts:['Times New Roman','Georgia','Garamond','Book Antiqua','Cambria','Courier New','Calibri','Arial']},
  {group:'Book typeset',fonts:['EB Garamond','Libre Baskerville','Lora','Merriweather','Crimson Text','Playfair Display','PT Serif','Bitter']}
];
function setFontSize(px){
  document.execCommand('fontSize',false,'7');
  const editor=document.getElementById('content-editable');
  editor.querySelectorAll('font[size="7"]').forEach(el=>{el.removeAttribute('size');el.style.fontSize=px+'px'});
  editor.focus();
}
function safeLineHeight(value){const n=Number(value);return [1.4,1.6,1.7,1.8,2.2].includes(n)?n:1.7}
function setHighlight(color){document.execCommand('hiliteColor',false,color)||document.execCommand('backColor',false,color);document.getElementById('content-editable')?.focus()}
function setLineSpacing(val){const s=state.sections.find(x=>String(x.id)===String(state.activeId));if(!s)return;s.lineHeight=safeLineHeight(val);save();const el=document.getElementById('content-editable');if(el)el.style.lineHeight=s.lineHeight}
function renderEditor(){
  const s=state.sections.find(x=>String(x.id)===String(state.activeId)),wrap=document.getElementById('editor-wrap');
  if(!s){wrap.innerHTML='<div class="empty">No section selected.</div>';return}
  const fontOptions=BOOK_FONTS.map(g=>`<optgroup label="${g.group}">${g.fonts.map(f=>`<option value="${f}" style="font-family:'${f}'">${f}</option>`).join('')}</optgroup>`).join('');
  wrap.innerHTML=`<input type="text" id="title-input" aria-label="Section title" value="${escapeHtml(s.title||'Untitled')}">
    <div class="toolbar" aria-label="Formatting tools">
      <div class="tb-group">
        <button type="button" data-cmd="undo" title="Undo">↶</button><button type="button" data-cmd="redo" title="Redo">↷</button>
      </div>
      <div class="tb-group">
        <select id="tb-font" class="tb-font-select" aria-label="Font family"><option value="">Font ▾</option>${fontOptions}</select>
        <select id="tb-size" aria-label="Font size"><option value="">Size ▾</option>${[10,11,12,14,16,18,20,24,28,32].map(n=>`<option value="${n}">${n}</option>`).join('')}</select>
      </div>
      <div class="tb-group">
        <button type="button" data-cmd="bold" title="Bold"><b>B</b></button><button type="button" data-cmd="italic" title="Italic"><i>I</i></button><button type="button" data-cmd="underline" title="Underline"><u>U</u></button><button type="button" data-cmd="strikeThrough" title="Strikethrough"><s>S</s></button>
        <button type="button" data-cmd="superscript" title="Superscript">x²</button><button type="button" data-cmd="subscript" title="Subscript">x₂</button>
      </div>
      <div class="tb-group">
        <div class="tb-color-wrap" title="Text color"><div class="tb-color-swatch">A</div><input type="color" id="tb-forecolor" value="#000000"></div>
        <div class="tb-color-wrap" title="Highlight"><div class="tb-color-swatch">🖍</div><input type="color" id="tb-highlight" value="#fff59d"></div>
        <button type="button" data-cmd="removeFormat" title="Clear formatting">Clear</button>
      </div>
      <div class="tb-group">
        <select id="tb-style" aria-label="Paragraph style"><option value="">Style ▾</option><option value="P">Normal</option><option value="H1">Heading 1</option><option value="H2">Heading 2</option><option value="H3">Heading 3</option><option value="BLOCKQUOTE">Quote</option></select>
      </div>
      <div class="tb-group">
        <button type="button" data-cmd="justifyLeft" title="Align left">◧</button><button type="button" data-cmd="justifyCenter" title="Center">▣</button><button type="button" data-cmd="justifyRight" title="Align right">◨</button><button type="button" data-cmd="justifyFull" title="Justify">▦</button>
      </div>
      <div class="tb-group">
        <button type="button" data-cmd="insertUnorderedList" title="Bullet list">• List</button><button type="button" data-cmd="insertOrderedList" title="Numbered list">1. List</button>
        <button type="button" data-cmd="outdent" title="Decrease indent">⇤</button><button type="button" data-cmd="indent" title="Increase indent">⇥</button>
      </div>
      <div class="tb-group">
        <select id="tb-linespacing" aria-label="Line spacing"><option value="1.4">Single</option><option value="1.6">1.15</option><option value="1.8">1.5</option><option value="2.2">Double</option></select>
      </div>
    </div>
    <div contenteditable="true" id="content-editable" role="textbox" aria-multiline="true" aria-label="Manuscript section" style="line-height:${safeLineHeight(s.lineHeight)}">${sanitizeRichHtml(s.html||'<p></p>')}</div>
    <div class="row"><span id="livecount">${wc(s.html||'')} words</span><button class="del" type="button" id="delete-section">Delete section</button></div>`;
  document.getElementById('title-input').oninput=e=>{s.title=e.target.value;save();renderSidebar();renderHome();renderMetrics()};
  const editor=document.getElementById('content-editable');
  editor.onpaste=e=>{e.preventDefault();const html=e.clipboardData?.getData('text/html')||'';const plain=e.clipboardData?.getData('text/plain')||'';const safe=html?sanitizeRichHtml(html):plain.split(/\n{2,}/).map(p=>`<p>${escapeHtml(p).replace(/\n/g,'<br>')}</p>`).join('');document.execCommand('insertHTML',false,safe||'<p></p>');setImportSafetyStatus('Pasted text was cleaned before it was added.','ok')};
  editor.oninput=e=>{s.html=sanitizeRichHtml(e.target.innerHTML);save();document.getElementById('livecount').textContent=wc(s.html)+' words';document.getElementById('totalstats').textContent=totalWords().toLocaleString()+' words';renderHome();renderDocumentList();renderMetrics()};
  renderMetrics();
  wrap.querySelectorAll('.toolbar [data-cmd]').forEach(b=>b.addEventListener('click',()=>cmd(b.dataset.cmd,b.dataset.value||null)));
  document.getElementById('tb-font').onchange=e=>{if(e.target.value)cmd('fontName',e.target.value);e.target.value=''};
  document.getElementById('tb-size').onchange=e=>{if(e.target.value)setFontSize(e.target.value);e.target.value=''};
  document.getElementById('tb-style').onchange=e=>{if(e.target.value)cmd('formatBlock',e.target.value);e.target.value=''};
  document.getElementById('tb-forecolor').oninput=e=>cmd('foreColor',e.target.value);
  document.getElementById('tb-highlight').oninput=e=>setHighlight(e.target.value);
  const lsSelect=document.getElementById('tb-linespacing');lsSelect.value=String(safeLineHeight(s.lineHeight));if(![...lsSelect.options].some(o=>o.value===lsSelect.value))lsSelect.value='1.4';
  lsSelect.onchange=e=>setLineSpacing(e.target.value);
  document.getElementById('delete-section').onclick=()=>delSection(s.id);
}
function addSection(){const id=Date.now();state.sections.push({id,title:'New Section',html:'<p></p>'});state.activeId=id;save();renderSidebar();renderEditor();renderHome();document.getElementById('title-input')?.focus()}
function delSection(id){if(state.sections.length===1){toast("You can’t delete your only section.");return}state.sections=state.sections.filter(s=>s.id!==id);state.activeId=state.sections[0].id;save();renderSidebar();renderEditor();renderHome()}

document.getElementById('add-section').addEventListener('click',addSection);
document.getElementById('create-blank-doc').addEventListener('click',createBlankDocument);
document.getElementById('write-back').addEventListener('click',showWriteLibrary);
document.getElementById('file-input').onchange=async e=>{
  const files=[...e.target.files].slice(0,12);if(e.target.files.length>12)toast('Choose up to 12 files at a time.');let imported=0;
  for(const file of files){try{
    const check=await screenImportFile(file);let html='';const name=file.name.replace(/\.(docx|pdf|txt)$/i,'').slice(0,120);
    if(check.ext==='docx'){if(!mammoth)throw new Error('Word importer unavailable.');const result=await mammoth.convertToHtml({arrayBuffer:check.bytes.buffer},{externalFileAccess:false});html=result.value||'<p></p>';if(result.messages?.some(m=>m.type==='warning'))check.notes.push('The document contains Word features that were skipped during import.')}
    else if(check.ext==='pdf'){
      const pdfTask=pdfjsLib.getDocument({data:check.bytes,cMapUrl:PDF_CMAP_URL,cMapPacked:true,standardFontDataUrl:PDF_STANDARD_FONT_URL,useWorkerFetch:false,useWasm:false,isEvalSupported:false,enableXfa:false});const doc=await pdfTask.promise;
      if(doc.numPages>1500){await pdfTask.destroy();throw new Error('This PDF has more than 1,500 pages. Please split it into smaller parts.')}const paras=[];let charTotal=0;
      try{for(let i=1;i<=doc.numPages;i++){const page=await doc.getPage(i),content=await page.getTextContent(),text=content.items.map(it=>it.str).join(' ');charTotal+=text.length;if(charTotal>3000000)throw new Error('This PDF has too much extracted text for one import. Split it into smaller parts.');paras.push('<p>'+escapeHtml(text)+'</p>')}}finally{await pdfTask.destroy()}
      html=paras.join('');check.notes.push('PDFs are imported as plain text; PDF scripts, links, forms, and attachments are not run or imported.');
    }else html=new TextDecoder('utf-8',{fatal:true}).decode(check.bytes).split(/\n\s*\n+/).map(p=>'<p>'+escapeHtml(p).replace(/\n/g,'<br>')+'</p>').join('');
    html=sanitizeRichHtml(html);const id=Date.now()+Math.floor(Math.random()*1000);state.sections.push({id,title:name,html});state.activeId=id;imported++;
    setImportSafetyStatus(`${file.name}: local checks passed. Unsafe formatting and active links were removed.${check.notes.length?' '+check.notes.join(' '):''}`,check.notes.length?'warning':'ok');
  }catch(err){const message=err?.message||'Could not safely check this file.';setImportSafetyStatus(`${file.name}: not imported. ${message}`,'error');toast('Import stopped: '+message);console.warn('Import safety check stopped a file:',file.name,message)}}
  if(imported){save();renderSidebar();renderEditor();renderHome();showWriteWorkspace();toast(`${imported} file${imported===1?'':'s'} safely imported.`)}e.target.value='';
};

const STOPWORDS=new Set(['The','A','An','I','He','She','They','We','It','You','Us','Them','Its','Your','Yours','Yourself','Our','Ours','Ourselves','Themselves','Himself','Herself','Myself','Someone','Somebody','Something','Somewhere','Somehow','Anyone','Anybody','Anything','Anywhere','Everyone','Everybody','Everything','Everywhere','Nothing','Nobody','Nowhere','None','But','And','Or','Nor','So','Yet','If','When','Then','Than','There','Here','This','That','These','Those','His','Her','Their','Because','Although','Though','While','Since','Unless','Until','After','Before','Above','Below','Between','Among','Beyond','Within','Without','Through','Across','Around','Toward','Towards','During','Despite','Perhaps','Suddenly','Meanwhile','Normally','However','Instead','Otherwise','Still','Also','Even','Just','Now','Soon','Later','Finally','Eventually','Indeed','Certainly','Probably','Maybe','Well','Oh','Ah','Yes','No','Okay','Alright','Sure','Right','Look','Listen','Wait','Stop','Come','Go','Let','Once','Again','Almost','Already','Always','Never','Every','Each','Both','Few','Many','Most','Some','All','Any','Can','Could','Would','Should','Will','Shall','Must','May','Might','Do','Does','Did','Am','Is','Are','Was','Were','Being','Been','Have','Has','Had','Sorry','Please','Thanks','Thank','Hello','Hi','Hey','Goodbye','Bye','Congratulations','Welcome','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday','January','February','March','April','May','June','July','August','September','October','November','December','Chapter','Prologue','Epilogue','Part']);
const COMMON_ENGLISH=new Set(['the','of','and','a','to','in','is','was','he','for','it','with','as','his','on','be','at','by','i','this','had','not','are','but','from','or','have','an','they','which','one','you','were','her','all','she','there','would','their','we','him','been','has','when','who','will','more','no','if','out','so','said','what','up','its','about','into','than','them','can','only','other','new','some','could','time','these','two','may','then','do','first','any','my','now','such','like','our','over','me','even','most','made','after','also','did','many','before','must','through','back','where','much','your','way','well','down','should','because','each','just','those','how','too','little','very','make','still','own','see','work','long','here','get','both','between','know','while','last','might','us','old','year','come','right','used','take']);
function sectionLooksNonEnglish(html){
  const words=(textOf(html).match(/[A-Za-z']+/g)||[]);
  if(words.length<20)return false; // too short to judge fairly — assume English
  let hits=0;words.forEach(w=>{if(COMMON_ENGLISH.has(w.toLowerCase()))hits++});
  return (hits/words.length)<0.08; // English prose is thick with function words; foreign text won't clear this bar
}
function detectCharacters(){
  const nonEnglish=new Set();state.sections.forEach(s=>{if(sectionLooksNonEnglish(s.html||''))nonEnglish.add(s.id)});
  const scanSections=state.sections.filter(s=>!nonEnglish.has(s.id));
  const lowerSeen=new Set();scanSections.forEach(s=>{const plain=textOf(s.html||'').replace(/\n+/g,'. ');(plain.match(/[A-Za-z']+/g)||[]).forEach(w=>{if(/^[a-z][a-z']{2,}$/.test(w))lowerSeen.add(w)})});
  const solo={},bigrams={};scanSections.forEach(s=>{const plain=textOf(s.html||'').replace(/\n+/g,'. '),tokens=plain.match(/[A-Za-z']+|[.!?,;]|["“”:]/g)||[];let atStart=true,prevWord='',prevCand=null;const seenSolo=new Set(),seenBig=new Set();
    tokens.forEach(tok=>{if(tok===','||tok===';'){prevCand=null;return}if(tok==='.'||tok==='!'||tok==='?'||tok==='"'||tok==='“'||tok==='”'||tok===':'){atStart=true;prevCand=null;return}
      const isCand=/^[A-Z][a-z]{2,}$/.test(tok)&&!STOPWORDS.has(tok)&&!lowerSeen.has(tok.toLowerCase());
      if(isCand){if(!solo[tok])solo[tok]={count:0,sections:new Set(),midHits:0,afterDeterminer:0};solo[tok].count++;if(!atStart)solo[tok].midHits++;if(prevWord==='the'||prevWord==='a'||prevWord==='an')solo[tok].afterDeterminer++;seenSolo.add(tok);
        if(prevCand){const key=prevCand+' '+tok;if(!bigrams[key])bigrams[key]={count:0,sections:new Set(),first:prevCand,last:tok};bigrams[key].count++;seenBig.add(key)}
        prevCand=tok
      } else {prevCand=null}
      prevWord=tok.toLowerCase();atStart=false});
    seenSolo.forEach(w=>solo[w].sections.add(s.title||'Untitled'));seenBig.forEach(k=>bigrams[k].sections.add(s.title||'Untitled'));
  });
  const used=new Set(),results=[];
  Object.values(bigrams).forEach(b=>{const fc=solo[b.first]?solo[b.first].count:b.count,lc=solo[b.last]?solo[b.last].count:b.count,total=Math.max(fc+lc-b.count,b.count);if(total<2)return;const sections=new Set(b.sections);if(solo[b.first])solo[b.first].sections.forEach(x=>sections.add(x));if(solo[b.last])solo[b.last].sections.forEach(x=>sections.add(x));results.push([b.first+' '+b.last,{count:total,sections,aliases:[b.first,b.last]}]);used.add(b.first);used.add(b.last)});
  Object.entries(solo).forEach(([w,d])=>{if(used.has(w))return;if(d.count<2||d.midHits<1)return;if(d.afterDeterminer/d.count>.4)return;results.push([w,{count:d.count,sections:d.sections}])});
  const merged=applyCharMerges(results.filter(([n])=>!state.charIgnore?.[n]));
  return merged.sort((a,b)=>b[1].count-a[1].count);
}
function resolveMergeTarget(name,map,seen){seen=seen||new Set();if(seen.has(name))return name;seen.add(name);return map[name]?resolveMergeTarget(map[name],map,seen):name}
function applyCharMerges(results){
  const map=state.charMerge||{};
  if(!Object.keys(map).length)return results;
  const grouped={};
  results.forEach(([name,d])=>{
    const canonical=resolveMergeTarget(name,map);
    if(!grouped[canonical])grouped[canonical]={count:0,sections:new Set(),aliasSet:new Set()};
    grouped[canonical].count+=d.count;
    d.sections.forEach(x=>grouped[canonical].sections.add(x));
    if(name!==canonical)grouped[canonical].aliasSet.add(name);
    (d.aliases||[]).forEach(a=>grouped[canonical].aliasSet.add(a));
  });
  return Object.entries(grouped).map(([name,d])=>[name,{count:d.count,sections:d.sections,aliases:d.aliasSet.size?[...d.aliasSet]:undefined}]);
}
  function ignoreCharacter(name){state.charIgnore=state.charIgnore||{};state.charIgnore[name]=true;save();renderCharacters();renderWeb();renderMetrics()}
  function restoreIgnoredCharacters(){state.charIgnore={};save();renderCharacters();renderWeb();renderMetrics()}
  function mergeCharacter(name,target){if(!target||target===name)return;state.charMerge=state.charMerge||{};state.charMerge[name]=target;save();renderCharacters();renderWeb();renderMetrics()}
function renderCharacters(){
  const grid=document.getElementById('char-grid'),chars=detectCharacters(),hiddenCount=Object.keys(state.charIgnore||{}).length;
  if(!chars.length){grid.innerHTML='<div class="empty">No recurring characters detected yet. Names mentioned two or more times, including away from sentence starts, will appear here.</div>'+(hiddenCount?`<div class="empty"><a href="#" id="restore-hidden-link">Restore ${hiddenCount} hidden entr${hiddenCount===1?'y':'ies'}</a></div>`:'');if(hiddenCount)document.getElementById('restore-hidden-link').onclick=e=>{e.preventDefault();restoreIgnoredCharacters()};return}
  grid.innerHTML='';chars.forEach(([name,d])=>{
    const others=chars.filter(([n])=>n!==name).map(([n])=>n);
    const card=document.createElement('div');card.className='char-card';
    const aliasNote=d.aliases?`<div class="count">Also referred to as: ${d.aliases.map(escapeHtml).join(', ')}</div>`:'';
    const mergeOptions=others.map(n=>`<option value="merge:${encodeURIComponent(n)}">${escapeHtml(n)}</option>`).join('');
    card.innerHTML=`<h3>${escapeHtml(name)}</h3><div class="count">Mentioned ${d.count} times</div>${aliasNote}<textarea aria-label="Notes for ${escapeHtml(name)}" placeholder="Role, notes...">${escapeHtml(state.charNotes[name]||'')}</textarea><div class="chapters">Appears in: ${[...d.sections].map(escapeHtml).join(', ')}</div><select class="char-action-select" aria-label="Actions for ${escapeHtml(name)}"><option value="">Actions ▾</option><option value="__delete">Delete — not a character</option>${others.length?`<optgroup label="Merge into">${mergeOptions}</optgroup>`:''}</select>`;
    card.querySelector('textarea').oninput=e=>{state.charNotes[name]=e.target.value;save()};
    card.querySelector('.char-action-select').onchange=e=>{const val=e.target.value;if(val==='__delete')ignoreCharacter(name);else if(val.startsWith('merge:'))mergeCharacter(name,decodeURIComponent(val.slice(6)));};
    grid.appendChild(card);
  });
  if(hiddenCount){const note=document.createElement('div');note.className='empty';note.innerHTML=`<a href="#" id="restore-hidden-link">Restore ${hiddenCount} hidden entr${hiddenCount===1?'y':'ies'}</a>`;grid.appendChild(note);document.getElementById('restore-hidden-link').onclick=e=>{e.preventDefault();restoreIgnoredCharacters()}}
}
function renderWeb(){
  const svg=document.getElementById('webcanvas'),empty=document.getElementById('web-empty'),selection=document.getElementById('web-selection');
  const characters=detectCharacters(),chapters=state.sections;
  if(!chapters.length){svg.hidden=true;empty.hidden=false;return}
  svg.hidden=false;empty.hidden=characters.length>0;svg.innerHTML='';
  state.webPositions=state.webPositions||{};
  const ns='http://www.w3.org/2000/svg',positions=state.webPositions,width=svg.clientWidth||900;
  const columns=Math.min(Math.max(1,Math.floor((width-24)/190)),Math.max(characters.length,1)),narrowLayout=width<500;
  const rows=Math.ceil(characters.length/columns),characterStartY=narrowLayout?198+chapters.length*82+38:320,height=Math.max(570,characterStartY+rows*88);
  svg.style.height=`${height}px`;
  const spread=(index,count)=>width*(index+1)/(count+1);
  const nodes=[{key:'story-root',type:'story',label:projects.find(project=>project.id===activeProjectId)?.name||'Story',detail:'STORY',width:198,height:58,defaultX:width/2,defaultY:66}];
  chapters.forEach((chapter,index)=>nodes.push({key:`chapter:${chapter.id}`,type:'chapter',label:chapter.title||'Untitled chapter',detail:`${wc(chapter.html||'').toLocaleString()} words`,width:174,height:54,defaultX:narrowLayout?width/2:spread(index,chapters.length),defaultY:narrowLayout?198+index*82:198,section:chapter}));
  characters.forEach(([name,data],index)=>{
    const row=Math.floor(index/columns),column=index%columns,count=Math.min(columns,characters.length-row*columns);
    nodes.push({key:`character:${name}`,type:'character',label:name,detail:`${data.count} mentions`,width:154,height:48,defaultX:spread(column,count),defaultY:characterStartY+row*88,character:data});
  });
  nodes.forEach(node=>{
    const saved=positions[node.key],sameLayout=saved&&saved.columns===columns,halfWidth=node.width/2;
    node.x=sameLayout?Math.min(width-halfWidth-6,Math.max(halfWidth+6,Number(saved.x)||node.defaultX)):node.defaultX;
    node.y=sameLayout?Math.min(height-node.height/2-8,Math.max(node.height/2+8,Number(saved.y)||node.defaultY)):node.defaultY;
  });
  const byKey=new Map(nodes.map(node=>[node.key,node])),connections=[];
  chapters.forEach(chapter=>connections.push([byKey.get('story-root'),byKey.get(`chapter:${chapter.id}`)]));
  characters.forEach(([name,data])=>chapters.forEach(chapter=>{if(data.sections.has(chapter.title||'Untitled'))connections.push([byKey.get(`chapter:${chapter.id}`),byKey.get(`character:${name}`)])}));
  const edgeLayer=document.createElementNS(ns,'g');
  connections.forEach(([from,to])=>{const line=document.createElementNS(ns,'line');line.setAttribute('x1',from.x);line.setAttribute('y1',from.y);line.setAttribute('x2',to.x);line.setAttribute('y2',to.y);line.setAttribute('stroke','var(--line)');line.setAttribute('stroke-width','1.5');line.dataset.from=from.key;line.dataset.to=to.key;edgeLayer.appendChild(line)});
  svg.appendChild(edgeLayer);
  const nodeLayer=document.createElementNS(ns,'g');
  nodes.forEach(node=>{
    const group=document.createElementNS(ns,'g'),rect=document.createElementNS(ns,'rect'),label=document.createElementNS(ns,'text'),detail=document.createElementNS(ns,'text');
    group.style.cursor='grab';group.setAttribute('role','button');group.setAttribute('tabindex','0');group.setAttribute('aria-label',`${node.type}: ${node.label}, ${node.detail}`);
    group.dataset.key=node.key;
    rect.setAttribute('x',node.x-node.width/2);rect.setAttribute('y',node.y-node.height/2);rect.setAttribute('width',node.width);rect.setAttribute('height',node.height);rect.setAttribute('rx',node.type==='character'?'9':'12');
    rect.setAttribute('fill',node.type==='story'?'var(--accent)':node.type==='chapter'?'var(--card-strong)':'var(--panel)');rect.setAttribute('stroke',node.type==='story'?'var(--accent)':node.type==='chapter'?'var(--accent2)':'var(--line)');rect.setAttribute('stroke-width',node.type==='character'?'1':'1.5');
    label.setAttribute('x',node.x);label.setAttribute('y',node.y-2);label.setAttribute('text-anchor','middle');label.setAttribute('font-size',node.type==='story'?'14':'12');label.setAttribute('font-weight','600');label.setAttribute('fill',node.type==='story'?'var(--primary-text)':'var(--ink)');label.setAttribute('font-family','sans-serif');label.textContent=node.label.length>21?node.label.slice(0,19)+'…':node.label;
    detail.setAttribute('x',node.x);detail.setAttribute('y',node.y+14);detail.setAttribute('text-anchor','middle');detail.setAttribute('font-size','9');detail.setAttribute('fill',node.type==='story'?'var(--primary-text)':'var(--sub)');detail.setAttribute('font-family','sans-serif');detail.textContent=node.detail;
    group.append(rect,label,detail);
    let dragging=false;
    const selectNode=()=>{if(!selection)return;selection.textContent=node.type==='character'?`${node.label} · ${node.detail} · Appears in ${[...node.character.sections].join(', ')}`:node.type==='chapter'?`${node.label} · ${node.detail}`:`${node.label} · manuscript root`};
    group.addEventListener('click',selectNode);group.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();selectNode()}});
    group.addEventListener('pointerdown',event=>{dragging=true;group.setPointerCapture(event.pointerId);group.style.cursor='grabbing';event.preventDefault()});
    group.addEventListener('pointermove',event=>{
      if(!dragging)return;
      const bounds=svg.getBoundingClientRect();node.x=Math.min(bounds.width-node.width/2-6,Math.max(node.width/2+6,event.clientX-bounds.left));node.y=Math.min(height-node.height/2-8,Math.max(node.height/2+8,event.clientY-bounds.top));
      positions[node.key]={x:node.x,y:node.y,columns};rect.setAttribute('x',node.x-node.width/2);rect.setAttribute('y',node.y-node.height/2);label.setAttribute('x',node.x);label.setAttribute('y',node.y-2);detail.setAttribute('x',node.x);detail.setAttribute('y',node.y+14);
      edgeLayer.querySelectorAll('line').forEach(line=>{if(line.dataset.from===node.key){line.setAttribute('x1',node.x);line.setAttribute('y1',node.y)}if(line.dataset.to===node.key){line.setAttribute('x2',node.x);line.setAttribute('y2',node.y)}});
    });
    group.addEventListener('pointerup',()=>{dragging=false;group.style.cursor='grab';save()});group.addEventListener('pointercancel',()=>{dragging=false;group.style.cursor='grab';save()});
    nodeLayer.appendChild(group);
  });
  svg.appendChild(nodeLayer);
  if(selection)selection.textContent='Drag nodes to arrange the story, chapters, and characters. Select a node for details.';
}
function renderAI(){const sel=document.getElementById('ai-section');sel.innerHTML='';state.sections.forEach(s=>{const o=document.createElement('option');o.value=s.id;o.textContent=s.title||'Untitled';sel.appendChild(o)});sel.value=state.activeId}
async function copyPrompt(){const s=state.sections.find(x=>String(x.id)===String(document.getElementById('ai-section').value)),tpl=document.getElementById('ai-template').value,prompt=tpl.replace('{{TEXT}}',s?textOf(s.html):'');try{await navigator.clipboard.writeText(prompt);toast('Prompt copied. Paste it into Claude or ChatGPT.')}catch(e){toast('Clipboard unavailable—select and copy the prompt manually.')}}
function insertResponse(){const resp=document.getElementById('ai-response').value,s=state.sections.find(x=>String(x.id)===String(state.activeId));if(!s||!resp.trim()){toast('Nothing to insert.');return}s.html=(s.html||'')+'<p>'+escapeHtml(resp)+'</p>';save();renderEditor();renderSidebar();renderHome();toast('Added to '+(s.title||'your section')+'.')}
document.getElementById('copy-prompt').addEventListener('click',copyPrompt);document.getElementById('insert-response').addEventListener('click',insertResponse);

const FINALISE_ITEMS=[
  {id:'section-order',title:'Sections are titled and in the intended order.',hint:'Review your section list and confirm the sequence reads the way you want.'},
  {id:'character-pass',title:'Character names and appearances have had a continuity pass.',hint:'Use Characters and Story Web to catch details worth a second look.'},
  {id:'story-pass',title:'The story threads and ending have been reviewed.',hint:'Check that the ideas you set up have the landing you intended.'},
  {id:'proofread',title:'Spelling, punctuation, and dialogue have had a final read.',hint:'A slow read aloud can reveal small issues that a quick skim misses.'},
  {id:'backup',title:'I have saved a copy somewhere safe.',hint:'Export a plain-text or formatted copy below before you share or publish.'}
];
function renderFinalise(){
  const list=document.getElementById('finalise-checklist');list.innerHTML='';FINALISE_ITEMS.forEach(item=>{const label=document.createElement('label');label.className='check-item';const input=document.createElement('input');input.type='checkbox';input.checked=!!state.finaliseChecklist[item.id];input.setAttribute('aria-label',item.title);const copy=document.createElement('span');copy.className='check-copy';copy.innerHTML=`<strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.hint)}</small>`;input.addEventListener('change',()=>{state.finaliseChecklist[item.id]=input.checked;save();updateFinaliseProgress();renderHome()});label.append(input,copy);list.appendChild(label)});
  document.getElementById('final-word-count').textContent=totalWords().toLocaleString();document.getElementById('final-section-count').textContent=state.sections.length.toLocaleString();document.getElementById('final-character-count').textContent=totalCharacters().toLocaleString();updateFinaliseProgress();renderBookDesigner();
}
function updateFinaliseProgress(){const done=FINALISE_ITEMS.filter(x=>state.finaliseChecklist[x.id]).length,pct=Math.round(done/FINALISE_ITEMS.length*100);document.getElementById('finalise-count').textContent=`${done} of ${FINALISE_ITEMS.length} complete`;document.getElementById('finalise-progress').style.width=pct+'%'}
function validCoverArt(data){return typeof data==='string'&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(data)?data:''}
async function encodeCoverArt(file){if(!file||!/^image\/(jpeg|png|webp)$/.test(file.type))throw new Error('Choose a JPG, PNG, or WebP image.');if(file.size>20*1024*1024)throw new Error('Choose an image under 20 MB.');const bitmap=await createImageBitmap(file),scale=Math.min(1,1600/bitmap.width,2200/bitmap.height,Math.sqrt(6000000/(bitmap.width*bitmap.height))),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close?.();const result=canvas.toDataURL('image/jpeg',.82);if(result.length>3*1024*1024)throw new Error('The compressed artwork is too large to store offline. Try a smaller image.');return result}
async function handleCoverArtUpload(file){if(!file)return;const note=document.getElementById('cover-art-note');note.textContent='Preparing cover art…';try{state.book.coverArt=await encodeCoverArt(file);state.book.coverArtName=file.name.slice(0,120);save();renderBookPreview();document.getElementById('remove-cover-art').disabled=false;note.textContent=`${file.name.slice(0,65)} · resized for offline storage`;toast('Cover art added to this project.')}catch(error){note.textContent=error.message||'Could not read that image.';toast(error.message||'Could not add cover art.')}finally{document.getElementById('cover-art-input').value=''}}
function removeCoverArt(){delete state.book.coverArt;delete state.book.coverArtName;save();renderBookDesigner();toast('Cover art removed.')}
function renderBookDesigner(){
  const book=state.book||(state.book={...DEFAULT_BOOK});
  document.getElementById('book-title').value=book.title||'';document.getElementById('book-subtitle').value=book.subtitle||'';document.getElementById('book-author').value=book.author||'';document.getElementById('book-cover-style').value=book.coverStyle||'botanical';document.getElementById('book-trim').value=book.trim||'trade';document.getElementById('book-font').value=book.font||'serif';document.getElementById('book-dedication').value=book.dedication||'';document.getElementById('book-include-toc').checked=book.includeToc!==false;document.getElementById('book-include-copyright').checked=book.includeCopyright!==false;document.getElementById('remove-cover-art').disabled=!validCoverArt(book.coverArt);document.getElementById('cover-art-note').textContent=book.coverArtName?`${book.coverArtName} · resized for offline storage`:'JPG, PNG, or WebP · resized and stored with this offline project.';renderBookPreview();
}
function updateBookSetting(key,value){state.book[key]=value;save();renderBookPreview()}
function renderBookPreview(){
  const target=document.getElementById('book-preview-pages');if(!target)return;const book=state.book||DEFAULT_BOOK,project=projects.find(p=>p.id===activeProjectId),title=book.title?.trim()||project?.name||'Untitled Book',author=book.author?.trim()||'Author name',subtitle=book.subtitle?.trim(),cover=['botanical','minimal','classic'].includes(book.coverStyle)?book.coverStyle:'botanical';
  const coverArt=validCoverArt(book.coverArt),pages=[`<article class="book-page book-cover-page cover-${cover}${coverArt?' has-cover-art':''}">${coverArt?`<img class="book-cover-art-preview" src="${coverArt}" alt="Uploaded cover artwork">`:''}<span class="book-page-label">${escapeHtml(cover==='botanical'?'A Loomwright edition':cover==='minimal'?'Title page':'Collected work')}</span><h3>${escapeHtml(title)}</h3>${subtitle?`<p class="book-cover-subtitle">${escapeHtml(subtitle)}</p>`:''}<span class="book-cover-author">${escapeHtml(author)}</span></article>`];
  if(book.includeCopyright!==false)pages.push(`<article class="book-page"><span class="book-page-label">Copyright</span><h3>${escapeHtml(title)}</h3><p>Copyright © ${new Date().getFullYear()} ${escapeHtml(author)}</p><p>All rights reserved.</p><p class="book-preview-note">Publication details can be added when the final edition is prepared.</p></article>`);
  if(book.dedication?.trim())pages.push(`<article class="book-page"><span class="book-page-label">Dedication</span><div style="min-height:190px;display:grid;place-items:center;text-align:center;font-style:italic">${escapeHtml(book.dedication).replace(/\n/g,'<br>')}</div></article>`);
  if(book.includeToc!==false)pages.push(`<article class="book-page book-toc-page ${book.trim==='trade'?'book-toc-clean':''}"><span class="book-page-label">Contents</span><h3>Contents</h3><div class="book-toc-list">${state.sections.map(s=>`<div class="book-toc-row"><span>${escapeHtml(s.title||'Untitled')}</span><span class="leader"></span></div>`).join('')}</div></article>`);
  const first=state.sections[0],excerpt=first?textOf(first.html||'').trim():'Your manuscript begins here.';const sample=excerpt.slice(0,380);
  pages.push(`<article class="book-page book-sample-page"><span class="book-page-label">Opening pages</span><h3>${escapeHtml(first?.title||'Your manuscript')}</h3>${sample?`<div class="sample-copy">${escapeHtml(sample).replace(/\n/g,'<br>')}${excerpt.length>380?'…':''}</div>`:'<p>Your opening chapter will appear here.</p>'}</article>`);
  target.innerHTML=pages.join('');target.dataset.trim=book.trim||'trade';target.dataset.font=book.font||'serif';
}
function bindBookDesigner(){
  [['book-title','title'],['book-subtitle','subtitle'],['book-author','author'],['book-dedication','dedication']].forEach(([id,key])=>document.getElementById(id).addEventListener('input',e=>updateBookSetting(key,e.target.value)));
  [['book-cover-style','coverStyle'],['book-trim','trim'],['book-font','font']].forEach(([id,key])=>document.getElementById(id).addEventListener('change',e=>updateBookSetting(key,e.target.value)));
  [['book-include-toc','includeToc'],['book-include-copyright','includeCopyright']].forEach(([id,key])=>document.getElementById(id).addEventListener('change',e=>updateBookSetting(key,e.target.checked)));
  document.getElementById('cover-art-input').addEventListener('change',e=>handleCoverArtUpload(e.target.files?.[0]));document.getElementById('remove-cover-art').addEventListener('click',removeCoverArt);
  document.getElementById('book-reset').addEventListener('click',()=>{state.book={...DEFAULT_BOOK};save();renderBookDesigner();toast('Book design reset.')});
}
const buildHtmlExportWithoutCoverArt=buildHtmlExport;
buildHtmlExport=function(){let doc=buildHtmlExportWithoutCoverArt();const book=state.book||DEFAULT_BOOK,subtitle=book.subtitle?.trim(),art=validCoverArt(book.coverArt);if(subtitle)doc=doc.replace(`<p>${subtitle}</p>`,`<p>${escapeHtml(subtitle)}</p>`);if(!art)return doc;return doc.replace('<style>','<style>.book-cover{position:relative;isolation:isolate;overflow:hidden}.book-cover-art{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:-1}.book-cover.has-cover-art{background:transparent!important}.book-cover.has-cover-art:after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,#ffffff20 0%,#ffffffe0 48%,#fffffff2 100%);z-index:-1}\n').replace(/(<section class="book-cover [^"]+">)/,`$1<img class="book-cover-art" src="${art}" alt="Uploaded cover artwork">`)};
function downloadFile(filename,content,type){const blob=new Blob([content],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
function fileBase(){const project=projects.find(p=>p.id===activeProjectId);return (state.book?.title||project?.name||'loomwright-manuscript').replace(/[^a-z0-9-_]+/gi,'-').replace(/^-|-$/g,'').toLowerCase()||'loomwright-manuscript'}
function exportText(){const content=state.sections.map(s=>`${s.title||'Untitled'}\n${'='.repeat(Math.min(40,(s.title||'Untitled').length))}\n\n${textOf(s.html||'').trim()}`).join('\n\n\n');downloadFile(fileBase()+'.txt',content,'text/plain;charset=utf-8');toast('Plain-text copy downloaded.')}
function buildHtmlExport(){const book=state.book||DEFAULT_BOOK,project=projects.find(p=>p.id===activeProjectId),title=book.title?.trim()||project?.name||'Loomwright manuscript',author=book.author?.trim()||'',sections=state.sections.map((s,i)=>`<section class="chapter" id="section-${i+1}"><h1>${escapeHtml(s.title||'Untitled')}</h1>${sanitizeRichHtml(s.html||'<p></p>')}</section>`).join('\n'),copyright=book.includeCopyright!==false?`<section class="front-page copyright"><h1>${escapeHtml(title)}</h1><p>Copyright © ${new Date().getFullYear()} ${escapeHtml(author)}</p><p>All rights reserved.</p></section>`:'',dedication=book.dedication?.trim()?`<section class="front-page dedication"><p>${escapeHtml(book.dedication).replace(/\n/g,'<br>')}</p></section>`:'',toc=book.includeToc!==false?`<section class="front-page contents"><h1>Contents</h1><ol>${state.sections.map((s,i)=>`<li><a href="#section-${i+1}">${escapeHtml(s.title||'Untitled')}</a></li>`).join('')}</ol></section>`:'',font=book.font==='sans'?'Arial, sans-serif':book.font==='classic'?"'Palatino Linotype', Palatino, Georgia, serif":"Georgia, 'Iowan Old Style', serif",trim=book.trim==='a5'?'5.8in 8.3in':book.trim==='letter'?'8.5in 11in':'5in 8in',coverClass=['botanical','minimal','classic'].includes(book.coverStyle)?book.coverStyle:'botanical',cover=`<section class="book-cover ${coverClass}"><small>${coverClass==='classic'?'A collected work':'LOOMWRIGHT EDITION'}</small><h1>${escapeHtml(title)}</h1>${book.subtitle?`<p>${escapeHtml(book.subtitle)}</p>`:''}<footer>${escapeHtml(author)}</footer></section>`,doc=`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title><style>@page{size:${trim};margin:.75in}*{box-sizing:border-box}body{max-width:6in;margin:3rem auto;padding:0 1rem;font:18px/1.75 ${font};color:#26362d}.book-cover{min-height:85vh;display:flex;flex-direction:column;justify-content:center;text-align:center;page-break-after:always;padding:2rem;border:1px solid #91a997}.book-cover small,.book-cover footer{font: .8rem Arial,sans-serif;letter-spacing:.1em;text-transform:uppercase;color:#596b5e}.book-cover h1{font:normal 2.3rem/1.2 ${font};margin:auto 0 1rem}.book-cover p{font:1rem/1.5 Arial,sans-serif;color:#64766a;margin:0 0 4rem}.book-cover footer{margin-top:auto}.book-cover.minimal{border-top:8px solid #91a997}.book-cover.classic{background:#f5f1e8;border:4px double #aeb8a9}.front-page{min-height:80vh;page-break-after:always;display:flex;flex-direction:column;justify-content:center}.copyright{font:14px/1.6 Arial,sans-serif;color:#596b5e}.dedication{text-align:center;font-style:italic}.contents h1,.chapter h1{font-size:1.5rem;font-weight:normal}.contents ol{padding-left:1.5rem}.contents li{margin:.5rem 0}.contents a{color:inherit;text-decoration:none}.chapter{page-break-before:always;margin:0 0 4rem}.chapter h1{margin:0 0 1.5rem}</style></head><body>${cover}${copyright}${dedication}${toc}${sections}</body></html>`;return doc}
function exportHtml(){downloadFile(fileBase()+'.html',buildHtmlExport(),'text/html;charset=utf-8');toast('Formatted book copy downloaded.')}
document.getElementById('export-txt').addEventListener('click',exportText);document.getElementById('export-html').addEventListener('click',exportHtml);

function toast(msg){const t=document.getElementById('toast');t.textContent=msg;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),2600)}
function revealApp(){clearTimeout(introTimer);const splash=document.getElementById('splash'),shell=document.getElementById('app-shell');splash.classList.add('leaving');shell.classList.add('is-ready');setTimeout(()=>{splash.hidden=true},360)}
function playIntro(){const splash=document.getElementById('splash'),shell=document.getElementById('app-shell');splash.hidden=false;splash.classList.remove('leaving');shell.classList.remove('is-ready');const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;introTimer=setTimeout(revealApp,reduced?220:1380)}
document.getElementById('skip-intro').addEventListener('click',revealApp);document.getElementById('replay-intro').addEventListener('click',()=>{switchView('home');playIntro()});
document.getElementById('palette-select').addEventListener('change',e=>updateAppSetting('palette',e.target.value));document.getElementById('theme-select').addEventListener('change',e=>updateAppSetting('theme',e.target.value));document.getElementById('bg-effect-select').addEventListener('change',e=>updateAppSetting('bgEffect',e.target.value));
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(appSettings.theme==='auto')applyTheme()});
document.getElementById('project-create-form').addEventListener('submit',e=>{e.preventDefault();const input=document.getElementById('new-project-name');createProject(input.value);input.value=''});
bindBookDesigner();
renderSidebar();renderEditor();applyTheme();renderHome();renderProjects();initializeOfflineStorage();setupOfflineApp();playIntro();
