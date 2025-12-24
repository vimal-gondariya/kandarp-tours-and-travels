const data = getData();

function renderPackages() {
  const el = document.getElementById("packages");
  if (!el) return;
  el.innerHTML = data.packages.map(p => {
    const includes = (p.includes || []).map(i => `<li>${i}</li>`).join("");
    return `
      <div class="card">
        <h3>${p.title}</h3>
        <p>${p.days}</p>
        <ul class="includes">${includes}</ul>
      </div>
    `;
  }).join("");
}

function renderMedia() {
  const el = document.getElementById("media");
  if (!el) return;
  el.innerHTML = data.testimonials.map(m => {
    const mediaHtml = m.type === "image" ? `<img src="${m.src}" alt="${m.title}">` : `<video controls src="${m.src}"></video>`;
    return `
      <div class="card">
        ${mediaHtml}
        <h3>${m.title}</h3>
      </div>
    `;
  }).join("");
}

renderPackages();
renderMedia();
// apply site-wide settings (colors, fonts, logo, hero text)
function applySiteSettings() {
  const s = getData().settings || {};
  try {
    if (s.themeColor) document.documentElement.style.setProperty('--primary', s.themeColor);
    if (s.fontColor) document.documentElement.style.setProperty('--font-color', s.fontColor);
    if (s.fontFamily) {
      const family = s.fontFamily;
      const href = 'https://fonts.googleapis.com/css2?family=' + family + ':wght@300;400;600;700&display=swap';
      if (!document.querySelector('link[href="'+href+'"]')) {
        const l = document.createElement('link'); l.rel='stylesheet'; l.href=href; document.head.appendChild(l);
      }
      document.body.style.fontFamily = family.replace(/\+/g,' ')+', system-ui, sans-serif';
    }
    const logoEl = document.getElementById('siteLogo');
    const brandText = document.querySelector('.brand .brand-text');
    const fallback = 'assets/logo.svg';
    if (logoEl) { if (s.logo) { logoEl.src = s.logo; logoEl.style.display='inline-block'; } else { logoEl.src = fallback; logoEl.style.display='inline-block'; } }
    if (brandText) brandText.textContent = s.siteName || brandText.textContent;
    const heroTitleEl = document.querySelector('.hero h1');
    const heroSubEl = document.querySelector('.hero p');
    if (heroTitleEl && s.heroTitle) heroTitleEl.textContent = s.heroTitle;
    if (heroSubEl && s.heroSubtitle) heroSubEl.textContent = s.heroSubtitle;
  } catch(e) { console.error(e); }
}

applySiteSettings();
// re-apply when includes (header/footer) finish loading
window.addEventListener('includesLoaded', ()=>{ try{ applySiteSettings(); }catch(e){} });