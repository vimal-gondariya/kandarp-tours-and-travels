// loads shared header and footer into pages
(async function(){
  try{
    const base = (location.origin && location.origin !== 'null') ? location.origin : '';
    const filename = (p => p.split('/').pop())('includes/header.html');
    const headerUrl = base + '/includes/header.html';
    const footerUrl = base + '/includes/footer.html';

    async function fetchSafe(url){
      const candidates = [
        url,
        '/includes/' + url.split('/').pop(),
        './includes/' + url.split('/').pop(),
        '../includes/' + url.split('/').pop(),
        (location.pathname ? location.pathname.replace(/\/[^\/]*$/, '') : '') + '/includes/' + url.split('/').pop()
      ];
      for (const u of candidates){
        try{ const r = await fetch(u); if(r && r.ok) return await r.text(); } catch(e){}
      }
      return '';
    }

    const headerHtml = await fetchSafe(headerUrl);
    const footerHtml = await fetchSafe(footerUrl);
    const headerEl = document.getElementById('site-header'); if(headerEl) headerEl.innerHTML = headerHtml;
    const footerEl = document.getElementById('site-footer'); if(footerEl) footerEl.innerHTML = footerHtml;

    // small enhancement: wire nav toggle (hamburger) for responsive nav
    if (headerEl){
      const toggle = headerEl.querySelector('#navToggle');
      if (toggle) {
        toggle.addEventListener('click', ()=>{ headerEl.classList.toggle('nav-open'); });
        window.addEventListener('resize', ()=>{ if (window.innerWidth > 800 && headerEl.classList.contains('nav-open')) headerEl.classList.remove('nav-open'); });
      }
    }

    // apply stored settings (logo, brand text, header background) so logo appears on all pages
    (function applyStoredSettings(){
      try{
        // load server-side settings only
        fetch('/data').then(r=>r.json()).then(res=>{ if (res && res.ok && res.data) apply(res.data); }).catch(()=>{});

        function apply(data){
          const s = (data && data.settings) || {};
          // header background
          if (s.headerBg){ const h = document.querySelector('header'); if(h){ h.style.backgroundImage = 'none'; h.style.backgroundColor = s.headerBg; } }
          // brand text
          if (s.siteName){ const brandText = document.querySelector('.brand .brand-text'); if(brandText) brandText.textContent = s.siteName; }
          // logo (try multiple ids for pages)
          if (s.logo){
            const logoEl = document.getElementById('siteLogo') || document.getElementById('backLogo');
            if (logoEl){ logoEl.src = s.logo; logoEl.style.display = 'inline-block'; }
          }
          // favicon
          if (s.favicon){ try{ let link = document.querySelector('link[rel="icon"]'); if(!link){ link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); } link.href = s.favicon; }catch(e){} }
        }
      }catch(e){ /* ignore */ }
    })();

    // dispatch event so other scripts can react after includes are loaded
    window.dispatchEvent(new CustomEvent('includesLoaded'));
  }catch(e){ console.error('includes load failed', e); }
})();
