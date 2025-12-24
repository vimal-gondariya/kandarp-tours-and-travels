const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
app.use(express.json({ limit: '100mb' }));

// Allow simple CORS so backoffice pages can POST to this server
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
const dataFile = path.join(dataDir, 'data.json');

// ensure assets/testimonials folder exists for uploads
const assetsDir = path.join(__dirname, 'assets');
if (!fs.existsSync(assetsDir)) fs.mkdirSync(assetsDir);
const uploadsDir = path.join(assetsDir, 'testimonials');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

// serve static assets so uploaded files are accessible
app.use('/assets', express.static(assetsDir));

const defaultData = {
  settings: {
    siteName: 'Kandarp Tours & Travels',
    logo: '',
    themeColor: '#0a7cff',
    headerBg: '#0a7cff',
    fontFamily: 'Inter',
    fontColor: '#0f172a',
    heroTitle: 'Explore curated travel packages',
    heroSubtitle: 'Discover memorable journeys and experiences'
  },
  auth: { username: 'kandarp@gmail.com', password: 'Mohit@2026-26' },
  packages: [],
  testimonials: []
};

function readData(){
  try{
    if (!fs.existsSync(dataFile)) { fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2), 'utf8'); }
    const raw = fs.readFileSync(dataFile, 'utf8');
    return JSON.parse(raw || '{}');
  }catch(e){ console.error('readData failed', e); return defaultData; }
}

function writeData(obj){
  try{
    // simple backup of previous file
    try{
      if (fs.existsSync(dataFile)){
        const bak = path.join(dataDir, 'data.json.bak-' + Date.now());
        fs.copyFileSync(dataFile, bak);
      }
    }catch(e){ console.warn('backup failed', e); }

    fs.writeFileSync(dataFile, JSON.stringify(obj, null, 2), 'utf8');
    // also write CSVs for packages and testimonials for easy access
    try{
      if (Array.isArray(obj.packages)){
        const pkgHeaders = ['id','title','days','includes'];
        const pkgRows = obj.packages.map(p=>({ id:p.id, title:p.title, days:p.days, includes: Array.isArray(p.includes)?p.includes.join(';'):p.includes }));
        fs.writeFileSync(path.join(dataDir,'packages.csv'), toCSV(pkgRows, pkgHeaders), 'utf8');
      }
      if (Array.isArray(obj.testimonials)){
        const tHeaders = ['id','title','media'];
        const tRows = obj.testimonials.map(t=>({ id:t.id, title:t.title, media: Array.isArray(t.media) ? t.media.map(m=>m.url || m).join(';') : (t.src||'') }));
        fs.writeFileSync(path.join(dataDir,'testimonial.csv'), toCSV(tRows, tHeaders), 'utf8');
      }
    }catch(e){ console.error('write CSVs failed', e); }
    return true;
  }catch(e){ console.error('writeData failed', e); return false; }
}

app.get('/data', (req, res) => {
  try{ const d = readData(); res.json({ ok: true, data: d }); }catch(e){ res.status(500).json({ ok:false, error: String(e) }); }
});

app.post('/data', (req, res) => {
  const body = req.body;
  if (!body || typeof body !== 'object') return res.status(400).json({ ok:false, error: 'Invalid body' });
  try{
    writeData(body);
    res.json({ ok: true });
  }catch(e){ res.status(500).json({ ok:false, error: String(e) }); }
});

