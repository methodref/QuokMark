/* Import and export stay inside the access popup. */
const transfer=$('bookmark-transfer');
const commandLine=$('command-line'),commandInput=$('command-input');
let transferAction='', exportFolders=new Set(), importData=null, importPlan=[], transferBusy=false, transferRead=0, exportFormatProvided=false;
function closeTransfer(){if(transferBusy)return;transferRead++;transfer.close();list.focus({preventScroll:true});syncSelection(false);}
function showTransferError(error){$('transfer-error').textContent=t('操作失败：')+error.message;}
function renderExportFolders(){
  const tree=$('export-tree');tree.replaceChildren();
  function append(nodes,parent,ancestorSelected=false){
    for(const node of nodes){
      if(!folder(node))continue;
      const children=(node.children || []).filter(folder),selected=exportFolders.has(node.id);
      const branch=document.createElement(children.length?'details':'div');branch.className='export-branch';
      const label=document.createElement('label'),input=document.createElement('input'),name=document.createElement('span');
      input.type='checkbox';input.checked=ancestorSelected||selected;input.disabled=ancestorSelected;name.textContent=node.title || t('未命名');
      input.onchange=()=>{
        if(input.checked){exportFolders.add(node.id);for(const entry of walk(node.children || [],0,true))exportFolders.delete(entry.node.id);}
        else exportFolders.delete(node.id);
        $('transfer-error').textContent='';
        const expanded=new Set([...tree.querySelectorAll('details[open]')].map(element=>element.dataset.id));
        renderExportFolders();for(const element of tree.querySelectorAll('details'))element.open=expanded.has(element.dataset.id);
        focusExportRow(tree.querySelector(`[data-folder-id="${node.id}"]`));
      };
      label.dataset.folderId=node.id;label.className='export-row';label.tabIndex=-1;label.append(input,name);
      if(children.length){const summary=document.createElement('summary');summary.append(label);branch.append(summary);branch.dataset.id=node.id;
        const subtree=document.createElement('div');subtree.className='export-children';append(children,subtree,ancestorSelected||selected);branch.append(subtree);
        branch.open=selected||children.some(child=>walk([child],0,true).some(entry=>exportFolders.has(entry.node.id)));
      }else branch.append(label);
      parent.append(branch);
    }
  }
  append(roots,tree);
  $('transfer-save').disabled=exportFolders.size===0;
  $('transfer-summary').textContent=t('已选择 {count} 个目录；包含完整子树',{count:exportFolders.size});
}
function exportRows(){
  const tree=$('export-tree');
  return [...tree.querySelectorAll('.export-row')].filter(row=>{
    for(let parent=row.parentElement;parent&&parent!==tree;parent=parent.parentElement){
      if(parent.tagName==='DETAILS'&&!parent.open&&!parent.firstElementChild.contains(row))return false;
    }
    return true;
  });
}
function focusExportRow(row){
  if(!row)return;
  for(const item of $('export-tree').querySelectorAll('.export-row'))item.tabIndex=item===row?0:-1;
  row.focus({preventScroll:true});row.scrollIntoView({block:'nearest'});
}
function exportTreeKey(event){
  const key=({ArrowDown:'j',ArrowUp:'k',ArrowLeft:'h',ArrowRight:'l'})[event.key]||event.key;
  if(!['j','k','h','l',' ','Enter'].includes(key))return;
  event.preventDefault();
  const items=exportRows(),row=event.target.closest('.export-row')||event.target.closest('summary')?.querySelector('.export-row')||items[0];
  if(!row)return;
  const index=items.indexOf(row),branch=row.closest('.export-branch');
  if(key==='j'||key==='k')focusExportRow(items[Math.max(0,Math.min(items.length-1,index+(key==='j'?1:-1)))]);
  if(key==='h'){
    if(branch.tagName==='DETAILS'&&branch.open)branch.open=false;
    else focusExportRow(branch.parentElement.closest('.export-branch')?.querySelector(':scope > summary > .export-row'));
  }
  if(key==='l'&&branch.tagName==='DETAILS'){
    if(!branch.open)branch.open=true;
    else focusExportRow(branch.querySelector('.export-children .export-row'));
  }
  if(key===' '&&!event.repeat){const input=row.querySelector('input');if(!input.disabled)input.click();}
  if(key==='Enter'){
    if(!exportFolders.size){$('transfer-error').textContent=t('请选择至少一个目录');return;}
    (exportFormatProvided?$('transfer-save'):$('export-format')).focus();
  }
}
function renderImportPreview(){
  const target=findItem($('import-destination').value),preview=$('import-preview');preview.replaceChildren();
  importPlan=importData&&target?bookmarkFiles.plan(importData.items,target.node):[];
  const conflicts=importPlan.filter(operation=>operation.old),replace=$('import-policy').value==='replace';
  $('import-conflicts').hidden=!conflicts.length;
  for(const operation of conflicts){
    const row=document.createElement('li');row.textContent=(operation.old.title || t('未命名'))+' — '+(operation.protected?t('受保护，始终跳过'):folder(operation.old)?t('覆盖将删除 {bookmarks} 个书签、{folders} 个子目录',{...operation.counts}):t('重复网址，覆盖将更新名称'));preview.append(row);
  }
  const removed=conflicts.filter(operation=>!operation.protected).reduce((sum,operation)=>({bookmarks:sum.bookmarks+operation.counts.bookmarks,folders:sum.folders+operation.counts.folders}),{bookmarks:0,folders:0});
  $('import-warning').hidden=!replace||!conflicts.some(operation=>!operation.protected);
  $('import-warning').textContent=t('完全覆盖：重复目录及其全部内容将被删除，用文件内容替换；不会合并。重复书签将更新名称。将删除 {bookmarks} 个书签、{folders} 个子目录。此操作不可撤销。',removed);
  $('transfer-save').textContent=replace&&conflicts.length?t('覆盖并导入'):t('导入');
  $('transfer-save').className=replace&&conflicts.length?'danger':'primary';
  $('transfer-save').disabled=!importData||!target||!!target.node.unmodifiable;
  if(importData){const count=bookmarkFiles.counts(importData.items);$('transfer-summary').textContent=t('文件包含 {bookmarks} 个书签、{folders} 个目录；{conflicts} 项重复', {...count,conflicts:conflicts.length})+(importData.ignored?t('；忽略 {count} 个分隔符',{count:importData.ignored}):'');}
}
function openTransfer(action,{targetId=selected,format}={}){
  finishFolderMotion();showBookmarkTip(null);transferAction=action;importData=null;importPlan=[];exportFolders=new Set();transferRead++;
  const fallback=roots.find(node=>folder(node)&&(action==='export'||!node.unmodifiable));
  const item=findItem(targetId)||(fallback&&findItem(fallback.id));if(!item)return;
  const parent=folder(item.node)?item.node:item.parent;
  $('transfer-title').textContent=action==='export'?t('导出目录'):t('导入书签');
  $('export-fields').hidden=action!=='export';$('import-fields').hidden=action!=='import';
  $('transfer-summary').textContent='';$('transfer-error').textContent='';$('import-file').value='';$('import-policy').value='skip';
  $('transfer-save').textContent=action==='export'?t('导出'):t('导入');$('transfer-save').className='primary';
  exportFormatProvided=Boolean(format);
  if(action==='export'){if(format)$('export-format').value=format;if(parent)exportFolders.add(parent.id);renderExportFolders();}
  else{
    const options=folderEntries(roots).filter(entry=>!entry.node.unmodifiable).map(entry=>{const option=document.createElement('option');option.value=entry.node.id;option.textContent=entry.path.join(' / ');return option;});
    $('import-destination').replaceChildren(...options);if(parent&&!parent.unmodifiable)$('import-destination').value=parent.id;renderImportPreview();
  }
  transfer.showModal();
  if(action==='export')focusExportRow($('export-tree').querySelector(`[data-folder-id="${parent?.id}"]`)||exportRows()[0]);
  else $('import-file').focus();
}
$('transfer-cancel').onclick=closeTransfer;
transfer.addEventListener('cancel',event=>{event.preventDefault();closeTransfer();});
$('import-destination').onchange=renderImportPreview;
$('import-policy').onchange=renderImportPreview;
$('import-file').onchange=async()=>{
  const version=++transferRead,file=$('import-file').files[0];importData=null;$('transfer-error').textContent='';renderImportPreview();$('transfer-summary').textContent='';
  if(!file)return;
  try{const data=await bookmarkFiles.read(file);if(version!==transferRead||!transfer.open)return;importData=data;renderImportPreview();$('import-destination').focus();}
  catch(error){if(version===transferRead&&transfer.open)showTransferError(error);}
};
$('transfer-form').onsubmit=async event=>{
  event.preventDefault();if(transferBusy)return;$('transfer-error').textContent='';
  if(transferAction==='export'){
    const ids=new Set(exportFolders);transferBusy=true;$('transfer-save').disabled=true;$('transfer-cancel').disabled=true;
    try{
      const tree=(await chrome.bookmarks.getTree())[0].children;
      const nodes=bookmarkFiles.exportSelection(tree,ids);if(!nodes.length)throw Error(t('请选择至少一个目录'));
      const format=$('export-format').value,extension={json:'json',markdown:'md',html:'html'}[format],mime={json:'application/json',markdown:'text/markdown',html:'text/html'}[format];
      const url=URL.createObjectURL(new Blob([bookmarkFiles.write(nodes,format)],{type:mime+';charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='quokmark-bookmarks-'+new Date().toISOString().slice(0,10)+'.'+extension;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
      transferBusy=false;closeTransfer();message(t('已导出所选目录'));
    }catch(error){showTransferError(error);}
    finally{transferBusy=false;$('transfer-cancel').disabled=false;if(transfer.open)renderExportFolders();}
    return;
  }
  if(!importData)return;
  transferBusy=true;let applying=false;for(const input of transfer.querySelectorAll('input,select,button'))input.disabled=true;
  try{
    const previous=bookmarkFiles.signature(importPlan),parentId=$('import-destination').value;
    roots=(await chrome.bookmarks.getTree())[0].children;
    const target=findItem(parentId);if(!target||target.node.unmodifiable)throw Error(t('请选择有效的目标目录'));
    const operations=bookmarkFiles.plan(importData.items,target.node);
    if(bookmarkFiles.signature(operations)!==previous){renderImportPreview();throw Error(t('书签已变化，请查看更新后的预览，再次确认导入'));}
    applying=true;const result=await bookmarkFiles.apply(operations,parentId,$('import-policy').value==='replace');
    roots=(await chrome.bookmarks.getTree())[0].children;transferBusy=false;transfer.close();render();list.focus({preventScroll:true});syncSelection();
    message(t('导入完成：新增 {added} 项，覆盖 {replaced} 项，跳过 {skipped} 项',result));
  }catch(error){
    showTransferError(error);if(applying)$('transfer-error').textContent+=' '+t('导入已中断，部分条目可能已完成；请检查书签和更新后的预览。');
    try{roots=(await chrome.bookmarks.getTree())[0].children;render();renderImportPreview();}catch{/* Keep the original operation error visible. */}
  }finally{transferBusy=false;for(const input of transfer.querySelectorAll('input,select,button'))input.disabled=false;if(transferAction==='import')renderImportPreview();}
};
document.addEventListener('keydown',event=>{
  if(transfer.open){
    event.stopImmediatePropagation();
    if(transferBusy){event.preventDefault();return;}
    if(event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key==='Enter'&&event.repeat){event.preventDefault();return;}
    if(event.key==='Escape'){event.preventDefault();closeTransfer();return;}
    if(transferAction==='export'&&$('export-tree').contains(event.target)){exportTreeKey(event);return;}
    if(event.target.tagName==='SELECT'){
      const input=event.target,key=({ArrowDown:'j',ArrowUp:'k'})[event.key]||event.key;
      if(key==='j'||key==='k'){
        event.preventDefault();input.selectedIndex=Math.max(0,Math.min(input.options.length-1,input.selectedIndex+(key==='j'?1:-1)));input.onchange?.();
      }
      if(key==='Enter'){
        event.preventDefault();
        (input.id==='import-destination'&&!importData?$('import-file'):input.id==='import-destination'&&!$('import-conflicts').hidden?$('import-policy'):$('transfer-save')).focus();
      }
    }
    return;
  }
  if(!commandLine.hidden){
    event.stopImmediatePropagation();
    if(event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey)return;
    if(event.key==='Enter'&&event.repeat){event.preventDefault();return;}
    if(event.key==='Escape'){event.preventDefault();closeBookmarkCommand();}
    if(event.key==='Tab'){event.preventDefault();completeBookmarkCommand(event.shiftKey);}
    if(event.key==='Enter'){event.preventDefault();executeBookmarkCommand();}
    return;
  }
  if(event.key===':'&&!event.isComposing&&!event.ctrlKey&&!event.metaKey&&!event.altKey&&['nav','results'].includes(mode)&&!managementOpen()){
    event.preventDefault();event.stopImmediatePropagation();pendingG=false;pendingZ=false;pendingY=false;finishFolderMotion();
    mode='command';commandLine.hidden=false;app.classList.add('commanding');commandInput.value='';$('command-error').textContent='';completionCandidates=[];completionIndex=-1;showBookmarkTip(null);status();commandInput.focus();
  }
},true);
const bookmarkCommands=['r','read','import','w','write','export'];
const exportCommandFormats={json:'json',md:'markdown',markdown:'markdown',html:'html'};
let completionCandidates=[],completionIndex=-1;
function closeBookmarkCommand(focus=true){
  commandLine.hidden=true;app.classList.remove('commanding');mode=query?'results':'nav';status();
  if(focus)list.focus({preventScroll:true});showBookmarkTip(list.querySelector('.bookmark.selected'));
}
function completeBookmarkCommand(reverse=false){
  const value=commandInput.value.trimStart().replace(/^:/,'').toLowerCase();
  if(completionIndex<0||commandInput.value!==completionCandidates[completionIndex]){
    const parts=value.split(/\s+/);
    completionCandidates=parts.length===1?bookmarkCommands.filter(command=>command.startsWith(parts[0])):parts.length===2&&['w','write','export'].includes(parts[0])?Object.keys(exportCommandFormats).filter(format=>format.startsWith(parts[1])).map(format=>parts[0]+' '+format):[];
    completionIndex=completionCandidates.indexOf(value);
  }
  if(!completionCandidates.length)return;
  if(completionIndex<0&&reverse)completionIndex=0;
  completionIndex=(completionIndex+(reverse?-1:1)+completionCandidates.length)%completionCandidates.length;commandInput.value=completionCandidates[completionIndex];$('command-error').textContent='';
}
function executeBookmarkCommand(){
  const [command,...args]=commandInput.value.trim().replace(/^:/,'').toLowerCase().split(/\s+/);
  const importing=['r','read','import'].includes(command),exporting=['w','write','export'].includes(command);
  if(!importing&&!exporting){$('command-error').textContent=t('未知命令：使用 r 导入或 w 导出');return;}
  if((importing&&args.length)||args.length>1||(args.length&&!Object.hasOwn(exportCommandFormats,args[0]))){$('command-error').textContent=t('用法：r 导入；w [json|md|html] 导出');return;}
  closeBookmarkCommand();openTransfer(importing?'import':'export',{format:args[0]?exportCommandFormats[args[0]]:undefined});
}
commandInput.addEventListener('input',()=>{completionCandidates=[];completionIndex=-1;$('command-error').textContent='';});
document.addEventListener('pointerdown',event=>{if(!commandLine.hidden&&!commandLine.contains(event.target))closeBookmarkCommand(false);},true);
