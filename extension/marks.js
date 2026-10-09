/* Shortcuts store native bookmark or folder IDs alongside the popup preferences. */
let folderMarks={}, activeMark='1', pendingMark=null, markDestination='', markExpanded=new Set(), pendingMarkG=false, markStage='slots', markAdding=false;
let markSearchPending=false;
const marksDialog=$('folder-marks'), markConfirm=$('mark-confirm'), markSearch=$('mark-search'), markKeyInput=$('mark-key');
const reservedMarkKeys=new Set('dfghjklmuy');
function isMarkKey(key){return /^[1-9a-z]$/.test(key)&&!reservedMarkKeys.has(key);}
function markKeys(){return [...new Set(['1','2','3',...Object.keys(folderMarks).filter(isMarkKey),activeMark])].sort();}
function nextMarkKey(){const keys=markKeys();return [...'123456789abcdefghijklmnopqrstuvwxyz'].find(key=>isMarkKey(key)&&!keys.includes(key));}
function addMarkShortcut(){
  const key=nextMarkKey();if(!key)return;
  chooseMarkSlot(key,false);markKeyInput.focus();markKeyInput.select();
}
function refreshFolderMarks(){
  for(const mark of Object.values(folderMarks)){
    const item=findItem(mark.id);if(item)mark.title=item.node.title||t('未命名');
  }
  if(marksDialog.open)renderMarkSlots();
}
function jumpToFavorite(slot){
  const mark=folderMarks[slot];if(!mark){message(t('快捷键 {slot} 未绑定，使用 :m 设置',{slot}));return;}
  const item=findItem(mark.id);
  if(!item||item.node.type==='separator'){message(t('快捷键 {slot} 的条目已失效，使用 :m 重新绑定',{slot}));return;}
  if(item.node.url){openBookmark(item.node);return;}
  if(mode==='hints')cancelHints();finishFolderMotion();search.blur();query='';search.value='';searchCollapsed={};mode='nav';pendingG=false;pendingY=false;
  let parent=item.parent;while(parent){collapsed[parent.id]=false;parent=findItem(parent.id)?.parent;}
  selected=item.node.id;render();list.focus({preventScroll:true});syncSelection(false);alignSelectionUpperThird();
  directoryScroll=list.scrollTop;save();status();message(t('已跳转到 {name}',{name:item.node.title||t('未命名')}));
}
function storeMark(slot,item){
  folderMarks[slot]={id:item.node.id,title:item.node.title||t('未命名')};markStage='slots';save();render();
  if(marksDialog.open&&!markConfirm.open)focusMarkPane();
  message(t('已绑定 {slot} → {name}',{slot,name:item.node.title||t('未命名')}));
}
function bindFolderMark(slot,item){
  if(markSearchPending||!isMarkKey(slot)||!item||item.node.type==='separator'){message(t('请选择有效快捷键和条目'));return;}
  const previous=folderMarks[slot];
  if(previous&&previous.id!==item.node.id){
    pendingMark={slot,id:item.node.id};const old=findItem(previous.id);
    $('mark-confirm-number').textContent=slot;
    $('mark-confirm-old').textContent=old?(folder(old.node)?t('目录'):t('书签'))+' · '+old.path.join(' / '):previous.title||t('已失效');
    $('mark-confirm-new').textContent=(folder(item.node)?t('目录'):t('书签'))+' · '+item.path.join(' / ');
    markConfirm.showModal();$('mark-confirm-save').focus();return;
  }
  storeMark(slot,item);
}
function removeFolderMark(slot){delete folderMarks[slot];save();render();message(t('已解除快捷键 {slot} 的绑定',{slot}));}
function renderMarkSlots(focus=false){
  const hadFocus=$('mark-slots').contains(document.activeElement)||$('mark-folders').contains(document.activeElement);
  const slots=$('mark-slots');slots.replaceChildren();
  for(const slot of markKeys()){
    const mark=folderMarks[slot],item=mark&&findItem(mark.id),valid=item&&item.node.type!=='separator';
    const active=slot===activeMark&&!markAdding;
    const row=document.createElement('button');row.type='button';row.dataset.slot=slot;row.setAttribute('role','option');row.setAttribute('aria-selected',String(active));row.tabIndex=active?0:-1;
    const key=document.createElement('kbd');key.textContent=slot;
    const label=document.createElement('span');label.textContent=valid?(folder(item.node)?t('目录'):t('书签'))+' · '+item.path.join(' / '):mark?(mark.title+' · '+t('已失效')):t('未绑定');
    const indicator=document.createElement('span');indicator.className='mark-selected';indicator.textContent='←';indicator.setAttribute('aria-hidden','true');
    row.classList.toggle('invalid',Boolean(mark&&!valid));row.append(key,label,indicator);
    row.onclick=()=>{chooseMarkSlot(slot);};slots.append(row);
  }
  const add=document.createElement('button');add.type='button';add.id='mark-add';add.setAttribute('role','option');add.setAttribute('aria-selected',String(markAdding));add.tabIndex=markAdding?0:-1;add.disabled=!nextMarkKey();
  const plus=document.createElement('kbd');plus.textContent='+';plus.setAttribute('aria-hidden','true');
  const label=document.createElement('span');label.textContent=t('添加快捷键');add.append(plus,label);add.onclick=addMarkShortcut;slots.append(add);
  $('mark-remove').disabled=!folderMarks[activeMark];renderMarkFolders();renderMarkControls();
  if((focus||hadFocus)&&marksDialog.open&&!markConfirm.open)focusMarkPane();
}
function focusMarkPane(){
  const row=$(markStage==='slots'?'mark-slots':'mark-folders').querySelector('[tabindex="0"]');
  if(row){row.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});}else if(markStage==='folders')markSearch.focus();
}
function renderMarkControls(){
  const choosing=markStage==='slots';
  $('mark-slot-pane').hidden=!choosing;$('mark-folder-pane').hidden=choosing;$('mark-remove').hidden=!choosing;
  $('mark-slot-number').textContent=activeMark;
  $('mark-save').textContent=choosing?markAdding?t('添加快捷键'):t('选择条目'):t('确认绑定');
  $('mark-save').disabled=choosing&&markAdding?!nextMarkKey():!findItem(markDestination)||!isMarkKey(markKeyInput.value.toLowerCase());
  if(!choosing&&markSearchPending)$('mark-save').disabled=true;
  $('mark-remove').disabled=markAdding||!folderMarks[activeMark];
  $('marks-close').textContent=choosing?t('取消'):t('返回');
  const mark=folderMarks[activeMark],item=mark&&findItem(mark.id);
  const context=choosing?t('已绑定 {count} 个快捷键',{count:Object.keys(folderMarks).filter(isMarkKey).length}):t('当前绑定：{name}',{name:item?.path.join(' / ')||mark?.title||t('未绑定')});
  $('marks-context').textContent=context;$('marks-context').title=context;
}
function setMarkStage(stage){
  if(stage==='folders'&&!isMarkKey(markKeyInput.value.toLowerCase())){markKeyInput.focus();return;}
  markStage=stage;pendingMarkG=false;renderMarkControls();focusMarkPane();
}
function chooseMarkSlot(slot,focus=true){
  activeMark=slot;markAdding=false;pendingMarkG=false;markSearch.value='';
  markKeyInput.value=slot;$('mark-key-error').textContent='';
  markDestination=folderMarks[slot]?.id||findItem(selected)?.node.id||roots.find(folder)?.id||'';
  renderMarkSlots(focus);
}
markKeyInput.addEventListener('focus',()=>markKeyInput.select());
markKeyInput.addEventListener('input',()=>{
  const key=markKeyInput.value.toLowerCase();markKeyInput.value=key;
  if(isMarkKey(key)){chooseMarkSlot(key,false);return;}
  $('mark-key-error').textContent=reservedMarkKeys.has(key)?t('按键 {key} 已用于操作，不能绑定',{key}):t('请输入 1–9 或单个英文字母');
  $('mark-save').disabled=true;
});
function renderMarkFolders(focus=false){
  const tree=$('mark-folders');tree.replaceChildren();
  const term=markSearch.value.trim().toLocaleLowerCase(),entries=[];
  markSearchPending=false;
  if(!term&&!findItem(markDestination))markDestination=roots.find(folder)?.id||'';
  let parent=findItem(markDestination)?.parent;while(parent){markExpanded.add(parent.id);parent=findItem(parent.id)?.parent;}
  function append(nodes,depth=0,path=[]){
    for(const node of nodes.filter(node=>node.type!=='separator')){
      const children=(node.children||[]).filter(node=>node.type!=='separator'),expanded=markExpanded.has(node.id);
      const fullPath=[...path,node.title||t('未命名')];
      if(!term||(node.title||'').toLocaleLowerCase().includes(term))entries.push({node,children,expanded,depth:term?0:depth,fullPath});
      if(term||expanded)append(children,depth+1,fullPath);
    }
  }
  let groups=[];
  if(term){
    prepareBookmarkSearch();
    const result=bookmarkSearch.bindings(markSearch.value);
    markSearchPending=result.state==='loading';groups=result.groups;
    for(const group of groups)for(const entry of group.entries)entries.push({...entry,children:entry.node.children||[],expanded:false,depth:0,fullPath:entry.fullPath.map(name=>name||t('未命名'))});
    if(result.state==='fallback')message(t('搜索暂不可用，已改用名称搜索'));
  }else append(roots);
  tree.setAttribute('aria-busy',String(markSearchPending));
  if(!markSearchPending&&!entries.some(entry=>entry.node.id===markDestination))markDestination=entries[0]?.node.id||'';
  let groupIndex=0,groupRemaining=0;
  for(const {node,children,expanded,depth,fullPath} of entries){
      if(term&&!groupRemaining){
        const group=groups[groupIndex++],heading=document.createElement('div');heading.className='mark-group-title';heading.setAttribute('role','presentation');
        heading.textContent=group.fullPath.map(name=>name||t('未命名')).join(' / ')||t('书签');tree.append(heading);groupRemaining=group.entries.length;
      }
      if(term)groupRemaining--;
      const active=node.id===markDestination;
      const row=document.createElement('button');row.type='button';row.dataset.id=node.id;row.dataset.parent=node.parentId||'';row.tabIndex=active?0:-1;
      row.setAttribute('role','treeitem');row.setAttribute('aria-level',String(depth+1));row.setAttribute('aria-selected',String(active));
      row.setAttribute('aria-label',(folder(node)?t('目录'):t('书签'))+' · '+fullPath.join(' / '));
      if(children.length&&!term)row.setAttribute('aria-expanded',String(expanded));row.style.paddingLeft=(8+depth*14)+'px';
      row.title=fullPath.join(' / ');
      const disclosure=document.createElement('span');disclosure.className='mark-disclosure';disclosure.textContent=folder(node)?children.length&&!term?(expanded?'▾':'▸'):'▱':'↗';disclosure.setAttribute('aria-hidden','true');
      const name=document.createElement('span');name.className='mark-name';name.textContent=term?fullPath.join(' / '):node.title||t('未命名');
      const indicator=document.createElement('span');indicator.className='mark-selected';indicator.textContent='←';indicator.setAttribute('aria-hidden','true');row.append(disclosure,name,indicator);
      row.onclick=event=>{markDestination=node.id;pendingMarkG=false;
        if(event.target===disclosure&&children.length&&!term){if(expanded)markExpanded.delete(node.id);else markExpanded.add(node.id);}
        renderMarkFolders(true);
      };tree.append(row);
  }
  $('mark-folder-count').textContent=t('{count} 个条目',{count:entries.length});
  if(!entries.length){const empty=document.createElement('p');empty.className='mark-empty';empty.textContent=markSearchPending?t('正在准备搜索…'):t('没有匹配的条目');tree.append(empty);}
  $('mark-save').disabled=markSearchPending||!findItem(markDestination)||!isMarkKey(markKeyInput.value.toLowerCase());
  $('mark-confirm-save').disabled=markSearchPending;
  if(focus){const row=tree.querySelector('[tabindex="0"]');row?.focus({preventScroll:true});row?.scrollIntoView({block:'nearest'});}
}
markSearch.addEventListener('input',()=>{pendingMarkG=false;renderMarkFolders();});
function openFolderMarks(){
  markStage='slots';markExpanded=new Set();chooseMarkSlot(Object.keys(folderMarks).find(isMarkKey)||'1');
  marksDialog.showModal();renderMarkSlots(true);
}
function closeFolderMarks(){marksDialog.close();list.focus({preventScroll:true});}
$('marks-close').onclick=()=>{if(markStage==='folders')setMarkStage('slots');else closeFolderMarks();};
$('mark-save').onclick=()=>{if(markStage==='slots'){if(markAdding)addMarkShortcut();else setMarkStage('folders');}else bindFolderMark(activeMark,findItem(markDestination));};
$('mark-remove').onclick=()=>{removeFolderMark(activeMark);renderMarkSlots(true);};
marksDialog.addEventListener('cancel',event=>{event.preventDefault();if(markStage==='folders')setMarkStage('slots');else closeFolderMarks();});
markConfirm.addEventListener('cancel',event=>{event.preventDefault();markConfirm.close();pendingMark=null;});
$('mark-confirm-cancel').onclick=()=>{markConfirm.close();pendingMark=null;};
$('mark-confirm-save').onclick=()=>{
  if(markSearchPending)return;
  const item=pendingMark&&findItem(pendingMark.id);
  if(item&&item.node.type!=='separator'&&isMarkKey(pendingMark.slot))storeMark(pendingMark.slot,item);else message(t('请选择有效快捷键和条目'));
  pendingMark=null;markConfirm.close();
};
markConfirm.addEventListener('close',()=>{if(marksDialog.open)focusMarkPane();else list.focus({preventScroll:true});});
function markButtonKey(event,buttons){
  const key=({ArrowLeft:'h',ArrowRight:'l',ArrowUp:'k',ArrowDown:'j'})[event.key]||event.key;
  if(['h','l','j','k'].includes(key)){
    event.preventDefault();const index=buttons.indexOf(document.activeElement),delta=key==='h'||key==='k'?-1:1;
    buttons[Math.max(0,Math.min(buttons.length-1,index+delta))]?.focus();
  }
  if(key==='Enter'){event.preventDefault();if(buttons.includes(document.activeElement))document.activeElement.click();}
}
document.addEventListener('keydown',event=>{
  if(!marksDialog.open&&!markConfirm.open)return;
  event.stopImmediatePropagation();
  if(event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey)return;
  if(event.key==='Enter'&&event.repeat){event.preventDefault();return;}
  if(markConfirm.open){
    if(event.key==='Escape'){event.preventDefault();$('mark-confirm-cancel').click();return;}
    markButtonKey(event,[$('mark-confirm-cancel'),$('mark-confirm-save')]);
    return;
  }
  if(event.target===markKeyInput){
    if(event.key==='Enter'){event.preventDefault();if(isMarkKey(markKeyInput.value.toLowerCase()))chooseMarkSlot(markKeyInput.value.toLowerCase(),false);setMarkStage('folders');}
    if(event.key==='Escape'){event.preventDefault();chooseMarkSlot(activeMark);}
    if(['ArrowDown','ArrowUp'].includes(event.key)){event.preventDefault();chooseMarkSlot(activeMark);}
    return;
  }
  if(event.target===markSearch){
    if(['Escape','Enter','ArrowDown','ArrowUp'].includes(event.key)){
      event.preventDefault();if($('mark-folders').querySelector('[tabindex="0"]'))focusMarkPane();else if(event.key==='Escape'){markSearch.value='';renderMarkFolders(true);}
    }
    return;
  }
  if(event.key==='/'){event.preventDefault();pendingMarkG=false;const input=markStage==='slots'?markKeyInput:markSearch;input.focus();input.select();return;}
  if(event.key==='Escape'){
    event.preventDefault();pendingMarkG=false;
    if($('mark-actions').contains(event.target))focusMarkPane();else if(markStage==='folders'&&markSearch.value){markSearch.value='';renderMarkFolders(true);}else if(markStage==='folders')setMarkStage('slots');else closeFolderMarks();return;
  }
  if(isMarkKey(event.key.toLowerCase())&&markStage==='slots'){event.preventDefault();chooseMarkSlot(event.key.toLowerCase());return;}
  if($('mark-actions').contains(event.target)){
    if(['j','k','ArrowUp','ArrowDown'].includes(event.key)){event.preventDefault();focusMarkPane();return;}
    markButtonKey(event,[...$('mark-actions').children].filter(button=>!button.hidden&&!button.disabled));return;
  }
  if($('mark-slots').contains(event.target)){
    const key=({ArrowDown:'j',ArrowUp:'k',ArrowLeft:'h',ArrowRight:'l'})[event.key]||event.key;
    if(key==='j'||key==='k'){
      event.preventDefault();const keys=markKeys(),index=markAdding?keys.length:keys.indexOf(activeMark),next=Math.max(0,Math.min(keys.length-(nextMarkKey()?0:1),index+(key==='j'?1:-1)));
      if(next===keys.length){markAdding=true;renderMarkSlots(true);}else chooseMarkSlot(keys[next]);
    }
    if(key==='Enter'||key==='l'){event.preventDefault();if(markAdding)addMarkShortcut();else setMarkStage('folders');}
    if(key==='h'){event.preventDefault();$('marks-close').focus();}
    return;
  }
  if(!$('mark-folders').contains(event.target))return;
  const key=({ArrowDown:'j',ArrowUp:'k',ArrowLeft:'h',ArrowRight:'l',Home:'Home',End:'G'})[event.key]||event.key;
  if(!['j','k','h','l','d','u','g','G','Home','Enter'].includes(key)){pendingMarkG=false;return;}
  event.preventDefault();
  if(key==='Enter'){pendingMarkG=false;$('mark-save').click();return;}
  if(key==='g'&&!pendingMarkG){pendingMarkG=!event.repeat;return;}
  if(key==='g'&&event.repeat)return;pendingMarkG=false;
  const tree=$('mark-folders'),rows=[...tree.querySelectorAll('[data-id]')],index=rows.findIndex(row=>row.dataset.id===markDestination),row=rows[index];if(!row)return;
  if(key==='h'){
    if(row.getAttribute('aria-expanded')==='true')markExpanded.delete(markDestination);
    else if(rows.some(item=>item.dataset.id===row.dataset.parent))markDestination=row.dataset.parent;
  }else if(key==='l'){
    if(row.getAttribute('aria-expanded')==='false')markExpanded.add(markDestination);
    else if(row.getAttribute('aria-expanded')==='true')markDestination=rows[index+1]?.dataset.id||markDestination;
  }else{
    const step=Math.max(1,Math.floor(tree.clientHeight/row.offsetHeight/2));
    const next=key==='g'||key==='Home'?0:key==='G'?rows.length-1:Math.max(0,Math.min(rows.length-1,index+(key==='j'?1:key==='k'?-1:key==='d'?step:-step)));
    markDestination=rows[next].dataset.id;
    if(key==='d'||key==='u')tree.scrollTop+=(next-index)*row.offsetHeight;
  }
  renderMarkFolders(true);
},true);
