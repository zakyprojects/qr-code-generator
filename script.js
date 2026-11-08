(function () {
  'use strict';

  var root = document.documentElement;
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var $ = function (id) { return document.getElementById(id); };

  var canvas = $('canvas');
  var emptyEl = $('empty');
  var pngBtn = $('png-btn');
  var svgBtn = $('svg-btn');
  var mode = 'text';
  var current = null; // { qr, count } for the text now shown

  // Encode text as UTF-8, so Urdu, emoji etc. scan correctly.
  qrcode.stringToBytes = qrcode.stringToBytesFuncs['UTF-8'];

  // ---------- Theme ----------
  function setThemeColor() { themeMeta.content = root.dataset.theme === 'dark' ? '#11110f' : '#f7f6f1'; }
  setThemeColor();
  $('theme-btn').addEventListener('click', function () {
    if (root.dataset.theme === 'dark') delete root.dataset.theme; else root.dataset.theme = 'dark';
    try { localStorage.setItem('qr_theme', root.dataset.theme === 'dark' ? 'dark' : 'light'); } catch (e) {}
    setThemeColor();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function (e) {
    var saved = null;
    try { saved = localStorage.getItem('qr_theme'); } catch (err) {}
    if (saved === 'dark' || saved === 'light') return;
    if (e.matches) root.dataset.theme = 'dark'; else delete root.dataset.theme;
    setThemeColor();
  });

  // ---------- Tabs ----------
  function setMode(next) {
    mode = next;
    $('tab-text').setAttribute('aria-selected', String(mode === 'text'));
    $('tab-wifi').setAttribute('aria-selected', String(mode === 'wifi'));
    $('pane-text').hidden = mode !== 'text';
    $('pane-wifi').hidden = mode !== 'wifi';
    update();
  }
  $('tab-text').addEventListener('click', function () { setMode('text'); });
  $('tab-wifi').addEventListener('click', function () { setMode('wifi'); });

  // ---------- Content ----------
  // Wi-Fi format: WIFI:T:<type>;S:<name>;P:<password>;; with \ ; , : " escaped.
  function esc(s) { return s.replace(/([\\;,:"])/g, '\\$1'); }

  function content() {
    if (mode === 'text') return $('text').value.trim();
    var ssid = $('ssid').value;
    if (!ssid.trim()) return '';
    var sec = $('wifi-sec').value;
    var out = 'WIFI:T:' + sec + ';S:' + esc(ssid) + ';';
    if (sec !== 'nopass') out += 'P:' + esc($('wifi-pass').value) + ';';
    return out + ';';
  }

  function showMessage(text, isError) {
    current = null;
    canvas.hidden = true;
    emptyEl.hidden = false;
    emptyEl.textContent = text;
    emptyEl.classList.toggle('error', !!isError);
    pngBtn.disabled = svgBtn.disabled = true;
  }

  // Draws the code with a 4-module quiet zone (needed for reliable scanning).
  function draw(target, qr, px) {
    var count = qr.getModuleCount();
    // Whole-pixel modules keep edges sharp; leftover pixels widen the white border.
    var cell = Math.max(1, Math.floor(px / (count + 8)));
    var offset = Math.floor((px - cell * count) / 2);
    var ctx = target.getContext('2d');
    target.width = target.height = px;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, px, px);
    ctx.fillStyle = '#000000';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) ctx.fillRect(offset + c * cell, offset + r * cell, cell, cell);
      }
    }
  }

  function update() {
    var data = content();
    if (!data) {
      showMessage(mode === 'text' ? 'Type a link or text to make a QR code.' : 'Enter the network name to make a QR code.');
      return;
    }
    var qr = qrcode(0, 'M');
    try {
      qr.addData(data);
      qr.make();
    } catch (e) {
      showMessage('This is too long for one QR code. Please shorten it.', true);
      return;
    }
    current = { qr: qr };
    draw(canvas, qr, 640);
    canvas.hidden = false;
    emptyEl.hidden = true;
    pngBtn.disabled = svgBtn.disabled = false;
  }

  ['text', 'ssid', 'wifi-pass'].forEach(function (id) { $(id).addEventListener('input', update); });
  $('wifi-sec').addEventListener('change', update);

  // ---------- Downloads ----------
  function fileName(ext) { return (mode === 'wifi' ? 'wifi-qr-code.' : 'qr-code.') + ext; }

  function save(href, name) {
    var a = document.createElement('a');
    a.href = href;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  pngBtn.addEventListener('click', function () {
    if (!current) return;
    var out = document.createElement('canvas');
    draw(out, current.qr, Number($('size').value));
    out.toBlob(function (blob) {
      var url = URL.createObjectURL(blob);
      save(url, fileName('png'));
      setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    }, 'image/png');
  });

  svgBtn.addEventListener('click', function () {
    if (!current) return;
    var qr = current.qr;
    var count = qr.getModuleCount();
    var full = count + 8;
    var path = '';
    for (var r = 0; r < count; r++) {
      for (var c = 0; c < count; c++) {
        if (qr.isDark(r, c)) path += 'M' + (c + 4) + ' ' + (r + 4) + 'h1v1h-1z';
      }
    }
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + full + ' ' + full +
      '" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="#fff"/><path d="' +
      path + '" fill="#000"/></svg>';
    var url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
    save(url, fileName('svg'));
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  update();
})();
