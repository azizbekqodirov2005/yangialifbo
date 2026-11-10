/*
 * Uzbek alphabet conversion engine.
 *
 * Deterministic, dependency-free, no DOM access. Works in the browser
 * (window.UzConverter) and in Node (require). All rules live in the tables
 * and small functions below, so they can be updated without touching the UI.
 *
 * Supported writing systems
 *   "cyrillic"       Uzbek Cyrillic
 *   "latin-current"  Latin alphabet in force today: Oʻ Gʻ Sh Ch (+ Ng digraph)
 *   "latin-new"      Alphabet from Law O‘RQ-1184 of 21.10.2026 (in force from
 *                    22.04.2027): 28 letters + tutuq belgisi. Oʻ→Ö, Gʻ→Ğ,
 *                    Sh→Ş, Ch→Ç; "ng" is no longer a letter (written n + g).
 *
 * Input "latin" may be any Latin variant: current, new, or older spellings
 * with assorted apostrophes. It is normalised first.
 *
 * Unicode conventions used for output
 *   U+02BB  ʻ  okina       – inside Oʻ / Gʻ (current alphabet)
 *   U+02BC  ʼ  tutuq belgisi – in maʼno, taʼlim, sheʼr (both Latin variants)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.UzConverter = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var OKINA = 'ʻ';
  var TUTUQ = 'ʼ';

  // Every character people use in place of the proper apostrophes.
  var APOSTROPHES = "'`´‘’‛′ʹʻʼʽ";

  var VOWELS_CYR = 'аеёиоуэюяўы';
  var VOWELS_LAT = 'aeiou';

  // ---------------------------------------------------------------- tables

  var CYR_TO_LAT = {
    'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'ё': 'yo', 'ж': 'j',
    'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n',
    'о': 'o', 'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f',
    'х': 'x', 'ч': 'ch', 'ш': 'sh', 'щ': 'shch', 'ъ': TUTUQ, 'ь': '',
    'ы': 'i', 'э': 'e', 'ю': 'yu', 'я': 'ya', 'ў': 'o' + OKINA,
    'қ': 'q', 'ғ': 'g' + OKINA, 'ҳ': 'h'
    // 'е' and 'ц' depend on position and are handled in code.
  };

  var LAT_TO_CYR = {
    'a': 'а', 'b': 'б', 'd': 'д', 'e': 'е', 'f': 'ф', 'g': 'г', 'h': 'ҳ',
    'i': 'и', 'j': 'ж', 'k': 'к', 'l': 'л', 'm': 'м', 'n': 'н', 'o': 'о',
    'p': 'п', 'q': 'қ', 'r': 'р', 's': 'с', 't': 'т', 'u': 'у', 'v': 'в',
    'x': 'х', 'y': 'й', 'z': 'з'
  };

  // Letters of the new alphabet (also used by the 1990s Latin alphabet).
  var NEW_LETTER_TO_CYR = { 'ş': 'ш', 'ç': 'ч', 'ö': 'ў', 'ğ': 'ғ' };
  var NEW_LETTER_TO_CURRENT = { 'ş': 'sh', 'ç': 'ch', 'ö': 'o' + OKINA, 'ğ': 'g' + OKINA };

  // Words/suffixes where Latin "ts" stands for Cyrillic "ц".
  var TS_FOLLOWED_BY = /^(iya|iy|ion|ey|ikl|ement|entr)/;

  // Anything that must never be converted.
  var PROTECTED_RE = new RegExp(
    '((?:https?:\\/\\/|www\\.)[^\\s<>"«»]*[^\\s<>"«».,;:!?)\\]}]' +
    '|[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\\.[A-Za-z0-9-]+)+)', 'g');

  var NEW_LETTERS_RE = /[ÖöĞğŞşÇç]/;

  // Alphabet table shown on the "Imlo qoidalari" page.
  var ALPHABET_TABLE = [
    ['А а', 'A a', 'A a'], ['Б б', 'B b', 'B b'], ['В в', 'V v', 'V v'],
    ['Г г', 'G g', 'G g'], ['Ғ ғ', 'Gʻ gʻ', 'Ğ ğ'], ['Д д', 'D d', 'D d'],
    ['Е е', 'Ye ye / E e', 'Ye ye / E e'], ['Ё ё', 'Yo yo', 'Yo yo'],
    ['Ж ж', 'J j', 'J j'], ['З з', 'Z z', 'Z z'], ['И и', 'I i', 'I i'],
    ['Й й', 'Y y', 'Y y'], ['К к', 'K k', 'K k'], ['Қ қ', 'Q q', 'Q q'],
    ['Л л', 'L l', 'L l'], ['М м', 'M m', 'M m'], ['Н н', 'N n', 'N n'],
    ['О о', 'O o', 'O o'], ['П п', 'P p', 'P p'], ['Р р', 'R r', 'R r'],
    ['С с', 'S s', 'S s'], ['Т т', 'T t', 'T t'], ['У у', 'U u', 'U u'],
    ['Ў ў', 'Oʻ oʻ', 'Ö ö'], ['Ф ф', 'F f', 'F f'], ['Х х', 'X x', 'X x'],
    ['Ҳ ҳ', 'H h', 'H h'], ['Ц ц', 'S s / Ts ts', 'S s / Ts ts'],
    ['Ч ч', 'Ch ch', 'Ç ç'], ['Ш ш', 'Sh sh', 'Ş ş'],
    ['Щ щ', 'Shch shch', 'Şç şç'], ['Ъ ъ', 'ʼ', 'ʼ'],
    ['Ь ь', '(yozilmaydi)', '(yozilmaydi)'], ['Э э', 'E e', 'E e'],
    ['Ю ю', 'Yu yu', 'Yu yu'], ['Я я', 'Ya ya', 'Ya ya']
  ];

  // --------------------------------------------------------------- helpers

  var LETTER_RE = /\p{L}/u;

  function isLetter(ch) { return !!ch && LETTER_RE.test(ch); }
  function isUpper(ch) { return !!ch && ch !== ch.toLowerCase() && ch === ch.toUpperCase(); }
  function isApostrophe(ch) { return !!ch && APOSTROPHES.indexOf(ch) !== -1; }
  function upperFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /** Apply fn to every part of the text that is not a URL or e-mail address. */
  function mapUnprotected(text, fn) {
    var parts = String(text).split(PROTECTED_RE);
    for (var i = 0; i < parts.length; i += 2) parts[i] = fn(parts[i]);
    return parts.join('');
  }

  function hasNewLetters(text) { return NEW_LETTERS_RE.test(text); }

  /**
   * Digraph/letter case rule: in an all-caps context ("ШАҲАР") the whole
   * digraph is upper-case ("SHAHAR"); otherwise only its first letter ("Shahar").
   */
  function caseDigraph(value, chars, i) {
    var prev = chars[i - 1], next = chars[i + 1];
    var ctxUpper = (isLetter(prev) && isUpper(prev)) || (isLetter(next) && isUpper(next));
    return ctxUpper ? value.toUpperCase() : upperFirst(value);
  }

  // ----------------------------------------------- Latin: normalisation

  /**
   * Normalise apostrophes and legacy letters. Result is "canonical Latin":
   * Oʻ/Gʻ written with U+02BB, tutuq with U+02BC, ŏ→oʻ, ŋ→ng.
   * Apostrophes used as quotation marks are left untouched.
   */
  function canonicalizeLatin(text) {
    var chars = Array.from(text);
    for (var i = 0; i < chars.length; i++) {
      var c = chars[i];
      if (!isApostrophe(c)) continue;
      var prev = chars[i - 1], next = chars[i + 1];
      if (!isLetter(prev)) continue;               // opening quote or lone mark
      var nextLetter = isLetter(next);
      if ('oOgG'.indexOf(prev) !== -1 && (nextLetter || isLetter(chars[i - 2]))) {
        chars[i] = OKINA;                           // o', g'  →  oʻ, gʻ
      } else if (nextLetter) {
        chars[i] = TUTUQ;                           // ta'lim →  taʼlim
      }
    }
    return chars.join('')
      .replace(/ŏ/g, 'o' + OKINA).replace(/Ŏ/g, 'O' + OKINA)
      .replace(/ŋ/g, 'ng').replace(/Ŋ/g, 'Ng');
  }

  // ------------------------------------------------- Latin → new Latin

  function toNewLatin(text) {
    return mapUnprotected(text, function (part) {
      var t = canonicalizeLatin(part);
      var alreadyNew = hasNewLetters(t);

      if (!alreadyNew) {
        // Oʻ Gʻ → Ö Ğ
        t = t.replace(/([oOgG])ʻ/g, function (m, c) {
          return { o: 'ö', O: 'Ö', g: 'ğ', G: 'Ğ' }[c];
        });
        // Sh Ch → Ş Ç (keep the case of the first letter)
        t = t.replace(/sh|ch|Sh|Ch|SH|CH|sH|cH/g, function (m) {
          var small = m.toLowerCase() === 'sh' ? 'ş' : 'ç';
          return isUpper(m.charAt(0)) ? small.toUpperCase() : small;
        });
        // "s'h" was a separator for the old digraph; the new alphabet needs none.
        t = t.replace(/([sS])ʼ([hH])/g, '$1$2');
      } else {
        // Mixed text: only finish what is still written the old way.
        t = t.replace(/([oOgG])ʻ/g, function (m, c) {
          return { o: 'ö', O: 'Ö', g: 'ğ', G: 'Ğ' }[c];
        });
      }
      return t;
    });
  }

  // --------------------------------------------- Latin → current Latin

  function toCurrentLatin(text) {
    return mapUnprotected(text, function (part) {
      var t = canonicalizeLatin(part);
      if (!hasNewLetters(t)) return t;

      // In the new alphabet a plain "sh" is s + h; the current alphabet
      // needs a tutuq to keep it from reading as one letter.
      t = t.replace(/([sS])([hH])/g, '$1' + TUTUQ + '$2');

      var chars = Array.from(t), out = '';
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i], l = c.toLowerCase();
        if (!NEW_LETTER_TO_CURRENT[l]) { out += c; continue; }
        var val = NEW_LETTER_TO_CURRENT[l];
        if (!isUpper(c)) out += val;
        else if (val.length === 2 && val.charAt(1) === OKINA) out += val.charAt(0).toUpperCase() + OKINA;
        else out += caseDigraph(val, chars, i);
      }
      return out;
    });
  }

  // ---------------------------------------------- Cyrillic → current Latin

  function cyrillicToLatin(text) {
    return mapUnprotected(text, function (part) {
      var chars = Array.from(part), out = '';
      for (var i = 0; i < chars.length; i++) {
        var c = chars[i], l = c.toLowerCase(), up = isUpper(c);
        var prev = chars[i - 1], prevL = prev ? prev.toLowerCase() : '';
        var val;

        if (l === 'е') {
          // Word start, after a vowel or after ъ/ь  →  "ye"; elsewhere "e".
          var atStart = !isLetter(prev) || VOWELS_CYR.indexOf(prevL) !== -1 || prevL === 'ъ' || prevL === 'ь';
          val = atStart ? 'ye' : 'e';
        } else if (l === 'ц') {
          val = isLetter(prev) ? 'ts' : 's';          // цирк → sirk, лицей → litsey
        } else if (l === 'ҳ' && prevL === 'с') {
          out += TUTUQ + (up ? 'H' : 'h');            // Исҳоқ → Isʼhoq (keeps s + h apart)
          continue;
        } else if (Object.prototype.hasOwnProperty.call(CYR_TO_LAT, l)) {
          val = CYR_TO_LAT[l];
        } else {
          out += c;                                   // digits, punctuation, Latin, etc.
          continue;
        }

        if (!up || val === '' || val === TUTUQ) out += val;
        else if (val.length === 1) out += val.toUpperCase();
        else if (val.charAt(1) === OKINA) out += val.charAt(0).toUpperCase() + OKINA;
        else out += caseDigraph(val, chars, i);
      }
      return out;
    });
  }

  // ---------------------------------------------- Latin → Cyrillic

  function latinToCyrillic(text) {
    return mapUnprotected(text, function (part) {
      var t = canonicalizeLatin(part);
      var newMode = hasNewLetters(t);   // in the new alphabet "sh" is just s + h
      var chars = Array.from(t);
      var low = chars.map(function (c) { return c.toLowerCase(); });
      var out = '';

      function cased(letter, up) { return up ? letter.toUpperCase() : letter; }
      function wordStart(i) { return !isLetter(chars[i - 1]); }
      function afterVowel(i) {
        var p = low[i - 1];
        if (!p) return false;
        if (VOWELS_LAT.indexOf(p) !== -1) return true;
        return p === OKINA && low[i - 2] === 'o';
      }

      for (var i = 0; i < chars.length;) {
        var c = chars[i], l = low[i], n = low[i + 1], nn = low[i + 2], up = isUpper(c);

        // Oʻ, Gʻ
        if ((l === 'o' || l === 'g') && n === OKINA) {
          out += cased(l === 'o' ? 'ў' : 'ғ', up); i += 2; continue;
        }
        // Tutuq used as a separator: s'h, t's, n'g, y'o …
        if (n === TUTUQ && ((l === 's' && nn === 'h') || (l === 't' && nn === 's') ||
            (l === 'n' && nn === 'g') || (l === 'y' && 'ouae'.indexOf(nn) !== -1 && nn))) {
          out += cased(LAT_TO_CYR[l], up); i += 2; continue;
        }
        // Letters of the new / 1990s alphabet
        if (NEW_LETTER_TO_CYR[l]) { out += cased(NEW_LETTER_TO_CYR[l], up); i++; continue; }

        // Digraphs
        if (l === 's' && n === 'h' && !newMode) { out += cased('ш', up); i += 2; continue; }
        if (l === 'c' && n === 'h') { out += cased('ч', up); i += 2; continue; }
        if (l === 't' && n === 's') {
          var rest = low.slice(i + 2, i + 9).join('');
          if (wordStart(i) || !isLetter(chars[i + 2]) || TS_FOLLOWED_BY.test(rest)) {
            out += cased('ц', up); i += 2; continue;
          }
        }
        if (l === 'y') {
          if (n === 'o' && nn !== OKINA) { out += cased('ё', up); i += 2; continue; }
          if (n === 'u') { out += cased('ю', up); i += 2; continue; }
          if (n === 'a') { out += cased('я', up); i += 2; continue; }
          if (n === 'e' && (wordStart(i) || afterVowel(i))) { out += cased('е', up); i += 2; continue; }
        }

        // Single letters
        if (l === 'e') { out += cased(wordStart(i) ? 'э' : 'е', up); i++; continue; }
        if (LAT_TO_CYR[l]) { out += cased(LAT_TO_CYR[l], up); i++; continue; }

        // Tutuq → ъ (only inside a word)
        if (c === TUTUQ && isLetter(chars[i - 1])) { out += 'ъ'; i++; continue; }

        out += c; i++;                              // everything else is kept as is
      }
      return out;
    });
  }

  // ------------------------------------------------------------ public API

  /**
   * @param {string} text
   * @param {{from: 'cyrillic'|'latin', to: 'cyrillic'|'latin-new'|'latin-current'}} opts
   */
  function convert(text, opts) {
    text = String(text == null ? '' : text);
    var from = opts && opts.from, to = opts && opts.to;
    if (from === 'cyrillic') {
      if (to === 'latin-new') return toNewLatin(cyrillicToLatin(text));
      if (to === 'latin-current') return cyrillicToLatin(text);
      return text;
    }
    if (from === 'latin') {
      if (to === 'cyrillic') return latinToCyrillic(text);
      if (to === 'latin-new') return toNewLatin(text);
      if (to === 'latin-current') return toCurrentLatin(text);
    }
    return text;
  }

  /** Rough script detection used to warn about a wrong source selection. */
  function detectScript(text) {
    var cyr = (String(text).match(/[Ѐ-ӿ]/g) || []).length;
    var lat = (String(text).match(/[A-Za-zÖöĞğŞşÇç]/g) || []).length;
    var total = cyr + lat;
    return {
      cyrillic: cyr,
      latin: lat,
      dominant: total === 0 ? 'none' : (cyr >= lat ? 'cyrillic' : 'latin'),
      newLatin: hasNewLetters(String(text))
    };
  }

  return {
    convert: convert,
    cyrillicToLatin: cyrillicToLatin,
    latinToCyrillic: latinToCyrillic,
    toNewLatin: toNewLatin,
    toCurrentLatin: toCurrentLatin,
    normalizeApostrophes: canonicalizeLatin,
    detectScript: detectScript,
    ALPHABET_TABLE: ALPHABET_TABLE,
    OKINA: OKINA,
    TUTUQ: TUTUQ
  };
});
