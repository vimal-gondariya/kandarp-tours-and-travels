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
      const tCsv = toCSV(testimonials, ['id', 'title', 'type', 'src']);
      fs.writeFileSync(path.join(dataDir, 'testimonial.csv'), tCsv);
    }
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`save-server listening on http://localhost:${port}`));
