(function () {
  'use strict';

  var U = window.UzConverter;
  var $ = function (id) { return document.getElementById(id); };

  var LABELS = {
    cyrillic: 'Kirill',
    latin: 'Lotin',
    'latin-new': 'Yangi lotin',
    'latin-current': 'Hozirgi lotin'
  };
  var PREFS_KEY = 'uzconv.prefs.v1';
  var HISTORY_KEY = 'uzconv.history.v1';
  var HISTORY_MAX = 20;
  var HISTORY_TEXT_MAX = 100000;
  var FILE_MAX_BYTES = 2 * 1024 * 1024;

  var els = {
    source: $('source'), target: $('target'),
    input: $('input'), output: $('output'),
    toasts: $('toasts'), fileInput: $('file-input'),
    historyDialog: $('history-dialog'), historyList: $('history-list')
  };

  var state = {
    busy: false,
  };

  // ---------------------------------------------------------------- helpers

  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function nextFrame() {
    return new Promise(function (resolve) { requestAnimationFrame(function () { setTimeout(resolve, 0); }); });
  }

  function toast(message, kind, ms) {
    var el = document.createElement('div');
    el.className = 'toast';
    el.dataset.kind = kind || 'info';
    el.setAttribute('role', kind === 'error' ? 'alert' : 'status');
    el.textContent = message;
    els.toasts.appendChild(el);
    while (els.toasts.children.length > 3) els.toasts.firstChild.remove();
    setTimeout(function () { el.remove(); }, ms || (kind === 'error' ? 6000 : 3500));
  }

  function setBusy(button, busy) {
    state.busy = busy;
  }

  // --------------------------------------------------------------- counters

  var WORD_RE = /[\p{L}\p{N}]+(?:[ʻʼ'’‘`\-][\p{L}\p{N}]+)*/gu;
  var SURROGATE_RE = /[\uD800-\uDBFF][\uDC00-\uDFFF]/g;
  var counterTimer = null;

  function countText(str) {
    var pairs = (str.match(SURROGATE_RE) || []).length;
    return { chars: str.length - pairs, words: (str.match(WORD_RE) || []).length };
  }

  function updateCounters() {
    var a = countText(els.input.value), b = countText(els.output.value);
    $('in-chars').textContent = fmt(a.chars);
    $('in-words').textContent = fmt(a.words);
    $('out-chars').textContent = fmt(b.chars);
    $('out-words').textContent = fmt(b.words);
  }

  function scheduleCounters() {
    clearTimeout(counterTimer);
    counterTimer = setTimeout(updateCounters, 120);
  }

  // ------------------------------------------------------------ preferences

  function syncTargetOptions() {
    var cyrOption = els.target.querySelector('option[value="cyrillic"]');
    var fromCyr = els.source.value === 'cyrillic';
    cyrOption.disabled = fromCyr;
    if (fromCyr && els.target.value === 'cyrillic') els.target.value = 'latin-new';
  }

  function savePrefs() {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify({ from: els.source.value, to: els.target.value })); } catch (e) { /* private mode */ }
  }

  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem(PREFS_KEY) || 'null');
      if (p && LABELS[p.from] && LABELS[p.to]) { els.source.value = p.from; els.target.value = p.to; }
    } catch (e) { /* ignore */ }
    syncTargetOptions();
  }

  // ----------------------------------------------------------- conversion

  var historyTimer = null;

  async function onConvert(live) {
    var mode = live;                           // true = while typing, 'select' = dropdown changed
    live = live === true || live === 'select';
    if (state.busy && !live) return;
    syncTargetOptions();                       // never convert Cyrillic → Cyrillic
    var text = els.input.value;
    if (!text.trim()) {
      if (live) { els.output.value = ''; updateCounters(); return; }
      toast('Avval matn kiriting yoki TXT fayl yuklang.', 'error');
      els.input.focus();
      return;
    }

    // Warn about (and fix) a wrong source selection.
    var det = U.detectScript(text);
    if (mode === 'select' && det.dominant && det.dominant !== els.source.value) return; // don't fight the user's dropdown choice
    if (els.source.value === 'latin' && det.dominant === 'cyrillic') {
      els.source.value = 'cyrillic';
      syncTargetOptions();
      savePrefs();
      if (!live) toast('Matn kirill yozuvida ekan, manba yozuvi «Kirill» qilib o‘zgartirildi.');
    } else if (els.source.value === 'cyrillic' && det.dominant === 'latin') {
      els.source.value = 'latin';
      syncTargetOptions();
      savePrefs();
      if (!live) toast('Matn lotin yozuvida ekan, manba yozuvi «Lotin» qilib o‘zgartirildi.');
    }

    if (!live) { setBusy(null, true); await nextFrame(); }
    try {
      var from = els.source.value, to = els.target.value;
      var result = U.convert(text, { from: from, to: to });
      els.output.value = result;
      updateCounters();
      if (!live) {
        addHistory({ from: from, to: to, input: text, output: result });
        toast('Matn o‘girildi.', 'success');
      } else if (mode === true) {
        // Live typing: save one history entry once the user pauses.
        clearTimeout(historyTimer);
        historyTimer = setTimeout(function () {
          if (els.input.value === text) addHistory({ from: from, to: to, input: text, output: result });
        }, 2500);
      }
    } catch (err) {
      console.error(err);
      if (!live) toast('Matnni o‘girib bo‘lmadi. Matnni tekshirib, qayta urinib ko‘ring.', 'error');
    } finally {
      if (!live) setBusy(null, false);
    }
  }

  // --------------------------------------------------------------- file I/O

  function decodeText(buffer) {
    var text;
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
    } catch (e) {
      // Many older Cyrillic TXT files are saved in Windows-1251.
      text = new TextDecoder('windows-1251').decode(buffer);
    }
    return text.replace(/^﻿/, '');
  }

  async function handleFile(file) {
    if (!file) return;
    if (!/\.txt$/i.test(file.name) && file.type !== 'text/plain') {
      toast('Faqat TXT fayllar qabul qilinadi. Faylni .txt formatida saqlab, qayta yuklang.', 'error');
      return;
    }
    if (file.size > FILE_MAX_BYTES) {
      toast('Fayl juda katta: eng ko‘pi bilan 2 MB. Faylni qismlarga bo‘lib yuklang.', 'error');
      return;
    }
    try {
      var text = decodeText(await file.arrayBuffer());
      els.input.value = text;
      updateCounters();
      toast('«' + file.name + '» fayli yuklandi.', 'success');
    } catch (err) {
      console.error(err);
      toast('Faylni o‘qib bo‘lmadi. Boshqa TXT fayl bilan urinib ko‘ring.', 'error');
    }
  }

  function downloadOutput() {
    var text = els.output.value;
    if (!text) {
      toast('Yuklab olish uchun natija yo‘q. Avval matnni o‘giring.', 'error');
      return;
    }
    var blob = new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'natija.txt';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    toast('Fayl yuklab olindi.', 'success');
  }

  async function copyOutput() {
    var text = els.output.value;
    if (!text) {
      toast('Nusxalash uchun natija yo‘q. Avval matnni o‘giring.', 'error');
      return;
    }
    var ok = false;
    try {
      await navigator.clipboard.writeText(text);
      ok = true;
    } catch (e) {
      try { els.output.select(); ok = document.execCommand('copy'); els.output.setSelectionRange(0, 0); } catch (e2) { ok = false; }
    }
    if (ok) toast('Nusxalandi.', 'success');
    else toast('Nusxalab bo‘lmadi. Natijani belgilab, qo‘lda nusxa oling.', 'error');
  }

  // ---------------------------------------------------------------- history

  function loadHistory() {
    try {
      var list = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch (e) { return []; }
  }

  function saveHistory(list) {
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); return true; } catch (e) { return false; }
  }

  function addHistory(entry) {
    if (entry.input.length > HISTORY_TEXT_MAX || entry.output.length > HISTORY_TEXT_MAX) return;
    var list = loadHistory();
    var top = list[0];
    if (top && top.input === entry.input && top.output === entry.output && top.from === entry.from && top.to === entry.to) return;
    list.unshift({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), ts: Date.now(),
      from: entry.from, to: entry.to, input: entry.input, output: entry.output });
    while (list.length > HISTORY_MAX) list.pop();
    while (!saveHistory(list) && list.length > 1) list.pop();   // storage full: drop the oldest
  }

  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function formatDate(ts) {
    var d = new Date(ts);
    return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + d.getFullYear() + ', ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }

  function renderHistory() {
    var frag = document.createDocumentFragment();
    loadHistory().forEach(function (h) {
      var li = document.createElement('li');
      li.className = 'history-item';
      li.dataset.id = h.id;

      var meta = document.createElement('div');
      meta.className = 'history-meta';
      var d = document.createElement('span'); d.textContent = formatDate(h.ts);
      var dir = document.createElement('span'); dir.textContent = (LABELS[h.from] || h.from) + ' → ' + (LABELS[h.to] || h.to);
      meta.append(d, dir);

      var prev = document.createElement('p');
      prev.className = 'history-preview';
      prev.textContent = h.input.slice(0, 160);

      var actions = document.createElement('div');
      actions.className = 'history-actions';
      var open = document.createElement('button'); open.type = 'button'; open.className = 'btn btn-secondary btn-small';
      open.dataset.action = 'restore'; open.dataset.id = h.id; open.textContent = 'Qayta ochish';
      var del = document.createElement('button'); del.type = 'button'; del.className = 'btn btn-quiet btn-small';
      del.dataset.action = 'remove'; del.dataset.id = h.id; del.textContent = 'O‘chirish';
      actions.append(open, del);

      li.append(meta, prev, actions);
      frag.appendChild(li);
    });
    els.historyList.replaceChildren(frag);
  }

  function restoreHistory(id) {
    var h = loadHistory().filter(function (x) { return x.id === id; })[0];
    if (!h) return;
    els.source.value = h.from;
    syncTargetOptions();
    els.target.value = h.to;
    syncTargetOptions();
    savePrefs();
    els.input.value = h.input;
    els.output.value = h.output;
    updateCounters();
    els.historyDialog.close();
    toast('Tarixdagi matn qayta ochildi.', 'success');
  }

  // ----------------------------------------------------------------- wiring

  var liveTimer = null;
  els.source.addEventListener('change', function () { syncTargetOptions(); savePrefs(); if (els.input.value.trim()) onConvert('select'); });
  els.target.addEventListener('change', function () { savePrefs(); if (els.input.value.trim()) onConvert('select'); });

  els.input.addEventListener('input', function () {
    scheduleCounters();
    clearTimeout(liveTimer);                   // live conversion while typing
    liveTimer = setTimeout(function () { if (!state.busy) onConvert(true); }, 250);
  });
  els.output.addEventListener('input', scheduleCounters);
  els.input.addEventListener('keydown', function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); onConvert(); }
  });

  // Drag a TXT file onto the input.
  els.input.addEventListener('dragover', function (e) { e.preventDefault(); });
  els.input.addEventListener('drop', function (e) {
    var f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
    if (f) { e.preventDefault(); handleFile(f); }
  });

  $('btn-upload').addEventListener('click', function () { els.fileInput.click(); });
  els.fileInput.addEventListener('change', function () {
    handleFile(els.fileInput.files[0]);
    els.fileInput.value = '';
  });

  $('btn-clear-in').addEventListener('click', function () {
    els.input.value = '';
    updateCounters();
    els.input.focus();
  });
  $('btn-clear-out').addEventListener('click', function () {
    els.output.value = '';
    updateCounters();
    els.output.focus();
  });
  $('btn-copy').addEventListener('click', copyOutput);
  $('btn-download').addEventListener('click', downloadOutput);

  // History dialog.
  $('btn-history').addEventListener('click', function () { renderHistory(); els.historyDialog.showModal(); });
  $('history-close').addEventListener('click', function () { els.historyDialog.close(); });
  els.historyDialog.addEventListener('click', function (e) { if (e.target === els.historyDialog) els.historyDialog.close(); });
  els.historyList.addEventListener('click', function (e) {
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'restore') { restoreHistory(btn.dataset.id); return; }
    saveHistory(loadHistory().filter(function (h) { return h.id !== btn.dataset.id; }));
    renderHistory();
  });
  $('history-clear').addEventListener('click', function () {
    saveHistory([]);
    renderHistory();
    toast('Tarix tozalandi.', 'success');
  });

  // ------------------------------------------------------------------ theme

  var themeButton = $('theme-toggle');
  function syncThemeButton() {
    var dark = window.UzTheme && window.UzTheme.get() === 'dark';
    themeButton.setAttribute('aria-label', dark ? 'Kunduzgi rejimga o‘tish' : 'Tungi rejimga o‘tish');
    themeButton.title = dark ? 'Kunduzgi rejim' : 'Tungi rejim';
  }
  themeButton.addEventListener('click', function () {
    window.UzTheme.set(window.UzTheme.get() === 'dark' ? 'light' : 'dark');
    syncThemeButton();
  });
  if (window.matchMedia) {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', syncThemeButton);
  }
  syncThemeButton();

  // ---------------------------------------------------------------- startup

  function fillAlphabet() {
    var rows = U.ALPHABET_TABLE, half = Math.ceil(rows.length / 2);
    [[$('alphabet-a'), rows.slice(0, half)], [$('alphabet-b'), rows.slice(half)]].forEach(function (pair) {
      var table = pair[0];
      var thead = table.createTHead().insertRow();
      ['Kirill', 'Hozirgi lotin', 'Yangi lotin'].forEach(function (h) {
        var th = document.createElement('th'); th.scope = 'col'; th.textContent = h; thead.appendChild(th);
      });
      var body = table.createTBody();
      pair[1].forEach(function (row) {
        var tr = body.insertRow();
        row.forEach(function (cell) { tr.insertCell().textContent = cell; });
      });
    });
  }

  $('year').textContent = new Date().getFullYear();
  loadPrefs();
  fillAlphabet();
  updateCounters();
})();