// existing CSV endpoint kept
function toCSV(rows, headers) {
  const esc = v => {
    if (v === null || v === undefined) return '';
    return '"' + String(v).replace(/"/g, '""') + '"';
  };
  const headerLine = headers.join(',') + '\n';
  const lines = rows.map(r => headers.map(h => esc(r[h])).join(',')).join('\n');
  return headerLine + lines;
}

app.post('/save-csv', (req, res) => {
  const { packages, testimonials } = req.body || {};
  try {
    if (Array.isArray(packages)) {
      const pkgCsv = toCSV(packages, ['id', 'title', 'days', 'includes']);
      fs.writeFileSync(path.join(dataDir, 'packages.csv'), pkgCsv);
    }
    if (Array.isArray(testimonials)) {
      const rows = testimonials.map(t=>({ id:t.id, title:t.title, media: Array.isArray(t.media) ? t.media.map(m=>m.url || m).join(';') : (t.src||'') }));
      const tCsv = toCSV(rows, ['id', 'title', 'media']);
      fs.writeFileSync(path.join(dataDir, 'testimonial.csv'), tCsv);
    }

    // rebuild data.json from CSVs and save
    try{
      const built = buildDataFromCSVs();
      writeData(Object.assign({}, defaultData, built));
    }catch(e){ console.warn('rebuild from CSVs failed', e); }

    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// Upload CSV file and replace the matching file in data/, then rebuild data.json
app.post('/upload-csv', upload.single('file'), (req, res) => {
  try{
    if (!req.file) return res.status(400).json({ ok:false, error:'No file uploaded' });
    const target = req.body && req.body.target;
    const allowed = ['packages.csv', 'testimonial.csv', 'settings.csv'];
    if (!target || allowed.indexOf(target) === -1) return res.status(400).json({ ok:false, error:'Invalid target' });
    const dest = path.join(dataDir, target);
    fs.renameSync(req.file.path, dest);

    // rebuild data.json
    const built = buildDataFromCSVs();
    writeData(Object.assign({}, defaultData, built));

    res.json({ ok:true });
  }catch(e){ console.error(e); res.status(500).json({ ok:false, error: String(e) }); }
});

// build site JSON object from CSV files in data/
function parseCSV(content){
  const lines = content.replace(/\r/g,'').split('\n').filter(Boolean);
  if (lines.length === 0) return { headers:[], rows:[] };
  const headers = lines[0].split(',').map(h=>h.replace(/^"|"$/g,'').trim());
  const rows = lines.slice(1).map(l=>{
    const cells = [];
    let cur = '', inQ = false;
    for (let i=0;i<l.length;i++){
      const ch = l[i];
      if (ch === '"'){ inQ = !inQ; continue; }
      if (ch === ',' && !inQ){ cells.push(cur); cur = ''; continue; }
      cur += ch;
    }
    if (cur !== '') cells.push(cur);
    const obj = {};
    headers.forEach((h, idx)=>{ obj[h] = (cells[idx]||'').trim().replace(/""/g,'"'); });
    return obj;
  });
  return { headers, rows };
}

function buildDataFromCSVs(){
  const out = { settings: {}, packages: [], testimonials: [] };
  try{
    const sPath = path.join(dataDir,'settings.csv');
    if (fs.existsSync(sPath)){
      const sTxt = fs.readFileSync(sPath,'utf8');
      const parsed = parseCSV(sTxt);
      parsed.rows.forEach(r=>{ if (r.key) out.settings[r.key]=r.value; });
    }
  }catch(e){ console.warn('read settings failed', e); }

  try{
    const pPath = path.join(dataDir,'packages.csv');
    if (fs.existsSync(pPath)){
      const pTxt = fs.readFileSync(pPath, 'utf8');
      const parsed = parseCSV(pTxt);
      out.packages = parsed.rows.map(r=>({ id: r.id || ('pkg_'+Date.now()), title: r.title||'', days: r.days||'', includes: r.includes? r.includes.split(';').map(x=>x.trim()).filter(Boolean): [] }));
    }
  }catch(e){ console.warn('read packages failed', e); }

  try{
    const tPath = path.join(dataDir,'testimonial.csv');
    if (fs.existsSync(tPath)){
      const tTxt = fs.readFileSync(tPath,'utf8');
      const parsed = parseCSV(tTxt);
      out.testimonials = parsed.rows.map(r=>({ id: r.id || ('media_'+Date.now()), title: r.title||'', type: r.type||'', media: (r.media? r.media.split(';').map(u=>({ id: 'm_'+Date.now()+'_'+Math.random().toString(36).slice(2,6), url: u, type: u.indexOf('/assets/')!==-1 ? (u.match(/\.(mp4|webm|ogg)$/i)?'video':'image') : (r.type && r.type.indexOf('video')!==-1 ? 'video':'image'), filename: '' })) : (r.src? [{ id:'m_'+Date.now(), url: r.src, type: r.type||'image', filename: '' }] : [])) }));
    }
  }catch(e){ console.warn('read testimonials failed', e); }

  return out;
}

// Upload media files (images/videos) and return public URLs
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) { cb(null, uploadsDir); },
  filename: function (req, file, cb) { const ext = path.extname(file.originalname); const name = path.basename(file.originalname, ext).replace(/[^a-z0-9\-]/ig,'').toLowerCase(); cb(null, name + '-' + Date.now() + ext); }
});
const upload = multer({ storage: storage, limits: { fileSize: 50*1024*1024 } });

app.post('/upload-media', upload.array('files', 10), (req, res) => {
  try{
    if (!req.files || req.files.length===0) return res.status(400).json({ ok:false, error:'No files' });
    const results = req.files.map(f=>{
      // determine type
      const type = f.mimetype && f.mimetype.startsWith('video') ? 'video' : (f.mimetype && f.mimetype.startsWith('image') ? 'image' : 'file');
      const url = '/assets/testimonials/' + path.basename(f.path);
      return { filename: path.basename(f.path), url, type };
    });
    res.json({ ok:true, files: results });
  }catch(e){ console.error(e); res.status(500).json({ ok:false, error: String(e) }); }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`save-server listening on http://localhost:${port}`));
