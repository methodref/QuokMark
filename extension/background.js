// Keep initial bookmark data in the document load, before the native popup appears.
const startupPlaceholder='<script id="startup-data" type="application/json">null</script>';
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET'||request.destination!=='document'||request.url!==chrome.runtime.getURL('index.html'))return;
  event.respondWith(popupResponse(request));
});
async function popupResponse(request){
  const original=fetch(request);
  try{
    const [response,tree,settings]=await Promise.all([
      original,
      chrome.bookmarks.getTree(),
      chrome.storage.local.get(['linkcoveState','linkcoveDemo','linkcoveLanguage','quokmarkTheme'])
    ]);
    if(!response.ok)return response;
    const html=await response.clone().text();
    if(!html.includes(startupPlaceholder))return response;
    const data=JSON.stringify({tree,settings}).replace(/</g,'\\u003c');
    const body=html.replace(startupPlaceholder,()=>`<script id="startup-data" type="application/json">${data}</script>`);
    const headers=new Headers(response.headers);
    headers.delete('content-length');
    return new Response(body,{status:response.status,statusText:response.statusText,headers});
  }catch{
    // The packaged page retains its normal API fallback and visible error handling.
    return original;
  }
}
