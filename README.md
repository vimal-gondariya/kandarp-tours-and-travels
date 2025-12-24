# Travel Site (Kandarp Tours & Travels)

This is a static travel site and admin backoffice. You can host it on GitHub Pages.

Note: To persist changes directly to CSV files and save uploaded media into the `assets/` folder at runtime, you must run the included server. The Backoffice no longer uses browser localStorage for persistence — it writes to disk via the server.

Server-backed workflow (recommended):

- Run the included local server to allow runtime writes (uploads and CSV writes):

  npm install
  npm start

- Endpoints provided by the server:
  - GET /data → returns the site JSON (data/data.json)
  - POST /data → writes `data/data.json` and regenerates `data/packages.csv` and `data/testimonial.csv`
  - POST /upload-media → saves uploaded images/videos to `assets/testimonials/` and returns public URLs
  - POST /upload-csv → upload a CSV file to replace `data/packages.csv`, `data/testimonial.csv` or `data/settings.csv` (param `target`), server rebuilds `data.json` and writes it to disk

If you prefer not to run the server, Backoffice can still export CSVs for you to manually upload to your hosting, but runtime persistence will not be available.

Quick start

1. Initialize a git repository and push to GitHub (replace `<user>` and `<repo>`):

```bash
cd /path/to/travel-site-ready
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/<user>/<repo>.git
git push -u origin main
```

2. Enable GitHub Pages (the repository includes a workflow to auto-deploy):
   - The workflow will deploy the repository root to the `gh-pages` branch on push to `main`.

3. Optional: create a personal access token (not required for the included workflow) or configure a custom domain.

Automatic deployment via Actions

A GitHub Actions workflow at `.github/workflows/deploy.yml` will build and push the site to `gh-pages` branch when you push to `main`.

Notes
- Serve locally during development with:

```bash
python3 -m http.server 8000
```

- If you want to persist uploaded images server-side, run the included `save-server.js` and configure it separately.

**Important:** The server writes files to `data/` and `assets/` on disk. Ensure the user running the server has write permissions for these directories. The server will create backup files like `data.json.bak-<timestamp>` before overwriting `data/data.json`.

**Tip:** For production, run the server under a service manager (systemd, PM2, or similar) and make periodic backups of `data/` and `assets/`.

Contact
- For further help I can:
  - Commit these files and create the initial GitHub repo for you (if you provide access).
  - Adjust the deployment workflow to deploy only the `dist/` folder or build step.
