/* Edits operate directly on browser bookmarks. */
const menu=$('item-menu'), editor=$('item-editor'), destinations=$('move-destinations');
let managementTarget='', editAction='', destination='', busy=false;
let orderItems=[], orderTarget='', orderPlacement='before', pendingOrderG=false;
function findItem(id,nodes=roots,parent=null,path=[]){
  for(const node of nodes){
    const fullPath=[...path,node.title || t('未命名')];
    if(node.id===id) return {node,parent,path:fullPath};
    const found=findItem(id,node.children || [],node,fullPath);if(found)return found;
  }
}
function protectedItem(item){return !item?.parent || Boolean(item.node.folderType || item.node.unmodifiable);}
function managementOpen(){return !menu.hidden || editor.open || transfer.open || marksDialog.open || markConfirm.open;}
function closeMenu(focus=true){menu.hidden=true;if(focus)list.focus({preventScroll:true});}
function openItemMenu(id,x,y){
  const item=findItem(id);if(!item)return;
  if(mode==='hints')cancelHints();search.blur();mode=query?'results':'nav';pendingG=false;pendingY=false;
  selected=id;syncSelection(false);showBookmarkTip(null);status();managementTarget=id;
  menu.replaceChildren();
  const actions=[[t('重命名…'),'rename'],...(!folder(item.node)?[[t('修改链接…'),'url']]:[]),[t('移动到…'),'move'],[t('调整顺序…'),'order'],[folder(item.node)?t('删除文件夹…'):t('删除…'),'delete']];
  for(const [label,action] of actions){
    const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('role','menuitem');
    button.disabled=protectedItem(item);
    if(action==='order' && !(item.parent?.children || []).some(node=>node.id!==id&&node.type!=='separator'&&folder(node)===folder(item.node)))button.disabled=true;
    if(action==='delete')button.className='danger menu-delete';
    button.onclick=()=>{closeMenu(false);openEditor(action);};
    menu.append(button);
  }
  menu.hidden=false;
  const app=document.querySelector('.app').getBoundingClientRect();
  menu.style.left=Math.max(4,Math.min(x-app.left,app.width-menu.offsetWidth-4))+'px';
  menu.style.top=Math.max(4,Math.min(y-app.top,app.height-menu.offsetHeight-4))+'px';
  menu.querySelector('button:not(:disabled)')?.focus();
}
// Collect paths once instead of searching the complete tree for each folder.
function folderEntries(nodes,path=[],entries=[]){
  for(const node of nodes){
    if(!folder(node))continue;
    const fullPath=[...path,node.title || t('未命名')];
    entries.push({node,path:fullPath});
    folderEntries(node.children || [],fullPath,entries);
  }
  return entries;
}
function renderDestinations(){
  destinations.replaceChildren();const item=findItem(managementTarget);
  const blocked=new Set(walk([item.node],0,true).map(x=>x.node.id));
  const term=$('move-search').value.toLocaleLowerCase();
  const matches=folderEntries(roots).filter(entry=>entry.path.join(' / ').toLocaleLowerCase().includes(term));
  if(!matches.some(x=>x.node.id===destination))destination=matches[0]?.node.id || '';
  $('move-empty').hidden=matches.length>0;
  for(const entry of matches){
    const {node}=entry, disabled=blocked.has(node.id)||!!node.unmodifiable;
    const row=document.createElement('button');row.type='button';row.className='destination';row.dataset.id=node.id;
    row.setAttribute('role','option');row.setAttribute('aria-selected',String(destination===node.id));row.setAttribute('aria-disabled',String(disabled));row.tabIndex=destination===node.id?0:-1;
    const label=document.createElement('span');label.textContent=entry.path.join(' / ');row.append(label);
    if(item.parent?.id===node.id || disabled){const note=document.createElement('small');note.textContent=disabled?t('不可选择'):t('当前位置');row.append(note);}
    row.onclick=()=>{destination=node.id;renderDestinations();destinations.querySelector(`[data-id="${node.id}"]`)?.focus();};destinations.append(row);
  }
  const target=findItem(destination);
  $('move-path').textContent=target?t('目标：')+target.path.join(' / '):t('请选择目标目录');
  $('editor-save').disabled=!target || blocked.has(destination) || !!target.node.unmodifiable || destination===item.parent?.id;
}
function updateOrder(focus=false){
  const targets=$('order-targets');
  for(const row of targets.children){
    const active=row.dataset.id===orderTarget;
    row.setAttribute('aria-selected',String(active));row.tabIndex=active?0:-1;
    if(active&&focus){row.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});}
  }
  $('order-before').setAttribute('aria-pressed',String(orderPlacement==='before'));
  $('order-after').setAttribute('aria-pressed',String(orderPlacement==='after'));
  const from=orderItems.findIndex(node=>node.id===managementTarget),anchor=orderItems.findIndex(node=>node.id===orderTarget);
  const slot=anchor+(orderPlacement==='after'?1:0),position=slot-(from<slot?1:0);
  $('order-preview-position').textContent=anchor<0?'—':t('第 {from} 位 → 第 {to} 位',{from:from+1,to:position+1});
  $('editor-save').disabled=anchor<0||position===from;
}
function openEditor(action){
  const item=findItem(managementTarget);if(!item || protectedItem(item))return;
  editAction=action;destination=item.parent?.id || '';$('move-search').value='';
  editor.classList.toggle('ordering',action==='order');pendingOrderG=false;
  $('editor-title').textContent={rename:t('重命名'),url:t('修改链接'),move:t('移动到文件夹'),order:t('调整顺序'),delete:t('确认删除')}[action];
  $('editor-subtitle').textContent=item.node.title || t('未命名');
  $('rename-field').hidden=action!=='rename';$('url-field').hidden=action!=='url';$('move-field').hidden=action!=='move';$('order-field').hidden=action!=='order';$('delete-info').hidden=action!=='delete';
  $('editor-error').textContent='';$('editor-save').disabled=false;
  $('editor-save').textContent={rename:t('保存'),url:t('保存'),move:t('移动到这里'),order:t('保存顺序'),delete:t('删除')}[action];$('editor-save').className=action==='delete'?'danger':'primary';
  if(action==='rename')$('new-name').value=item.node.title;
  if(action==='url')$('new-url').value=item.node.url;
  if(action==='move')renderDestinations();
  if(action==='order'){
    orderItems=item.parent.children.filter(node=>node.type!=='separator'&&folder(node)===folder(item.node));
    const from=orderItems.findIndex(node=>node.id===item.node.id);
    orderTarget=(orderItems[from+1]||orderItems[from-1])?.id||'';orderPlacement=orderItems[from+1]?'before':'after';
    $('editor-subtitle').textContent=item.path.slice(0,-1).join(' / ');
    $('order-source-number').textContent=String(from+1).padStart(2,'0');$('order-source-title').textContent=item.node.title||t('未命名');
    $('order-count').textContent=folder(item.node)?t('{count} 个目录',{count:orderItems.length}):t('{count} 个书签',{count:orderItems.length});
    $('order-targets').replaceChildren(...orderItems.filter(node=>node.id!==item.node.id).map(node=>{
      const row=document.createElement('button');row.type='button';row.className='order-target';row.dataset.id=node.id;row.setAttribute('role','option');
      const number=document.createElement('span');number.className='order-number';number.textContent=String(orderItems.indexOf(node)+1).padStart(2,'0');
      const title=document.createElement('span');title.className='order-name';title.textContent=node.title||t('未命名');
      const mark=document.createElement('span');mark.className='order-mark';mark.textContent='←';mark.setAttribute('aria-hidden','true');row.append(number,title,mark);
      row.onclick=()=>{if(busy)return;orderTarget=node.id;pendingOrderG=false;updateOrder(true);};return row;
    }));
    updateOrder();
  }
  if(action==='delete'){
    const children=walk(item.node.children || [],0,true);
    $('delete-info').textContent=folder(item.node)?t('将删除此文件夹及其中的 {bookmarks} 个书签、{folders} 个子目录。此操作不可撤销。',{bookmarks:children.filter(x=>!folder(x.node)).length,folders:children.filter(x=>folder(x.node)).length}):t('将删除此书签。此操作不可撤销。');
  }
  editor.showModal();
  if(action==='rename'){$('new-name').focus();$('new-name').select();}
  else if(action==='url'){$('new-url').focus();$('new-url').select();}
  else if(action==='move')destinations.querySelector('[tabindex="0"]')?.focus();else if(action==='order')updateOrder(true);else $('editor-cancel').focus();
}
function closeEditor(){if(busy)return;editor.close();list.focus({preventScroll:true});syncSelection(false);}
$('move-search').addEventListener('input',()=>{renderDestinations();destinations.scrollTop=0;});
function focusDestination(){(destinations.querySelector('[tabindex="0"]') || destinations).focus();}
$('editor-cancel').onclick=closeEditor;
for(const placement of ['before','after'])$('order-'+placement).onclick=()=>{if(busy)return;orderPlacement=placement;pendingOrderG=false;updateOrder();};
editor.addEventListener('cancel',event=>{event.preventDefault();closeEditor();});
$('editor-form').onsubmit=async event=>{
  event.preventDefault();if(busy)return;
  const item=findItem(managementTarget);if(!item || protectedItem(item)){$('editor-error').textContent=t('条目已变更，无法操作');return;}
  const name=$('new-name').value.trim(), url=$('new-url').value.trim(), target=findItem(destination);
  if(editAction==='rename' && !name){$('editor-error').textContent=t('请输入名称');return;}
  if(editAction==='url'){
    try{if(folder(item.node))throw Error();new URL(url);}
    catch{$('editor-error').textContent=t('请输入有效的链接地址');return;}
  }
  if(editAction==='move' && (!target || !folder(target.node) || target.node.unmodifiable || target.node.id===item.parent.id || walk([item.node],0,true).some(x=>x.node.id===destination))){$('editor-error').textContent=t('请选择有效的目标目录');return;}
  const oldIndex=rows.findIndex(x=>x.node.id===managementTarget);
  const neighbor=rows.slice(oldIndex+1).find(x=>!walk([item.node],0,true).some(y=>y.node.id===x.node.id)) || rows[oldIndex-1];
  busy=true;$('editor-save').disabled=true;$('editor-cancel').disabled=true;
  try{
    if(editAction==='rename')await chrome.bookmarks.update(item.node.id,{title:name});
    if(editAction==='url')await chrome.bookmarks.update(item.node.id,{url});
    if(editAction==='move')await chrome.bookmarks.move(item.node.id,{parentId:destination});
    if(editAction==='order'){
      const currentRoots=(await chrome.bookmarks.getTree())[0].children,current=findItem(managementTarget,currentRoots),anchor=findItem(orderTarget,currentRoots);
      if(!current||protectedItem(current)||!anchor||current.parent.id!==anchor.parent?.id||folder(current.node)!==folder(anchor.node))throw Error(t('条目已变更，无法操作'));
      const siblings=current.parent.children,from=siblings.findIndex(node=>node.id===current.node.id),slot=siblings.findIndex(node=>node.id===anchor.node.id)+(orderPlacement==='after'?1:0),position=slot-(from<slot?1:0);
      const firefox=chrome.runtime.getURL('/').startsWith('moz-extension:');
      if(position!==from)await chrome.bookmarks.move(current.node.id,{index:firefox?position:slot});
    }
    if(editAction==='delete')await chrome.bookmarks[folder(item.node)?'removeTree':'remove'](item.node.id);
    roots=(await chrome.bookmarks.getTree())[0].children;
    if(editAction==='move' || editAction==='delete')selected=neighbor?.node.id || '';
    busy=false;editor.close();render();list.focus({preventScroll:true});syncSelection();
    message(editAction==='move'?t('已移动到 ')+target.path.join(' / '):editAction==='delete'?t('已删除'):editAction==='url'?t('已修改链接地址'):editAction==='order'?t('已调整顺序'):t('已重命名'));
  }catch(error){$('editor-error').textContent=t('操作失败：')+error.message;}
  finally{busy=false;$('editor-save').disabled=false;$('editor-cancel').disabled=false;}
};
document.addEventListener('pointerdown',event=>{if(!menu.hidden && !menu.contains(event.target))closeMenu(false);});
document.addEventListener('keydown',event=>{
  if(editor.open){
    event.stopImmediatePropagation();
    if(busy){event.preventDefault();return;}
    if(event.isComposing || event.keyCode===229)return;
    if(editAction==='move'){
      const input=$('move-search');
      if(event.target===input){
        if(event.key==='Escape'||event.key==='Enter'){event.preventDefault();focusDestination();}
        return;
      }
      if(event.key==='/' && !event.ctrlKey && !event.metaKey && !event.altKey){event.preventDefault();input.focus();return;}
      if(event.key==='Escape' && input.value){event.preventDefault();input.value='';renderDestinations();focusDestination();return;}
    }
    if(event.key==='Escape'){event.preventDefault();closeEditor();return;}
    if(editAction==='order'){
      if(event.ctrlKey||event.metaKey||event.altKey)return;
      const key=({ArrowDown:'j',ArrowUp:'k',ArrowLeft:'h',ArrowRight:'l',Home:'Home',End:'G'})[event.key]||event.key;
      if(!['j','k','h','l','d','u','g','G','Home','Enter'].includes(key)){pendingOrderG=false;return;}
      event.preventDefault();
      if(key==='Enter'){
        pendingOrderG=false;if(event.repeat)return;
        if(document.activeElement===$('editor-cancel'))closeEditor();else if(!$('editor-save').disabled)$('editor-form').requestSubmit();return;
      }
      if(key==='g'&&!pendingOrderG){pendingOrderG=!event.repeat;return;}
      if(key==='g'&&event.repeat)return;
      pendingOrderG=false;
      const targets=orderItems.filter(node=>node.id!==managementTarget),index=targets.findIndex(node=>node.id===orderTarget);
      if(key==='h'||key==='l')orderPlacement=key==='h'?'before':'after';
      else if(key==='d'||key==='u'){
        const container=$('order-targets'),height=container.children[index]?.offsetHeight||1;
        const step=Math.max(1,Math.floor(container.clientHeight/height/2))*(key==='d'?1:-1);
        const next=Math.max(0,Math.min(targets.length-1,index+step));
        orderTarget=targets[next]?.id||'';container.scrollTop+=(next-index)*height;
      }
      else orderTarget=targets[key==='g'||key==='Home'?0:key==='G'?targets.length-1:Math.max(0,Math.min(targets.length-1,index+(key==='j'?1:-1)))]?.id||'';
      updateOrder(true);return;
    }
    if(editAction==='delete'){
      const key=({ArrowLeft:'h',ArrowRight:'l'})[event.key] || event.key;
      if(key==='h'||key==='l'){
        event.preventDefault();
        const buttons=[...editor.querySelectorAll('.editor-actions button:not(:disabled)')];
        const index=buttons.indexOf(document.activeElement);
        if(index>=0)buttons[Math.max(0,Math.min(buttons.length-1,index+(key==='l'?1:-1)))].focus();
      }
      if(['ArrowUp','ArrowDown','j','k'].includes(key))event.preventDefault();
      if(key==='Enter'){event.preventDefault();if(document.activeElement===$('editor-save'))$('editor-form').requestSubmit();else closeEditor();}
      return;
    }
    if(editAction!=='move' || !destinations.contains(event.target))return;
    const key=({ArrowDown:'j',ArrowUp:'k',ArrowLeft:'h',ArrowRight:'l'})[event.key] || event.key;
    if(!['j','k','h','l','Enter'].includes(key))return;
    event.preventDefault();const items=[...destinations.children], index=items.indexOf(document.activeElement), row=items[index];if(!row)return;
    if(['j','k','h','l'].includes(key))items[Math.max(0,Math.min(items.length-1,index+(['j','l'].includes(key)?1:-1)))].click();
    if(key==='Enter'&&!$('editor-save').disabled)$('editor-form').requestSubmit();return;
  }
  if(!menu.hidden){
    event.stopImmediatePropagation();
    const buttons=[...menu.querySelectorAll('button:not(:disabled)')], index=buttons.indexOf(document.activeElement);
    if(['j','k','ArrowDown','ArrowUp','Tab'].includes(event.key)){event.preventDefault();const delta=['k','ArrowUp'].includes(event.key)||event.shiftKey?-1:1;buttons[(index+delta+buttons.length)%buttons.length].focus();}
    if(event.key==='Escape'){event.preventDefault();closeMenu();}
    return;
  }
  if(marksDialog.open||markConfirm.open)return;
  const menuKey=event.key==='m' && (mode==='nav'||mode==='results') && !event.ctrlKey && !event.metaKey && !event.altKey && !event.isComposing;
  if(menuKey || (event.shiftKey&&event.key==='F10')||event.key==='ContextMenu'){
    const row=list.querySelector('.row.selected');if(!row || document.activeElement===search)return;
    event.preventDefault();event.stopImmediatePropagation();const rect=row.getBoundingClientRect();openItemMenu(selected,rect.left,rect.bottom);
  }
},true);
