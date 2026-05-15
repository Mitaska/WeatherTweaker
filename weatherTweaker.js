;(function () {
  'use strict';

  var STORAGE_KEY = 'weathertweaker:v2';

  var DEFAULTS = {
    opacity: 1.0,
    speed: 1.0,
    size: 1.0,
    count: 1.0,
    brightness: 1.0,
    contrast: 1.0,
    tint: '',
    tintStrength: 0,
    forcedWeather: null,
  };

  function loadCfg() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }

  function saveCfg(cfg) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      if (currentChatId) saveChatState(currentChatId);
    } catch (e) {}
  }

  // Per-chat config persistence
  function chatKey(id) { return 'weathertweaker:chat:' + id; }

  function saveChatState(id) {
    if (!id) return;
    try {
      var state = { cfg: cfg, savedParticles: savedParticles };
      localStorage.setItem(chatKey(id), JSON.stringify(state));
    } catch (e) {}
  }

  function loadChatState(id) {
    if (!id) return;
    try {
      var raw = localStorage.getItem(chatKey(id));
      if (raw) {
        var state = JSON.parse(raw);
        if (state.cfg) Object.assign(cfg, state.cfg);
        savedParticles = state.savedParticles || null;
      } else {
        // No saved state for this chat — reset to defaults
        Object.assign(cfg, DEFAULTS);
        savedParticles = null;
      }
    } catch (e) {
      Object.assign(cfg, DEFAULTS);
      savedParticles = null;
    }
  }

  function swapChat(oldId, newId) {
    if (oldId === newId) return;
    log('Chat config: ' + oldId + ' -> ' + newId);
    if (oldId) saveChatState(oldId);
    currentChatId = newId;
    // Reset saved overlay/lightning so they're re-captured
    savedOverlay = null;
    savedLightning = null;
    loadChatState(newId);
    // Apply loaded config to canvas and UI
    applyCanvasFilters();
    updateTint();
    if (popup) updateUI();
    updateBtnState();
  }

  // ============================================================
  // WEATHER PRESETS
  // ============================================================

  var WEATHERS = {
    auto:      { label: 'Auto (follow AI)',        type: null,   count: 0,  overlay: '',               lightning: false },
    clear:     { label: '\u2600\uFE0F Clear / Sunny',  type: 'dust',  count: 12, overlay: '',               lightning: false },
    cloudy:    { label: '\u2601\uFE0F Cloudy',      type: 'dust',  count: 8,  overlay: 'rgba(100,100,120,0.05)', lightning: false },
    rain:      { label: '\uD83C\uDF26\uFE0F Rain',      type: 'rain',  count: 80, overlay: 'rgba(50,80,120,0.08)',   lightning: false },
    heavyrain: { label: '\uD83C\uDF27\uFE0F Heavy Rain', type: 'rain',  count: 200,overlay: 'rgba(50,80,120,0.08)',   lightning: false },
    thunder:   { label: '\u26C8\uFE0F Thunderstorm',     type: 'rain',  count: 200,overlay: 'rgba(50,80,120,0.10)',   lightning: true  },
    snow:      { label: '\u2744\uFE0F Snow',         type: 'snow',  count: 50, overlay: 'rgba(200,220,255,0.06)',  lightning: false },
    blizzard:  { label: '\uD83C\uDF28\uFE0F Blizzard',   type: 'snow',  count: 150,overlay: 'rgba(200,220,255,0.10)',  lightning: false },
    fog:       { label: '\uD83C\uDF2B\uFE0F Fog / Mist',   type: 'fog',   count: 20, overlay: 'rgba(180,180,200,0.12)', lightning: false },
    sand:      { label: '\uD83C\uDFDC\uFE0F Sandstorm',    type: 'sand',  count: 100,overlay: 'rgba(180,150,100,0.12)',  lightning: false },
    hail:      { label: '\uD83E\uDDCA Hail',           type: 'hail',  count: 60, overlay: 'rgba(180,200,230,0.06)',  lightning: false },
    windy:     { label: '\uD83D\uDCA8 Windy',            type: 'leaf',  count: 25, overlay: '',               lightning: false },
    blossom:   { label: '\uD83C\uDF38 Cherry Blossom',    type: 'petal', count: 30, overlay: 'rgba(255,180,200,0.04)', lightning: false },
    ember:     { label: '\uD83D\uDD25 Ember / Fire',     type: 'ember', count: 35, overlay: 'rgba(120,40,10,0.08)',   lightning: false },
    ash:       { label: '\uD83C\uDF0B Ash / Volcanic',    type: 'ash',   count: 40, overlay: 'rgba(80,60,60,0.10)',    lightning: false },
    aurora:    { label: '\uD83C\uDF0C Aurora',         type: 'aurora',count: 6,  overlay: 'rgba(20,60,40,0.08)',    lightning: false },
  };

  // ============================================================
  // PARTICLE FACTORY
  // ============================================================

  function rand(min, max) { return min + Math.random() * (max - min); }

  function createParticle(type, w, h) {
    var p = {
      x: Math.random() * w,
      y: Math.random() * h,
      vx: 0, vy: 0,
      size: 2,
      opacity: 0.5,
      type: type,
      wobble: Math.random() * Math.PI * 2,
      life: Math.floor(Math.random() * 100),
      maxLife: 500,
      color: '',
    };
    switch (type) {
      case 'rain':    p.vy=rand(8,14);p.vx=rand(-1,-3);p.size=1.5;p.opacity=rand(0.25,0.45);p.maxLife=200;break;
      case 'snow':    p.vy=rand(0.5,1.7);p.vx=rand(-0.3,0.3);p.size=rand(2,5);p.opacity=rand(0.4,0.7);p.maxLife=800;break;
      case 'leaf':    p.vy=rand(0.8,1.8);p.vx=rand(1.5,3.5);p.size=rand(4,7);p.opacity=rand(0.5,0.8);p.maxLife=500;break;
      case 'petal':   p.vy=rand(0.4,1.2);p.vx=rand(0.5,1.5);p.size=rand(3,6);p.opacity=rand(0.4,0.7);p.maxLife=600;break;
      case 'firefly': p.vy=rand(-0.2,0.2);p.vx=rand(-0.3,0.3);p.size=rand(2,4);p.opacity=0;p.maxLife=rand(300,600);break;
      case 'star':    p.vy=0;p.vx=0;p.size=rand(1,2.5);p.opacity=0;p.maxLife=rand(400,800);p.y=Math.random()*h*0.4;break;
      case 'fog':     p.vy=0;p.vx=rand(0.2,0.6);p.size=rand(60,140);p.opacity=rand(0.03,0.07);p.maxLife=1000;break;
      case 'dust':    p.vy=rand(-0.1,0.1);p.vx=rand(-0.1,0.1);p.size=rand(1,3);p.opacity=rand(0.15,0.3);p.maxLife=rand(600,1000);break;
      case 'ember':   p.vy=rand(-1.5,-3);p.vx=rand(-0.5,0.5);p.size=rand(2,4);p.opacity=rand(0.6,0.9);p.maxLife=rand(300,500);p.y=h-Math.random()*h*0.2;break;
      case 'ash':     p.vy=rand(0.3,0.9);p.vx=rand(-0.4,0.4);p.size=rand(2,5);p.opacity=rand(0.2,0.4);p.maxLife=rand(700,1000);p.color='rgb(80,70,60)';break;
      case 'sand':    p.vy=rand(0.5,1.5);p.vx=rand(4,8);p.size=rand(1,3);p.opacity=rand(0.3,0.6);p.maxLife=rand(250,400);p.color='rgb(200,170,120)';p.x=-10;break;
      case 'hail':    p.vy=rand(10,16);p.vx=rand(-1,-2);p.size=rand(2,5);p.opacity=rand(0.4,0.7);p.maxLife=150;break;
      case 'aurora':  p.vy=0;p.vx=rand(0.1,0.3);p.size=rand(80,200);p.opacity=rand(0.04,0.07);p.maxLife=rand(1200,1800);p.y=Math.random()*h*0.35;break;
    }
    return p;
  }

  function buildParticles(type, count, w, h) {
    var arr = [];
    w = w || 1920;
    h = h || 1080;
    for (var i = 0; i < count; i++) arr.push(createParticle(type, w, h));
    return arr;
  }

  // ============================================================
  // STATE
  // ============================================================

  var cfg = loadCfg();
  var canvas = null;
  var particlesRefObj = null;
  var configMemoObj = null;
  var baseCount = 0;
  var modLoopId = null;
  var tintOverlay = null;
  var fiberRetryCount = 0;
  var canvasObserver = null;
  var popup = null;
  var popupBtn = null;
  var log = function (msg) { console.log('[WeatherTweaker]', msg); };
  var warn = function (msg) { console.warn('[WeatherTweaker]', msg); };

  // ============================================================
  // FIBER TRAVERSAL
  // ============================================================

  function locateRefs() {
    if (!canvas || particlesRefObj) return;
    try {
      var fiberKey = null;
      for (var k in canvas) {
        if (k.indexOf('__reactFiber$') === 0) { fiberKey = k; break; }
      }
      if (!fiberKey) { warn('No React fiber key on canvas'); return; }
      var fiber = canvas[fiberKey];
      var found = false;
      var checked = 0;
      while (fiber && !found) {
        checked++;
        if (typeof fiber.type === 'function' && fiber.memoizedState) {
          var hook = fiber.memoizedState;
          while (hook) {
            var ms = hook.memoizedState;
            if (ms !== null && typeof ms === 'object') {
              if ('current' in ms && Array.isArray(ms.current)) {
                particlesRefObj = ms;
                found = true;
              }
              if (!('current' in ms) && typeof ms.type === 'string' &&
                  'count' in ms && 'overlay' in ms && 'lightning' in ms) {
                configMemoObj = ms;
              }
            }
            hook = hook.next;
          }
        }
        if (!found) fiber = fiber.return;
      }
      if (found) {
        savedOverlay = null;
        savedLightning = null;
        log('Fiber found after ' + checked + ' levels');
      } else {
        fiberRetryCount++;
        if (fiberRetryCount <= 3) log('Fiber not found (attempt ' + fiberRetryCount + ')');
        if (fiberRetryCount === 3) warn('Giving up fiber search after 3 attempts');
      }
    } catch (e) {
      warn('Fiber traversal error: ' + e.message);
    }
  }

  function findActiveChatId() {
    try {
      var el = document.querySelector(
        'aside [data-chat-id].bg-\\[var\\(--sidebar-accent\\)\\]'
      );
      return el ? el.getAttribute('data-chat-id') : null;
    } catch (e) {}
    return null;
  }

  // ============================================================
  // CONFIG MEMO OVERRIDE
  // ============================================================

  var savedOverlay = null;
  var savedLightning = null;
  var savedParticles = null;
  var currentChatId = null;

  function applyConfigOverrides() {
    if (!configMemoObj) return;
    var w = WEATHERS[cfg.forcedWeather];
    if (w && w.type) {
      if (savedOverlay === null) savedOverlay = configMemoObj.overlay;
      if (savedLightning === null) savedLightning = configMemoObj.lightning;
      configMemoObj.overlay = w.overlay;
      configMemoObj.lightning = w.lightning;
    } else {
      if (savedOverlay !== null) { configMemoObj.overlay = savedOverlay; savedOverlay = null; }
      if (savedLightning !== null) { configMemoObj.lightning = savedLightning; savedLightning = null; }
    }
  }

  // ============================================================
  // PARTICLE MODIFICATION
  // ============================================================

  function storeOrigins(particles) {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      if (!p.__mt) {
        p.__mt = { op: p.opacity, sz: p.size, vx: p.vx, vy: p.vy };
      }
    }
  }

  function cloneParticleArray(arr) {
    var result = [];
    for (var i = 0; i < arr.length; i++) {
      var p = arr[i];
      var c = {};
      for (var k in p) { c[k] = p[k]; }
      if (p.__mt) c.__mt = Object.assign({}, p.__mt);
      result.push(c);
    }
    return result;
  }

  function modifyParticles(particles) {
    var w = WEATHERS[cfg.forcedWeather];
    if (w && w.type) {
      // Before first force, snapshot the original particles
      if (!savedParticles && particles && particles.length > 0) {
        savedParticles = cloneParticleArray(particles);
      }
      var wDim = canvas ? { w: canvas.width, h: canvas.height } : { w: 1920, h: 1080 };
      var desiredCount = Math.round((w.count || 50) * cfg.count);
      desiredCount = Math.max(1, Math.min(desiredCount, 5000));
      var needsRebuild = true;
      if (particles && particles.length > 0) {
        if (particles[0].type === w.type) {
          var diff = Math.abs(particles.length - desiredCount);
          needsRebuild = diff > Math.max(desiredCount * 0.1, 5);
        }
      }
      if (needsRebuild) {
        particles.length = 0;
        var fresh = buildParticles(w.type, desiredCount, wDim.w, wDim.h);
        for (var i = 0; i < fresh.length; i++) particles.push(fresh[i]);
        storeOrigins(particles);
      }
    } else {
      // Auto mode — restore snapshot if we had forced a preset
      if (savedParticles && particles) {
        particles.length = 0;
        for (var i = 0; i < savedParticles.length; i++) particles.push(savedParticles[i]);
        savedParticles = null;
        storeOrigins(particles);
      }
      // Apply count override
      if (particles && particles.length > 0) {
        var currLen = particles.length;
        if (baseCount === 0 || Math.abs(currLen - baseCount) > Math.max(baseCount * 0.3, 10)) baseCount = currLen;
        var target;
        if (Math.abs(cfg.count - 1.0) < 0.01) { target = currLen; baseCount = currLen; }
        else { target = Math.round(baseCount * cfg.count); target = Math.max(1, Math.min(target, 5000)); }
        while (particles.length < target) {
          var src = particles[Math.floor(Math.random() * particles.length)];
          if (!src) break;
          var clone = {};
          for (var k in src) { clone[k] = src[k]; }
          clone.__mt = src.__mt ? Object.assign({}, src.__mt) : undefined;
          clone.x = Math.random() * (canvas ? canvas.width : 1920);
          clone.y = Math.random() * (canvas ? canvas.height : 1080);
          clone.life = 0;
          particles.push(clone);
        }
        while (particles.length > target) { particles.pop(); }
      }
    }
    if (particles && particles.length > 0) {
      storeOrigins(particles);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        if (!p.__mt) continue;
        p.opacity = p.__mt.op * cfg.opacity;
        p.size = p.__mt.sz * cfg.size;
        p.vx = p.__mt.vx * cfg.speed;
        p.vy = p.__mt.vy * cfg.speed;
      }
    }
  }

  function modLoop() {
    if (!particlesRefObj && canvas) locateRefs();

    // Detect chat switch via DOM
    if (canvas) {
      var chatId = findActiveChatId();
      if (chatId && chatId !== currentChatId) {
        log('Chat switched: ' + (currentChatId ? 'saving' : 'loading') + ' config');
        swapChat(currentChatId, chatId);
      }
    }

    if (particlesRefObj && particlesRefObj.current) {
      applyConfigOverrides();
      modifyParticles(particlesRefObj.current);
    } else if (particlesRefObj && !particlesRefObj.current) {
      if (WEATHERS[cfg.forcedWeather] && WEATHERS[cfg.forcedWeather].type) {
        particlesRefObj.current = [];
        modifyParticles(particlesRefObj.current);
      }
    }
    modLoopId = requestAnimationFrame(modLoop);
  }

  // ============================================================
  // CANVAS CSS FILTERS + TINT
  // ============================================================

  function applyCanvasFilters() {
    if (!canvas) return;
    canvas.style.filter = 'brightness(' + cfg.brightness + ') contrast(' + cfg.contrast + ')';
  }

  function ensureTint() {
    if (tintOverlay) return;
    if (!canvas || !canvas.parentNode) return;
    tintOverlay = document.createElement('div');
    tintOverlay.id = 'weathertweaker-tint';
    tintOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;mix-blend-mode:overlay;transition:background .3s;';
    canvas.parentNode.appendChild(tintOverlay);
  }

  function updateTint() {
    if (!cfg.tint || cfg.tintStrength <= 0) {
      if (tintOverlay) tintOverlay.style.background = 'transparent';
      return;
    }
    ensureTint();
    var hex = Math.round(cfg.tintStrength * 255).toString(16);
    if (hex.length < 2) hex = '0' + hex;
    tintOverlay.style.background = cfg.tint + hex;
  }

  function removeTint() {
    if (tintOverlay && tintOverlay.parentNode) tintOverlay.parentNode.removeChild(tintOverlay);
    tintOverlay = null;
  }

  // ============================================================
  // CANVAS DETECTION
  // ============================================================

  function isWeatherCanvas(el) {
    return el.tagName === 'CANVAS' && el.classList.contains('pointer-events-none') &&
      el.classList.contains('inset-0') && el.classList.contains('z-0');
  }

  function attach(canvasEl) {
    detach();
    canvas = canvasEl;
    fiberRetryCount = 0;
    log('Canvas found, starting modLoop');
    modLoopId = requestAnimationFrame(modLoop);
    applyCanvasFilters();
    updateTint();
  }

  function detach() {
    if (modLoopId) { cancelAnimationFrame(modLoopId); modLoopId = null; }
    if (currentChatId) saveChatState(currentChatId);
    removeTint();
    particlesRefObj = null; configMemoObj = null;
    savedOverlay = null; savedLightning = null; savedParticles = null;
    canvas = null; baseCount = 0; fiberRetryCount = 0; currentChatId = null;
  }

  function scanCanvas() {
    var found = document.querySelector('canvas.pointer-events-none.absolute.inset-0.z-0');
    if (found && found !== canvas) attach(found);
    else if (!found && canvas) { detach(); }
  }

  // ============================================================
  // UI — TOOLBAR BUTTON + POPUP
  // ============================================================

  function isActive() {
    for (var key in DEFAULTS) {
      if (key === 'tint' || key === 'tintStrength') continue;
      if (Math.abs(cfg[key] - DEFAULTS[key]) > 0.01) return true;
    }
    if (cfg.forcedWeather) return true;
    if (cfg.tint && cfg.tintStrength > 0) return true;
    return false;
  }

  function addToolbarButtons() {
    // Find all toolbar groups (desktop + mobile variants)
    var groups = document.querySelectorAll('div.pointer-events-auto.ml-auto.flex.shrink-0');
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      // Check it has the right children pattern (gap-1.5 class)
      if (group.className.indexOf('gap') === -1) continue;
      if (group.querySelector('#mt-btn-wrapper')) continue; // already injected

      var wrapper = document.createElement('div');
      wrapper.id = 'mt-btn-wrapper';
      wrapper.className = 'relative';

      var btn = document.createElement('button');
      btn.className =
        'flex items-center justify-center rounded-full border backdrop-blur-md transition-all p-1.5 ' +
        'border-foreground/10 bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground';
      btn.title = 'WeatherTweaker \u2014 Weather Tweaks';
      var svg = document.createElementNS('http://www.w3.org/2000/svg','svg');
      svg.setAttribute('width','14');svg.setAttribute('height','14');
      svg.setAttribute('viewBox','0 0 24 24');
      svg.setAttribute('fill','none');svg.setAttribute('stroke','currentColor');
      svg.setAttribute('stroke-width','2');svg.setAttribute('stroke-linecap','round');svg.setAttribute('stroke-linejoin','round');
      var p1=document.createElementNS('http://www.w3.org/2000/svg','path');p1.setAttribute('d','M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z');svg.appendChild(p1);
      var p2=document.createElementNS('http://www.w3.org/2000/svg','path');p2.setAttribute('d','M12 2v1M4.93 4.93l.7.7M2 12h1M20 12h1M6 17l-1 1');svg.appendChild(p2);
      btn.appendChild(svg);

      wrapper.appendChild(btn);
      group.insertBefore(wrapper, group.firstChild);

      // Click handler
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (popup && popup.parentNode) {
          closePopup();
        } else {
          showPopup(this);
        }
      });
    }
  }

  function showPopup(anchor) {
    closePopup();

    var isMobile = window.innerWidth < 768;
    var uid = Date.now() + '-' + Math.random().toString(36).slice(2, 6);

    popup = document.createElement('div');
    if (isMobile) {
      popup.className =
        'fixed inset-0 z-[9999] flex items-center justify-center p-4 max-md:pt-[max(1rem,env(safe-area-inset-top))]';
      var backdrop = document.createElement('div');
      backdrop.className = 'absolute inset-0 bg-black/30';
      backdrop.addEventListener('click', closePopup);
      popup.appendChild(backdrop);
    }

    var card = document.createElement('div');
    if (isMobile) {
      card.className =
        'relative w-full max-w-sm max-h-[calc(100dvh-4rem)] overflow-y-auto';
    }
    card.style.cssText =
      'border-radius:12px;border:1px solid var(--border);' +
      'background:var(--card);box-shadow:0 25px 50px -12px rgba(0,0,0,.6);' +
      'animation:message-in .2s ease-out;' +
      (isMobile ? '' : 'position:absolute;right:0;top:calc(100% + 4px);z-index:100;' +
        'width:262px;max-height:calc(100dvh - 200px);overflow-y:auto;');

    // Header
    var header = document.createElement('div');
    header.style.cssText =
      'display:flex;align-items:center;justify-content:space-between;' +
      'padding:8px 12px;border-bottom:1px solid var(--border);';

    var title = document.createElement('div');
    title.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--foreground);';
    title.innerHTML =
      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="color:var(--primary,#6c63ff);flex-shrink:0">' +
      '<path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/>' +
      '<path d="M12 2v1M4.93 4.93l.7.7M2 12h1M20 12h1"/>' +
      '</svg>Weather Tweaks';
    header.appendChild(title);

    var close = document.createElement('button');
    close.id = 'mt-close-' + uid;
    close.style.cssText =
      'border-radius:6px;padding:4px;color:var(--muted-foreground);' +
      'background:none;border:none;cursor:pointer;line-height:0;' +
      'transition:background .15s,color .15s;';
    close.innerHTML =
      '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 6 6 18M6 6l12 12"/>' +
      '</svg>';
    close.addEventListener('mouseenter', function () {
      this.style.background = 'var(--accent)'; this.style.color = 'var(--foreground)';
    });
    close.addEventListener('mouseleave', function () {
      this.style.background = 'none'; this.style.color = 'var(--muted-foreground)';
    });
    close.addEventListener('click', closePopup);
    header.appendChild(close);

    card.appendChild(header);

    // Body
    var body = document.createElement('div');
    body.style.cssText = 'padding:4px 12px 2px;';
    body.innerHTML = buildContent();
    card.appendChild(body);

    if (isMobile) {
      popup.appendChild(card);
      document.body.appendChild(popup);
    } else {
      popup = card;
      var parent = anchor.parentNode;
      if (parent) parent.appendChild(popup);
    }

    // Event handlers
    setTimeout(function () {
      function onDown(e) {
        if (!popup) return;
        if (popup.contains(e.target) || (anchor && anchor.contains(e.target))) return;
        closePopup();
      }
      function onKey(e) { if (e.key === 'Escape') closePopup(); }
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
      popup._mtCleanup = function () {
        document.removeEventListener('mousedown', onDown);
        document.removeEventListener('keydown', onKey);
      };
    }, 0);

    bindPopupEvents();
    updateBtnState();
  }

  function closePopup() {
    if (popup) {
      if (popup._mtCleanup) popup._mtCleanup();
      if (popup.parentNode) popup.parentNode.removeChild(popup);
    }
    popup = null;
    updateBtnState();
  }

  function buildContent() {
    // Check if weather canvas exists — if not, show help message
    if (!document.querySelector('canvas.pointer-events-none.absolute.inset-0.z-0')) {
      return (
        '<div style="padding:12px 0;text-align:center;font-size:12px;color:var(--muted-foreground,#999);line-height:1.6">' +
        '<div style="font-size:28px;margin-bottom:8px;opacity:.6">\u2601\uFE0F</div>' +
        'Weather effects not available for this chat.' +
        '<div style="margin-top:8px;font-size:11px;text-align:left;color:var(--muted-foreground,#999)">' +
        'Requires:<br>' +
        '\u2022 <strong>Settings \u2192 Appearance</strong> \u2192 enable <em>Dynamic weather effects</em><br>' +
        '\u2022 <strong>Roleplay HUD</strong> \u2192 enable the <em>World State</em> agent' +
        '</div></div>'
      );
    }

    var rows = '';
    var fields = [
      { id:'mt-opacity',    l:'Opacity',    min:0, max:3, step:0.05 },
      { id:'mt-speed',      l:'Speed',      min:0, max:3, step:0.05 },
      { id:'mt-size',       l:'Size',       min:0, max:3, step:0.05 },
      { id:'mt-count',      l:'Count',      min:0, max:3, step:0.05 },
      { id:'mt-brightness', l:'Brightness', min:0, max:3, step:0.05 },
      { id:'mt-contrast',   l:'Contrast',   min:0, max:3, step:0.05 },
    ];

    for (var i = 0; i < fields.length; i++) {
      var f = fields[i];
      var key = f.id.replace('mt-', '');
      var val = key in cfg ? cfg[key] : DEFAULTS[key];
      rows +=
        '<div class="mt-row">' +
          '<span class="mt-lbl">' + f.l + '</span>' +
          '<input class="mt-rng" id="' + f.id + '" type="range" min="' + f.min + '" max="' + f.max + '" step="' + f.step + '" value="' + val + '">' +
          '<span class="mt-val" id="' + f.id + '-val">' + Number(val).toFixed(2) + '</span>' +
        '</div>';
    }

    var weatherOpts = '';
    for (var key in WEATHERS) {
      if (WEATHERS.hasOwnProperty(key)) {
        var sel = key === (cfg.forcedWeather || 'auto') ? ' selected' : '';
        weatherOpts += '<option value="' + key + '"' + sel + '>' + WEATHERS[key].label + '</option>';
      }
    }
    rows +=
      '<div class="mt-row" style="border-top:1px solid var(--border);padding-top:5px;margin-top:3px">' +
        '<span class="mt-lbl">Weather</span>' +
        '<select id="mt-weather" class="mt-sel">' + weatherOpts + '</select>' +
      '</div>';

    var tintHex = cfg.tint || '#ff9933';
    rows +=
      '<div class="mt-row" style="border-top:1px solid var(--border);padding-top:5px;margin-top:3px">' +
        '<span class="mt-lbl">Tint</span>' +
        '<input class="mt-clr" id="mt-tint-clr" type="color" value="' + tintHex + '">' +
        '<input class="mt-rng" id="mt-tint-str" type="range" min="0" max="0.5" step="0.01" value="' + cfg.tintStrength + '">' +
        '<span class="mt-val" id="mt-tint-str-val">' + cfg.tintStrength.toFixed(2) + '</span>' +
      '</div>' +
      '<button class="mt-rst" id="mt-rst">Reset defaults</button>';

    return rows;
  }

  function bindPopupEvents() {
    var keys = ['opacity','speed','size','count','brightness','contrast'];
    for (var i = 0; i < keys.length; i++) {
      (function (k) {
        var inp = document.getElementById('mt-' + k);
        var val = document.getElementById('mt-' + k + '-val');
        if (!inp || !val) return;
        inp.addEventListener('input', function () {
          cfg[k] = parseFloat(inp.value);
          val.textContent = cfg[k].toFixed(2);
          saveCfg(cfg);
          applyNow();
        });
      })(keys[i]);
    }

    var weather = document.getElementById('mt-weather');
    if (weather) {
      weather.addEventListener('change', function () {
        var v = weather.value;
        cfg.forcedWeather = v === 'auto' ? null : v;
        saveCfg(cfg);
        savedOverlay = null; savedLightning = null;
        log('Weather forced: ' + v);
        applyNow();
      });
    }

    var tintClr = document.getElementById('mt-tint-clr');
    var tintStr = document.getElementById('mt-tint-str');
    var tintVal = document.getElementById('mt-tint-str-val');
    if (tintClr && tintStr && tintVal) {
      function onTint() {
        cfg.tint = tintClr.value;
        cfg.tintStrength = parseFloat(tintStr.value);
        tintVal.textContent = cfg.tintStrength.toFixed(2);
        saveCfg(cfg);
        applyNow();
      }
      tintClr.addEventListener('input', onTint);
      tintStr.addEventListener('input', onTint);
    }

    var reset = document.getElementById('mt-rst');
    if (reset) {
      reset.addEventListener('click', function () {
        Object.assign(cfg, DEFAULTS);
        saveCfg(cfg);
        savedOverlay = null; savedLightning = null;
        updateUI();
        applyNow();
      });
    }
  }

  function updateUI() {
    var keys = ['opacity','speed','size','count','brightness','contrast'];
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var inp = document.getElementById('mt-' + k);
      var val = document.getElementById('mt-' + k + '-val');
      if (inp) inp.value = cfg[k];
      if (val) val.textContent = cfg[k].toFixed(2);
    }
    var w = document.getElementById('mt-weather');
    if (w) w.value = cfg.forcedWeather || 'auto';
    var tc = document.getElementById('mt-tint-clr');
    var ts = document.getElementById('mt-tint-str');
    var tv = document.getElementById('mt-tint-str-val');
    if (tc) tc.value = cfg.tint || '#ff9933';
    if (ts) ts.value = cfg.tintStrength;
    if (tv) tv.textContent = cfg.tintStrength.toFixed(2);
    updateBtnState();
  }

  function updateBtnState() {
    var btns = document.querySelectorAll('#mt-btn-wrapper > button');
    var active = isActive() || (popup !== null);
    for (var i = 0; i < btns.length; i++) {
      var b = btns[i];
      if (active) {
        b.className =
          'flex items-center justify-center rounded-full border backdrop-blur-md transition-all p-1.5 ' +
          'bg-foreground/15 border-foreground/20 text-foreground/90';
      } else {
        b.className =
          'flex items-center justify-center rounded-full border backdrop-blur-md transition-all p-1.5 ' +
          'border-foreground/10 bg-foreground/5 text-foreground/60 hover:bg-foreground/10 hover:text-foreground';
      }
    }
  }

  function applyNow() {
    if (particlesRefObj && particlesRefObj.current) {
      baseCount = particlesRefObj.current.length;
      applyConfigOverrides();
      modifyParticles(particlesRefObj.current);
    } else if (particlesRefObj && !particlesRefObj.current) {
      if (WEATHERS[cfg.forcedWeather] && WEATHERS[cfg.forcedWeather].type) {
        particlesRefObj.current = [];
        modifyParticles(particlesRefObj.current);
      }
    }
    applyCanvasFilters();
    updateTint();
  }

  // ============================================================
  // INIT
  // ============================================================

  log('Loading...');
  scanCanvas();
  canvasObserver = new MutationObserver(function () { scanCanvas(); });
  canvasObserver.observe(document.body, { childList: true, subtree: true });

  // Inject toolbar buttons on DOM changes
  var toolbarInterval = setInterval(function () {
    addToolbarButtons();
  }, 1000);

  var toolbarObserver = new MutationObserver(function () {
    addToolbarButtons();
  });
  toolbarObserver.observe(document.body, { childList: true, subtree: true });

  // ============================================================
  // CLEANUP
  // ============================================================

  if (typeof marinara !== 'undefined' && marinara.onCleanup) {
    marinara.onCleanup(function () {
      closePopup();
      detach();
      if (canvasObserver) canvasObserver.disconnect();
      if (toolbarObserver) toolbarObserver.disconnect();
      clearInterval(toolbarInterval);
      var wrappers = document.querySelectorAll('#mt-btn-wrapper');
      for (var i = 0; i < wrappers.length; i++) {
        if (wrappers[i].parentNode) wrappers[i].parentNode.removeChild(wrappers[i]);
      }
      var tint = document.getElementById('weathertweaker-tint');
      if (tint && tint.parentNode) tint.parentNode.removeChild(tint);
    });
  }

})();
