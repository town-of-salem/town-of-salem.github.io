document.addEventListener('DOMContentLoaded', () => {
  const staticBase = window.ARCADEFLOW_STATIC_BASE || '';
  const staticIndexUrl = window.ARCADEFLOW_STATIC_INDEX || '';
  const staticMode = Boolean(staticIndexUrl);
  const publicApiBase = String(window.ARCADEFLOW_PUBLIC_API || '').replace(/\/+$/, '');
  const publicApiSite = String(window.ARCADEFLOW_PUBLIC_API_SITE || '').trim();
  const publicApiEnabled = Boolean(staticMode && publicApiBase && publicApiSite);
  const publicVisitorKey = `arcadeflowPublicVisitor:${publicApiSite || 'local'}`;
  const publicVisitor = (() => {
    if (!publicApiEnabled) return '';
    try {
      let value = localStorage.getItem(publicVisitorKey) || '';
      if (!/^[A-Za-z0-9._~-]{16,160}$/.test(value)) {
        const bytes = new Uint8Array(24);
        crypto.getRandomValues(bytes);
        value = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
        localStorage.setItem(publicVisitorKey, value);
      }
      return value;
    } catch (_) { return `v${Date.now()}${Math.random().toString(36).slice(2)}`; }
  })();
  const publicApiPath = (path) => `${publicApiBase}/v1/${encodeURIComponent(publicApiSite)}${path}`;
  const publicApiHeaders = (extra = {}) => publicApiEnabled ? { 'X-ArcadeFlow-Visitor': publicVisitor, ...extra } : extra;
  const staticPath = (path) => {
    if (!staticMode || !path || !path.startsWith('/')) return path;
    if (staticBase && (path === staticBase || path.startsWith(staticBase + '/'))) return path;
    return staticBase + path;
  };
  const menuButton = document.querySelector('[data-menu-toggle]');
  const mobileMenu = document.querySelector('[data-mobile-menu]');
  if (menuButton && mobileMenu) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      mobileMenu.hidden = open;
      document.body.classList.toggle('menu-open', !open);
    });
    mobileMenu.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => {
      menuButton.setAttribute('aria-expanded', 'false');
      mobileMenu.hidden = true;
      document.body.classList.remove('menu-open');
    }));
  }

  const player = document.querySelector('.player-wrap');
  if (player) {
    const frame = player.querySelector('[data-game-frame]');
    const poster = player.querySelector('[data-player-poster]');
    const playButton = player.querySelector('[data-play-game]');
    const status = player.querySelector('[data-player-status]');
    const embedUrl = player.dataset.embed;
    const slug = player.dataset.game;
    const trackPlay = player.dataset.trackPlay !== '0';
    let started = Boolean(frame?.getAttribute('src'));
    let counted = false;

    const countPlay = async () => {
      if ((staticMode && !publicApiEnabled) || !trackPlay || counted) return;
      counted = true;
      try {
        const target = publicApiEnabled
          ? publicApiPath(`/games/${encodeURIComponent(slug)}/play`)
          : staticPath(`/games/${encodeURIComponent(slug)}/play`);
        const response = await fetch(target, {
          method: 'POST',
          headers: publicApiHeaders({ 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }),
          credentials: publicApiEnabled ? 'omit' : 'same-origin'
        });
        if (!response.ok) return;
        const data = await response.json();
        document.querySelectorAll('[data-game-plays]').forEach((node) => {
          node.textContent = String(data.plays ?? node.textContent);
        });
      } catch (_) {
        // A statistics failure must never stop the game from loading.
      }
    };

    const startGame = () => {
      if (!frame || started || !embedUrl) return;
      started = true;
      frame.hidden = false;
      frame.src = embedUrl;
      poster?.remove();
      if (status) status.innerHTML = '<i class="live-dot"></i> Game loaded';
      countPlay();
    };

    if (started) countPlay();
    playButton?.addEventListener('click', startGame);

    player.querySelector('[data-reload]')?.addEventListener('click', () => {
      if (!started) {
        startGame();
        return;
      }
      const current = frame?.src;
      if (!frame) return;
      frame.src = 'about:blank';
      window.setTimeout(() => { frame.src = current || embedUrl; }, 30);
    });

    player.querySelector('[data-fullscreen]')?.addEventListener('click', () => {
      if (!started) startGame();
      const target = player.querySelector('.player-stage') || player;
      (target.requestFullscreen || target.webkitRequestFullscreen)?.call(target);
    });
  }

  if (staticMode && !publicApiEnabled) {
    document.querySelectorAll('[data-rating-form]').forEach((form) => {
      const msg = form.querySelector('[data-rating-message]');
      form.querySelectorAll('input,button').forEach((el) => { el.disabled = true; });
      if (msg) msg.textContent = 'Rating is read-only on this static copy.';
    });
    document.querySelectorAll('[data-report-game],[data-report-comment]').forEach((el) => { el.hidden = true; });
    document.querySelectorAll('form[action*="/comments"]').forEach((form) => { form.hidden = true; });
  }

  document.querySelectorAll('[data-rating-form]').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const message = form.querySelector('[data-rating-message]') || document.querySelector('[data-rating-message]');
      const button = form.querySelector('button[type="submit"]');
      if (message) {
        message.textContent = 'Saving…';
        message.className = 'rating-message';
      }
      if (button) button.disabled = true;
      try {
        const slug = player?.dataset.game || '';
        const target = publicApiEnabled && slug ? publicApiPath(`/games/${encodeURIComponent(slug)}/rate`) : form.action;
        const response = await fetch(target, {
          method: 'POST',
          body: new FormData(form),
          headers: publicApiHeaders({ 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }),
          credentials: publicApiEnabled ? 'omit' : 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error(data.error || 'Rating could not be saved');
        document.querySelectorAll('[data-rating-average]').forEach((node) => { node.textContent = String(data.rating_average); });
        document.querySelectorAll('[data-rating-count]').forEach((node) => { node.textContent = String(data.rating_count); });
        if (message) {
          message.textContent = 'Your rating was saved.';
          message.className = 'rating-message success';
        }
      } catch (error) {
        if (message) {
          message.textContent = error.message || 'Rating could not be saved.';
          message.className = 'rating-message error';
        }
      } finally {
        if (button) button.disabled = false;
      }
    });
  });

  document.querySelectorAll('[data-report-game]').forEach((button) => {
    button.addEventListener('click', async () => {
      const slug = button.dataset.gameSlug;
      const message = button.parentElement?.querySelector('[data-report-message]');
      button.disabled = true;
      if (message) message.textContent = 'Checking availability…';
      try {
        const target = publicApiEnabled
          ? publicApiPath(`/games/${encodeURIComponent(slug)}/report`)
          : staticPath(`/games/${encodeURIComponent(slug)}/report`);
        const response = await fetch(target, {
          method: 'POST',
          headers: publicApiHeaders({ 'X-Requested-With': 'XMLHttpRequest', 'Accept': 'application/json' }),
          credentials: publicApiEnabled ? 'omit' : 'same-origin'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error('Availability check failed.');
        if (message) message.textContent = data.message;
        if (!data.available) {
          window.setTimeout(() => window.location.assign(staticPath('/')), 1500);
        }
      } catch (error) {
        if (message) message.textContent = error.message || 'Availability check failed.';
      } finally {
        button.disabled = false;
      }
    });
  });

  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const formatApiDate = (value) => {
    try { return new Intl.DateTimeFormat(undefined, {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(value)); }
    catch (_) { return String(value || ''); }
  };
  const renderPublicSocial = (data) => {
    if (!data || !data.ok) return;
    document.querySelectorAll('[data-game-plays]').forEach((node) => { node.textContent = String(data.plays ?? node.textContent); });
    document.querySelectorAll('[data-rating-average]').forEach((node) => { node.textContent = data.rating_count ? String(data.rating_average) : 'New'; });
    document.querySelectorAll('[data-rating-count]').forEach((node) => { node.textContent = String(data.rating_count ?? 0); });
    const panel = document.querySelector('.comments-panel');
    if (panel) {
      const total = panel.querySelector('.section-head > span');
      if (total) total.textContent = `${data.comments_total ?? 0} total`;
      const list = panel.querySelector('.comment-list');
      if (list && Array.isArray(data.comments)) {
        list.innerHTML = data.comments.length ? data.comments.map((comment) => `<article class="comment" data-comment-id="${Number(comment.id) || 0}"><header><b>${escapeHtml(comment.author_name)}</b><time datetime="${escapeHtml(comment.created_at)}">${escapeHtml(formatApiDate(comment.created_at))}</time></header><p>${escapeHtml(comment.body)}</p><button class="comment-report" type="button" data-report-comment="${Number(comment.id) || 0}">Report</button></article>`).join('') : '<p class="muted">No comments yet. Be the first to share a useful impression.</p>';
        bindPublicCommentReports(list);
      }
      panel.querySelector('.load-comments')?.remove();
    }
  };
  const loadPublicSocial = async () => {
    const slug = player?.dataset.game || '';
    if (!publicApiEnabled || !slug) return;
    try {
      const response = await fetch(publicApiPath(`/games/${encodeURIComponent(slug)}/social`), {
        headers: publicApiHeaders({ 'Accept': 'application/json' }), credentials: 'omit'
      });
      if (!response.ok) return;
      renderPublicSocial(await response.json());
    } catch (_) {}
  };
  const bindPublicCommentReports = (root = document) => {
    root.querySelectorAll('[data-report-comment]').forEach((button) => {
      if (button.dataset.apiBound === '1') return;
      button.dataset.apiBound = '1';
      button.addEventListener('click', async () => {
        if (!publicApiEnabled) return;
        button.disabled = true;
        try {
          const response = await fetch(publicApiPath(`/comments/${encodeURIComponent(button.dataset.reportComment)}/report`), {
            method: 'POST', headers: publicApiHeaders({'X-Requested-With':'XMLHttpRequest','Accept':'application/json'}), credentials:'omit'
          });
          const data = await response.json();
          button.textContent = data.hidden ? 'Hidden for review' : 'Reported';
          if (data.hidden) button.closest('.comment')?.remove();
        } catch (_) { button.textContent = 'Could not report'; button.disabled = false; }
      });
    });
  };

  document.querySelectorAll('.comment-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      if (!publicApiEnabled) return;
      event.preventDefault();
      const slug = player?.dataset.game || '';
      if (!slug) return;
      const button = form.querySelector('button[type="submit"]');
      let message = form.parentElement?.querySelector('.comment-message[data-api-message]');
      if (!message) {
        message = document.createElement('div');
        message.className = 'comment-message';
        message.dataset.apiMessage = '1';
        form.before(message);
      }
      message.textContent = 'Publishing…';
      message.className = 'comment-message';
      if (button) button.disabled = true;
      try {
        const response = await fetch(publicApiPath(`/games/${encodeURIComponent(slug)}/comments`), {
          method: 'POST', body: new FormData(form), headers: publicApiHeaders({'X-Requested-With':'XMLHttpRequest','Accept':'application/json'}), credentials:'omit'
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data.ok) throw new Error('Comment rejected by the anti-spam and safety filter.');
        form.reset();
        message.textContent = 'Comment published.';
        message.className = 'comment-message success';
        await loadPublicSocial();
      } catch (error) {
        message.textContent = error.message || 'Comment could not be published.';
        message.className = 'comment-message error';
      } finally { if (button) button.disabled = false; }
    });
  });

  if (publicApiEnabled) {
    bindPublicCommentReports();
    loadPublicSocial();
  }

  const readList = (key) => {
    try { return JSON.parse(localStorage.getItem(key) || '[]').filter(Boolean); } catch (_) { return []; }
  };
  const writeList = (key, values) => localStorage.setItem(key, JSON.stringify([...new Set(values)].slice(0, 50)));
  const favoriteKey = 'gamePortalFavorites';
  const recentKey = 'gamePortalRecent';

  const syncFavoriteButtons = () => {
    const favorites = new Set(readList(favoriteKey));
    document.querySelectorAll('[data-favorite-toggle]').forEach((button) => {
      const active = favorites.has(button.dataset.gameSlug);
      button.classList.toggle('active', active);
      button.textContent = button.classList.contains('favorite-inline')
        ? (active ? '♥ Saved to favorites' : '♡ Add to favorites')
        : (active ? '♥' : '♡');
      button.setAttribute('aria-pressed', String(active));
    });
  };
  document.querySelectorAll('[data-favorite-toggle]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.preventDefault(); event.stopPropagation();
      const slug = button.dataset.gameSlug;
      const values = readList(favoriteKey);
      writeList(favoriteKey, values.includes(slug) ? values.filter((item) => item !== slug) : [slug, ...values]);
      syncFavoriteButtons();
    });
  });
  syncFavoriteButtons();

  document.querySelectorAll('.game-card').forEach((card) => {
    card.addEventListener('click', () => {
      const shell = card.closest('[data-game-slug]');
      const slug = shell?.dataset.gameSlug;
      if (slug) writeList(recentKey, [slug, ...readList(recentKey).filter((item) => item !== slug)]);
    });
  });
  if (player?.dataset.game) {
    const slug = player.dataset.game;
    playButton?.addEventListener('click', () => writeList(recentKey, [slug, ...readList(recentKey).filter((item) => item !== slug)]));
  }

  const libraryGrid = document.querySelector('[data-library-grid]');
  if (libraryGrid) {
    const kind = libraryGrid.dataset.libraryKind;
    const key = kind === 'favorites' ? favoriteKey : recentKey;
    const slugs = readList(key);
    const empty = document.querySelector('[data-library-empty]');
    if (!slugs.length) {
      if (empty) empty.hidden = false;
    } else {
      fetch(staticMode ? staticIndexUrl : `/api/library?slugs=${encodeURIComponent(slugs.join(','))}`, { credentials: 'same-origin' })
        .then((response) => response.json())
        .then((data) => {
          if (staticMode && Array.isArray(data)) { const wanted = new Set(slugs); data = { games: slugs.map((slug) => data.find((g) => g.slug === slug)).filter(Boolean) }; }
          const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
          libraryGrid.innerHTML = (data.games || []).map((game) => `
            <article class="game-card-shell" data-game-slug="${escape(game.slug)}">
              <a class="game-card" href="${staticPath(`/games/${encodeURIComponent(game.slug)}/`)}">
                <div class="game-cover"><img src="${escape(game.thumbnail_url)}" alt="${escape(game.title)} browser game" loading="lazy" width="960" height="540"></div>
                <div class="card-copy"><h3>${escape(game.title)}</h3><div class="card-meta"><span>${escape(game.category)}</span><span>${game.plays} plays</span></div><span class="card-rating">${game.rating_count ? `★ <b>${game.rating_average}</b> <small>(${game.rating_count})</small>` : '<b>New rating</b><small>Be first</small>'}</span></div>
              </a><button class="favorite-button active" type="button" data-favorite-toggle data-game-slug="${escape(game.slug)}">♥</button>
            </article>`).join('');
          libraryGrid.querySelectorAll('[data-favorite-toggle]').forEach((button) => {
            button.addEventListener('click', (event) => {
              event.preventDefault();
              const slug = button.dataset.gameSlug;
              const values = readList(favoriteKey);
              writeList(favoriteKey, values.includes(slug) ? values.filter((item) => item !== slug) : [slug, ...values]);
              button.closest('.game-card-shell')?.remove();
              if (!libraryGrid.children.length && empty) empty.hidden = false;
            });
          });
          if (!(data.games || []).length && empty) empty.hidden = false;
        }).catch(() => { if (empty) empty.hidden = false; });
    }
  }

  document.querySelectorAll('[data-report-comment]').forEach((button) => {
    if (publicApiEnabled) return;
    button.addEventListener('click', async () => {
      button.disabled = true;
      try {
        const target = publicApiEnabled
          ? publicApiPath(`/comments/${encodeURIComponent(button.dataset.reportComment)}/report`)
          : `/comments/${encodeURIComponent(button.dataset.reportComment)}/report`;
        const response = await fetch(target, {
          method: 'POST', headers: publicApiHeaders({'X-Requested-With':'XMLHttpRequest','Accept':'application/json'}), credentials: publicApiEnabled ? 'omit' : 'same-origin'
        });
        const data = await response.json();
        button.textContent = data.hidden ? 'Hidden for review' : 'Reported';
        if (data.hidden) button.closest('.comment')?.remove();
      } catch (_) { button.textContent = 'Could not report'; button.disabled = false; }
    });
  });



  const staticSearchGrid = document.querySelector('[data-static-search-grid]');
  if (staticMode && staticSearchGrid) {
    const params = new URLSearchParams(location.search);
    const q = (params.get('q') || '').trim();
    const input = document.querySelector('[data-static-search-input]');
    const title = document.querySelector('[data-static-search-title]');
    if (input) input.value = q;
    if (title) title.textContent = q ? `Results for “${q}”` : 'Find your next game';
    if (q) {
      fetch(staticIndexUrl).then((r) => r.json()).then((games) => {
        const words = q.toLowerCase().split(/\s+/).filter(Boolean);
        const matches = (games || []).filter((g) => {
          const hay = [g.title, g.short_description, g.category, ...(g.tags || [])].join(' ').toLowerCase();
          return words.every((word) => hay.includes(word));
        }).slice(0, 40);
        const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
        staticSearchGrid.innerHTML = matches.map((g) => `<article class="game-card-shell" data-game-slug="${escape(g.slug)}"><a class="game-card" href="${escape(g.url)}"><div class="game-cover">${g.thumbnail_url ? `<img src="${escape(g.thumbnail_url)}" alt="${escape(g.title)} browser game" loading="lazy" width="960" height="540">` : `<div class="cover-fallback">${escape((g.title || 'G')[0])}</div>`}</div><div class="card-copy"><h3>${escape(g.title)}</h3><div class="card-meta"><span>${escape(g.category)}</span><span>${g.plays} plays</span></div></div></a></article>`).join('') || '<p>No games found.</p>';
      }).catch(() => { staticSearchGrid.innerHTML = '<p>Search is temporarily unavailable.</p>'; });
    }
  }

});
