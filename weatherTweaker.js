;(function () {
  'use strict';

  var STORAGE_KEY = 'weathertweaker:v2';
  var STANDALONE_KEY = 'weathertweaker:standalone';

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
    auroraStyle: 'green',
    auroraColor1: '#80ff80',
    auroraColor2: '#cc66ff',
    auroraRevamped: false,
    auroraQuality: 'medium',
    celestial: 'auto',
    celestialPos: 0.5,
    sunRays: true,
  };

  function hexToRgba(hex, alpha) {
    var r = parseInt(hex.slice(1, 3), 16);
    var g = parseInt(hex.slice(3, 5), 16);
    var b = parseInt(hex.slice(5, 7), 16);
    return 'rgba(' + r + ',' + g + ',' + b + ',' + alpha + ')';
  }

  function loadCfg() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return Object.assign({}, DEFAULTS, JSON.parse(raw));
    } catch (e) {}
    return Object.assign({}, DEFAULTS);
  }

  var saveTimer = null;
  function writeCfgNow() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cfg));
      if (currentChatId) saveChatState(currentChatId);
    } catch (e) {}
  }
  function saveCfg() {
    if (saveTimer) return;
    saveTimer = setTimeout(function () { saveTimer = null; writeCfgNow(); }, 250);
  }

  function loadBoolPref(key) {
    try { return localStorage.getItem(key) === '1'; } catch (e) {}
    return false;
  }
  function saveBoolPref(key, val) {
    try { localStorage.setItem(key, val ? '1' : '0'); } catch (e) {}
  }

  function throttle(fn, ms) {
    var last = 0, timer = null;
    return function () {
      var now = Date.now();
      var remaining = ms - (now - last);
      if (remaining <= 0) {
        last = now;
        fn();
      } else if (!timer) {
        timer = setTimeout(function () { last = Date.now(); timer = null; fn(); }, remaining);
      }
    };
  }

  function chatKey(id) { return 'weathertweaker:chat:' + id; }

  function saveChatState(id) {
    if (!id) return;
    try {
      var state = { cfg: cfg };
      localStorage.setItem(chatKey(id), JSON.stringify(state));
    } catch (e) {}
  }

  function loadChatState(id) {
    if (!id) return;
    savedParticles = null;
    try {
      var raw = localStorage.getItem(chatKey(id));
      if (raw) {
        var state = JSON.parse(raw);
        if (state.cfg) Object.assign(cfg, state.cfg);
      } else {
        Object.assign(cfg, DEFAULTS);
      }
    } catch (e) {
      Object.assign(cfg, DEFAULTS);
    }
  }

  function swapChat(oldId, newId) {
    if (oldId === newId) return;
    log('Chat config: ' + oldId + ' -> ' + newId);
    if (oldId) saveChatState(oldId);
    currentChatId = newId;
    savedOverlay = null;
    savedLightning = null;
    savedCelestial = null;
    savedHour = null;
    loadChatState(newId);
    applyCanvasFilters();
    updateTint();
    if (popup) refreshPopupBody();
    updateBtnState();
  }


  var WEATHERS = {
    auto:      { label: 'Auto (follow AI)',        type: null,   count: 0,  overlay: '',               lightning: false },
    clear:     { label: '☀️ Clear / Sunny',  type: 'dust',  count: 12, overlay: '',               lightning: false },
    cloudy:    { label: '☁️ Cloudy',      type: 'dust',  count: 8,  overlay: 'rgba(100,100,120,0.05)', lightning: false },
    rain:      { label: '🌦️ Rain',      type: 'rain',  count: 80, overlay: 'rgba(50,80,120,0.08)',   lightning: false },
    heavyrain: { label: '🌧️ Heavy Rain', type: 'rain',  count: 200,overlay: 'rgba(50,80,120,0.08)',   lightning: false },
    thunder:   { label: '⛈️ Thunderstorm',     type: 'rain',  count: 200,overlay: 'rgba(50,80,120,0.10)',   lightning: true  },
    snow:      { label: '❄️ Snow',         type: 'snow',  count: 50, overlay: 'rgba(200,220,255,0.06)',  lightning: false },
    blizzard:  { label: '🌨️ Blizzard',   type: 'snow',  count: 150,overlay: 'rgba(200,220,255,0.10)',  lightning: false },
    fog:       { label: '🌫️ Fog / Mist',   type: 'fog',   count: 20, overlay: 'rgba(180,180,200,0.12)', lightning: false },
    sand:      { label: '🏜️ Sandstorm',    type: 'sand',  count: 100,overlay: 'rgba(180,150,100,0.12)',  lightning: false },
    hail:      { label: '🧊 Hail',           type: 'hail',  count: 60, overlay: 'rgba(180,200,230,0.06)',  lightning: false },
    windy:     { label: '💨 Windy',            type: 'leaf',  count: 25, overlay: '',               lightning: false },
    blossom:   { label: '🌸 Cherry Blossom',    type: 'petal', count: 30, overlay: 'rgba(255,180,200,0.04)', lightning: false },
    ember:     { label: '🔥 Ember / Fire',     type: 'ember', count: 35, overlay: 'rgba(120,40,10,0.08)',   lightning: false },
    ash:       { label: '🌋 Ash / Volcanic',    type: 'ash',   count: 40, overlay: 'rgba(80,60,60,0.10)',    lightning: false },
    aurora:    { label: '🌌 Aurora',             type: 'aurora',count: 6,    overlay: 'rgba(20,60,40,0.08)',    lightning: false },
    starrynight: { label: '✨ Starry Night',           type: 'star',  count: 140, overlay: 'rgba(6,8,22,0.20)',   lightning: false, shootingStars: false, meteorRate: 0 },
    starryshowers:{ label: '🌠 Starry Showers',   type: 'star',  count: 60,  overlay: 'rgba(6,8,22,0.20)',   lightning: false, shootingStars: true,  meteorRate: 0.022 },
  };


  function rand(min, max) { return min + Math.random() * (max - min); }

  function createParticle(type, w, h, fromTop) {
    var p = {
      x: Math.random() * w,
      y: fromTop ? -10 : Math.random() * h,
      vx: 0, vy: 0,
      size: 2,
      opacity: 0.5,
      type: type,
      wobble: Math.random() * Math.PI * 2,
      life: 0,
      maxLife: 600 + Math.random() * 400,
      color: '',
    };
    switch (type) {
      case 'rain':    p.vy=8+Math.random()*6;p.vx=-1+Math.random()*-2;p.size=1.5;p.opacity=0.25+Math.random()*0.2;p.maxLife=200;break;
      case 'snow':    p.vy=0.5+Math.random()*1.2;p.vx=-0.3+Math.random()*0.6;p.size=2+Math.random()*3;p.opacity=0.4+Math.random()*0.3;p.maxLife=800;break;
      case 'leaf':    p.vy=0.8+Math.random()*1;p.vx=1.5+Math.random()*2;p.size=4+Math.random()*3;p.opacity=0.5+Math.random()*0.3;p.maxLife=500;break;
      case 'petal':   p.vy=0.4+Math.random()*0.8;p.vx=0.5+Math.random()*1;p.size=3+Math.random()*3;p.opacity=0.4+Math.random()*0.3;p.maxLife=600;break;
      case 'firefly': p.vy=-0.2+Math.random()*0.4;p.vx=-0.3+Math.random()*0.6;p.size=2+Math.random()*2;p.opacity=0;p.maxLife=300+Math.random()*300;break;
      case 'star':    p.vy=0;p.vx=0;p.size=1+Math.random()*1.5;p.opacity=0;p.maxLife=400+Math.random()*400;p.y=Math.random()*h*0.4;break;
      case 'fog':     p.vy=0;p.vx=0.2+Math.random()*0.4;p.size=60+Math.random()*80;p.opacity=0.03+Math.random()*0.04;p.maxLife=1000;break;
      case 'dust':    p.vy=-0.1+Math.random()*0.2;p.vx=-0.1+Math.random()*0.2;p.size=1+Math.random()*2;p.opacity=0.15+Math.random()*0.15;p.maxLife=600+Math.random()*400;break;
      case 'ember':   p.vy=-1.5+Math.random()*-1.5;p.vx=-0.5+Math.random()*1;p.size=2+Math.random()*2;p.opacity=0.6+Math.random()*0.3;p.maxLife=300+Math.random()*200;p.y=h+10;break;
      case 'ash':     p.vy=0.3+Math.random()*0.6;p.vx=-0.4+Math.random()*0.8;p.size=2+Math.random()*3;p.opacity=0.2+Math.random()*0.2;p.maxLife=700+Math.random()*300;p.color='rgba('+((100+Math.random()*40)|0)+','+((90+Math.random()*30)|0)+','+((90+Math.random()*30)|0)+',0.6)';break;
      case 'sand':    p.vy=0.5+Math.random()*1;p.vx=4+Math.random()*4;p.size=1+Math.random()*2;p.opacity=0.3+Math.random()*0.3;p.maxLife=250+Math.random()*150;p.x=-10;p.color='rgba('+((200+Math.random()*30)|0)+','+((170+Math.random()*30)|0)+','+((110+Math.random()*20)|0)+',0.7)';break;
      case 'hail':    p.vy=10+Math.random()*6;p.vx=-1+Math.random()*-1;p.size=2+Math.random()*3;p.opacity=0.4+Math.random()*0.3;p.maxLife=150;break;
      case 'aurora':  p.vy=0;p.vx=0.1+Math.random()*0.2;p.size=80+Math.random()*120;p.opacity=0.04+Math.random()*0.03;p.maxLife=1200+Math.random()*600;p.y=Math.random()*h*0.35;break;
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


  var AMBIENT_TYPES = { fog: 1, dust: 1, firefly: 1, star: 1, aurora: 1, ember: 1 };

  function unitsToExit(p, cw, ch) {
    var best = Infinity;
    if (p.vy > 0.05) best = Math.min(best, (ch + 20 - p.y) / p.vy);
    if (p.vy < -0.05) best = Math.min(best, (p.y + 20) / -p.vy);
    if (p.vx > 0.05) best = Math.min(best, (cw + 20 - p.x) / p.vx);
    if (p.vx < -0.05) best = Math.min(best, (p.x + 20) / -p.vx);
    return best;
  }

  function spawnOwnParticle(type, cw, ch, respawn) {
    var p = createParticle(type, cw, ch, false);
    if (!respawn && type === 'sand') {
      p.x = Math.random() * cw;
    }
    if (respawn && !AMBIENT_TYPES[type]) {
      var fluxTop = Math.max(p.vy, 0) * cw;
      var fluxSide = Math.abs(p.vx) * ch;
      if (Math.random() * (fluxTop + fluxSide) < fluxTop) {
        p.x = Math.random() * cw;
        p.y = -10;
      } else {
        p.x = p.vx > 0 ? -10 : cw + 10;
        p.y = Math.random() * ch;
      }
    }
    p.maxLife *= 0.75 + Math.random() * 0.5;
    if (!AMBIENT_TYPES[type]) {
      var exit = (unitsToExit(p, cw, ch) / (cfg.speed || 1)) * 1.25;
      if (isFinite(exit) && exit > p.maxLife) p.maxLife = exit;
    }
    p.__mt = { op: p.opacity, sz: p.size, vx: p.vx, vy: p.vy };
    return p;
  }


  var spriteCache = {};

  var SNOW_STOPS = [[0, 'rgba(255,255,255,0.9)'], [1, 'rgba(255,255,255,0)']];
  var FOG_STOPS = [[0, 'rgba(200,200,220,0.06)'], [1, 'rgba(200,200,220,0)']];
  var EMBER_STOPS = [[0, 'rgba(255,200,60,1)'], [0.4, 'rgba(255,100,20,0.6)'], [1, 'rgba(255,60,10,0)']];
  var HAIL_STOPS = [[0, 'rgba(255,255,255,0.95)'], [0.7, 'rgba(200,220,255,0.7)'], [1, 'rgba(180,200,240,0.3)']];
  var FIREFLY_STOPS = [[0, 'rgba(200,255,100,0.8)'], [0.5, 'rgba(180,255,80,0.3)'], [1, 'rgba(180,255,80,0)']];

  function getGlowSprite(key, px, stops, inset) {
    var s = spriteCache[key];
    if (s) return s;
    s = document.createElement('canvas');
    s.width = px;
    s.height = px;
    var sctx = s.getContext('2d');
    if (sctx) {
      var h = px / 2;
      var off = inset ? h * 0.3 : 0;
      var g = sctx.createRadialGradient(h - off, h - off, 0, h, h, h);
      for (var i = 0; i < stops.length; i++) g.addColorStop(stops[i][0], stops[i][1]);
      sctx.fillStyle = g;
      sctx.beginPath();
      sctx.arc(h, h, h, 0, Math.PI * 2);
      sctx.fill();
    }
    spriteCache[key] = s;
    return s;
  }

  function getStarSprite(rgb, bright) {
    var key = 'st:' + rgb + (bright ? ':b' : ':d');
    var s = spriteCache[key];
    if (s) return s;
    var u = 10;
    var ext = Math.ceil(u * (bright ? 6 : 3.2));
    s = document.createElement('canvas');
    s.width = ext * 2;
    s.height = ext * 2;
    var sctx = s.getContext('2d');
    if (sctx) {
      sctx.globalCompositeOperation = 'screen';
      var haloR = u * (bright ? 6 : 3.2);
      var glow = sctx.createRadialGradient(ext, ext, 0, ext, ext, haloR);
      glow.addColorStop(0, 'rgba(' + rgb + ',' + (bright ? 0.55 : 0.32) + ')');
      glow.addColorStop(0.4, 'rgba(' + rgb + ',0.12)');
      glow.addColorStop(1, 'rgba(' + rgb + ',0)');
      sctx.fillStyle = glow;
      sctx.fillRect(0, 0, ext * 2, ext * 2);
      sctx.fillStyle = 'rgba(' + rgb + ',1)';
      sctx.beginPath();
      sctx.arc(ext, ext, u * 0.75, 0, Math.PI * 2);
      sctx.fill();
      if (bright) {
        var spikeLen = u * 5;
        var g1 = sctx.createLinearGradient(ext - spikeLen, ext, ext + spikeLen, ext);
        g1.addColorStop(0, 'rgba(' + rgb + ',0)');
        g1.addColorStop(0.5, 'rgba(' + rgb + ',0.6)');
        g1.addColorStop(1, 'rgba(' + rgb + ',0)');
        sctx.strokeStyle = g1;
        sctx.lineWidth = 5;
        sctx.beginPath();
        sctx.moveTo(ext - spikeLen, ext);
        sctx.lineTo(ext + spikeLen, ext);
        sctx.stroke();
        var g2 = sctx.createLinearGradient(ext, ext - spikeLen, ext, ext + spikeLen);
        g2.addColorStop(0, 'rgba(' + rgb + ',0)');
        g2.addColorStop(0.5, 'rgba(' + rgb + ',0.6)');
        g2.addColorStop(1, 'rgba(' + rgb + ',0)');
        sctx.strokeStyle = g2;
        sctx.beginPath();
        sctx.moveTo(ext, ext - spikeLen);
        sctx.lineTo(ext, ext + spikeLen);
        sctx.stroke();
      }
    }
    spriteCache[key] = s;
    return s;
  }


  function drawParticle(ctx, p) {
    var fadeIn = Math.min((p.fadeLife === undefined ? p.life : p.fadeLife) / 60, 1);
    var fadeOut = Math.max(1 - p.life / p.maxLife, 0);
    var alpha = p.opacity * fadeIn * fadeOut;
    if (alpha <= 0) return;

    ctx.globalAlpha = alpha;

    switch (p.type) {
      case 'rain': {
        ctx.strokeStyle = 'rgba(180,210,255,0.8)';
        ctx.lineWidth = p.size;
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        ctx.lineTo(p.x + p.vx * 2, p.y + p.vy * 2);
        ctx.stroke();
        break;
      }
      case 'snow': {
        var sSpr = getGlowSprite('snow', 64, SNOW_STOPS);
        ctx.drawImage(sSpr, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        break;
      }
      case 'leaf': {
        ctx.fillStyle = 'hsl(' + (100 + Math.sin(p.wobble) * 30) + ', 60%, 45%)';
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.wobble);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'petal': {
        ctx.fillStyle = 'hsl(' + (340 + Math.sin(p.wobble) * 15) + ', 80%, 80%)';
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.wobble);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.5, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'firefly': {
        var pulse = Math.sin(p.life * 0.05) * 0.5 + 0.5;
        var fSpr = getGlowSprite('firefly', 64, FIREFLY_STOPS);
        var fr = p.size * 3;
        ctx.globalAlpha = alpha * pulse;
        ctx.drawImage(fSpr, p.x - fr, p.y - fr, fr * 2, fr * 2);
        break;
      }
      case 'star': {
        var twinkle = Math.sin(p.life * 0.04 + p.wobble) * 0.5 + 0.5;
        ctx.fillStyle = 'rgba(255,255,240,' + (twinkle * 0.7) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,240,' + (twinkle * 0.3) + ')';
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        ctx.moveTo(p.x - p.size * 2, p.y);
        ctx.lineTo(p.x + p.size * 2, p.y);
        ctx.moveTo(p.x, p.y - p.size * 2);
        ctx.lineTo(p.x, p.y + p.size * 2);
        ctx.stroke();
        break;
      }
      case 'fog': {
        var fogSpr = getGlowSprite('fog', 256, FOG_STOPS);
        ctx.drawImage(fogSpr, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        break;
      }
      case 'dust': {
        ctx.fillStyle = 'rgba(255,240,220,0.6)';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'ember': {
        var ep = Math.sin(p.life * 0.08) * 0.3 + 0.7;
        var eSpr = getGlowSprite('ember', 64, EMBER_STOPS);
        var er = p.size * 2.5;
        ctx.globalAlpha = alpha * ep;
        ctx.drawImage(eSpr, p.x - er, p.y - er, er * 2, er * 2);
        break;
      }
      case 'ash': {
        ctx.fillStyle = p.color;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.wobble);
        ctx.beginPath();
        ctx.ellipse(0, 0, p.size, p.size * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        break;
      }
      case 'sand': {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'hail': {
        var hSpr = getGlowSprite('hail', 64, HAIL_STOPS, true);
        ctx.drawImage(hSpr, p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        break;
      }
      case 'aurora': {
        var hue = (p.wobble * 60 + p.life * 0.3) % 360;
        var ag = ctx.createLinearGradient(p.x, p.y - p.size, p.x, p.y + p.size);
        ag.addColorStop(0, 'hsla(' + hue + ',80%,60%,0)');
        ag.addColorStop(0.3, 'hsla(' + hue + ',80%,60%,0.08)');
        ag.addColorStop(0.5, 'hsla(' + ((hue + 40) % 360) + ',70%,55%,0.12)');
        ag.addColorStop(0.7, 'hsla(' + ((hue + 80) % 360) + ',80%,60%,0.08)');
        ag.addColorStop(1, 'hsla(' + ((hue + 80) % 360) + ',80%,60%,0)');
        ctx.fillStyle = ag;
        ctx.beginPath();
        var ribbonW = p.size * 0.6;
        var sway = Math.sin(p.life * 0.008 + p.wobble) * 30;
        ctx.moveTo(p.x + sway - ribbonW, p.y - p.size);
        ctx.quadraticCurveTo(p.x + sway * 0.5, p.y, p.x + sway + ribbonW, p.y + p.size);
        ctx.lineTo(p.x + sway - ribbonW, p.y + p.size);
        ctx.quadraticCurveTo(p.x + sway * 0.5, p.y, p.x + sway + ribbonW, p.y - p.size);
        ctx.closePath();
        ctx.fill();
        break;
      }
    }

    ctx.globalAlpha = 1;
  }


  function celestialX(hour, w) {
    var t = Math.max(0, Math.min(1, (hour - 6) / 12));
    return w * 0.08 + t * w * 0.84;
  }

  function celestialY(hour, h, isMoon) {
    if (isMoon) {
      var tm = hour >= 12 ? (hour - 21) / 7 : (hour + 3) / 7;
      var arcm = Math.sin(Math.max(0, Math.min(1, tm)) * Math.PI);
      return h * 0.05 + (1 - arcm) * h * 0.2;
    }
    var t = Math.max(0, Math.min(1, (hour - 6) / 12));
    var arc = Math.sin(t * Math.PI);
    return h * 0.05 + (1 - arc) * h * 0.25;
  }

  function drawSun(ctx, x, y, radius, w, h, sunRays, sunsetGlow, frameCount) {
    ctx.save();
    if (sunsetGlow) {
      var glowGrad = ctx.createRadialGradient(x, y, radius, x, y + radius * 6, radius * 12);
      glowGrad.addColorStop(0, 'rgba(255,140,50,0.12)');
      glowGrad.addColorStop(0.4, 'rgba(255,80,30,0.06)');
      glowGrad.addColorStop(1, 'rgba(255,40,20,0)');
      ctx.fillStyle = glowGrad;
      ctx.fillRect(0, 0, w, h);
    }
    var outerGlow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 4);
    outerGlow.addColorStop(0, sunsetGlow ? 'rgba(255,120,40,0.15)' : 'rgba(255,240,180,0.12)');
    outerGlow.addColorStop(0.5, sunsetGlow ? 'rgba(255,80,20,0.05)' : 'rgba(255,240,180,0.04)');
    outerGlow.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = outerGlow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 4, 0, Math.PI * 2);
    ctx.fill();

    var discGrad = ctx.createRadialGradient(x, y, 0, x, y, radius);
    if (sunsetGlow) {
      discGrad.addColorStop(0, 'rgba(255,200,100,0.9)');
      discGrad.addColorStop(0.7, 'rgba(255,120,40,0.7)');
      discGrad.addColorStop(1, 'rgba(255,80,20,0.3)');
    } else {
      discGrad.addColorStop(0, 'rgba(255,250,220,0.8)');
      discGrad.addColorStop(0.7, 'rgba(255,240,180,0.5)');
      discGrad.addColorStop(1, 'rgba(255,230,150,0.2)');
    }
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (sunRays) {
      var rayCount = 12;
      var rotOffset = frameCount * 0.002;
      ctx.globalAlpha = 0.06;
      for (var i = 0; i < rayCount; i++) {
        var angle = (i / rayCount) * Math.PI * 2 + rotOffset;
        var pulse = 0.8 + Math.sin(frameCount * 0.01 + i * 1.5) * 0.2;
        var rayLen = radius * (3.5 + pulse * 2);
        var spread = 0.08;
        ctx.fillStyle = sunsetGlow ? 'rgba(255,160,60,0.5)' : 'rgba(255,250,200,0.4)';
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(angle - spread) * rayLen, y + Math.sin(angle - spread) * rayLen);
        ctx.lineTo(x + Math.cos(angle + spread) * rayLen, y + Math.sin(angle + spread) * rayLen);
        ctx.closePath();
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawMoon(ctx, x, y, radius) {
    ctx.save();
    var glow = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 5);
    glow.addColorStop(0, 'rgba(180,200,255,0.10)');
    glow.addColorStop(0.4, 'rgba(150,180,255,0.04)');
    glow.addColorStop(1, 'rgba(150,180,255,0)');
    ctx.globalAlpha = 1;
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(x, y, radius * 5, 0, Math.PI * 2);
    ctx.fill();

    var discGrad = ctx.createRadialGradient(x - radius * 0.15, y - radius * 0.15, 0, x, y, radius);
    discGrad.addColorStop(0, 'rgba(230,235,255,0.85)');
    discGrad.addColorStop(0.8, 'rgba(200,210,240,0.6)');
    discGrad.addColorStop(1, 'rgba(180,190,220,0.3)');
    ctx.globalAlpha = 0.7;
    ctx.fillStyle = discGrad;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalCompositeOperation = 'destination-out';
    ctx.globalAlpha = 0.65;
    ctx.fillStyle = 'black';
    ctx.beginPath();
    ctx.arc(x + radius * 0.45, y - radius * 0.1, radius * 0.85, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-over';

    ctx.globalAlpha = 0.06;
    ctx.fillStyle = 'rgba(150,160,190,1)';
    ctx.beginPath();
    ctx.arc(x - radius * 0.25, y - radius * 0.15, radius * 0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - radius * 0.4, y + radius * 0.25, radius * 0.08, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x - radius * 0.05, y + radius * 0.35, radius * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }


  var cfg = loadCfg();
  var standaloneMode = loadBoolPref(STANDALONE_KEY);
  var fpsIndependent = true;
  var canvas = null;
  var ownsCanvas = false;
  var particlesRefObj = null;
  var configMemoObj = null;
  var baseCount = 0;
  var modLoopId = null;
  var tintOverlay = null;
  var fiberRetryCount = 0;
  var canvasObserver = null;
  var popup = null;
  var frameTick = 0;
  var dtScale = 1;
  var particleBoost = 1;
  var lastFrameTime = 0;
  var detectedHz = 0;
  var rateSamples = [];
  var disposed = false;

  function recomputeFps() {
    particleBoost = detectedHz > 60 ? Math.min(detectedHz / 60, 8) : 1;
  }
  var ownParticles = [];
  var ownResizeObserver = null;
  var hiddenHostCanvas = null;
  var ownCanvasEl = null;
  var standaloneFrame = 0;
  var log = function (msg) { console.log('[WeatherTweaker]', msg); };
  var warn = function (msg) { console.warn('[WeatherTweaker]', msg); };

  var OWN_CANVAS_ID = 'weathertweaker-canvas';
  var HOST_CANVAS_SELECTOR = 'canvas.pointer-events-none.absolute.inset-0.z-0:not(#' + OWN_CANVAS_ID + ')';


  function locateRefs() {
    if (!canvas || particlesRefObj) return;
    if (fiberRetryCount >= 3) return;
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
              var val = Array.isArray(ms) ? ms[0] : ms;
              if (val && 'current' in val && Array.isArray(val.current)) {
                particlesRefObj = val;
                found = true;
              }
              if (val && !('current' in val) && typeof val.type === 'string' &&
                  'count' in val && 'overlay' in val && 'lightning' in val) {
                configMemoObj = val;
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

  function refreshConfigMemo() {
    if (!canvas) return;
    try {
      var fiberKey = null;
      for (var k in canvas) {
        if (k.indexOf('__reactFiber$') === 0) { fiberKey = k; break; }
      }
      if (!fiberKey) return;
      var fiber = canvas[fiberKey];
      while (fiber) {
        if (typeof fiber.type === 'function' && fiber.memoizedState) {
          var hook = fiber.memoizedState;
          while (hook) {
            var ms = hook.memoizedState;
            if (ms !== null && typeof ms === 'object') {
              var val = Array.isArray(ms) ? ms[0] : ms;
              if (val && !('current' in val) && typeof val.type === 'string' &&
                  'count' in val && 'overlay' in val && 'lightning' in val) {
                if (val !== configMemoObj) {
                  configMemoObj = val;
                  savedOverlay = null;
                  savedLightning = null;
                  savedCelestial = null;
                  savedHour = null;
                }
                return;
              }
            }
            hook = hook.next;
          }
        }
        fiber = fiber.return;
      }
    } catch (e) {}
  }

  function findActiveChatId() {
    try {
      var el = document.querySelector(
        '[data-chat-id].bg-\\[var\\(--marinara-chat-chrome-highlight-bg\\)\\]'
      );
      return el ? el.getAttribute('data-chat-id') : null;
    } catch (e) {}
    return null;
  }


  var savedOverlay = null;
  var savedLightning = null;
  var savedParticles = null;
  var currentChatId = null;
  var savedCelestial = null;
  var savedHour = null;
  var lightningAlpha = 0;
  var nextLightningFrame = 0;
  var lightningFrameCount = 0;
  var auroraBands = null;
  var auroraLayer = null;
  var auroraFrameCount = 0;
  var shootingStars = [];
  var starFrameCount = 0;
  var starField = null;

  function applyConfigOverrides() {
    if (!configMemoObj) return;
    var w = WEATHERS[cfg.forcedWeather];
    if (w && w.type) {
      if (savedOverlay === null) savedOverlay = configMemoObj.overlay;
      if (savedLightning === null) savedLightning = configMemoObj.lightning;
      configMemoObj.overlay = w.overlay;
      configMemoObj.lightning = false;
    } else {
      if (savedOverlay !== null) { configMemoObj.overlay = savedOverlay; savedOverlay = null; }
      if (savedLightning !== null) { configMemoObj.lightning = savedLightning; savedLightning = null; }
    }
    if (savedCelestial === null) savedCelestial = configMemoObj.celestial || 'sun';
    if (savedHour === null) savedHour = typeof configMemoObj.hour === 'number' ? configMemoObj.hour : 12;
    if (cfg.celestial !== 'auto') {
      configMemoObj.celestial = cfg.celestial;
      if (cfg.celestial === 'sun' || cfg.celestial === 'moon') {
        configMemoObj.hour = celestialPosToHour(cfg.celestial, cfg.celestialPos);
      }
    } else {
      configMemoObj.celestial = savedCelestial;
      configMemoObj.hour = savedHour;
    }
    configMemoObj.isClearSky = true;
    configMemoObj.sunRays = cfg.sunRays;
    if (cfg.tint && cfg.tintStrength > 0) configMemoObj.tint = '';
  }


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
    var dpr = window.devicePixelRatio || 1;
    var w = WEATHERS[cfg.forcedWeather];
    if (w && w.type) {
      if (!savedParticles && particles && particles.length > 0) {
        savedParticles = cloneParticleArray(particles);
      }
      if (w.type === 'star') {
        if (particles && particles.length) particles.length = 0;
        return;
      }
      if (w.type === 'aurora' && cfg.auroraRevamped) {
        if (particles && particles.length) particles.length = 0;
        return;
      }
      var wDim = canvas ? { w: canvas.width / dpr, h: canvas.height / dpr } : { w: 1920, h: 1080 };
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
      if (savedParticles && particles) {
        particles.length = 0;
        for (var i = 0; i < savedParticles.length; i++) particles.push(savedParticles[i]);
        savedParticles = null;
        storeOrigins(particles);
      }
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
          clone.x = Math.random() * (canvas ? canvas.width / dpr : 1920);
          clone.y = Math.random() * (canvas ? canvas.height / dpr : 1080);
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


  function updateOwnParticles(ctx, cw, ch) {
    var w = WEATHERS[cfg.forcedWeather];
    if (!w || !w.type || w.type === 'star' || (w.type === 'aurora' && cfg.auroraRevamped)) {
      ownParticles = [];
      return;
    }
    var desired = Math.round((w.count || 50) * cfg.count);
    desired = Math.max(1, Math.min(desired, 5000));
    var needsRebuild = true;
    if (ownParticles.length > 0 && ownParticles[0].type === w.type) {
      var diff = Math.abs(ownParticles.length - desired);
      needsRebuild = diff > Math.max(desired * 0.1, 5);
    }
    if (needsRebuild) {
      ownParticles = [];
      for (var n = 0; n < desired; n++) ownParticles.push(spawnOwnParticle(w.type, cw, ch, false));
    }
    for (var i = ownParticles.length - 1; i >= 0; i--) {
      var p = ownParticles[i];
      if (!p.__mt) p.__mt = { op: p.opacity, sz: p.size, vx: p.vx, vy: p.vy };
      p.opacity = p.__mt.op * cfg.opacity;
      p.size = p.__mt.sz * cfg.size;
      var frameAdv = dtScale * particleBoost;
      p.life += frameAdv;
      p.fadeLife = (p.fadeLife || 0) + frameAdv * (cfg.speed || 1);
      p.x += p.__mt.vx * frameAdv * cfg.speed;
      p.y += p.__mt.vy * frameAdv * cfg.speed;
      if (p.type === 'snow' || p.type === 'leaf' || p.type === 'petal' || p.type === 'ash') {
        p.wobble += 0.02 * frameAdv;
        p.x += Math.sin(p.wobble) * 0.5 * frameAdv;
      }
      if (p.type === 'ember') {
        p.wobble += 0.04 * frameAdv;
        p.x += Math.sin(p.wobble) * 0.6 * frameAdv;
      }
      if (p.type === 'firefly') {
        p.wobble += 0.03 * frameAdv;
        p.x += Math.sin(p.wobble) * 0.8 * frameAdv;
        p.y += Math.cos(p.wobble * 0.7) * 0.4 * frameAdv;
      }
      drawParticle(ctx, p);
      var offScreen = p.y > ch + 20 || p.y < -20 || p.x > cw + 20 || p.x < -20;
      if (offScreen || p.life > p.maxLife) {
        ownParticles[i] = spawnOwnParticle(p.type, cw, ch, true);
      }
    }
  }

  function celestialPosToHour(body, pos) {
    var p = Math.max(0, Math.min(1, typeof pos === 'number' ? pos : 0.5));
    if (body === 'moon') return (21 + p * 8) % 24;
    return 6 + p * 12;
  }

  function drawStandaloneCelestial(ctx, cw, ch) {
    var cel = cfg.celestial;
    if (cel !== 'sun' && cel !== 'moon') return;
    var radius = Math.min(cw, ch) * 0.035;
    var hour = celestialPosToHour(cel, cfg.celestialPos);
    if (cel === 'sun') {
      drawSun(ctx, celestialX(hour, cw), celestialY(hour, ch, false), radius, cw, ch, cfg.sunRays, false, standaloneFrame);
    } else {
      var moonNorm = hour >= 12 ? ((hour - 21 + 24) % 24) / 10 : (hour + 3) / 10;
      var mx = cw * 0.1 + Math.min(1, Math.max(0, moonNorm)) * cw * 0.8;
      drawMoon(ctx, mx, celestialY(hour, ch, true), radius * 1.1);
    }
  }

  function renderStandalone() {
    if (!canvas) return;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.width / dpr;
    var ch = canvas.height / dpr;
    standaloneFrame += dtScale;
    ctx.clearRect(0, 0, cw, ch);
    var w = WEATHERS[cfg.forcedWeather];
    if (w && w.overlay) {
      ctx.fillStyle = w.overlay;
      ctx.fillRect(0, 0, cw, ch);
    }
    drawStandaloneCelestial(ctx, cw, ch);
    updateOwnParticles(ctx, cw, ch);
  }


  function sampleRefreshRate(intervalMs) {
    rateSamples.push(intervalMs);
    if (rateSamples.length > 180) rateSamples.shift();
    if (rateSamples.length >= 20 && frameTick % 30 === 0) {
      var s = rateSamples.slice().sort(function (a, b) { return a - b; });
      var median = s[s.length >> 1];
      if (median > 0) {
        detectedHz = Math.round(1000 / median);
        recomputeFps();
        updateFpsReadout();
      }
    }
  }

  function updateFpsReadout() {
    var el = document.getElementById('mt-fps-detected');
    if (!el) return;
    el.textContent = detectedHz
      ? detectedHz + 'Hz' + (particleBoost > 1.05 ? ' ×' + particleBoost.toFixed(1) : '')
      : '…';
  }

  function modLoop() {
    frameTick++;

    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var raw = lastFrameTime ? now - lastFrameTime : 0;
    lastFrameTime = now;
    if (raw > 0 && raw < 250) sampleRefreshRate(raw);

    dtScale = fpsIndependent ? ((!raw || raw > 250) ? 1 : raw / 16.6667) : 1;

    if (ownsCanvas) {
      if (canvas && canvas.isConnected === false) {
        var rp = roleplaySurface();
        if (rp) insertOwnCanvas(rp, canvas);
      }
      if (frameTick % 20 === 0) {
        var sid = findActiveChatId();
        if (sid && sid !== currentChatId) swapChat(currentChatId, sid);
      }
      renderStandalone();
    } else {
      if (!particlesRefObj && canvas) locateRefs();

      if (canvas && frameTick % 20 === 0) {
        var chatId = findActiveChatId();
        if (chatId && chatId !== currentChatId) {
          log('Chat switched: ' + (currentChatId ? 'saving' : 'loading') + ' config');
          swapChat(currentChatId, chatId);
        }
        refreshConfigMemo();
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
    }

    if (frameTick % 20 === 0 && cfg.tint && cfg.tintStrength > 0 &&
        tintOverlay && !tintOverlay.isConnected) {
      updateTint();
    }

    applyLightningFlash();
    drawAurora();
    drawStars();
    drawShootingStars();
    modLoopId = requestAnimationFrame(modLoop);
  }


  function applyCanvasFilters() {
    if (!canvas) return;
    canvas.style.filter = 'brightness(' + cfg.brightness + ') contrast(' + cfg.contrast + ')';
  }

  function ensureTint() {
    if (tintOverlay && tintOverlay.isConnected) return;
    if (!canvas || !canvas.parentNode) return;
    if (!tintOverlay) {
      tintOverlay = document.createElement('div');
      tintOverlay.id = 'weathertweaker-tint';
      tintOverlay.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:1;mix-blend-mode:overlay;transition:background .3s;';
    }
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

  function applyLightningFlash() {
    if (!canvas) return;
    var w = WEATHERS[cfg.forcedWeather];
    if (!w || !w.type || !w.lightning) {
      nextLightningFrame = 0;
      lightningAlpha = 0;
      return;
    }
    lightningFrameCount += dtScale;
    if (lightningAlpha > 0) {
      var ctx = canvas.getContext('2d');
      if (!ctx) return;
      var dpr = window.devicePixelRatio || 1;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = 'rgba(220,230,255,' + lightningAlpha + ')';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.restore();
      lightningAlpha *= Math.pow(0.88, dtScale);
      if (lightningAlpha < 0.01) lightningAlpha = 0;
    }
    if (lightningAlpha <= 0 && lightningFrameCount >= nextLightningFrame) {
      lightningAlpha = 0.45 + Math.random() * 0.15;
      nextLightningFrame = lightningFrameCount + 400 + Math.random() * 800;
    }
  }

  function drawAurora() {
    if (!canvas) return;
    var w = WEATHERS[cfg.forcedWeather];
    if (!w || w.type !== 'aurora') {
      auroraBands = null;
      auroraLayer = null;
      auroraFrameCount = 0;
      return;
    }
    if (!cfg.auroraRevamped) return;
    auroraFrameCount += dtScale;
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.width / dpr;
    var ch = canvas.height / dpr;
    if (!auroraBands) {
      auroraBands = [];
      var count = 5 + Math.floor(Math.random() * 2);
      for (var i = 0; i < count; i++) {
        auroraBands.push({
          x: 0.1 + Math.random() * 0.8,
          width: 0.06 + Math.random() * 0.08,
          phase: Math.random() * Math.PI * 2,
          speed: 0.002 + Math.random() * 0.003,
          amplitude: 0.06 + Math.random() * 0.06,
        });
      }
    }
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var q = cfg.auroraQuality || 'medium';
    var qDiv = q === 'high' ? 1 : q === 'low' ? 4 : 2;
    var lScale = dpr / qDiv;
    var lw = Math.max(1, Math.round(cw * lScale));
    var lh = Math.max(1, Math.round(ch * lScale));
    if (!auroraLayer) auroraLayer = document.createElement('canvas');
    if (auroraLayer.width !== lw || auroraLayer.height !== lh) {
      auroraLayer.width = lw;
      auroraLayer.height = lh;
    }
    var lctx = auroraLayer.getContext('2d');
    if (!lctx) return;
    lctx.clearRect(0, 0, lw, lh);
    lctx.globalCompositeOperation = 'screen';
    var style = cfg.auroraStyle || 'green';
    for (var i = 0; i < auroraBands.length; i++) {
      var b = auroraBands[i];
      var xOff = b.x * lw + Math.sin(auroraFrameCount * b.speed + b.phase) * b.amplitude * lw;
      var halfW = (b.width * lw) / 2;
      var grad = lctx.createLinearGradient(xOff - halfW, 0, xOff + halfW, lh);
      if (style === 'realistic') {
        grad.addColorStop(0, 'rgba(255,100,180,0)');
        grad.addColorStop(0.15, 'rgba(255,100,180,0.03)');
        grad.addColorStop(0.3, 'rgba(150,80,255,0.05)');
        grad.addColorStop(0.55, 'rgba(0,220,150,0.06)');
        grad.addColorStop(0.8, 'rgba(80,255,120,0.06)');
        grad.addColorStop(1, 'rgba(80,255,120,0)');
      } else if (style === 'custom') {
        var c1 = cfg.auroraColor1 || '#80ff80';
        var c2 = cfg.auroraColor2 || '#cc66ff';
        grad.addColorStop(0, hexToRgba(c2, 0));
        grad.addColorStop(0.2, hexToRgba(c2, 0.04));
        grad.addColorStop(0.5, hexToRgba(c1, 0.06));
        grad.addColorStop(0.75, hexToRgba(c1, 0.08));
        grad.addColorStop(0.95, hexToRgba(c1, 0.04));
        grad.addColorStop(1, hexToRgba(c1, 0));
      } else {
        grad.addColorStop(0, 'rgba(80,255,120,0)');
        grad.addColorStop(0.15, 'rgba(0,200,80,0.03)');
        grad.addColorStop(0.4, 'rgba(0,220,100,0.06)');
        grad.addColorStop(0.6, 'rgba(80,255,120,0.08)');
        grad.addColorStop(0.85, 'rgba(80,255,120,0.04)');
        grad.addColorStop(1, 'rgba(80,255,120,0)');
      }
      lctx.fillStyle = grad;
      lctx.fillRect(0, 0, lw, lh);
    }
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    ctx.drawImage(auroraLayer, 0, 0, cw, ch);
    ctx.restore();
  }

  function buildStarField(count) {
    var arr = [];
    for (var i = 0; i < count; i++) {
      var hue = Math.random();
      arr.push({
        xRatio: Math.random(),
        yRatio: Math.random(),
        size: rand(0.42, 1.92),
        base: rand(0.35, 0.95),
        tw: rand(0.003, 0.011),
        phase: Math.random() * Math.PI * 2,
        bright: Math.random() < 0.07,
        rgb: hue < 0.55 ? '255,255,255'
           : hue < 0.78 ? '210,225,255'
           : hue < 0.92 ? '255,235,200'
           : '255,210,210',
      });
    }
    return arr;
  }

  function drawStars() {
    if (!canvas) return;
    var w = WEATHERS[cfg.forcedWeather];
    if (!w || w.type !== 'star') { starField = null; starFrameCount = 0; return; }
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.width / dpr;
    var ch = canvas.height / dpr;
    var desired = Math.max(1, Math.min(Math.round((w.count || 120) * cfg.count), 5000));
    if (!starField || Math.abs(starField.length - desired) > Math.max(desired * 0.1, 5)) {
      starField = buildStarField(desired);
    }
    starFrameCount += dtScale;
    var sizeMul = cfg.size || 1;
    var opacityMul = cfg.opacity || 1;
    var speedMul = cfg.speed || 1;
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    for (var i = 0; i < starField.length; i++) {
      var s = starField[i];
      var x = s.xRatio * cw;
      var y = s.yRatio * ch;
      var floor = s.bright ? 0.55 : 0.30;
      var twinkle = floor + (1 - floor) * (0.5 + 0.5 * Math.sin(s.phase + starFrameCount * s.tw * speedMul));
      var alpha = Math.max(0, Math.min(1, s.base * opacityMul * twinkle));
      if (alpha <= 0.01) continue;
      var size = Math.max(0.3, s.size * sizeMul);
      var ext = size * (s.bright ? 6 : 3.2);
      ctx.globalAlpha = alpha;
      ctx.drawImage(getStarSprite(s.rgb, s.bright), x - ext, y - ext, ext * 2, ext * 2);
    }
    ctx.restore();
  }

  function drawShootingStars() {
    if (!canvas) return;
    var w = WEATHERS[cfg.forcedWeather];
    if (!w || !w.shootingStars) {
      shootingStars = [];
      return;
    }
    var dpr = window.devicePixelRatio || 1;
    var cw = canvas.width / dpr;
    var ch = canvas.height / dpr;
    var ctx = canvas.getContext('2d');
    if (!ctx) return;
    var speedMul = cfg.speed || 1;
    var MAX_CONCURRENT = 2;
    var rate = (w.meteorRate || 0.022) * Math.max(0.2, Math.min(speedMul, 3)) * dtScale;
    if (shootingStars.length < MAX_CONCURRENT && Math.random() < rate) {
      var sx = Math.random() * cw;
      var sy = -8;
      var angle = Math.PI / 2 + (Math.random() - 0.5) * 0.35;
      var speed = (2.6 + Math.random() * 2.2) * speedMul;
      shootingStars.push({
        x: sx, y: sy,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        startAlpha: 0.85 + Math.random() * 0.15,
        age: 0,
        maxAge: 100 + Math.floor(Math.random() * 80),
        length: 45 + Math.random() * 55,
        tint: Math.random() < 0.2 ? '255,210,160' : '230,240,255',
      });
    }
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'screen';
    for (var i = shootingStars.length - 1; i >= 0; i--) {
      var s = shootingStars[i];
      s.age += dtScale * particleBoost;
      var fadeIn = Math.min(1, s.age / 4);
      var fadeOut = Math.max(0, 1 - s.age / s.maxAge);
      s.alpha = s.startAlpha * fadeIn * fadeOut;
      if (s.age >= s.maxAge || (s.alpha <= 0.01 && s.age > 4)) {
        shootingStars.splice(i, 1);
        continue;
      }
      s.x += s.vx * dtScale * particleBoost;
      s.y += s.vy * dtScale * particleBoost;
      if (s.x < -50 || s.y > ch + 50) { shootingStars.splice(i, 1); continue; }
      var dir = Math.atan2(s.vy, s.vx);
      var tailX = s.x - Math.cos(dir) * s.length;
      var tailY = s.y - Math.sin(dir) * s.length;
      var rgb = s.tint;
      var grad = ctx.createLinearGradient(s.x, s.y, tailX, tailY);
      grad.addColorStop(0, 'rgba(255,255,255,' + s.alpha + ')');
      grad.addColorStop(0.12, 'rgba(' + rgb + ',' + (s.alpha * 0.75) + ')');
      grad.addColorStop(0.55, 'rgba(' + rgb + ',' + (s.alpha * 0.25) + ')');
      grad.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      var headR = 7;
      var headGlow = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, headR);
      headGlow.addColorStop(0, 'rgba(255,255,255,' + s.alpha + ')');
      headGlow.addColorStop(0.35, 'rgba(' + rgb + ',' + (s.alpha * 0.55) + ')');
      headGlow.addColorStop(1, 'rgba(' + rgb + ',0)');
      ctx.fillStyle = headGlow;
      ctx.beginPath();
      ctx.arc(s.x, s.y, headR, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }


  function roleplaySurface() {
    return document.querySelector('[data-chat-mode="roleplay"]');
  }

  function insertOwnCanvas(parent, c) {
    var anchor = parent.querySelector('.rpg-vignette') || parent.querySelector('.rpg-overlay');
    if (anchor && anchor.nextSibling) parent.insertBefore(c, anchor.nextSibling);
    else if (anchor) parent.appendChild(c);
    else parent.insertBefore(c, parent.firstChild);
  }

  function ensureOwnCanvas(parent) {
    if (ownCanvasEl) {
      if (ownCanvasEl.parentNode !== parent) insertOwnCanvas(parent, ownCanvasEl);
      return ownCanvasEl;
    }
    var c = document.createElement('canvas');
    c.id = OWN_CANVAS_ID;
    c.className = 'pointer-events-none absolute inset-0 z-0 h-full w-full';
    insertOwnCanvas(parent, c);
    ownCanvasEl = c;
    return c;
  }

  function showHostCanvas() {
    if (hiddenHostCanvas) {
      hiddenHostCanvas.style.display = '';
      hiddenHostCanvas = null;
    }
  }

  var hostParticlesRef = null;
  var hostParticlesSnapshot = null;
  var hostFiberTries = 0;

  function findParticlesRef(el) {
    try {
      var fiberKey = null;
      for (var k in el) {
        if (k.indexOf('__reactFiber$') === 0) { fiberKey = k; break; }
      }
      if (!fiberKey) return null;
      var fiber = el[fiberKey];
      while (fiber) {
        if (typeof fiber.type === 'function' && fiber.memoizedState) {
          var hook = fiber.memoizedState;
          while (hook) {
            var ms = hook.memoizedState;
            if (ms !== null && typeof ms === 'object') {
              var val = Array.isArray(ms) ? ms[0] : ms;
              if (val && 'current' in val && Array.isArray(val.current)) return val;
            }
            hook = hook.next;
          }
        }
        fiber = fiber.return;
      }
    } catch (e) {}
    return null;
  }

  function suppressHostRender() {
    var host = document.querySelector(HOST_CANVAS_SELECTOR);
    if (!host) {
      hostParticlesRef = null;
      hostParticlesSnapshot = null;
      hiddenHostCanvas = null;
      return;
    }
    if (host !== hiddenHostCanvas) {
      hostParticlesRef = null;
      hostParticlesSnapshot = null;
      hostFiberTries = 0;
    }
    if (host.style.display !== 'none') host.style.display = 'none';
    hiddenHostCanvas = host;
    if (!hostParticlesRef && hostFiberTries < 5) {
      hostFiberTries++;
      hostParticlesRef = findParticlesRef(host);
    }
    if (hostParticlesRef && hostParticlesRef.current && hostParticlesRef.current.length > 0) {
      hostParticlesSnapshot = hostParticlesRef.current.slice();
      hostParticlesRef.current.length = 0;
    }
  }

  function restoreHostRender() {
    if (hostParticlesRef && hostParticlesRef.current &&
        hostParticlesRef.current.length === 0 && hostParticlesSnapshot) {
      for (var i = 0; i < hostParticlesSnapshot.length; i++) {
        hostParticlesRef.current.push(hostParticlesSnapshot[i]);
      }
    }
    hostParticlesRef = null;
    hostParticlesSnapshot = null;
    showHostCanvas();
  }

  function stopLoop() {
    if (modLoopId) { cancelAnimationFrame(modLoopId); modLoopId = null; }
    if (ownResizeObserver) { ownResizeObserver.disconnect(); ownResizeObserver = null; }
  }

  function attach(canvasEl, owns) {
    stopLoop();
    removeTint();
    particlesRefObj = null; configMemoObj = null;
    savedOverlay = null; savedLightning = null; savedCelestial = null; savedHour = null;
    baseCount = 0; fiberRetryCount = 0;
    canvas = canvasEl;
    ownsCanvas = !!owns;
    if (ownsCanvas) {
      resizeOwnCanvas();
      if (typeof ResizeObserver !== 'undefined') {
        ownResizeObserver = new ResizeObserver(function () { resizeOwnCanvas(); });
        ownResizeObserver.observe(canvas);
      }
      log('Standalone canvas mounted, starting modLoop');
    } else {
      log('Host canvas found, starting modLoop');
    }
    modLoopId = requestAnimationFrame(modLoop);
    applyCanvasFilters();
    updateTint();
  }

  function resizeOwnCanvas() {
    if (!canvas) return;
    var rect = canvas.getBoundingClientRect();
    if (!rect || !rect.width || !rect.height) return;
    var dpr = window.devicePixelRatio || 1;
    var nw = Math.max(1, Math.round(rect.width * dpr));
    var nh = Math.max(1, Math.round(rect.height * dpr));
    if (canvas.width === nw && canvas.height === nh) return;
    canvas.width = nw;
    canvas.height = nh;
    var ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function detach() {
    stopLoop();
    if (currentChatId) saveChatState(currentChatId);
    removeTint();
    restoreHostRender();
    if (ownCanvasEl) {
      if (ownCanvasEl.parentNode) ownCanvasEl.parentNode.removeChild(ownCanvasEl);
      ownCanvasEl = null;
    }
    particlesRefObj = null; configMemoObj = null;
    savedOverlay = null; savedLightning = null; savedParticles = null; savedCelestial = null; savedHour = null;
    canvas = null; ownsCanvas = false; baseCount = 0; fiberRetryCount = 0; currentChatId = null;
  }

  function scanCanvas() {
    if (disposed) return;
    if (standaloneMode) {
      var parent = roleplaySurface();
      if (!parent) { if (canvas) detach(); return; }
      var own = ensureOwnCanvas(parent);
      if (own && own !== canvas) attach(own, true);
      suppressHostRender();
      return;
    }
    var found = document.querySelector(HOST_CANVAS_SELECTOR);
    if (found && found !== canvas) attach(found, false);
    else if (!found && canvas) detach();
  }


  function isActive() {
    if (standaloneMode) return true;
    for (var key in DEFAULTS) {
      if (key === 'tint' || key === 'tintStrength') continue;
      if (cfg[key] !== DEFAULTS[key]) return true;
    }
    if (cfg.forcedWeather) return true;
    if (cfg.tint && cfg.tintStrength > 0) return true;
    return false;
  }

  var SVG_NS = 'http://www.w3.org/2000/svg';

  function weatherBtnClass(active, sizeClass) {
    var size = sizeClass || 'h-8 w-8';
    var base = 'marinara-chat-toolbar-button flex items-center justify-center rounded-lg border border-[var(--marinara-chat-chrome-button-border)] bg-[var(--marinara-chat-chrome-button-bg)] text-[var(--marinara-chat-chrome-button-text)] backdrop-blur-md transition-all hover:border-[var(--marinara-chat-chrome-button-border-hover)] hover:bg-[var(--marinara-chat-chrome-button-bg-hover)] hover:text-[var(--marinara-chat-chrome-button-text-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--marinara-chat-chrome-focus-ring)] ' + size + ' p-1.5';
    return active
      ? base + ' marinara-chat-toolbar-button--active border-[var(--marinara-chat-chrome-button-border-active)] bg-[var(--marinara-chat-chrome-button-bg-active)] text-[var(--marinara-chat-chrome-button-text-active)]'
      : base;
  }

  var CLOUD_PATH = 'M6.657 18c-2.572 0 -4.657 -2.007 -4.657 -4.483c0 -2.475 2.085 -4.482 4.657 -4.482c.393 -1.762 1.794 -3.2 3.675 -3.773c1.88 -.572 3.956 -.193 5.444 1c1.488 1.19 2.162 3.007 1.77 4.769h.99c1.913 0 3.464 1.56 3.464 3.486c0 1.927 -1.551 3.487 -3.465 3.487h-11.878';

  function buildWeatherIcon() {
    var svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('width', '15'); svg.setAttribute('height', '15');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none'); svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2'); svg.setAttribute('stroke-linecap', 'round'); svg.setAttribute('stroke-linejoin', 'round');
    var p1 = document.createElementNS(SVG_NS, 'path'); p1.setAttribute('d', CLOUD_PATH); svg.appendChild(p1);
    return svg;
  }

  function makeWeatherButton(sizeClass) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-mt-size', sizeClass || '');
    btn.className = weatherBtnClass(isActive() || popup !== null, sizeClass);
    btn.title = 'WeatherTweaker — Weather Tweaks';
    btn.setAttribute('aria-label', 'WeatherTweaker — Weather Tweaks');
    btn.appendChild(buildWeatherIcon());
    return btn;
  }

  function onWeatherBtnClick(e) {
    var fromMobilePopover = this.hasAttribute('data-mt-popover') && window.innerWidth < 768;
    if (!fromMobilePopover) e.stopPropagation();
    if (popup && popup.parentNode) closePopup();
    else showPopup(this);
  }

  function addToolbarButtons() {
    if (disposed) return;
    var isMobile = window.innerWidth < 768;
    var groups = document.querySelectorAll('[data-roleplay-top-controls="right"]');
    for (var i = 0; i < groups.length; i++) {
      var group = groups[i];
      if (isMobile) continue;
      if (group.className.indexOf('gap') === -1) continue;
      if (group.querySelector('.mt-btn-wrapper')) continue;

      var wrapper = document.createElement('div');
      wrapper.className = 'relative mt-btn-wrapper';

      var btn = makeWeatherButton();
      wrapper.appendChild(btn);
      group.insertBefore(wrapper, group.firstChild);

      btn.addEventListener('click', onWeatherBtnClick);
    }

    injectMobileMenuButton();
  }

  function injectMobileMenuButton() {
    if (!document.querySelector('[data-chat-mode="roleplay"]')) return;
    var popovers = document.querySelectorAll('[data-chat-toolbar-overflow-menu]');
    for (var i = 0; i < popovers.length; i++) {
      var pop = popovers[i];
      if (pop.querySelector('#mt-popover-btn')) continue;
      if (!pop.querySelector('button')) continue;

      var wrapper = document.createElement('div');
      wrapper.className = 'relative';

      var btn = makeWeatherButton('h-8 w-8 max-md:h-9 max-md:w-9');
      btn.id = 'mt-popover-btn';
      btn.setAttribute('data-mt-popover', '1');
      wrapper.appendChild(btn);
      pop.appendChild(wrapper);

      btn.addEventListener('click', onWeatherBtnClick);
    }
  }

  function showPopup(anchor) {
    closePopup();

    var isMobile = window.innerWidth < 768;
    var uid = Date.now() + '-' + Math.random().toString(36).slice(2, 6);

    popup = document.createElement('div');
    if (isMobile) {
      popup.className =
        'fixed inset-0 flex items-center justify-center p-4';
      popup.style.zIndex = '9999';
      popup.style.paddingTop = 'max(1rem, env(safe-area-inset-top))';
      var backdrop = document.createElement('div');
      backdrop.className = 'absolute inset-0 bg-black/30';
      backdrop.addEventListener('click', closePopup);
      popup.appendChild(backdrop);
    }

    var card = document.createElement('div');
    card.className =
      'marinara-chat-popover rounded-xl border border-[var(--marinara-chat-chrome-panel-border)] bg-[var(--marinara-chat-chrome-panel-bg)] text-[var(--marinara-chat-chrome-panel-text)] shadow-2xl shadow-black/40 backdrop-blur-md animate-message-in ' +
      (isMobile ? 'relative w-full' : 'absolute right-0');
    if (isMobile) {
      card.style.maxWidth = '384px';
      card.style.maxHeight = 'calc(100dvh - 4rem)';
    } else {
      card.style.width = '336px';
      card.style.maxWidth = 'calc(100vw - 16px)';
      card.style.maxHeight = 'calc(100dvh - 200px)';
      card.style.top = 'calc(100% + 4px)';
      card.style.zIndex = '100';
    }
    card.style.overflowY = 'auto';

    var header = document.createElement('div');
    header.className = 'border-b border-[var(--marinara-chat-chrome-panel-divider)] px-3 py-2.5 flex items-center justify-between';

    var title = document.createElement('div');
    title.className = 'flex min-w-0 items-center gap-1.5 whitespace-nowrap text-xs font-semibold leading-tight text-[var(--marinara-chat-chrome-panel-title)]';
    title.innerHTML =
      '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0">' +
      '<path d="' + CLOUD_PATH + '"/>' +
      '</svg>Weather Tweaks';
    header.appendChild(title);

    var headRight = document.createElement('div');
    headRight.className = 'flex items-center gap-1.5';

    var badge = document.createElement('span');
    badge.className = 'mt-badge';
    badge.id = 'mt-fps-detected';
    badge.textContent = '…';
    badge.style.minWidth = '68px';
    badge.style.textAlign = 'center';
    headRight.appendChild(badge);

    var close = document.createElement('button');
    close.type = 'button';
    close.id = 'mt-close-' + uid;
    close.setAttribute('aria-label', 'Close');
    close.className = 'rounded-lg p-1.5 text-[var(--muted-foreground)] transition-all hover:bg-[var(--accent)] hover:text-[var(--foreground)]';
    close.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M18 6 6 18M6 6l12 12"/>' +
      '</svg>';
    close.addEventListener('click', closePopup);
    headRight.appendChild(close);
    header.appendChild(headRight);

    card.appendChild(header);

    var body = document.createElement('div');
    body.id = 'mt-popup-body';
    body.className = 'px-3 py-1';
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

    var popupEl = popup;
    setTimeout(function () {
      if (popup !== popupEl) return;
      function onDown(e) {
        if (!popup) return;
        if (popup.contains(e.target) || (anchor && anchor.contains(e.target))) return;
        closePopup();
      }
      function onKey(e) { if (e.key === 'Escape') closePopup(); }
      document.addEventListener('mousedown', onDown);
      document.addEventListener('keydown', onKey);
      popupEl._mtCleanup = function () {
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

  function hostCanvasPresent() {
    return !!document.querySelector(HOST_CANVAS_SELECTOR);
  }

  var activeTab = 'weather';

  function presetEmoji(key) {
    if (key === 'auto') return null;
    var first = WEATHERS[key].label.split(' ')[0];
    return /[a-z]/i.test(first) ? null : first;
  }

  function presetTitle(key) {
    if (key === 'auto') return standaloneMode ? 'None (off)' : WEATHERS.auto.label;
    return WEATHERS[key].label.replace(/^\S+\s+/, '');
  }

  function sliderRow(key, label, min, max, step) {
    var val = key in cfg ? cfg[key] : DEFAULTS[key];
    return '<div class="mt-row">' +
      '<span class="mt-lbl">' + label + '</span>' +
      '<input class="mt-rng" id="mt-' + key + '" type="range" min="' + min + '" max="' + max + '" step="' + step + '" value="' + val + '">' +
      '<span class="mt-val" id="mt-' + key + '-val">' + Number(val).toFixed(2) + '</span>' +
      '</div>';
  }

  function buildAuroraCard() {
    return '<div class="mt-card">' +
      '<div class="mt-card-title">Preset options</div>' +
      '<div class="mt-row">' +
        '<span class="mt-lbl" title="Render custom aurora bands instead of the default particles">Revamped</span>' +
        '<span style="flex:1"></span>' +
        '<input type="checkbox" class="mt-sw" id="mt-aurora-revamped"' + (cfg.auroraRevamped ? ' checked' : '') + '>' +
      '</div>' +
      '<div class="mt-row">' +
        '<span class="mt-lbl" title="Style presets only apply when Revamped is enabled">Style</span>' +
        '<select id="mt-aurora-style" class="mt-sel"' + (cfg.auroraRevamped ? '' : ' disabled') + '>' +
          '<option value="green"' + (cfg.auroraStyle === 'green' ? ' selected' : '') + '>Green</option>' +
          '<option value="realistic"' + (cfg.auroraStyle === 'realistic' ? ' selected' : '') + '>Realistic</option>' +
          '<option value="custom"' + (cfg.auroraStyle === 'custom' ? ' selected' : '') + '>Custom</option>' +
        '</select>' +
      '</div>' +
      '<div class="mt-row">' +
        '<span class="mt-lbl" title="Resolution of the aurora render layer. The bands are soft gradients, so Medium is usually indistinguishable from High while being 4x cheaper.">Quality</span>' +
        '<select id="mt-aurora-quality" class="mt-sel"' + (cfg.auroraRevamped ? '' : ' disabled') + '>' +
          '<option value="low"' + (cfg.auroraQuality === 'low' ? ' selected' : '') + '>Low (fastest)</option>' +
          '<option value="medium"' + ((cfg.auroraQuality || 'medium') === 'medium' ? ' selected' : '') + '>Medium</option>' +
          '<option value="high"' + (cfg.auroraQuality === 'high' ? ' selected' : '') + '>High (native)</option>' +
        '</select>' +
      '</div>' +
      '<div class="mt-row" id="mt-aurora-custom-row" title="Custom colors only apply when the Custom style is selected">' +
        '<input class="mt-clr" id="mt-aurora-c1" type="color" value="' + (cfg.auroraColor1 || '#80ff80') + '"' + (cfg.auroraStyle === 'custom' && cfg.auroraRevamped ? '' : ' disabled') + '>' +
        '<span style="font-size:0.625rem;color:var(--marinara-chat-chrome-panel-muted)">base</span>' +
        '<input class="mt-clr" id="mt-aurora-c2" type="color" value="' + (cfg.auroraColor2 || '#cc66ff') + '"' + (cfg.auroraStyle === 'custom' && cfg.auroraRevamped ? '' : ' disabled') + '>' +
        '<span style="font-size:0.625rem;color:var(--marinara-chat-chrome-panel-muted)">accent</span>' +
      '</div>' +
      '</div>';
  }

  function buildWeatherTab() {
    var html = '<div class="mt-grid">';
    for (var key in WEATHERS) {
      if (!WEATHERS.hasOwnProperty(key)) continue;
      var on = key === (cfg.forcedWeather || 'auto');
      var emoji = presetEmoji(key);
      var inner = emoji || ('<span>' + (standaloneMode ? 'OFF' : 'AUTO') + '</span>');
      html += '<button type="button" class="mt-tile' + (on ? ' mt-tile--on' : '') + '" data-mt-weather="' + key + '" title="' + presetTitle(key) + '">' + inner + '</button>';
    }
    html += '</div>';
    html += '<div class="mt-name" id="mt-weather-name">' + presetTitle(cfg.forcedWeather || 'auto') + '</div>';
    if (cfg.forcedWeather === 'aurora') html += buildAuroraCard();
    return html;
  }

  function buildSceneTab() {
    var tintHex = cfg.tint || '#ff9933';
    var html = sliderRow('brightness', 'Brightness', 0, 3, 0.05) + sliderRow('contrast', 'Contrast', 0, 3, 0.05);
    html +=
      '<div class="mt-row">' +
        '<span class="mt-lbl">Tint</span>' +
        '<input class="mt-clr" id="mt-tint-clr" type="color" value="' + tintHex + '">' +
        '<input class="mt-rng" id="mt-tint-str" type="range" min="0" max="0.5" step="0.01" value="' + cfg.tintStrength + '">' +
        '<span class="mt-val" id="mt-tint-str-val">' + cfg.tintStrength.toFixed(2) + '</span>' +
      '</div>';
    html += '<div class="mt-sec">Celestial</div>';
    var segs = '';
    var cels = [['auto', 'Auto'], ['sun', 'Sun'], ['moon', 'Moon'], ['none', 'Off']];
    for (var i = 0; i < cels.length; i++) {
      var on = (cfg.celestial || 'auto') === cels[i][0];
      segs += '<button type="button" data-mt-cel="' + cels[i][0] + '"' + (on ? ' class="mt-seg--on"' : '') + '>' + cels[i][1] + '</button>';
    }
    html += '<div class="mt-row"><div class="mt-seg">' + segs + '</div></div>';
    html +=
      '<div class="mt-row">' +
        '<span class="mt-lbl">Position</span>' +
        '<input class="mt-rng" id="mt-celestial-pos" type="range" min="0" max="1" step="0.05" value="' + cfg.celestialPos + '"' + (cfg.celestial === 'sun' || cfg.celestial === 'moon' ? '' : ' disabled') + '>' +
        '<span class="mt-val" id="mt-celestial-pos-val">' + Number(cfg.celestialPos).toFixed(2) + '</span>' +
      '</div>' +
      '<div class="mt-row">' +
        '<span class="mt-lbl">Sun rays</span>' +
        '<span style="flex:1"></span>' +
        '<input type="checkbox" class="mt-sw" id="mt-sun-rays"' + (cfg.sunRays ? ' checked' : '') + '>' +
      '</div>';
    return html;
  }

  function tabBtn(id, label) {
    return '<button type="button" class="mt-tab' + (activeTab === id ? ' mt-tab--on' : '') + '" data-mt-tab="' + id + '">' + label + '</button>';
  }

  function buildContent() {
    var html = '';

    if (!standaloneMode && !hostCanvasPresent()) {
      html +=
        '<div style="padding:12px 0;text-align:center;line-height:1.6;color:var(--marinara-chat-chrome-panel-muted);font-size:0.75rem">' +
        '<div style="font-size:28px;margin-bottom:8px;opacity:.6">☁️</div>' +
        'Weather effects not available for this chat.' +
        '<div style="margin-top:8px;text-align:left;color:var(--marinara-chat-chrome-panel-muted);font-size:0.6875rem">' +
        'Enable <strong>Standalone</strong> below, or:<br>' +
        '• <strong>Settings → Appearance</strong> → <em>Dynamic weather effects</em><br>' +
        '• <strong>Roleplay HUD</strong> → <em>World State</em> agent' +
        '</div></div>';
    } else {
      html += '<div class="mt-tabs">' + tabBtn('weather', 'Weather') + tabBtn('particles', 'Particles') + tabBtn('scene', 'Scene') + '</div>';
      html += '<div style="padding:6px 0 4px;min-height:176px">';
      if (activeTab === 'particles') {
        html += sliderRow('opacity', 'Opacity', 0, 3, 0.05) +
                sliderRow('speed', 'Speed', 0, 3, 0.05) +
                sliderRow('size', 'Size', 0, 3, 0.05) +
                sliderRow('count', 'Count', 0, 3, 0.05);
      } else if (activeTab === 'scene') {
        html += buildSceneTab();
      } else {
        html += buildWeatherTab();
      }
      html += '</div>';
    }

    html +=
      '<div class="mt-foot">' +
        '<label title="Render weather with the extension own canvas - no World State agent or Dynamic weather effects setting required.">' +
          '<input type="checkbox" class="mt-sw" id="mt-standalone"' + (standaloneMode ? ' checked' : '') + '>' +
          '<span>Standalone</span>' +
        '</label>' +
        '<button type="button" class="mt-rst" id="mt-rst">Reset</button>' +
      '</div>';

    return html;
  }

  function refreshPopupBody() {
    var b = document.getElementById('mt-popup-body');
    if (!b) return;
    b.innerHTML = buildContent();
    bindPopupEvents();
    updateUI();
  }

  function paintSlider(inp) {
    var min = parseFloat(inp.min) || 0;
    var max = parseFloat(inp.max);
    if (isNaN(max)) max = 1;
    var v = parseFloat(inp.value) || 0;
    var p = max > min ? ((v - min) / (max - min)) * 100 : 0;
    p = Math.max(0, Math.min(100, p));
    inp.style.background = 'linear-gradient(to right, var(--primary) ' + p + '%, var(--marinara-chat-chrome-input-border) ' + p + '%)';
  }

  function paintAllSliders() {
    var rngs = document.querySelectorAll('#mt-popup-body .mt-rng');
    for (var i = 0; i < rngs.length; i++) paintSlider(rngs[i]);
  }

  function bindPopupEvents() {
    var rngs = document.querySelectorAll('#mt-popup-body .mt-rng');
    for (var r = 0; r < rngs.length; r++) {
      (function (inp) {
        paintSlider(inp);
        inp.addEventListener('input', function () { paintSlider(inp); });
      })(rngs[r]);
    }

    var standalone = document.getElementById('mt-standalone');
    if (standalone) {
      standalone.addEventListener('change', function () {
        standaloneMode = standalone.checked;
        saveBoolPref(STANDALONE_KEY, standaloneMode);
        log('Standalone mode: ' + standaloneMode);
        detach();
        scanCanvas();
        refreshPopupBody();
        updateBtnState();
      });
    }

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

    var tabs = document.querySelectorAll('[data-mt-tab]');
    for (var t = 0; t < tabs.length; t++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          activeTab = btn.getAttribute('data-mt-tab');
          refreshPopupBody();
        });
      })(tabs[t]);
    }

    var tiles = document.querySelectorAll('[data-mt-weather]');
    for (var n = 0; n < tiles.length; n++) {
      (function (tile) {
        tile.addEventListener('click', function () {
          var v = tile.getAttribute('data-mt-weather');
          cfg.forcedWeather = v === 'auto' ? null : v;
          saveCfg(cfg);
          savedOverlay = null; savedLightning = null;
          log('Weather forced: ' + v);
          applyNow();
          refreshPopupBody();
        });
      })(tiles[n]);
    }

    var tintClr = document.getElementById('mt-tint-clr');
    var tintStr = document.getElementById('mt-tint-str');
    var tintVal = document.getElementById('mt-tint-str-val');
    if (tintClr && tintStr && tintVal) {
      var onTint = function () {
        cfg.tint = tintClr.value;
        cfg.tintStrength = parseFloat(tintStr.value);
        tintVal.textContent = cfg.tintStrength.toFixed(2);
        saveCfg(cfg);
        applyNow();
      };
      tintClr.addEventListener('input', onTint);
      tintStr.addEventListener('input', onTint);
    }

    var reset = document.getElementById('mt-rst');
    if (reset) {
      reset.addEventListener('click', function () {
        Object.assign(cfg, DEFAULTS);
        saveCfg(cfg);
        applyNow();
        refreshPopupBody();
      });
    }

    var auroraStyle = document.getElementById('mt-aurora-style');
    if (auroraStyle) {
      auroraStyle.addEventListener('change', function () {
        cfg.auroraStyle = auroraStyle.value;
        saveCfg(cfg);
        auroraBands = null;
        updateAuroraDisabled();
        applyNow();
      });
    }
    var auroraQuality = document.getElementById('mt-aurora-quality');
    if (auroraQuality) {
      auroraQuality.addEventListener('change', function () {
        cfg.auroraQuality = auroraQuality.value;
        saveCfg(cfg);
        applyNow();
      });
    }
    var auroraC1 = document.getElementById('mt-aurora-c1');
    var auroraC2 = document.getElementById('mt-aurora-c2');
    var onAuroraColor = function () {
      if (auroraC1 && auroraC2) {
        cfg.auroraColor1 = auroraC1.value;
        cfg.auroraColor2 = auroraC2.value;
        saveCfg(cfg);
        auroraBands = null;
      }
    };
    if (auroraC1) auroraC1.addEventListener('input', onAuroraColor);
    if (auroraC2) auroraC2.addEventListener('input', onAuroraColor);

    var revamped = document.getElementById('mt-aurora-revamped');
    if (revamped) {
      revamped.addEventListener('change', function () {
        cfg.auroraRevamped = revamped.checked;
        saveCfg(cfg);
        auroraBands = null;
        updateAuroraDisabled();
        applyNow();
      });
    }

    var segs = document.querySelectorAll('[data-mt-cel]');
    for (var g = 0; g < segs.length; g++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          cfg.celestial = btn.getAttribute('data-mt-cel');
          saveCfg(cfg);
          applyNow();
          refreshPopupBody();
        });
      })(segs[g]);
    }
    var celPos = document.getElementById('mt-celestial-pos');
    var celPosVal = document.getElementById('mt-celestial-pos-val');
    if (celPos && celPosVal) {
      celPos.addEventListener('input', function () {
        cfg.celestialPos = parseFloat(celPos.value);
        celPosVal.textContent = cfg.celestialPos.toFixed(2);
        saveCfg(cfg);
        applyNow();
      });
    }
    var sunRays = document.getElementById('mt-sun-rays');
    if (sunRays) {
      sunRays.addEventListener('change', function () {
        cfg.sunRays = sunRays.checked;
        saveCfg(cfg);
        applyNow();
      });
    }
  }

  function updateAuroraDisabled() {
    var as = document.getElementById('mt-aurora-style');
    if (as) as.disabled = !cfg.auroraRevamped;
    var aq = document.getElementById('mt-aurora-quality');
    if (aq) aq.disabled = !cfg.auroraRevamped;
    var c1 = document.getElementById('mt-aurora-c1');
    var c2 = document.getElementById('mt-aurora-c2');
    var cd = !cfg.auroraRevamped || cfg.auroraStyle !== 'custom';
    if (c1) c1.disabled = cd;
    if (c2) c2.disabled = cd;
  }

  function updateCelestialDisabled() {
    var cp = document.getElementById('mt-celestial-pos');
    if (cp) cp.disabled = !(cfg.celestial === 'sun' || cfg.celestial === 'moon');
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
    var tc = document.getElementById('mt-tint-clr');
    var ts = document.getElementById('mt-tint-str');
    var tv = document.getElementById('mt-tint-str-val');
    if (tc) tc.value = cfg.tint || '#ff9933';
    if (ts) ts.value = cfg.tintStrength;
    if (tv) tv.textContent = cfg.tintStrength.toFixed(2);
    var as = document.getElementById('mt-aurora-style');
    if (as) as.value = cfg.auroraStyle || 'green';
    var aq = document.getElementById('mt-aurora-quality');
    if (aq) aq.value = cfg.auroraQuality || 'medium';
    var ac1 = document.getElementById('mt-aurora-c1');
    var ac2 = document.getElementById('mt-aurora-c2');
    if (ac1) ac1.value = cfg.auroraColor1 || '#80ff80';
    if (ac2) ac2.value = cfg.auroraColor2 || '#cc66ff';
    var rev = document.getElementById('mt-aurora-revamped');
    if (rev) rev.checked = cfg.auroraRevamped !== false;
    var cp = document.getElementById('mt-celestial-pos');
    var cpv = document.getElementById('mt-celestial-pos-val');
    var posVal = typeof cfg.celestialPos === 'number' ? cfg.celestialPos : 0.5;
    if (cp) cp.value = posVal;
    if (cpv) cpv.textContent = posVal.toFixed(2);
    var sr = document.getElementById('mt-sun-rays');
    if (sr) sr.checked = cfg.sunRays !== false;
    var sa = document.getElementById('mt-standalone');
    if (sa) sa.checked = standaloneMode;
    updateFpsReadout();
    updateAuroraDisabled();
    updateCelestialDisabled();
    paintAllSliders();
    updateBtnState();
  }

  function updateBtnState() {
    var btns = document.querySelectorAll('.mt-btn-wrapper > button, #mt-popover-btn');
    var active = isActive() || (popup !== null);
    for (var i = 0; i < btns.length; i++) {
      var btn = btns[i];
      btn.className = weatherBtnClass(active, btn.getAttribute('data-mt-size') || undefined);
    }
  }

  function applyNow() {
    if (ownsCanvas) {
      applyCanvasFilters();
      updateTint();
      return;
    }
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


  log('Loading...');
  recomputeFps();
  scanCanvas();
  addToolbarButtons();

  var throttledScan = throttle(scanCanvas, 300);
  canvasObserver = new MutationObserver(throttledScan);
  canvasObserver.observe(document.body, { childList: true, subtree: true });

  var toolbarInterval = setInterval(addToolbarButtons, 1000);
  var throttledToolbar = throttle(addToolbarButtons, 400);
  var toolbarObserver = new MutationObserver(throttledToolbar);
  toolbarObserver.observe(document.body, { childList: true, subtree: true });


  if (typeof marinara !== 'undefined' && marinara && marinara.onCleanup) {
    marinara.onCleanup(function () {
      disposed = true;
      closePopup();
      detach();
      showHostCanvas();
      if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; writeCfgNow(); }
      if (canvasObserver) canvasObserver.disconnect();
      if (toolbarObserver) toolbarObserver.disconnect();
      clearInterval(toolbarInterval);
      var wrappers = document.querySelectorAll('.mt-btn-wrapper, #mt-popover-btn');
      for (var i = 0; i < wrappers.length; i++) {
        if (wrappers[i].parentNode) wrappers[i].parentNode.removeChild(wrappers[i]);
      }
      var ownCanvas = document.getElementById(OWN_CANVAS_ID);
      if (ownCanvas && ownCanvas.parentNode) ownCanvas.parentNode.removeChild(ownCanvas);
      var tint = document.getElementById('weathertweaker-tint');
      if (tint && tint.parentNode) tint.parentNode.removeChild(tint);
    });
  }

})();
