const defaultData = {
  settings: {
    siteName: "Kandarp Tours & Travels",
    logo: "",
    favicon: '',
    themeColor: "#0a7cff",
    headerBg: '#0a7cff',
    fontFamily: "Inter",
    fontColor: "#0f172a",
    heroTitle: "Explore curated travel packages",
    heroSubtitle: "Discover memorable journeys and experiences",
  },
  auth: { username: "kandarp@gmail.com", password: "Mohit@2026-26" },
  packages: [],
  testimonials: []
};

let siteData = defaultData;

function getData() { return siteData; }

function saveData(data) {
  siteData = data;
  // POST to server to write data.json and regenerate CSVs
  fetch('/data', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(data) }).then(r=>r.json()).then(res=>{
    if (res && res.ok) {
      window.dispatchEvent(new CustomEvent('serverSync', { detail: { ok:true, action:'save' } }));
      // refresh from server to get canonical representation
      try{ syncFromServer(); }catch(e){}
    } else {
      window.dispatchEvent(new CustomEvent('serverSync', { detail: { ok:false, action:'save' } }));
    }
  }).catch(()=> window.dispatchEvent(new CustomEvent('serverSync', { detail: { ok:false, action:'save' } })) );
}

// Initialize in-memory data from server on load
function syncFromServer(){
  fetch('/data').then(r=>r.json()).then(res=>{
    if (res && res.ok && res.data) {
      siteData = res.data;
      window.dispatchEvent(new CustomEvent('serverSync', { detail: { ok:true, from:'server' }}));
      try{ if (typeof renderSettings === 'function') renderSettings(); }catch(e){}
      try{ if (typeof renderAdmin === 'function') renderAdmin(); }catch(e){}
      try{ if (typeof applySettingsToSite === 'function') applySettingsToSite(); }catch(e){}
    } else {
      window.dispatchEvent(new CustomEvent('serverSync', { detail: { ok:false } }));
    }
  }).catch(()=> window.dispatchEvent(new CustomEvent('serverSync', { detail: { ok:false } })) );
}

// attempt sync shortly after load
window.addEventListener('load', ()=>{ setTimeout(syncFromServer, 200); });