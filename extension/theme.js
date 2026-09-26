/* Follow the browser's color preference unless the user chooses an explicit theme. */
const colorPreference=matchMedia('(prefers-color-scheme: dark)');
const themeSelect=document.getElementById('theme-select');
let themePreference='system';
function applyTheme(){
  document.documentElement.dataset.theme=themePreference==='system'?(colorPreference.matches?'dark':'light'):themePreference;
  themeSelect.value=themePreference;
}
colorPreference.addEventListener('change',()=>{if(themePreference==='system')applyTheme();});
applyTheme();
themeSelect.disabled=true;
const themeReady=(async()=>{
  try{
    const saved=(startupData?.settings || await chrome.storage.local.get('quokmarkTheme')).quokmarkTheme;
    if(['system','light','dark'].includes(saved))themePreference=saved;
  }catch{/* Keep the automatic default when preferences are unavailable. */}
  finally{applyTheme();themeSelect.disabled=false;}
})();
themeSelect.addEventListener('change',async()=>{
  const previous=themePreference;
  themePreference=themeSelect.value;applyTheme();themeSelect.disabled=true;
  try{await chrome.storage.local.set({quokmarkTheme:themePreference});}
  catch{themePreference=previous;applyTheme();message(t('主题保存失败，请重试'));}
  finally{themeSelect.disabled=false;themeSelect.focus();}
});
