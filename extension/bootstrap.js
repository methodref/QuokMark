// Chromium may embed startup data; Firefox reads it through the extension APIs.
const startupData=JSON.parse(document.getElementById('startup-data')?.textContent || 'null');
