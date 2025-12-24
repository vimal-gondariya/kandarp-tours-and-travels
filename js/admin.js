let editingPackageId = null;
let editingMediaId = null;

function addPackage() {
  const titleEl = document.getElementById('pkg_title');
  const daysEl = document.getElementById('pkg_days');
  const includesEl = document.getElementById('pkg_includes');
  if (!titleEl || !titleEl.value.trim()) return alert('Enter a package title');
  const data = getData();
  if (editingPackageId) {
    // update existing
    const pkg = data.packages.find(p=>p.id===editingPackageId);
    if (!pkg) return alert('Package not found');
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
  alert("Package saved");
  try { renderAdmin(); } catch(e) {}
  try { exportCSVs(); } catch(e) {}
}

function addMedia() {
  const files = document.getElementById('mediaFile').files;
  const title = (document.getElementById('mediaTitle')||{}).value || '';
  // if editing existing media, allow updating title and optionally replacing file
  if (editingMediaId) {
    const data = getData();
    const m = data.testimonials.find(t=>t.id===editingMediaId);
    if (!m) return alert('Media not found');
    m.title = title || m.title;
    if (files && files.length>0) {
      const r = new FileReader();
      r.onload = ()=>{
        m.src = r.result;
        saveData(data);
        editingMediaId = null;
        (document.getElementById('mediaTitle')||{}).value = '';
        (document.getElementById('mediaFile')||{}).value = null;
        document.getElementById('uploadMediaBtn').textContent = 'Upload';
        const cancelMedia = document.getElementById('cancelMediaEditBtn'); if (cancelMedia) cancelMedia.style.display='none';
        alert('Media updated');
        try{ renderAdmin(); }catch(e){}
        try{ exportCSVs(); }catch(e){}
      };
      r.readAsDataURL(files[0]);
    } else {
      saveData(data);
      editingMediaId = null;
      (document.getElementById('mediaTitle')||{}).value = '';
      alert('Media updated');
      try{ renderAdmin(); }catch(e){}
      try{ exportCSVs(); }catch(e){}
    }
    return;
  }
  if (!files || files.length === 0) return alert('Select one or more files');
  const readers = Array.from(files).map(file => new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res({ file, data: r.result });
    r.onerror = rej;
    r.readAsDataURL(file);
  }));
  Promise.all(readers).then(results => {
    const data = getData();
    results.forEach(r => {
      const f = r.file;
      const t = f.type && f.type.startsWith('image') ? 'image' : (f.type && f.type.startsWith('video') ? 'video' : 'file');
      data.testimonials.push({ id: 'media_' + Date.now() + '_' + Math.random().toString(36).slice(2,7), title: title || f.name, type: t, src: r.data });
    });
    saveData(data);
    (document.getElementById('mediaTitle')||{}).value = '';
    (document.getElementById('mediaFile')||{}).value = null;
    alert('Uploaded');
    try { renderAdmin(); } catch(e) {}
    try { exportCSVs(); } catch(e) {}
  }).catch(err => {
    console.error(err);
    alert('Upload failed');
  });
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
  if (!f) return alert("Select JSON file");
  const r = new FileReader();
  r.onload = () => {
    try {
      JSON.parse(r.result);
      localStorage.setItem("TRAVEL_SITE_DATA", r.result);
      alert("Imported successfully");
      location.reload();
    } catch {
      alert("Invalid JSON");
    }
  };
  r.readAsText(f);
}

function logout() {
  try{ sessionStorage.removeItem('isLoggedIn'); }catch(e){}
  try{ localStorage.removeItem('isLoggedIn'); }catch(e){}
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
  const tHeaders = ["id", "title", "type", "src"];
  const tRows = data.testimonials.map(t => ({ id: t.id, title: t.title, type: t.type, src: t.src }));
  const tCsv = toCSV(tRows, tHeaders);
  downloadFile("testimonial.csv", tCsv);

  // Try to POST to a local server (optional). If the server is not running, it's fine.
  tryPostCSVs({ packages: pkgRows, testimonials: tRows });
}

