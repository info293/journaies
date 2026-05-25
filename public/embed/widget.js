(function () {
  'use strict';

  var BASE_URL = 'https://www.travelzada.com';

  function getConfig(el) {
    return {
      agent:    el.getAttribute('data-agent')    || el.getAttribute('agent')    || '',
      height:   el.getAttribute('data-height')   || el.getAttribute('height')   || '720px',
      width:    el.getAttribute('data-width')    || el.getAttribute('width')    || '100%',
      theme:    el.getAttribute('data-theme')    || el.getAttribute('theme')    || 'light',
      rounded:  el.getAttribute('data-rounded')  || el.getAttribute('rounded')  || '16',
      mode:     el.getAttribute('data-mode')     || el.getAttribute('mode')     || 'inline',
      color:    el.getAttribute('data-color')    || el.getAttribute('color')    || '#6366f1',
      label:    el.getAttribute('data-label')    || el.getAttribute('label')    || 'Plan Your Trip ✈️',
      position: el.getAttribute('data-position') || el.getAttribute('position') || 'right',
    };
  }

  // ── Build full-page takeover ─────────────────────────────────────────────
  // Turns any page into the full AI planner. DMC creates /trip-planner on
  // their site, drops this script with data-mode="fullpage", done.
  function buildFullPage(config) {
    if (!config.agent) return;
    var url = BASE_URL + '/tailored-travel/' + config.agent + '?embed=1&theme=' + config.theme;

    // Reset host page so the iframe can fill the entire viewport cleanly
    document.documentElement.style.cssText = 'margin:0;padding:0;height:100%;overflow:hidden;';
    document.body.style.cssText = 'margin:0;padding:0;height:100%;overflow:hidden;background:#f9fafb;';

    // Hide any content that was already on the page (fallback text, loaders, etc.)
    var existing = document.body.children;
    for (var i = 0; i < existing.length; i++) {
      existing[i].style.display = 'none';
    }

    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'yes');
    iframe.setAttribute('allow', 'geolocation');
    iframe.setAttribute('allowfullscreen', '');
    iframe.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;border:none;z-index:2147483647;background:#f9fafb;';
    document.body.appendChild(iframe);
  }

  // ── Build inline iframe ───────────────────────────────────────────────────
  function buildIframe(config) {
    var url = BASE_URL + '/tailored-travel/' + config.agent + '?embed=1&theme=' + config.theme;
    var iframe = document.createElement('iframe');
    iframe.src = url;
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'yes');
    iframe.setAttribute('allow', 'geolocation');
    iframe.setAttribute('allowfullscreen', '');
    iframe.style.cssText = [
      'width:' + config.width,
      'height:' + config.height,
      'border:none',
      'border-radius:' + config.rounded + 'px',
      'display:block',
      'background:#f9fafb',
    ].join(';');
    return iframe;
  }

  // ── Build floating bubble widget ──────────────────────────────────────────
  function buildBubble(config) {
    if (!config.agent) return;

    var isRight = config.position !== 'left';
    var color   = config.color;
    var hSide   = isRight ? 'right:24px' : 'left:24px';
    var pSide   = isRight ? 'right:16px' : 'left:16px';

    // ── Inject CSS ──────────────────────────────────────────────────────────
    var style = document.createElement('style');
    style.textContent =
      '.tz-btn{position:fixed;bottom:24px;' + hSide + ';width:62px;height:62px;border-radius:50%;background:' + color + ';border:none;cursor:pointer;box-shadow:0 4px 20px rgba(0,0,0,.28);display:flex;align-items:center;justify-content:center;z-index:2147483646;transition:transform .2s,box-shadow .2s;padding:0;}' +
      '.tz-btn:hover{transform:scale(1.08);box-shadow:0 6px 28px rgba(0,0,0,.35);}' +
      '.tz-badge{position:absolute;top:-4px;right:-4px;background:#ef4444;color:#fff;font-size:10px;font-weight:700;font-family:sans-serif;width:18px;height:18px;border-radius:50%;display:flex;align-items:center;justify-content:center;border:2px solid #fff;pointer-events:none;}' +
      '.tz-panel{position:fixed;bottom:100px;' + pSide + ';width:420px;max-width:calc(100vw - 32px);background:#fff;border-radius:20px;box-shadow:0 8px 48px rgba(0,0,0,.22);z-index:2147483645;overflow:hidden;display:flex;flex-direction:column;transition:opacity .28s cubic-bezier(.4,0,.2,1),transform .28s cubic-bezier(.4,0,.2,1);opacity:0;transform:translateY(20px) scale(.96);pointer-events:none;}' +
      '.tz-panel.tz-open{opacity:1;transform:translateY(0) scale(1);pointer-events:auto;}' +
      '.tz-head{background:' + color + ';padding:14px 16px;display:flex;align-items:center;gap:10px;flex-shrink:0;}' +
      '.tz-avatar{width:34px;height:34px;border-radius:50%;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;flex-shrink:0;}' +
      '.tz-titles{flex:1;min-width:0;}' +
      '.tz-name{color:#fff;font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:14px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}' +
      '.tz-status{color:rgba(255,255,255,.75);font-family:-apple-system,BlinkMacSystemFont,sans-serif;font-size:11px;display:flex;align-items:center;gap:4px;}' +
      '.tz-dot{width:6px;height:6px;border-radius:50%;background:#4ade80;flex-shrink:0;}' +
      '.tz-close{background:rgba(255,255,255,.2);border:none;border-radius:50%;width:30px;height:30px;cursor:pointer;color:#fff;font-size:16px;display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .15s;}' +
      '.tz-close:hover{background:rgba(255,255,255,.35);}' +
      '.tz-iframe{width:100%;height:520px;border:none;display:block;background:#f9fafb;}';
    document.head.appendChild(style);

    // ── Icons (inline SVG) ──────────────────────────────────────────────────
    var iconBot =
      '<svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">' +
        '<rect x="4" y="7" width="16" height="11" rx="3" fill="white" opacity="0.95"/>' +
        '<circle cx="9" cy="12.5" r="1.5" fill="' + color + '"/>' +
        '<circle cx="15" cy="12.5" r="1.5" fill="' + color + '"/>' +
        '<path d="M9 16.5h6" stroke="' + color + '" stroke-width="1.5" stroke-linecap="round"/>' +
        '<path d="M12 4v3" stroke="white" stroke-width="1.5" stroke-linecap="round"/>' +
        '<circle cx="12" cy="3.5" r="1" fill="white"/>' +
        '<path d="M4 13H2M22 13h-2" stroke="white" stroke-width="1.5" stroke-linecap="round"/>' +
      '</svg>';

    var iconClose =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none">' +
        '<path d="M18 6L6 18M6 6l12 12" stroke="white" stroke-width="2.5" stroke-linecap="round"/>' +
      '</svg>';

    var avatarIcon =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none">' +
        '<rect x="4" y="7" width="16" height="11" rx="3" fill="white" opacity="0.9"/>' +
        '<circle cx="9" cy="12.5" r="1.5" fill="' + color + '"/>' +
        '<circle cx="15" cy="12.5" r="1.5" fill="' + color + '"/>' +
        '<path d="M12 4v3" stroke="white" stroke-width="1.5" stroke-linecap="round"/>' +
        '<circle cx="12" cy="3.5" r="1" fill="white"/>' +
      '</svg>';

    // ── Panel ───────────────────────────────────────────────────────────────
    var panel = document.createElement('div');
    panel.className = 'tz-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-label', config.label);

    // Header
    var head = document.createElement('div');
    head.className = 'tz-head';

    var avatar = document.createElement('div');
    avatar.className = 'tz-avatar';
    avatar.innerHTML = avatarIcon;

    var titles = document.createElement('div');
    titles.className = 'tz-titles';

    var nameEl = document.createElement('div');
    nameEl.className = 'tz-name';
    nameEl.textContent = config.label;

    var statusEl = document.createElement('div');
    statusEl.className = 'tz-status';
    statusEl.innerHTML = '<span class="tz-dot"></span>AI Planner • Online';

    titles.appendChild(nameEl);
    titles.appendChild(statusEl);

    var closeBtn = document.createElement('button');
    closeBtn.className = 'tz-close';
    closeBtn.setAttribute('aria-label', 'Close');
    closeBtn.innerHTML = iconClose;

    head.appendChild(avatar);
    head.appendChild(titles);
    head.appendChild(closeBtn);
    panel.appendChild(head);

    // Iframe (lazy — only load when first opened)
    var iframe = document.createElement('iframe');
    iframe.className = 'tz-iframe';
    iframe.setAttribute('frameborder', '0');
    iframe.setAttribute('scrolling', 'yes');
    iframe.setAttribute('allow', 'geolocation');
    iframe.setAttribute('allowfullscreen', '');
    panel.appendChild(iframe);

    // ── Floating button ─────────────────────────────────────────────────────
    var btn = document.createElement('button');
    btn.className = 'tz-btn';
    btn.setAttribute('aria-label', config.label);
    btn.innerHTML = iconBot;

    // ── Toggle logic ────────────────────────────────────────────────────────
    var isOpen  = false;
    var loaded  = false;
    var url     = BASE_URL + '/tailored-travel/' + config.agent + '?embed=1&theme=' + config.theme;

    function openPanel() {
      if (!loaded) { iframe.src = url; loaded = true; }
      panel.classList.add('tz-open');
      btn.innerHTML = iconClose;
      btn.style.transform = 'scale(1)';
      isOpen = true;
    }

    function closePanel() {
      panel.classList.remove('tz-open');
      btn.innerHTML = iconBot;
      isOpen = false;
    }

    btn.addEventListener('click', function () {
      if (isOpen) closePanel(); else openPanel();
    });
    closeBtn.addEventListener('click', closePanel);

    // Close on outside click
    document.addEventListener('click', function (e) {
      if (isOpen && !panel.contains(e.target) && !btn.contains(e.target)) {
        closePanel();
      }
    });

    document.body.appendChild(panel);
    document.body.appendChild(btn);
  }

  // ── Script tag mode ──────────────────────────────────────────────────────
  // Inline:  <script src="widget.js" data-agent="slug" data-height="700px"></script>
  // Bubble:  <script src="widget.js" data-agent="slug" data-mode="bubble" data-color="#6366f1"></script>
  var currentScript = document.currentScript || (function () {
    var scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  if (currentScript && currentScript.getAttribute('data-agent')) {
    var config = getConfig(currentScript);

    if (config.mode === 'bubble') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { buildBubble(config); });
      } else {
        buildBubble(config);
      }
    } else if (config.mode === 'fullpage') {
      if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function () { buildFullPage(config); });
      } else {
        buildFullPage(config);
      }
    } else {
      var wrapper = document.createElement('div');
      wrapper.style.cssText = 'width:100%;max-width:100%;overflow:hidden;';
      wrapper.appendChild(buildIframe(config));
      currentScript.parentNode.insertBefore(wrapper, currentScript);
    }
  }

  // ── Web Component mode ───────────────────────────────────────────────────
  // Inline:  <travelzada-planner agent="slug" height="700px"></travelzada-planner>
  // Bubble:  <travelzada-planner agent="slug" mode="bubble" color="#6366f1"></travelzada-planner>
  if (typeof window.customElements !== 'undefined') {
    var TravelzadaPlanner = function () {
      return Reflect.construct(HTMLElement, [], TravelzadaPlanner);
    };
    TravelzadaPlanner.prototype = Object.create(HTMLElement.prototype);
    TravelzadaPlanner.prototype.constructor = TravelzadaPlanner;

    TravelzadaPlanner.prototype.connectedCallback = function () {
      var cfg = getConfig(this);
      if (!cfg.agent) return;

      if (cfg.mode === 'bubble') {
        buildBubble(cfg);
      } else if (cfg.mode === 'fullpage') {
        buildFullPage(cfg);
      } else {
        this.style.cssText = 'display:block;width:' + cfg.width;
        this.appendChild(buildIframe(cfg));
      }
    };

    try {
      window.customElements.define('travelzada-planner', TravelzadaPlanner);
    } catch (e) { /* already registered */ }
  }
})();
