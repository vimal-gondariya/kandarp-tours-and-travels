// loads shared header and footer into pages
(async function(){
  try{
    const base = location.origin === 'null' ? '.' : location.origin;
    const headerUrl = base + '/includes/header.html';
    const footerUrl = base + '/includes/footer.html';

    async function fetchSafe(url){
      try{ const r = await fetch(url); if(r.ok) return await r.text(); } catch(e){}
      // fallback try relative path
      try{ const r2 = await fetch('includes/'+url.split('/').pop()); if(r2.ok) return await r2.text(); } catch(e){}
      return '';
    }

    const headerHtml = await fetchSafe(headerUrl);
    const footerHtml = await fetchSafe(footerUrl);
    const headerEl = document.getElementById('site-header'); if(headerEl) headerEl.innerHTML = headerHtml;
    const footerEl = document.getElementById('site-footer'); if(footerEl) footerEl.innerHTML = footerHtml;

    // dispatch event so other scripts can react after includes are loaded
    window.dispatchEvent(new CustomEvent('includesLoaded'));
  }catch(e){ console.error('includes load failed', e); }
})();
