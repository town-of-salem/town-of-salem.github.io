document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname.replace(/\/index\.html$/, '/');
  if (path !== location.pathname) history.replaceState(null, '', path + location.search + location.hash);
  const menu = document.querySelector('.menu-btn');
  const nav = document.querySelector('.mega-nav');
  const more = document.querySelector('.nav-group');
  const toggle = more && more.querySelector('.nav-trigger');
  const desktop = matchMedia('(min-width:981px)');
  let closeTimer;
  const setMore = open => {
    if (!more || !toggle) return;
    clearTimeout(closeTimer);
    more.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  const setMenu = open => {
    if (!nav || !menu) return;
    nav.classList.toggle('open', open);
    menu.setAttribute('aria-expanded', String(open));
    if (!open) setMore(false);
  };
  if (menu && nav) {
    menu.addEventListener('click', () => setMenu(menu.getAttribute('aria-expanded') !== 'true'));
    nav.querySelectorAll('a').forEach(link => {
      const linkPath = new URL(link.href, location.href).pathname;
      if (linkPath === path) link.setAttribute('aria-current', 'page');
      else if (linkPath !== '/' && linkPath.endsWith('/') && path.startsWith(linkPath)) link.classList.add('current-section');
      link.addEventListener('click', () => setMenu(false));
    });
  }
  if (more && toggle) {
    toggle.addEventListener('click', () => setMore(toggle.getAttribute('aria-expanded') !== 'true'));
    toggle.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setMore(true);
        more.querySelector('.dropdown a')?.focus();
      }
    });
    more.addEventListener('mouseenter', () => {
      if (desktop.matches && matchMedia('(hover:hover)').matches) setMore(true);
    });
    more.addEventListener('mouseleave', () => {
      if (desktop.matches && !more.contains(document.activeElement)) closeTimer = setTimeout(() => setMore(false), 180);
    });
    more.addEventListener('focusout', event => {
      if (!more.contains(event.relatedTarget)) setMore(false);
    });
  }
  document.addEventListener('click', event => {
    if (!event.target.closest('.topbar')) setMenu(false);
    else if (!event.target.closest('.nav-group')) setMore(false);
  });
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    if (toggle?.getAttribute('aria-expanded') === 'true') {
      setMore(false);
      toggle.focus();
    } else if (menu?.getAttribute('aria-expanded') === 'true') {
      setMenu(false);
      menu.focus();
    }
  });
  const resetMenu = () => setMenu(false);
  if (desktop.addEventListener) desktop.addEventListener('change', resetMenu);
  else desktop.addListener(resetMenu);

  document.querySelectorAll('.play-shell').forEach(shell => {
    const play = shell.querySelector('[data-frame-url]');
    const placeholder = shell.querySelector('.play-placeholder');
    const wrap = shell.querySelector('.frame-wrap');
    const frame = shell.querySelector('iframe');
    const status = shell.querySelector('[data-frame-status]');
    const fullscreen = shell.querySelector('[data-frame-fullscreen]');
    const reload = shell.querySelector('[data-frame-reload]');
    const stop = shell.querySelector('[data-frame-stop]');
    if (!play || !placeholder || !wrap || !frame) return;
    let slowTimer;
    let loading = false;
    let started = false;
    const message = text => { if (status) status.textContent = text; };
    const finish = () => {
      clearTimeout(slowTimer);
      loading = false;
      wrap.removeAttribute('aria-busy');
      if (reload) reload.disabled = false;
    };
    frame.addEventListener('load', () => {
      if (!started || !frame.getAttribute('src')) return;
      finish();
      // A document load does not prove that the remote game server is ready.
      message('Game window open');
    });
    frame.addEventListener('error', () => {
      if (!started) return;
      finish();
      message('The game could not load. Try Reload.');
    });
    const loadGame = () => {
      if (loading) return;
      let url;
      try { url = new URL(play.dataset.frameUrl); } catch { message('Game address unavailable.'); return; }
      if (url.protocol !== 'https:') { message('Game address unavailable.'); return; }
      started = true;
      loading = true;
      placeholder.hidden = true;
      wrap.hidden = false;
      wrap.classList.add('active');
      wrap.setAttribute('aria-busy', 'true');
      if (reload) reload.disabled = true;
      message('Loading game…');
      frame.setAttribute('src', url.href);
      slowTimer = setTimeout(() => {
        finish();
        message('Still loading? You can try Reload.');
      }, 30000);
      (fullscreen && !fullscreen.disabled ? fullscreen : frame).focus();
    };
    play.addEventListener('click', loadGame);
    reload?.addEventListener('click', loadGame);
    stop?.addEventListener('click', async () => {
      const active = document.fullscreenElement || document.webkitFullscreenElement;
      if (active === wrap) {
        try {
          if (document.exitFullscreen) await document.exitFullscreen();
          else document.webkitExitFullscreen?.();
        } catch { /* Fullscreen may already have been exited. */ }
      }
      started = false;
      finish();
      frame.removeAttribute('src');
      wrap.classList.remove('active');
      wrap.hidden = true;
      placeholder.hidden = false;
      message('');
      play.focus();
    });
    if (fullscreen) {
      const supported = Boolean(wrap.requestFullscreen || wrap.webkitRequestFullscreen);
      fullscreen.disabled = !supported;
      if (!supported) fullscreen.title = 'Fullscreen is unavailable in this browser.';
      fullscreen.addEventListener('click', async () => {
        try {
          const active = document.fullscreenElement || document.webkitFullscreenElement;
          if (active === wrap) {
            if (document.exitFullscreen) await document.exitFullscreen();
            else document.webkitExitFullscreen?.();
          } else if (wrap.requestFullscreen) await wrap.requestFullscreen();
          else wrap.webkitRequestFullscreen?.();
        } catch { message('Fullscreen is unavailable. You can continue in the game window.'); }
      });
    }
  });
  const updateFullscreen = () => {
    const active = document.fullscreenElement || document.webkitFullscreenElement;
    document.querySelectorAll('[data-frame-fullscreen]').forEach(button => {
      const isActive = button.closest('.frame-wrap') === active;
      button.textContent = isActive ? 'Exit fullscreen' : 'Fullscreen';
      button.setAttribute('aria-pressed', String(isActive));
    });
  };
  document.addEventListener('fullscreenchange', updateFullscreen);
  document.addEventListener('webkitfullscreenchange', updateFullscreen);

  const search = document.querySelector('[data-search]');
  if (search) {
    const items = [...document.querySelectorAll('[data-filter-item]')];
    const status = document.querySelector('[data-search-status]');
    const empty = document.querySelector('[data-search-empty]');
    search.addEventListener('input', () => {
      const query = search.value.toLocaleLowerCase('en').trim();
      let matches = 0;
      items.forEach(item => {
        item.hidden = Boolean(query && !(item.textContent + ' ' + (item.dataset.searchTerms || '')).toLocaleLowerCase('en').includes(query));
        if (!item.hidden) matches++;
      });
      if (status) status.textContent = query ? matches + (matches === 1 ? ' match' : ' matches') : '';
      if (empty) empty.hidden = matches > 0;
      document.querySelectorAll('[data-filter-section]').forEach(section => {
        section.hidden = ![...section.querySelectorAll('[data-filter-item]')].some(item => !item.hidden);
      });
    });
  }
});
