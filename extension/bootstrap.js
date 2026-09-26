// The worker provides data only; all executable code stays in the extension package.
const startupData=JSON.parse(document.getElementById('startup-data')?.textContent || 'null');