function tryPostCSVs(payload) {
  fetch("http://localhost:3000/save-csv", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).catch(() => {
    // ignore errors; server is optional
  });
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
    tBody.innerHTML = data.testimonials.map(t => `
      <tr>
        <td style="width:160px">${t.type==='image'?`<img src="${t.src}" style="max-width:140px; border-radius:6px">`:`<video src="${t.src}" style="max-width:140px" controls muted></video>`}</td>
        <td>${escapeHtml(t.title || '')}</td>
        <td>${escapeHtml(t.type || '')}</td>
        <td>
          <button class="btn btn-sm btn-outline-primary" onclick="editMedia('${t.id}')">Edit</button>
          <button class="btn btn-sm btn-outline-danger ms-2" onclick="deleteMedia('${t.id}')">Delete</button>
          <a href="${t.src}" download="${t.id}" class="btn btn-sm btn-link ms-2">Download</a>
        </td>
      </tr>
    `).join('') || '<tr><td colspan="4">No testimonials</td></tr>';
  }
}

function editPackage(id) {
  const data = getData();
  const p = data.packages.find(x=>x.id===id);
  if (!p) return alert('Package not found');
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
  const m = data.testimonials.find(x=>x.id===id);
  if (!m) return alert('Media not found');
  document.getElementById('mediaTitle').value = m.title || '';
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
}

function saveSettings() {
  const data = getData();
  data.settings = data.settings || {};
  data.settings.siteName = (document.getElementById('setting_siteName')||{}).value || data.settings.siteName;
  data.settings.themeColor = (document.getElementById('setting_themeColor')||{}).value || data.settings.themeColor;
  data.settings.fontColor = (document.getElementById('setting_fontColor')||{}).value || data.settings.fontColor;
  data.settings.fontFamily = (document.getElementById('setting_fontFamily')||{}).value || data.settings.fontFamily;
  data.settings.heroTitle = (document.getElementById('setting_heroTitle')||{}).value || data.settings.heroTitle;
  data.settings.heroSubtitle = (document.getElementById('setting_heroSubtitle')||{}).value || data.settings.heroSubtitle;

  // handle logo file if present
  const f = (document.getElementById('setting_logoFile')||{}).files && document.getElementById('setting_logoFile').files[0];
  if (f) {
    const r = new FileReader();
    r.onload = () => {
      data.settings.logo = r.result;
      saveData(data);
      applySettingsToSite();
      renderSettings();
      alert('Settings saved');
    };
    r.readAsDataURL(f);
  } else {
    saveData(data);
    applySettingsToSite();
    renderSettings();
    alert('Settings saved');
  }
}

function resetSettings() {
  if (!confirm('Reset settings to defaults?')) return;
  const data = getData();
  data.settings = {
    siteName: 'Trawellign', logo: '', themeColor: '#0a7cff', fontFamily: 'Inter', fontColor: '#0f172a', heroTitle: 'Explore curated travel packages', heroSubtitle: 'Discover memorable journeys and experiences'
  };
  saveData(data);
  applySettingsToSite();
  renderAdmin();
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
    if (s.fontFamily) {
      loadGoogleFont(s.fontFamily);
      document.body.style.fontFamily = (s.fontFamily || 'Inter').replace(/\+/g,' ')+', system-ui, sans-serif';
    }
    // set hero texts if present
    const heroTitleEl = document.querySelector('.hero h1');
    const heroSubEl = document.querySelector('.hero p');
    if (heroTitleEl && s.heroTitle) heroTitleEl.textContent = s.heroTitle;
    if (heroSubEl && s.heroSubtitle) heroSubEl.textContent = s.heroSubtitle;
    // logo & site name
    const logoEl = document.getElementById('siteLogo');
    const brandText = document.querySelector('.brand .brand-text');
    const fallback = 'assets/logo.svg';
    if (logoEl) {
      if (s.logo) { logoEl.src = s.logo; logoEl.style.display = 'inline-block'; }
      else { logoEl.src = fallback; logoEl.style.display = 'inline-block'; }
    }
    if (brandText) brandText.textContent = s.siteName || 'Trawellign';
  } catch(e){ console.error(e); }
}

function deletePackage(id) {
  const data = getData();
  data.packages = data.packages.filter(p => p.id !== id);
  saveData(data);
  renderAdmin();
  try { exportCSVs(); } catch(e) {}
}

function deleteMedia(id) {
  const data = getData();
  data.testimonials = data.testimonials.filter(t => t.id !== id);
  saveData(data);
  renderAdmin();
  try { exportCSVs(); } catch(e) {}
}

function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c]));
}

// auto-render on load if running in backoffice
if (typeof window !== 'undefined') window.addEventListener('load', ()=>{ try { renderAdmin(); } catch(e){} });