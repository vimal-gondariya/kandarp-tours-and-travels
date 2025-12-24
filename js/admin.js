let editingPackageId = null;
let editingMediaId = null;

// UI helpers: Bootstrap toasts and confirmation modal
function showToast(message, type='success', timeout=3000){
  const container = document.getElementById('toastContainer');
  if(!container){ // fallback
    console.log('toast:', message);
    return;
  }
  const toastEl = document.createElement('div');
  toastEl.className = `toast align-items-center text-bg-${type} border-0 show`;
  toastEl.setAttribute('role','alert');
  toastEl.setAttribute('aria-live','assertive');
  toastEl.setAttribute('aria-atomic','true');
  toastEl.style.marginBottom = '8px';
  toastEl.innerHTML = `<div class="d-flex"><div class="toast-body">${message}</div><button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast" aria-label="Close"></button></div>`;
  container.appendChild(toastEl);
  const bs = new bootstrap.Toast(toastEl, { delay: timeout });
  bs.show();
  toastEl.addEventListener('hidden.bs.toast', ()=> toastEl.remove());
}

function showConfirm(message, title='Confirm'){
  return new Promise((resolve)=>{
    const modalEl = document.getElementById('confirmModal');
    if(!modalEl){ resolve(confirm(message)); return; }
    modalEl.querySelector('.modal-title').textContent = title;
    modalEl.querySelector('.modal-body').textContent = message;
    const okBtn = modalEl.querySelector('.confirm-ok-btn');
    const cancelBtn = modalEl.querySelector('.confirm-cancel-btn');
    const modal = new bootstrap.Modal(modalEl);
    function cleanup(){ okBtn.removeEventListener('click', onOk); cancelBtn.removeEventListener('click', onCancel); }
    function onOk(){ cleanup(); modal.hide(); resolve(true); }
    function onCancel(){ cleanup(); modal.hide(); resolve(false); }
    okBtn.addEventListener('click', onOk);
    cancelBtn.addEventListener('click', onCancel);
    modal.show();
  });
}

function addPackage() {
  const titleEl = document.getElementById('pkg_title');
  const daysEl = document.getElementById('pkg_days');
  const includesEl = document.getElementById('pkg_includes');
  if (!titleEl || !titleEl.value.trim()){ showToast('Enter a package title', 'warning'); return; }
  const data = getData();
  if (editingPackageId) {
    // update existing
    const pkg = data.packages.find(p=>p.id===editingPackageId);
    if (!pkg){ showToast('Package not found', 'danger'); return; }
    pkg.title = titleEl.value.trim();
    pkg.days = daysEl ? daysEl.value.trim() : '';
    pkg.includes = includesEl ? includesEl.value.split(',').map(s=>s.trim()).filter(Boolean) : [];
    editingPackageId = null;
  } else {
    data.packages.push({
      id: "pkg_" + Date.now(),
      title: titleEl.value.trim(),
      days: daysEl ? daysEl.value.trim() : '',
      includes: includesEl ? includesEl.value.split(',').map(s=>s.trim()).filter(Boolean) : []
    });
  }
  saveData(data);
  titleEl.value = '';
  if (daysEl) daysEl.value = '';
  if (includesEl) includesEl.value = '';
  document.getElementById('addPackageBtn').textContent = 'Add Package';
  const cancelBtn = document.getElementById('cancelPackageEditBtn'); if (cancelBtn) cancelBtn.style.display = 'none';
  showToast('Package saved', 'success');
  try { renderAdmin(); } catch(e) {}
  try { exportCSVs(); } catch(e) {}
}

