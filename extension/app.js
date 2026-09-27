/* QuokMark: native bookmark popup. */
const native = true;
const $ = (id) => document.getElementById(id);
const app=document.querySelector('.app'), list = $('list'), search = $('search');
const startupStatus=$('startup-status');
const domReady=document.readyState==='loading'?new Promise(resolve=>document.addEventListener('DOMContentLoaded',resolve,{once:true})):Promise.resolve();
let roots=[], rows=[], collapsed={}, selected='', mode='nav', query='', hints=new Map(), prefix='', pendingG=false, directoryScroll=0;
let hintViewport=null;
let searchCollapsed={}, searchFolderIds=[], pendingZ=false, pendingY=false;
const isCollapsed=id=>Boolean((query?searchCollapsed:collapsed)[id]);
let verticalLeft=null;
let selectedElement=null;
const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
let finishFolderMotion=()=>{};
reducedMotion.addEventListener('change',()=>finishFolderMotion());
document.addEventListener('keydown',event=>{
  if(app.inert){
    event.preventDefault();event.stopImmediatePropagation();
    if(event.key==='Escape')window.close();
    return;
  }
  if(!['Shift','Control','Alt','Meta'].includes(event.key))tipPrefersPointer=false;
  const node=rows.find(x=>x.node.id===selected)?.node;
  const toggles=mode==='nav' && node && folder(node) &&
    ((!isCollapsed(node.id) && ['h','ArrowLeft'].includes(event.key)) || (isCollapsed(node.id) && ['l','ArrowRight'].includes(event.key)));
  if(!toggles)finishFolderMotion();
},true);
document.addEventListener('pointerdown',()=>{pendingY=false;if(pendingZ){pendingZ=false;message();}},true);
list.addEventListener('pointerdown',event=>{if(!event.target.closest('.folderTitle'))finishFolderMotion();});
const folder = (node) => !node.url;
const walk = (nodes, depth=0, all=false) => nodes.flatMap(node => [{node,depth}, ...((folder(node) && (all || !isCollapsed(node.id))) ? walk(node.children || [],depth+1,all) : [])]);
const message = (text='') => { $('message').textContent=text; };
function status(){
  const searching=mode==='edit' || Boolean(query);
  document.querySelector('.app').classList.toggle('searching',searching);
  $('mode').textContent={nav:t('导航 NORMAL'),edit:t('搜索 INSERT'),results:t('搜索结果 NORMAL'),hints:t('选择 HINTS')}[mode];
  $('count').textContent=t('{count} 个书签',{count:rows.filter(x=>!folder(x.node)).length});
}
function save(deferred=false){
  clearTimeout(saveTimer);
  if(deferred){saveTimer=setTimeout(()=>save(),120);return;}
  saveTimer=0;
  const state={collapsed:{...collapsed},scroll:directoryScroll,selected};
  const serialized=JSON.stringify(state);
  if(serialized===lastSavedState)return;
  lastSavedState=serialized;
  chrome.storage.local.set({linkcoveState:state}).catch(()=>{
    if(lastSavedState===serialized)lastSavedState='';
    message(t('操作失败：')+'Storage unavailable');
  });
}
let saveTimer=0,lastSavedState='';
window.addEventListener('pagehide',()=>{if(!app.inert)save();});
function makeItem(node, label=node.title, items=rows){
  items.push({node,depth:0});
  const bookmarkName=node.title || t('未命名');
  const previous=folder(node)?null:document.getElementById(`item-${node.id}`);
  if(previous?.matches('.row.bookmark') && previous.bookmarkUrl===node.url && previous.querySelector('p')?.textContent===bookmarkName){
    previous.classList.toggle('selected',node.id===selected);
    const active=String(node.id===selected);
    if(previous.getAttribute('aria-selected')!==active)previous.setAttribute('aria-selected',active);
    return previous;
  }
  const row=document.createElement(folder(node)?'h2':'div');
  row.className=folder(node)?`row folder folderTitle collapsible-folder ${isCollapsed(node.id)?'collapsed':'expanded'}`:'row bookmark';
  if(node.id===selected)row.classList.add('selected');
  row.dataset.id=node.id; row.id=`item-${node.id}`;
  row.setAttribute('role','option');
  row.setAttribute('aria-selected',String(node.id===selected));
  if(folder(node)) row.setAttribute('aria-expanded',String(!isCollapsed(node.id)));
  if(folder(node)) row.title=label;
  if(folder(node)){
    const name=document.createElement('span');name.className='folder-label';name.textContent=label;
    const arrow=document.createElement('span');arrow.className='folder-arrow';row.append(name,arrow);
  }else{
    row.bookmarkUrl=node.url;
    const icon=document.createElement('img');icon.className='favicon';icon.width=18;icon.height=18;icon.alt='';icon.loading='lazy';icon.decoding='async';
    const url=new URL(chrome.runtime.getURL('/_favicon/'));url.searchParams.set('pageUrl',node.url);url.searchParams.set('size','32');
    icon.dataset.src=url.href;
    icon.onload=()=>{icon.classList.add('favicon-loaded');if(tipTarget===row)showBookmarkTip(row);};
    icon.onerror=()=>{icon.onerror=null;icon.src='icons/default.svg';};
    const name=document.createElement('p');name.textContent=bookmarkName;row.append(icon,name);
    row.onmouseenter=()=>{if(tipPrefersPointer)showBookmarkTip(row);};
    row.onmousemove=event=>{if(event.movementX || event.movementY){tipPrefersPointer=true;showBookmarkTip(row);}};
    row.onmouseleave=()=>{if(tipPrefersPointer)showBookmarkTip(list.querySelector('.bookmark.selected'));};
  }
  row.oncontextmenu=event=>{event.preventDefault();openItemMenu(node.id,event.clientX,event.clientY);};
  row.onclick=()=>{if(mode==='hints')cancelHints();selected=node.id;if(folder(node))toggle(node);else openBookmark(node);};
  return row;
}
function appendGroups(nodes,parent,path=[],items=rows){
  nodes.filter(node=>node.url).forEach(node=>parent.append(makeItem(node,node.title,items)));
  for(const node of nodes.filter(node=>folder(node))){
    const group=document.createElement('section');group.className='folder';
    const currentPath=[...path,node.title];
    group.bookmarkPath=currentPath;
    const hasBookmarks=query
      ? node.title.toLocaleLowerCase().includes(query.toLocaleLowerCase()) || node.children.some(child=>child.url)
      : !roots.some(root=>root.id===node.id) || node.children.some(child=>child.url);
    if(hasBookmarks) group.append(makeItem(node,(currentPath.length>1?currentPath.slice(1):currentPath).filter(Boolean).join(' / '),items));
    const children=document.createElement('div');children.className='childContainer';
    if(!hasBookmarks || !isCollapsed(node.id)) appendGroups(node.children,children,currentPath,items);
    group.append(children);parent.append(group);
  }
}
let searchRenderKey='';
function render(){
  finishFolderMotion();
  verticalLeft=null;
  const scroll=list.scrollTop;
  let nodes=roots, nextSearchKey='';
  if(query){
    const term=query.toLocaleLowerCase();
    function matchingNodes(nodes){
      return nodes.flatMap(node=>{
        if(node.title.toLocaleLowerCase().includes(term)) return [node];
        if(!folder(node)) return [];
        const children=matchingNodes(node.children || []);
        return children.length?[{...node,children}]:[];
      });
    }
    nodes=matchingNodes(roots);
    const folders=walk(nodes,0,true).filter(x=>folder(x.node));
    searchFolderIds=folders.map(x=>x.node.id);
    // Different queries can produce the same tree; avoid moving every row again.
    nextSearchKey=JSON.stringify([nodes,searchCollapsed,folders.filter(x=>x.node.title.toLocaleLowerCase().includes(term)).map(x=>x.node.id),language]);
    if(nextSearchKey===searchRenderKey){syncSelection(false);status();return;}
  }
  rows=[];
  const content=document.createDocumentFragment();
  const grid=document.createElement('div');grid.className='childContainer';content.append(grid);
  appendGroups(nodes,grid);
  if(!rows.some(x=>x.node.id===selected)) selected=rows[0]?.node.id || '';
  if(!rows.length){const empty=document.createElement('div');empty.className='empty';empty.textContent=query?t('没有匹配的书签'):t('还没有书签');content.append(empty);}
  list.replaceChildren(content);
  searchRenderKey=nextSearchKey;
  list.scrollTop=scroll;
  syncSelection(false); status();
  if(!app.inert)loadNearbyIcons();
}
let tipFrame=0, tipTarget=null, tipPrefersPointer=true;
function showBookmarkTip(row,immediate=false){
  tipTarget=row;
  if(tipFrame && !immediate)return;
  const update=()=>{
    tipFrame=0;
    // The latest input method owns the tooltip; passive refreshes do not change it.
    const row=tipTarget && ((tipPrefersPointer && list.querySelector('.bookmark:hover')) || tipTarget);
    const tip=$('bookmark-tip'), name=row?.querySelector('p');
    const blocked=(typeof managementOpen==='function' && managementOpen()) || $('shortcut-help').open || mode==='hints' || mode==='edit';
    let visible=false;
    if(row?.isConnected && name && !blocked && name.scrollWidth>name.clientWidth){
      const bounds=list.getBoundingClientRect(), rect=row.getBoundingClientRect();
      visible=rect.bottom>bounds.top && rect.top<bounds.bottom;
    }
    const previous=list.querySelector('[aria-describedby="bookmark-tip"]');
    if(previous && (!visible || previous!==row))previous.removeAttribute('aria-describedby');
    if(!visible){if(!tip.hidden)tip.hidden=true;return;}
    if(tip.textContent!==name.textContent){tip.textContent=name.textContent;tip.scrollLeft=0;}
    if(tip.hidden)tip.hidden=false;
    if(row.getAttribute('aria-describedby')!=='bookmark-tip')row.setAttribute('aria-describedby','bookmark-tip');
  };
  if(immediate){if(tipFrame)cancelAnimationFrame(tipFrame);update();}
  else tipFrame=requestAnimationFrame(update);
}
function syncSelection(scroll=true, immediate=false){
  const next=selected?document.getElementById(`item-${selected}`):null;
  if(selectedElement!==next){
    if(selectedElement?.isConnected){selectedElement.classList.remove('selected');selectedElement.setAttribute('aria-selected','false');}
    if(next){next.classList.add('selected');next.setAttribute('aria-selected','true');}
    selectedElement=next;
  }
  if(next && scroll)next.scrollIntoView({block:'nearest',behavior:immediate || reducedMotion.matches?'instant':'smooth'});
  if(selected) list.setAttribute('aria-activedescendant',`item-${selected}`); else list.removeAttribute('aria-activedescendant');
  showBookmarkTip(list.querySelector('.bookmark.selected'));
  if(!app.inert)save(true);
}
function move(delta, immediate=false){verticalLeft=null;const index=rows.findIndex(x=>x.node.id===selected);selected=rows[Math.max(0,Math.min(rows.length-1,index+delta))]?.node.id || '';syncSelection(true,immediate);}
function moveVertical(direction, immediate=false){
  const elements=[...list.querySelectorAll('.row')];
  const index=elements.findIndex(element=>element.dataset.id===selected), current=elements[index];
  if(!current) return;
  // Hover and selection lift cards visually; navigation follows their layout positions.
  function position(element){
    const rect=element.getBoundingClientRect(), transform=getComputedStyle(element).transform;
    const offset=transform==='none'?null:new DOMMatrixReadOnly(transform);
    return {top:rect.top-(offset?.m42 || 0),left:rect.left-(offset?.m41 || 0)};
  }
  const origin=position(current);
  verticalLeft ??= origin.left;
  let target=null, nearestTop=null;
  // DOM order follows the layout; stop after the neighboring visual row.
  for(let i=index+direction;i>=0 && i<elements.length;i+=direction){
    const element=elements[i], rect=position(element);
    if(direction*(rect.top-origin.top)<=2)continue;
    if(nearestTop!==null && Math.abs(rect.top-nearestTop)>=2)break;
    nearestTop ??= rect.top;
    const distance=Math.abs(rect.left-verticalLeft);
    if(!target || distance<target.distance || (distance===target.distance && i<target.index))target={element,distance,index:i};
  }
  if(!target)return;
  selected=target.element.dataset.id;
  syncSelection(true,immediate);
}
function viewportRows(selector, top, bottom){
  const elements=list.querySelectorAll(selector), measured=new Map();
  const at=index=>{
    if(!measured.has(index))measured.set(index,{element:elements[index],rect:elements[index].getBoundingClientRect()});
    return measured.get(index);
  };
  // Rows follow document order; locate the viewport without measuring the whole tree.
  let low=0, high=elements.length;
  while(low<high){const mid=(low+high)>>>1;if(at(mid).rect.bottom<top-2)low=mid+1;else high=mid;}
  if(low===elements.length)return [];
  // Include the complete first visual row despite the 2px hover/selection lift.
  const firstTop=at(low).rect.top;
  while(low>0 && Math.abs(at(low-1).rect.top-firstTop)<=2)low--;
  const visible=[];
  for(let i=low;i<elements.length;i++){
    const entry=at(i);if(entry.rect.top>bottom+2)break;
    visible.push(entry);
  }
  return visible;
}
function scrollHalfPage(direction, immediate=false){
  const current=list.querySelector('.row.selected')?.getBoundingClientRect();
  const top=Math.max(0,Math.min(list.scrollHeight-list.clientHeight,list.scrollTop+direction*list.clientHeight/2));
  const delta=top-list.scrollTop;
  const bounds=list.getBoundingClientRect();
  const visible=viewportRows('.row',bounds.top+delta,bounds.bottom+delta).map(({element,rect})=>{
    return {element,rect:{top:rect.top-delta,bottom:rect.bottom-delta,left:rect.left}};
  })
    .filter(({rect})=>rect.top>=bounds.top && rect.bottom<=bounds.bottom);
  if(visible.length){
    const targetTop=current?.top ?? bounds.top;
    const targetLeft=verticalLeft ?? current?.left ?? bounds.left;
    visible.sort((a,b)=>Math.abs(a.rect.top-targetTop)-Math.abs(b.rect.top-targetTop) || Math.abs(a.rect.left-targetLeft)-Math.abs(b.rect.left-targetLeft));
    selected=visible[0].element.dataset.id;
    verticalLeft=targetLeft;
  }
  syncSelection(false);
  list.scrollTo({top,behavior:immediate || reducedMotion.matches?'instant':'smooth'});
}
function toggle(node){
  const title=document.getElementById(`item-${node.id}`), content=title?.nextElementSibling;
  if(!content)return;
  searchRenderKey='';
  // Finish another transition, but retain this folder's current height when reversing.
  const height=content.getBoundingClientRect().height, scroll=list.scrollTop;
  finishFolderMotion();
  const closing=!isCollapsed(node.id), index=rows.findIndex(x=>x.node.id===node.id);
  (query?searchCollapsed:collapsed)[node.id]=closing;
  verticalLeft=null;
  title.classList.toggle('collapsed',closing);title.classList.toggle('expanded',!closing);
  title.setAttribute('aria-expanded',String(!closing));
  if(closing){
    const descendants=[...content.querySelectorAll('.row')];
    rows.splice(index+1,descendants.length);
    if(descendants.some(row=>row.dataset.id===selected))selected=node.id;
    // Reuse the existing subtree for the closing animation, with no interactive items.
    content.inert=true;content.setAttribute('aria-hidden','true');
    for(const row of descendants)row.classList.remove('row');
  }else{
    const items=[], fragment=document.createDocumentFragment();
    appendGroups(rows[index].node.children || [],fragment,title.parentElement.bookmarkPath,items);
    content.replaceChildren(fragment);rows.splice(index+1,0,...items);
  }
  if(!reducedMotion.matches){
    const targetHeight=closing?0:content.getBoundingClientRect().height;
    content.style.overflow='hidden';
    const motion=content.animate([{height:`${height}px`},{height:`${targetHeight}px`}],{duration:240,easing:'cubic-bezier(.25,.1,.25,1)'});
    finishFolderMotion=()=>{
      finishFolderMotion=()=>{};motion.onfinish=null;motion.cancel();
      if(closing)content.replaceChildren();
      content.inert=false;content.removeAttribute('aria-hidden');content.style.overflow='';
      if(!query){directoryScroll=list.scrollTop;save();}
    };
    motion.onfinish=()=>finishFolderMotion();
  }else if(closing){content.replaceChildren();content.inert=false;content.removeAttribute('aria-hidden');}
  list.scrollTop=scroll;syncSelection();status();
  if(!app.inert)loadNearbyIcons();
  if(!query){directoryScroll=list.scrollTop;save();}
}
function foldCommand(key){
  const current=document.getElementById(`item-${selected}`);
  const ancestors=[];
  for(let group=current?.closest('section.folder');group;group=group.parentElement?.closest('section.folder')){
    const title=group.querySelector(':scope > .folderTitle');
    if(title)ancestors.push(title.dataset.id);
  }
  if(key==='c' || key==='o'){
    const id=ancestors[0], node=rows.find(x=>x.node.id===id)?.node;
    if(node && isCollapsed(id)!==(key==='c')){selected=id;toggle(node);}
    return;
  }
  finishFolderMotion();
  const state=query?searchCollapsed:collapsed;
  const ids=query?searchFolderIds:walk(roots,0,true).filter(x=>folder(x.node)).map(x=>x.node.id);
  const previous=selected;
  for(const id of ids)state[id]=key==='M';
  render();
  selected=[previous,...ancestors].find(id=>rows.some(x=>x.node.id===id)) || selected;
  syncSelection();
  if(!query){directoryScroll=list.scrollTop;save();}
}
function enterSearch(){pendingY=false;pendingZ=false;if(mode==='hints') cancelHints();if(!query) directoryScroll=list.scrollTop;mode='edit';pendingG=false;search.focus();showBookmarkTip(null);status();message(t('输入名称，Esc 返回结果导航'));}
function cancelHints(){hintViewport=null;mode=query?'results':'nav';hints.clear();prefix='';list.querySelectorAll('.hint').forEach(x=>x.remove());list.querySelectorAll('.muted').forEach(x=>x.classList.remove('muted'));status();showBookmarkTip(list.querySelector('.bookmark.selected'));}
function beginHints(){
  list.scrollTo({top:list.scrollTop,behavior:'instant'});
  pendingY=false;pendingZ=false;
  finishFolderMotion();
  search.blur();list.focus({preventScroll:true});mode='hints';pendingG=false;prefix='';hints.clear();showBookmarkTip(null);
  const bounds=list.getBoundingClientRect();
  hintViewport={top:list.scrollTop,left:list.scrollLeft,width:list.clientWidth,height:list.clientHeight};
  const singleKeys='qweasdzxc iop jkl nm,'.replaceAll(' ','');
  const doublePrefixes='rtyufghvb';
  const visualRows=[];
  for(const {element:row,rect} of viewportRows('.row:not(.folder)',bounds.top,bounds.bottom)){
    const transform=getComputedStyle(row).transform;
    const lift=transform==='none'?0:new DOMMatrixReadOnly(transform).m42;
    const top=rect.top-lift;
    let group=visualRows.at(-1);
    if(!group || Math.abs(group.top-top)>=2){group={top,height:rect.height,items:[]};visualRows.push(group);}
    group.items.push({row,left:rect.left});
  }
  // Decide visibility for the whole layout row, unaffected by hover/focus animation.
  const visibleRows=visualRows.filter(group=>Math.min(group.top+group.height,bounds.bottom)-Math.max(group.top,bounds.top)>=group.height/2);
  visibleRows.sort((a,b)=>a.top-b.top);
  visibleRows.forEach((group,rowIndex)=>{
    group.items.sort((a,b)=>a.left-b.left).forEach(({row},column)=>{
      const slot=(rowIndex%6)*3+column;
      const key=(rowIndex<6?'':doublePrefixes[Math.floor(rowIndex/6)-1])+singleKeys[slot];
      hints.set(key,row.dataset.id);
      const badge=document.createElement('span');badge.className='hint';badge.textContent=key;badge.dataset.key=key;
      row.append(badge);
    });
  });
  if(!visibleRows.length){cancelHints();message(query?t('没有可选结果，请修改搜索'):t('没有可见书签，请先展开目录'));return;}
  status();message(t('输入标签打开 · Esc 取消'));
}
function hintInput(key){
  prefix=key==='Backspace'?prefix.slice(0,-1):prefix+key.toLowerCase();
  for(const badge of list.querySelectorAll('.hint')){const value=badge.dataset.key;badge.parentElement.classList.toggle('muted',!value.startsWith(prefix));badge.replaceChildren();const mark=document.createElement('mark');mark.textContent=value.slice(0,prefix.length);badge.append(mark,document.createTextNode(value.slice(prefix.length)));}
  if(hints.has(prefix)){const node=rows.find(x=>x.node.id===hints.get(prefix))?.node;cancelHints();if(node) openBookmark(node);}
  else if([...hints.keys()].some(x=>x.startsWith(prefix))) message(t('已输入 {prefix} · 继续输入',{prefix:prefix.toUpperCase()}));
  else {cancelHints();message();}
}
async function copyBookmark(){
  const node=rows.find(x=>x.node.id===selected)?.node;
  if(!node?.url){message(t('请选择书签后复制网址'));return;}
  try{await navigator.clipboard.writeText(node.url);message(t('已复制书签网址'));}
  catch{message(t('复制失败，请检查剪贴板权限'));}
}
const shortcutHelp=$('shortcut-help');
function openHelp(){
  pendingY=false;pendingZ=false;pendingG=false;finishFolderMotion();showBookmarkTip(null);
  shortcutHelp.showModal();$('help-close').focus();
}
$('help-close').onclick=()=>shortcutHelp.close();
$('help-button').onclick=()=>{if(mode==='hints')cancelHints();search.blur();mode=query?'results':'nav';status();openHelp();};
shortcutHelp.addEventListener('close',()=>{list.focus({preventScroll:true});showBookmarkTip(list.querySelector('.bookmark.selected'));});
document.addEventListener('keydown',event=>{
  if(!shortcutHelp.open)return;
  event.stopImmediatePropagation();
  if(event.key==='Escape'){event.preventDefault();shortcutHelp.close();}
},true);
async function openBookmark(node){
  try{
    selected=node.id;save();
    await chrome.tabs.create({url:node.url,active:true});window.close();
  }catch{message(t('无法打开此书签'));}
}
search.addEventListener('focus',()=>{if(mode!=='edit') enterSearch();});
search.addEventListener('input',()=>{
  query=search.value;searchCollapsed={};render();list.scrollTop=0;
  selected=rows.find(x=>x.node.url)?.node.id || rows[0]?.node.id || '';syncSelection(false);
});
$('hint-button').onclick=()=>{if(mode==='hints') cancelHints();else beginHints();};
function checkHintViewport(){
  if(mode!=='hints' || !hintViewport)return;
  const moved=Math.abs(list.scrollTop-hintViewport.top)>1 || Math.abs(list.scrollLeft-hintViewport.left)>1;
  const resized=list.clientWidth!==hintViewport.width || list.clientHeight!==hintViewport.height;
  if(moved || resized){cancelHints();message(t('位置变化，请重新按 f'));}
}
list.addEventListener('scroll',()=>{lastIconScroll=performance.now();checkHintViewport();showBookmarkTip(list.querySelector('.bookmark.selected'));if(!query && mode!=='edit'){directoryScroll=list.scrollTop;save(true);}});
window.addEventListener('resize',()=>{checkHintViewport();showBookmarkTip(list.querySelector('.bookmark.selected'));});
document.addEventListener('keydown',event=>{
  if(event.isComposing || event.keyCode===229 || event.metaKey || event.ctrlKey || event.altKey) return;
  let key=event.key;
  if(key==='Shift')return;
  if(key==='Escape' && event.repeat){event.preventDefault();return;}
  if(mode==='edit'){
    if(key==='Enter'){event.preventDefault();const node=rows.find(x=>x.node.id===selected)?.node;if(node?.url) openBookmark(node);}
    if(key==='Escape'){event.preventDefault();search.blur();mode=query?'results':'nav';list.focus({preventScroll:true});syncSelection(false);status();message(t('按 f 选择书签'));}
    return;
  }
  if(mode==='hints'){
    if(event.repeat){event.preventDefault();return;}
    if(key==='Escape'){event.preventDefault();cancelHints();message();}
    else if(key==='Backspace' || /^[a-z,]$/i.test(key)){event.preventDefault();hintInput(key);}
    return;
  }
  if(key!=='y')pendingY=false;
  if(key==='?' || key==='？'){event.preventDefault();openHelp();return;}
  if(pendingZ){
    pendingZ=false;pendingG=false;event.preventDefault();message();
    if(['c','o','M','R'].includes(key))foldCommand(key);
    return;
  }
  if(key==='y'){event.preventDefault();pendingG=false;if(pendingY){pendingY=false;copyBookmark();}else{pendingY=true;message(t('y · 再按 y 复制网址'));}return;}
  if(key==='z'){event.preventDefault();pendingZ=true;pendingG=false;message(t('z · c 折叠 / o 展开 · M 全折叠 / R 全展开'));return;}
  key=({ArrowUp:'k',ArrowDown:'j',ArrowLeft:'h',ArrowRight:'l'})[key] || key;
  if(!['j','k','h','l','d','u','g','G','/','f','F','Enter','Escape'].includes(key)){pendingG=false;return;}
  event.preventDefault();message();
  const node=rows.find(x=>x.node.id===selected)?.node;
  if(key==='Enter' && node?.url) openBookmark(node);
  // Repeating smooth requests can restart before advancing; held keys scroll immediately.
  if(key==='j') moveVertical(1,event.repeat);
  if(key==='k') moveVertical(-1,event.repeat);
  if(key==='d') scrollHalfPage(1,event.repeat);
  if(key==='u') scrollHalfPage(-1,event.repeat);
  if(key==='h'){if(node && folder(node) && !isCollapsed(node.id)) toggle(node);else move(-1,event.repeat);}
  if(key==='l'){if(node && folder(node) && isCollapsed(node.id)) toggle(node);else move(1,event.repeat);}
  if(key==='G'){verticalLeft=null;selected=rows.at(-1)?.node.id || '';syncSelection();}
  if(key==='g' && pendingG){verticalLeft=null;selected=rows[0]?.node.id || '';syncSelection();pendingG=false;return;}
  pendingG=key==='g';
  if(key==='/') enterSearch();
  if(key==='f' || key==='F') beginHints();
  if(key==='Escape'){
    if(query){query='';search.value='';mode='nav';render();list.scrollTop=directoryScroll;status();}
    else if(mode==='nav'){save();window.close();}
  }
});
async function init(){
  const [,,stored,tree]=await Promise.all([loadLanguage(),themeReady,startupData?.settings || chrome.storage.local.get(['linkcoveState','linkcoveDemo']),startupData?.tree || chrome.bookmarks.getTree(),domReady]);
  const state=stored.linkcoveState || stored.linkcoveDemo;
  collapsed=state?.collapsed || {};directoryScroll=state?.scroll || 0;
  roots=tree[0].children;
  function firstBookmark(nodes,parents=[]){
    const bookmark=nodes.find(node=>node.url);
    if(bookmark)return {bookmark,parents};
    for(const node of nodes){
      const found=firstBookmark(node.children || [],[...parents,node.id]);
      if(found)return found;
    }
  }
  function findSelected(nodes,id,parents=[]){
    for(const node of nodes){
      if(node.id===id)return {node,parents};
      const found=findSelected(node.children || [],id,[...parents,node.id]);
      if(found)return found;
    }
  }
  const previous=state?.selected && findSelected(roots,state.selected);
  if(previous){selected=previous.node.id;for(const id of previous.parents)collapsed[id]=false;}
  else if(!state?.selected){
    const first=firstBookmark(roots);
    if(first){selected=first.bookmark.id;for(const id of first.parents)collapsed[id]=false;}
  }
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  directoryScroll=0;render();list.scrollTop=0;
  syncSelection(true,true);
  loadNearbyIcons();
  showBookmarkTip(list.querySelector('.bookmark.selected'),true);
  startupStatus.hidden=true;
  app.inert=false;app.removeAttribute('aria-busy');list.focus({preventScroll:true});
  scheduleBackgroundIcons();
  directoryScroll=list.scrollTop;save();
  if(native){let timer;const refresh=()=>{clearTimeout(timer);timer=setTimeout(async()=>{if(mode==='hints')cancelHints();roots=(await chrome.bookmarks.getTree())[0].children;render();},80);};for(const event of ['onCreated','onRemoved','onChanged','onMoved','onChildrenReordered']) chrome.bookmarks[event].addListener(refresh);}
}
let iconObserver=null, iconWarmupVersion=0, lastIconScroll=0;
function scheduleBackgroundIcons(){
  if(typeof requestIdleCallback!=='function')return;
  const version=++iconWarmupVersion;
  requestIdleCallback(deadline=>{
    if(version!==iconWarmupVersion)return;
    const icons=[...list.querySelectorAll('.favicon[data-src]')];
    let index=0;
    function step(deadline){
      if(version!==iconWarmupVersion)return;
      if(performance.now()-lastIconScroll<180){setTimeout(()=>requestIdleCallback(step,{timeout:600}),180);return;}
      let loaded=0;
      while(index<icons.length && loaded<8 && (loaded===0 || deadline.timeRemaining()>2)){
        const icon=icons[index++];
        if(!icon.isConnected || !icon.dataset.src)continue;
        iconObserver?.unobserve(icon);
        icon.loading='eager';icon.src=icon.dataset.src;delete icon.dataset.src;
        loaded++;
      }
      if(index<icons.length)setTimeout(()=>requestIdleCallback(step,{timeout:600}),80);
    }
    step(deadline);
  },{timeout:600});
}
function loadNearbyIcons(){
  iconObserver?.disconnect();
  const halfPage=Math.ceil(list.clientHeight/2);
  const observer=new IntersectionObserver(entries=>{
    for(const {target,isIntersecting} of entries){
      if(!isIntersecting || !target.dataset.src)continue;
      observer.unobserve(target);
      target.loading='eager';
      target.src=target.dataset.src;delete target.dataset.src;
    }
  },{root:list,rootMargin:`0px 0px ${halfPage}px 0px`});
  iconObserver=observer;
  const bounds=list.getBoundingClientRect();
  const nearby=new Set(viewportRows('.bookmark',bounds.top,bounds.bottom+halfPage).map(({element})=>element.querySelector('.favicon')));
  for(const icon of list.querySelectorAll('.favicon[data-src]')){
    if(!nearby.has(icon)){iconObserver.observe(icon);continue;}
    icon.loading='eager';icon.src=icon.dataset.src;delete icon.dataset.src;
  }
  if(typeof app!=='undefined' && !app.inert)scheduleBackgroundIcons();
}
init().catch(()=>{
  app.removeAttribute('aria-busy');
  startupStatus.textContent=t('读取失败，请重新打开弹窗');startupStatus.setAttribute('role','alert');startupStatus.hidden=false;
});
