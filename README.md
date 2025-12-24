# Travel Site (Kandarp Tours & Travels)

This is a static travel site and admin backoffice. You can host it on GitHub Pages.

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

Contact
- For further help I can:
  - Commit these files and create the initial GitHub repo for you (if you provide access).
  - Adjust the deployment workflow to deploy only the `dist/` folder or build step.