async function addMedia() {
  const files = document.getElementById('mediaFile').files;
  const title = (document.getElementById('mediaTitle')||{}).value || '';
  if (!files || files.length === 0){ showToast('Select one or more files','warning'); return; }

  // prepare form data for upload to server
  const fd = new FormData();
  for (const f of files) fd.append('files', f);

  try{
    const resp = await fetch('/upload-media', { method:'POST', body: fd });
    const json = await resp.json();
    if (!json || !json.ok){ showToast('Upload failed','danger'); console.error(json); return; }

    const uploaded = json.files; // [{filename,url,type}]
    const data = getData();

    if (editingMediaId) {
      const t = data.testimonials.find(x=>x.id===editingMediaId);
      if (!t){ showToast('Media not found','danger'); return; }
      t.title = title || t.title;
      t.media = uploaded.map(u=>({ id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), type: u.type, url: u.url, filename: u.filename }));
      editingMediaId = null;
      document.getElementById('uploadMediaBtn').textContent = 'Upload';
      const cancelMedia = document.getElementById('cancelMediaEditBtn'); if (cancelMedia) cancelMedia.style.display='none';
      showToast('Media updated','success');
    } else {
      const mediaItems = uploaded.map(u=>({ id: 'm_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), type: u.type, url: u.url, filename: u.filename }));
      data.testimonials.push({ id: 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), title: title || (uploaded[0] && uploaded[0].filename) || 'Media', type: mediaItems.length===1?mediaItems[0].type:'mixed', media: mediaItems });
      showToast('Uploaded','success');
    }

    saveData(data);
    (document.getElementById('mediaTitle')||{}).value = '';
    (document.getElementById('mediaFile')||{}).value = null;
    try { renderAdmin(); } catch(e) {}
    try { exportCSVs(); } catch(e) {}
  }catch(err){ console.error(err); showToast('Upload failed','danger'); }
} 

function exportJSON() {
  const json = JSON.stringify(getData(), null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "data.json";
  a.click();
}

function importJSON() {
  const f = document.getElementById("importFile").files[0];
  if (!f){ showToast('Select JSON file','warning'); return; }
  const r = new FileReader();
  r.onload = () => {
    try {
      const parsed = JSON.parse(r.result);
      saveData(parsed);
      showToast('Imported successfully','success');
      try{ renderAdmin(); }catch(e){}
      try{ renderSettings(); }catch(e){}
    } catch (err) {
      console.error(err);
      showToast('Invalid JSON','danger');
    }
  };
  r.readAsText(f);
}

// CSV import helpers
function readFileText(id){ return new Promise((resolve,reject)=>{ const f = document.getElementById(id).files[0]; if(!f) return reject('no file'); const r=new FileReader(); r.onload=()=>resolve(r.result); r.onerror=reject; r.readAsText(f); }); }

async function importPackagesCSV(){
  try{
    const f = document.getElementById('importPackagesFile').files[0]; if (!f) throw new Error('no file');
    const fd = new FormData(); fd.append('file', f); fd.append('target','packages.csv');
    const res = await fetch('/upload-csv', { method:'POST', body: fd });
    const j = await res.json(); if (!j || !j.ok) throw new Error(j && j.error || 'upload failed');
    showToast('Packages CSV uploaded','success');
    // refresh from server
    try{ syncFromServer(); }catch(e){}
  }catch(e){ console.error(e); showToast('Import packages failed','danger'); }
}

async function importTestimonialsCSV(){
  try{
    const f = document.getElementById('importTestimonialsFile').files[0]; if (!f) throw new Error('no file');
    const fd = new FormData(); fd.append('file', f); fd.append('target','testimonial.csv');
    const res = await fetch('/upload-csv', { method:'POST', body: fd });
    const j = await res.json(); if (!j || !j.ok) throw new Error(j && j.error || 'upload failed');
    showToast('Testimonials CSV uploaded','success');
    try{ syncFromServer(); }catch(e){}
  }catch(e){ console.error(e); showToast('Import testimonials failed','danger'); }
}

async function importSettingsCSV(){
  try{
    const f = document.getElementById('importSettingsFile').files[0]; if (!f) throw new Error('no file');
    const fd = new FormData(); fd.append('file', f); fd.append('target','settings.csv');
    const res = await fetch('/upload-csv', { method:'POST', body: fd });
    const j = await res.json(); if (!j || !j.ok) throw new Error(j && j.error || 'upload failed');
    showToast('Settings CSV uploaded','success');
    try{ syncFromServer(); }catch(e){}
  }catch(e){ console.error(e); showToast('Import settings failed','danger'); }
}

function logout() {
  try{ sessionStorage.removeItem('isLoggedIn'); }catch(e){}
  location.href = "../admin.html";
}

// --- CSV helpers: generate CSV from current data and optionally POST to local server ---
function toCSV(rows, headers) {
  const esc = v => {
    if (v === null || v === undefined) return "";
    const s = String(v).replace(/\"/g, '\"\"');
    return '"' + s + '"';
  };
  const headerLine = headers.join(",") + "\n";
  const lines = rows.map(r => headers.map(h => esc(r[h])).join(",")).join("\n");
  return headerLine + lines;
}

function downloadFile(filename, content, type = "text/csv") {
  const blob = new Blob([content], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
}

function exportCSVs() {
  const data = getData();

  // packages.csv
  const pkgHeaders = ["id", "title", "days", "includes"];
  const pkgRows = data.packages.map(p => ({
    id: p.id,
    title: p.title,
    days: p.days,
    includes: Array.isArray(p.includes) ? p.includes.join(";") : p.includes
  }));
  const pkgCsv = toCSV(pkgRows, pkgHeaders);
  downloadFile("packages.csv", pkgCsv);

  // testimonial.csv
  const tHeaders = ["id", "title", "type", "media"];
  const tRows = data.testimonials.map(t => ({
    id: t.id,
    title: t.title,
    type: t.type || (Array.isArray(t.media)? t.media.map(m=>m.type).join('|') : ''),
    media: Array.isArray(t.media)? t.media.map(m=>m.url || m).join(';') : (t.src || '')
  }));
  const tCsv = toCSV(tRows, tHeaders);
  downloadFile("testimonial.csv", tCsv);

  // settings.csv (key,value)
  const s = data.settings || {};
  const settingsRows = Object.keys(s).map(k=>({ key: k, value: String(s[k]) }));
  const settingsCsv = toCSV(settingsRows, ['key','value']);
  downloadFile('settings.csv', settingsCsv);

  showToast('CSVs downloaded — upload to your hosting to persist', 'success', 3000);
}

function tryPostCSVs(payload) {
  // serverless mode: do nothing. CSVs are downloaded and must be uploaded to your hosting (or committed) to persist.
  console.log('CSV payload ready, serverless mode - download the CSVs to persist', payload);
}

// Wire the Export JSON button in backoffice to also export CSVs
if (typeof exportJSON === "function") {
  const originalExportJSON = exportJSON;
  exportJSON = function () {
    originalExportJSON();
    exportCSVs();
  };
}

// --- Admin render + actions ---
function renderAdmin() {
  const data = getData();

  // packages table
  const pkgBody = document.getElementById('packagesTableBody');
  if (pkgBody) {
    pkgBody.innerHTML = data.packages.map(p => `
      <tr>
        <td>${escapeHtml(p.title)}</td>
        <td>${escapeHtml(p.days || '')}</td>
        <td>${Array.isArray(p.includes) ? p.includes.join(', ') : (p.includes||'')}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="editPackage('${p.id}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger ms-2" onclick="deletePackage('${p.id}')">Delete</button>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="4">No packages</td></tr>';
  }

  // testimonials table
  const tBody = document.getElementById('testimonialsTableBody');
  if (tBody) {
    tBody.innerHTML = data.testimonials.map(t => {
      const mediaHtml = (Array.isArray(t.media)? t.media.map(m=>{
        if (m.type === 'image') return `<img src="${m.url}" style="max-width:140px; border-radius:6px; margin:4px">`;
        if (m.type === 'video') return `<video src="${m.url}" style="max-width:240px; display:block; margin:4px" controls muted></video>`;
        return `<a href="${m.url}">${escapeHtml(m.filename||m.url)}</a>`;
      }).join('') : (t.type==='image' && (t.src||t.media) ? `<img src="${t.src|| (t.media && t.media[0] && t.media[0].url)}" style="max-width:140px; border-radius:6px">`:`<video src="${t.src|| (t.media && t.media[0] && t.media[0].url)}" style="max-width:140px" controls muted></video>`));

      return `
      <tr>
        <td style="width:260px">${mediaHtml}</td>
        <td>${escapeHtml(t.title || '')}</td>
        <td>${escapeHtml(t.type || (Array.isArray(t.media)? t.media.map(m=>m.type).join(',') : ''))}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="editMedia('${t.id}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteMedia('${t.id}')">Delete</button>
        </td>
      </tr>
    `}).join('') || '<tr><td colspan="4">No testimonials</td></tr>';
  }
}

function editPackage(id) {
  const data = getData();
  const p = data.packages.find(x=>x.id===id);
  if (!p){ showToast('Package not found','danger'); return; }
  document.getElementById('pkg_title').value = p.title || '';
  document.getElementById('pkg_days').value = p.days || '';
  document.getElementById('pkg_includes').value = Array.isArray(p.includes) ? p.includes.join(', ') : (p.includes||'');
  editingPackageId = id;
  document.getElementById('addPackageBtn').textContent = 'Save Changes';
  const cancelBtn = document.getElementById('cancelPackageEditBtn'); if (cancelBtn) cancelBtn.style.display = 'inline-block';
}

function cancelEditPackage(){
  editingPackageId = null;
  document.getElementById('pkg_title').value = '';
  document.getElementById('pkg_days').value = '';
  document.getElementById('pkg_includes').value = '';
  document.getElementById('addPackageBtn').textContent = 'Add Package';
  const cancelBtn = document.getElementById('cancelPackageEditBtn'); if (cancelBtn) cancelBtn.style.display = 'none';
}

function editMedia(id){
  const data = getData();
  const t = data.testimonials.find(x=>x.id===id);
  if (!t){ showToast('Media not found','danger'); return; }
  document.getElementById('mediaTitle').value = t.title || '';
  editingMediaId = id;
  document.getElementById('uploadMediaBtn').textContent = 'Save Changes';
  const cancelMedia = document.getElementById('cancelMediaEditBtn'); if (cancelMedia) cancelMedia.style.display='inline-block';
}

function cancelEditMedia(){
  editingMediaId = null;
  document.getElementById('mediaTitle').value = '';
  document.getElementById('mediaFile').value = null;
  document.getElementById('uploadMediaBtn').textContent = 'Upload';
  const cancelMedia = document.getElementById('cancelMediaEditBtn'); if (cancelMedia) cancelMedia.style.display='none';
}

// Settings management
function renderSettings() {
  const s = (getData().settings || {});
  (document.getElementById('setting_siteName')||{}).value = s.siteName || '';
  (document.getElementById('setting_themeColor')||{}).value = s.themeColor || '#0a7cff';
  (document.getElementById('setting_fontColor')||{}).value = s.fontColor || '#0f172a';
  (document.getElementById('setting_fontFamily')||{}).value = s.fontFamily || 'Inter';
  (document.getElementById('setting_heroTitle')||{}).value = s.heroTitle || '';
  (document.getElementById('setting_heroSubtitle')||{}).value = s.heroSubtitle || '';
  (document.getElementById('setting_headerBg')||{}).value = s.headerBg || '#0a7cff';

  // favicon preview
  try{
    const fEl = document.getElementById('setting_faviconPreview');
    if (fEl){ if (s.favicon){ fEl.src = s.favicon; fEl.style.display = 'inline-block'; } else { fEl.src=''; fEl.style.display='none'; } }
    const lEl = document.getElementById('setting_logoPreview'); if (lEl){ if (s.logo){ lEl.src = s.logo; lEl.style.display='inline-block'; } else { lEl.style.display='none'; } }
  }catch(e){}

  // default page HTML content (from current static pages) 
  const defaultTerms = `<h2>Terms & Conditions</h2>
      <p>These are the general terms and conditions for using Kandarp Tours & Travels. By using the site you agree to the terms.</p>
      <h3>Booking</h3>
      <p>All bookings are subject to availability and confirmation.</p>
      <h3>Liability</h3>
      <p>We act as an agent for service providers; our liability is limited as per applicable law.</p>`;
  const defaultPrivacy = `<h2>Privacy Policy</h2>
      <p>We respect your privacy. This page describes how we collect and use personal data.</p>
      <h3>Data Collection</h3>
      <p>We collect only necessary information for bookings and support; data is stored locally in your browser and optionally exported to CSV.</p>`;
  const defaultRefund = `<h2>Refund Policy</h2>
      <p>Refunds depend on supplier policies. Requests must be submitted within 7 days of cancellation with proof.</p>`;

  // load into editors if present
  if (quillTerms) quillTerms.clipboard.dangerouslyPasteHTML(s.termsHtml || defaultTerms);
  else (document.getElementById('setting_termsHtml')||{}).value = s.termsHtml || defaultTerms;

  if (quillPrivacy) quillPrivacy.clipboard.dangerouslyPasteHTML(s.privacyHtml || defaultPrivacy);
  else (document.getElementById('setting_privacyHtml')||{}).value = s.privacyHtml || defaultPrivacy;

  if (quillRefund) quillRefund.clipboard.dangerouslyPasteHTML(s.refundHtml || defaultRefund);
  else (document.getElementById('setting_refundHtml')||{}).value = s.refundHtml || defaultRefund;
}

  

async function saveSettings() {
  const data = getData();
  data.settings = data.settings || {};
  data.settings.siteName = (document.getElementById('setting_siteName')||{}).value || data.settings.siteName;
  data.settings.themeColor = (document.getElementById('setting_themeColor')||{}).value || data.settings.themeColor;
  data.settings.fontColor = (document.getElementById('setting_fontColor')||{}).value || data.settings.fontColor;
  data.settings.fontFamily = (document.getElementById('setting_fontFamily')||{}).value || data.settings.fontFamily;
  data.settings.heroTitle = (document.getElementById('setting_heroTitle')||{}).value || data.settings.heroTitle;
  data.settings.heroSubtitle = (document.getElementById('setting_heroSubtitle')||{}).value || data.settings.heroSubtitle;
  data.settings.headerBg = (document.getElementById('setting_headerBg')||{}).value || data.settings.headerBg;

  // page HTML content from editors (Quill or textarea fallback)
  if (quillTerms) data.settings.termsHtml = quillTerms.root.innerHTML; else data.settings.termsHtml = (document.getElementById('setting_termsHtml')||{}).value || data.settings.termsHtml;
  if (quillPrivacy) data.settings.privacyHtml = quillPrivacy.root.innerHTML; else data.settings.privacyHtml = (document.getElementById('setting_privacyHtml')||{}).value || data.settings.privacyHtml;
  if (quillRefund) data.settings.refundHtml = quillRefund.root.innerHTML; else data.settings.refundHtml = (document.getElementById('setting_refundHtml')||{}).value || data.settings.refundHtml; 

  // upload logo + favicon to server (store assets in assets/testimonials or assets/ as served)
  const logoFile = (document.getElementById('setting_logoFile')||{}).files && document.getElementById('setting_logoFile').files[0];
  const faviconFile = (document.getElementById('setting_faviconFile')||{}).files && document.getElementById('setting_faviconFile').files[0];

  try{
    if (faviconFile){
      const fd = new FormData(); fd.append('files', faviconFile);
      const r = await fetch('/upload-media', { method:'POST', body: fd });
      const j = await r.json();
      if (j && j.ok && j.files && j.files[0]) data.settings.favicon = j.files[0].url;
      else showToast('Favicon upload failed','warning');
    }
    if (logoFile){
      const fd2 = new FormData(); fd2.append('files', logoFile);
      const r2 = await fetch('/upload-media', { method:'POST', body: fd2 });
      const j2 = await r2.json();
      if (j2 && j2.ok && j2.files && j2.files[0]) data.settings.logo = j2.files[0].url;
      else showToast('Logo upload failed','warning');
    }

    saveData(data);
    applySettingsToSite();
    renderSettings();
    showToast('Settings saved','success');
  }catch(e){ console.error(e); showToast('Failed to save settings','danger'); }
} 

function resetSettings() {
  showConfirm('Reset settings to defaults? This will overwrite header and pages.','Reset settings').then(ok=>{ if(!ok) return; 
    const data = getData();
    data.settings = {
      siteName: 'Kandarp Tours & Travels', logo: '', themeColor: '#0a7cff', headerBg: '#0a7cff', fontFamily: 'Inter', fontColor: '#0f172a', heroTitle: 'Explore curated travel packages', heroSubtitle: 'Discover memorable journeys and experiences',
      termsHtml: `<h2>Terms & Conditions</h2>
        <p>These are the general terms and conditions for using Kandarp Tours & Travels. By using the site you agree to the terms.</p>
        <h3>Booking</h3>
        <p>All bookings are subject to availability and confirmation.</p>
        <h3>Liability</h3>
        <p>We act as an agent for service providers; our liability is limited as per applicable law.</p>`,
      privacyHtml: `<h2>Privacy Policy</h2>
        <p>We respect your privacy. This page describes how we collect and use personal data.</p>
        <h3>Data Collection</h3>
        <p>We collect only necessary information for bookings and support; data is stored locally in your browser and optionally exported to CSV.</p>`,
      refundHtml: `<h2>Refund Policy</h2>
        <p>Refunds depend on supplier policies. Requests must be submitted within 7 days of cancellation with proof.</p>`
    };
    saveData(data);
    applySettingsToSite();
    renderAdmin();
    showToast('Settings reset to defaults','success');
  });
} 

function loadGoogleFont(family) {
  // family may contain + for spaces (Open+Sans). convert to proper family for CSS
  const linkId = 'gf-' + family.replace(/[^a-zA-Z0-9\-_]/g,'');
  if (document.getElementById(linkId)) return;
  const href = 'https://fonts.googleapis.com/css2?family=' + family + ':wght@300;400;600;700&display=swap';
  const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = href; l.id = linkId; document.head.appendChild(l);
}

function applySettingsToSite() {
  const s = (getData().settings || {});
  try {
    if (s.themeColor) document.documentElement.style.setProperty('--primary', s.themeColor);
    if (s.fontColor) document.documentElement.style.setProperty('--font-color', s.fontColor);
    if (s.headerBg) {
      const headerEl = document.querySelector('header'); if (headerEl){ headerEl.style.backgroundImage = 'none'; headerEl.style.backgroundColor = s.headerBg; }
    }
    if (s.fontFamily) {
      loadGoogleFont(s.fontFamily);
      document.body.style.fontFamily = (s.fontFamily || 'Inter').replace(/\+/g,' ')+', system-ui, sans-serif';
    }
    // set hero texts if present
    const heroTitleEl = document.querySelector('.hero h1');
    const heroSubEl = document.querySelector('.hero p');
    if (heroTitleEl && s.heroTitle) heroTitleEl.textContent = s.heroTitle;
    if (heroSubEl && s.heroSubtitle) heroSubEl.textContent = s.heroSubtitle;
    // logo, favicon & site name
    const logoEl = document.getElementById('siteLogo');
    const brandText = document.querySelector('.brand .brand-text');
    const fallback = 'assets/logo.svg';
    if (logoEl) {
      if (s.logo) { logoEl.src = s.logo; logoEl.style.display = 'inline-block'; }
      else { logoEl.src = fallback; logoEl.style.display = 'inline-block'; }
    }
    if (s.favicon){ try{ let link = document.querySelector('link[rel="icon"]'); if(!link){ link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); } link.href = s.favicon; }catch(e){}
    }
    if (brandText) brandText.textContent = s.siteName || 'Kandarp Tours & Travels';
  } catch(e){ console.error(e); }
}

function deletePackage(id) {
  showConfirm('Delete this package? This action cannot be undone.', 'Delete package').then(ok=>{
    if(!ok) return;
    const data = getData();
    data.packages = data.packages.filter(p => p.id !== id);
    saveData(data);
    renderAdmin();
    try { exportCSVs(); } catch(e) {}
    showToast('Package deleted','success');
  });
}

function deleteMedia(id) {
  showConfirm('Delete this media from testimonials? This action cannot be undone.', 'Delete media').then(ok=>{
    if(!ok) return;
    const data = getData();
    data.testimonials = data.testimonials.filter(t => t.id !== id);
    saveData(data);
    renderAdmin();
    try { exportCSVs(); } catch(e) {}
    showToast('Media deleted','success');
  });
}

// Preview page HTML in an iframe modal
function showPreview(page){
  const settings = (getData().settings || {});
  let html = '';
  if(page === 'terms') html = quillTerms ? quillTerms.root.innerHTML : (document.getElementById('setting_termsHtml')||{}).value || '';
  if(page === 'privacy') html = quillPrivacy ? quillPrivacy.root.innerHTML : (document.getElementById('setting_privacyHtml')||{}).value || '';
  if(page === 'refund') html = quillRefund ? quillRefund.root.innerHTML : (document.getElementById('setting_refundHtml')||{}).value || '';

  const siteName = (settings.siteName || 'Kandarp Tours & Travels').replace(/</g,'&lt;');
  const headerBg = settings.headerBg || '#0a7cff';

  const doc = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/style.css"><style>body{padding:20px;font-family:Inter, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial;} header{padding:20px;background:${headerBg};color:#fff} .brand-text{font-weight:700}</style></head><body><header><div class="container"><div class="brand"><span class="brand-text">${siteName}</span></div></div></header><main class="container"><section class="section">${html}</section></main></body></html>`;

  const frame = document.getElementById('previewFrame'); if(frame) frame.srcdoc = doc;
  const modalEl = document.getElementById('previewModal'); if(modalEl){ const modal = new bootstrap.Modal(modalEl); modal.show(); }
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

// quill editor references
let quillTerms = null;
let quillPrivacy = null;
let quillRefund = null;

// auto-render on load if running in backoffice
if (typeof window !== 'undefined') window.addEventListener('load', ()=>{ try { renderAdmin(); } catch(e){} 
  // initialize Quill editors if available
  try{
    if (typeof Quill !== 'undefined'){
      if (document.getElementById('editor_terms')) quillTerms = new Quill('#editor_terms', { theme: 'snow' });
      if (document.getElementById('editor_privacy')) quillPrivacy = new Quill('#editor_privacy', { theme: 'snow' });
      if (document.getElementById('editor_refund')) quillRefund = new Quill('#editor_refund', { theme: 'snow' });
    }
  }catch(e){ console.warn('Quill init failed', e); }
  try{ renderSettings(); }catch(e){}

  // show a small toast on server or CSV sync events to make persistence more visible
  window.addEventListener('serverSync', (e)=>{
    try{
      const d = e && e.detail;
      if (!d) return;
      if (d.ok){
        if (d.action === 'save') showToast('Saved to server ✅', 'success', 2000);
        else showToast('Loaded data from server ✅', 'success', 2000);
      } else {
        if (d.action === 'save') showToast('Failed to save to server ⚠️', 'warning', 3000);
        else showToast('Server sync failed ⚠️', 'warning', 3000);
      }
    }catch(e){}
  });

  window.addEventListener('csvSync', (e)=>{
    try{
      const d = e && e.detail;
      if (!d) return;
      if (d.ok){
        if (d.action === 'save') showToast('Saved locally ✅', 'success', 1800);
        else showToast('Loaded data from CSV/local ✅', 'success', 1800);
      } else {
        showToast('No CSVs found; using defaults/local data', 'warning', 2600);
      }
    }catch(e){}
  });
});