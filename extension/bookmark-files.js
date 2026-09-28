/* File formats contain bookmark data, never browser-specific IDs. */
const bookmarkFiles=(()=>{
  const isFolder=node=>Array.isArray(node.children);
  const copy=node=>node.url?{title:node.title,url:node.url}:{title:node.title,children:(node.children || []).filter(child=>child.type!=='separator').map(copy)};
  const counts=nodes=>nodes.reduce((sum,node)=>{if(node.type==='separator')return sum;if(isFolder(node)){sum.folders++;const nested=counts(node.children);sum.folders+=nested.folders;sum.bookmarks+=nested.bookmarks;}else sum.bookmarks++;return sum;},{folders:0,bookmarks:0});
  function normalize(nodes){
    if(!Array.isArray(nodes))throw Error(t('文件中的书签结构无效'));
    return nodes.map(node=>{
      if(!node || typeof node.title!=='string')throw Error(t('文件中的书签结构无效'));
      if(typeof node.url==='string'){
        try{new URL(node.url);}catch{throw Error(t('文件中包含无效网址：')+node.url);}
        return {title:node.title,url:node.url};
      }
      if(!Array.isArray(node.children))throw Error(t('文件中的书签结构无效'));
      return {title:node.title,children:normalize(node.children)};
    });
  }
  function exportSelection(roots,ids){
    const entries=new Map();
    function visit(nodes,parent=null,chosen=false){
      for(const node of nodes){
        if(node.url || node.type==='separator')continue;
        const selected=ids.has(node.id);
        entries.set(node.id,{node,parent,chosen:chosen||selected});
        visit(node.children || [],node.id,chosen||selected);
      }
    }
    visit(roots);
    let forest=[...entries.values()].filter(entry=>ids.has(entry.node.id)&&!entries.get(entry.parent)?.chosen).map(entry=>({id:entry.node.id,data:copy(entry.node)}));
    // Wrap colliding names with their source parents, merging shared ancestors by ID.
    while(true){
      const names=new Map();for(const entry of forest)names.set(entry.data.title,(names.get(entry.data.title)||0)+1);
      if(!forest.some(entry=>names.get(entry.data.title)>1&&entries.get(entry.id).parent))break;
      const next=new Map();
      for(const entry of forest){
        const parent=names.get(entry.data.title)>1&&entries.get(entry.id).parent;
        if(parent){
          if(!next.has(parent))next.set(parent,{id:parent,data:{title:entries.get(parent).node.title,children:[]}});
          next.get(parent).data.children.push(entry.data);
        }else if(next.has(entry.id))next.get(entry.id).data.children.push(...entry.data.children);
        else next.set(entry.id,entry);
      }
      forest=[...next.values()];
    }
    return forest.map(entry=>entry.data);
  }
  const markdownEscape=text=>text.replace(/&/g,'&amp;').replace(/\\/g,'\\\\').replace(/([`*_{}\[\]()#+.!<>~-])/g,'\\$1').replace(/\r/g,'&#13;').replace(/\n/g,'&#10;');
  const htmlEscape=text=>text.replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  function write(nodes,format){
    if(format==='json')return JSON.stringify({format:'quokmark-bookmarks',version:1,items:nodes},null,2)+'\n';
    if(format==='markdown'){
      const lines=[];
      function visit(items,depth=0){for(const node of items){const title=markdownEscape(node.title);lines.push('  '.repeat(depth)+'- '+(isFolder(node)?'**'+title+'**':'['+title+'](<'+node.url.replace(/&/g,'&amp;').replace(/\\/g,'\\\\').replace(/[<>\s]/g,char=>encodeURIComponent(char))+'>)'));if(isFolder(node))visit(node.children,depth+1);}}
      visit(nodes);return lines.join('\n')+'\n';
    }
    const lines=['<!DOCTYPE NETSCAPE-Bookmark-file-1>','<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">','<TITLE>Bookmarks</TITLE>','<H1>Bookmarks</H1>'];
    function visit(items,depth=0){const indent='    '.repeat(depth);lines.push(indent+'<DL><p>');for(const node of items){const title=htmlEscape(node.title);if(isFolder(node)){lines.push(indent+'    <DT><H3>'+title+'</H3>');visit(node.children,depth+1);}else lines.push(indent+'    <DT><A HREF="'+htmlEscape(node.url)+'">'+title+'</A>');}lines.push(indent+'</DL><p>');}
    visit(nodes);return lines.join('\n')+'\n';
  }
  function decodeEntities(text){const entity=document.createElement('textarea');entity.innerHTML=text;return entity.value;}
  function markdownText(text){
    const plain=text.trim().replace(/^(\*\*|__)([\s\S]*)\1$/,'$2');
    return decodeEntities(plain.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g,'$1'));
  }
  function markdownItem(text,line){
    // Parse a complete inline link, including escaped labels and balanced URL parentheses.
    if(text.startsWith('[')){
      let end=1;for(;end<text.length;end++){if(text[end]==='\\'){end++;continue;}if(text[end]===']')break;}
      const tail=text.slice(end+1).trim();
      if(text[end]!==']'||!tail.startsWith('('))return {title:markdownText(text),children:[]};
      if(!tail.endsWith(')'))throw Error(t('Markdown 链接格式无效，第 {line} 行',{line}));
      let destination=tail.slice(1,-1).trim(),url='';
      if(destination.startsWith('<')){const close=destination.indexOf('>');if(close<0)throw Error(t('Markdown 链接格式无效，第 {line} 行',{line}));url=destination.slice(1,close);destination=destination.slice(close+1).trim();}
      else{let depth=0,index=0;for(;index<destination.length;index++){const char=destination[index];if(char==='\\'){index++;continue;}if(char==='(')depth++;if(char===')')depth--;if(/\s/.test(char)&&depth===0)break;}if(depth!==0)throw Error(t('Markdown 链接格式无效，第 {line} 行',{line}));url=destination.slice(0,index).replace(/\\([\\()])/g,'$1');destination=destination.slice(index).trim();}
      if(destination&&!/^(?:"[^"\n]*"|'[^'\n]*'|\([^\n]*\))$/.test(destination))throw Error(t('Markdown 链接格式无效，第 {line} 行',{line}));
      return {title:markdownText(text.slice(1,end)),url:decodeEntities(url.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~])/g,'$1'))};
    }
    return {title:markdownText(text),children:[]};
  }
  function readMarkdown(text){
    const nodes=[],stack=[{indent:0,children:nodes}];let previous=null,baseIndent=null;
    for(const [index,line] of text.replace(/^\uFEFF/,'').split(/\r?\n/).entries()){
      if(!line.trim())continue;
      const match=line.replace(/\t/g,'    ').match(/^( *)(?:[-+*]|\d+[.)]) +(.+)$/);
      if(!match)throw Error(t('Markdown 仅支持嵌套列表，第 {line} 行',{line:index+1}));
      baseIndent ??= match[1].length;
      const indent=match[1].length-baseIndent,node=markdownItem(match[2].trim(),index+1);
      if(indent>stack.at(-1).indent){if(!previous||!isFolder(previous))throw Error(t('书签下不能包含子条目'));stack.push({indent,children:previous.children});}
      else while(stack.length>1&&indent<stack.at(-1).indent)stack.pop();
      if(indent!==stack.at(-1).indent)throw Error(t('Markdown 列表缩进无效，第 {line} 行',{line:index+1}));
      stack.at(-1).children.push(node);previous=node;
    }
    return nodes;
  }
  function readHTML(text){
    const doc=new DOMParser().parseFromString(text,'text/html'),root=doc.querySelector('dl');let ignored=0;
    if(!root)throw Error(t('请选择浏览器导出的书签 HTML 文件'));
    function readList(list){
      const nodes=[];let pending=null;
      function visit(elements){for(const element of elements){
        if(element.tagName==='P'){visit(element.children);continue;}
        if(element.tagName==='HR'){ignored++;continue;}
        if(element.tagName==='DL'){if(pending){pending.children=readList(element);pending=null;}continue;}
        if(element.tagName!=='DT')continue;
        const label=[...element.children].find(child=>child.tagName==='H3'||child.tagName==='A');
        if(!label){ignored+=element.querySelectorAll('hr').length;continue;}
        if(label.tagName==='A'){nodes.push({title:label.textContent,url:label.getAttribute('href') || ''});pending=null;}
        else{pending={title:label.textContent,children:[]};nodes.push(pending);const nested=[...element.children].find(child=>child.tagName==='DL');if(nested){pending.children=readList(nested);pending=null;}}
      }}
      visit(list.children);return nodes;
    }
    return {items:readList(root),ignored};
  }
  async function read(file){
    const text=await file.text(),extension=file.name.split('.').at(-1).toLowerCase();let result;
    if(extension==='json'){
      const data=JSON.parse(text.replace(/^\uFEFF/,''));
      if(data?.format!=='quokmark-bookmarks'||data.version!==1)throw Error(t('请选择本插件导出的 JSON 文件；不支持 Firefox 专用备份'));
      result={items:data.items,ignored:0};
    }else if(['md','markdown'].includes(extension))result={items:readMarkdown(text),ignored:0};
    else if(['html','htm'].includes(extension))result=readHTML(text);
    else throw Error(t('请选择 JSON、Markdown 或 HTML 文件'));
    result.items=normalize(result.items);if(!result.items.length)throw Error(t('文件中没有可导入的书签或目录'));return result;
  }
  function plan(items,parent){
    const used=new Set();
    return items.map(node=>{
      const old=(parent.children || []).find(child=>!used.has(child.id)&&child.type!=='separator'&&(isFolder(node)?!child.url&&child.title===node.title:child.url===node.url));
      if(old)used.add(old.id);
      return {node,old,protected:!!(old?.folderType||old?.unmodifiable),counts:old?counts(old.children || []):{folders:0,bookmarks:0}};
    });
  }
  const signature=operations=>JSON.stringify(operations.map(operation=>operation.old?{id:operation.old.id,data:copy(operation.old),protected:operation.protected}:null));
  async function create(node,parentId,index){
    const created=await chrome.bookmarks.create({parentId,title:node.title,...(isFolder(node)?{}:{url:node.url}),...(index===undefined?{}:{index})});
    try{if(isFolder(node))for(const child of node.children)await create(child,created.id);return created;}
    catch(error){await chrome.bookmarks[isFolder(node)?'removeTree':'remove'](created.id);throw error;}
  }
  async function apply(operations,parentId,replace){
    let added=0,replaced=0,skipped=0;
    for(const operation of operations){
      const {node,old}=operation;
      if(old&&(!replace||operation.protected)){skipped++;continue;}
      if(old&&!isFolder(node)){await chrome.bookmarks.update(old.id,{title:node.title});replaced++;continue;}
      const created=await create(node,parentId,old?.index);
      if(old){try{await chrome.bookmarks.removeTree(old.id);}catch(error){await chrome.bookmarks.removeTree(created.id);throw error;}replaced++;}
      else added++;
    }
    return {added,replaced,skipped};
  }
  return {exportSelection,write,read,counts,plan,signature,apply};
})();
