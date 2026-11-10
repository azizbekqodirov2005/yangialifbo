'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const U = require('../public/js/converter.js');

const O = U.OKINA, T = U.TUTUQ;
const cyr2cur = (s) => U.convert(s, { from: 'cyrillic', to: 'latin-current' });
const cyr2new = (s) => U.convert(s, { from: 'cyrillic', to: 'latin-new' });
const lat2cyr = (s) => U.convert(s, { from: 'latin', to: 'cyrillic' });
const lat2new = (s) => U.convert(s, { from: 'latin', to: 'latin-new' });
const lat2cur = (s) => U.convert(s, { from: 'latin', to: 'latin-current' });

test('1. Cyrillic → current Latin: basic words', () => {
  assert.equal(cyr2cur('Тошкент'), 'Toshkent');
  assert.equal(cyr2cur('чой'), 'choy');
  assert.equal(cyr2cur('қалам'), 'qalam');
  assert.equal(cyr2cur('ҳаво'), 'havo');
  assert.equal(cyr2cur('хат'), 'xat');
  assert.equal(cyr2cur('эмас'), 'emas');
  assert.equal(cyr2cur('ёш'), 'yosh');
  assert.equal(cyr2cur('тайёр'), 'tayyor');
  assert.equal(cyr2cur('юрак'), 'yurak');
  assert.equal(cyr2cur('ишчи'), 'ishchi');
});

test('2. Cyrillic → current Latin: Oʻ, Gʻ, Ng, tutuq', () => {
  assert.equal(cyr2cur('Ўзбекистон'), `O${O}zbekiston`);
  assert.equal(cyr2cur('ғилдирак'), `g${O}ildirak`);
  assert.equal(cyr2cur('тонг'), 'tong');
  assert.equal(cyr2cur('ёнғин'), `yong${O}in`);
  assert.equal(cyr2cur('маъно'), `ma${T}no`);
  assert.equal(cyr2cur('Исҳоқ'), `Is${T}hoq`);
});

test('3. Positional rules: е and ц', () => {
  assert.equal(cyr2cur('ер'), 'yer');
  assert.equal(cyr2cur('кейин'), 'keyin');
  assert.equal(cyr2cur('поезд'), 'poyezd');
  assert.equal(cyr2cur('цирк'), 'sirk');
  assert.equal(cyr2cur('лицей'), 'litsey');
  assert.equal(cyr2cur('съезд'), `s${T}yezd`);
});

test('4. Upper / lower case, including all-caps digraphs', () => {
  assert.equal(cyr2cur('ШАҲАР'), 'SHAHAR');
  assert.equal(cyr2cur('Шаҳар'), 'Shahar');
  assert.equal(cyr2cur('АҚШ'), 'AQSH');
  assert.equal(cyr2cur('ЎЗБЕК'), `O${O}ZBEK`);
  assert.equal(cyr2cur('Ғазна'), `G${O}azna`);
  assert.equal(cyr2cur('ЧОЙ'), 'CHOY');
  assert.equal(cyr2cur('Ёзув'), 'Yozuv');
  assert.equal(cyr2cur('Эл'), 'El');
});

test('5. Cyrillic → new Latin', () => {
  assert.equal(cyr2new('Ўзбекистон'), 'Özbekiston');
  assert.equal(cyr2new('шаҳар'), 'şahar');
  assert.equal(cyr2new('чой'), 'çoy');
  assert.equal(cyr2new('боғ'), 'boğ');
  assert.equal(cyr2new('тонг'), 'tong');
  assert.equal(cyr2new('ШАҲАР'), 'ŞAHAR');
  assert.equal(cyr2new('Чироқ'), 'Çiroq');
  assert.equal(cyr2new('шеър'), `şe${T}r`);
  assert.equal(cyr2new('Исҳоқ'), 'Ishoq');
  assert.equal(cyr2new('маъно'), `ma${T}no`);
});

test('6. Latin → Cyrillic: basic words and digraphs', () => {
  assert.equal(lat2cyr('shahar'), 'шаҳар');
  assert.equal(lat2cyr('choy'), 'чой');
  assert.equal(lat2cyr('tong'), 'тонг');
  assert.equal(lat2cyr('emas'), 'эмас');
  assert.equal(lat2cyr('yosh'), 'ёш');
  assert.equal(lat2cyr('tayyor'), 'тайёр');
  assert.equal(lat2cyr('yurak'), 'юрак');
  assert.equal(lat2cyr('yarim'), 'ярим');
  assert.equal(lat2cyr('ishchi'), 'ишчи');
  assert.equal(lat2cyr('qalam xat havo'), 'қалам хат ҳаво');
});

test('7. Latin → Cyrillic: Oʻ, Gʻ with every apostrophe variant', () => {
  const expected = 'ўзбек ғилдирак йўл тўй';
  for (const a of ["'", '’', '‘', 'ʻ', 'ʼ', '`', '´']) {
    const s = `o${a}zbek g${a}ildirak yo${a}l to${a}y`;
    assert.equal(lat2cyr(s), expected, `variant ${a}`);
  }
  assert.equal(lat2cyr("Oʻzbekiston Gʻarb"), 'Ўзбекистон Ғарб');
  assert.equal(lat2cyr("tog' bog'."), 'тоғ боғ.');
});

test('8. Latin → Cyrillic: tutuq, e / ye, ts, separators', () => {
  assert.equal(lat2cyr("ta'lim"), 'таълим');
  assert.equal(lat2cyr('maʼno'), 'маъно');
  assert.equal(lat2cyr('a’zo'), 'аъзо');
  assert.equal(lat2cyr('yer'), 'ер');
  assert.equal(lat2cyr('keyin'), 'кейин');
  assert.equal(lat2cyr('poyezd'), 'поезд');
  assert.equal(lat2cyr('konstitutsiya'), 'конституция');
  assert.equal(lat2cyr('litsey'), 'лицей');
  assert.equal(lat2cyr('otsiz'), 'отсиз');
  assert.equal(lat2cyr(`Is${T}hoq`), 'Исҳоқ');
  assert.equal(lat2cyr("Is'hoq"), 'Исҳоқ');
});

test('9. Latin → Cyrillic: case', () => {
  assert.equal(lat2cyr('SHAHAR'), 'ШАҲАР');
  assert.equal(lat2cyr('Shahar'), 'Шаҳар');
  assert.equal(lat2cyr('CHOY'), 'ЧОЙ');
  assert.equal(lat2cyr("O'ZBEKISTON"), 'ЎЗБЕКИСТОН');
  assert.equal(lat2cyr('Yosh'), 'Ёш');
  assert.equal(lat2cyr('YOSH'), 'ЁШ');
  assert.equal(lat2cyr('Emas'), 'Эмас');
});

test('10. New Latin → Cyrillic (Ö Ğ Ş Ç, and "sh" as s + h)', () => {
  assert.equal(lat2cyr('Özbekiston'), 'Ўзбекистон');
  assert.equal(lat2cyr('boğ çoy şahar'), 'боғ чой шаҳар');
  assert.equal(lat2cyr('ÇOY ŞAHAR'), 'ЧОЙ ШАҲАР');
  assert.equal(lat2cyr('Ishoq özbek'), 'Исҳоқ ўзбек');
});

test('11. Normalisation to the new alphabet', () => {
  assert.equal(lat2new("o'zbek g'alaba shahar choy"), 'özbek ğalaba şahar çoy');
  assert.equal(lat2new('Oʻzbekiston Gʻarb Shahar Choy'), 'Özbekiston Ğarb Şahar Çoy');
  assert.equal(lat2new('SHAHAR CHOY'), 'ŞAHAR ÇOY');
  assert.equal(lat2new("ta'lim she'r"), `ta${T}lim şe${T}r`);
  assert.equal(lat2new('tong ming'), 'tong ming');
  assert.equal(lat2new(`Is${T}hoq`), 'Ishoq');
  assert.equal(lat2new('özbek'), 'özbek', 'already-new text stays unchanged');
});

test('12. Normalisation to the current alphabet (apostrophes, old spellings)', () => {
  assert.equal(lat2cur("o'zbek g`ildirak oʻ ta’lim bo‘ldi"), `o${O}zbek g${O}ildirak oʻ ta${T}lim bo${O}ldi`);
  assert.equal(lat2cur('Şahar Çoy Özbek Ğarb'), `Shahar Choy O${O}zbek G${O}arb`);
  assert.equal(lat2cur('ŞAHAR'), 'SHAHAR');
  assert.equal(lat2cur('ŏzbek'), `o${O}zbek`);
  // New-alphabet text (detected by Ş/Ç/Ö/Ğ): plain "sh" is s + h and needs a tutuq.
  assert.equal(lat2cur('Ishoq şahar'), `Is${T}hoq shahar`);
  // Without any new letter the text is read as current Latin and left alone.
  assert.equal(lat2cur('Ishoq'), 'Ishoq');
});

test('13. Apostrophes used as quotes are left alone', () => {
  assert.equal(lat2cur("'salom' dedi"), "'salom' dedi");
  assert.equal(lat2cyr("'salom' dedi"), "'салом' деди");
});

test('14. Punctuation, numbers, paragraphs and line breaks are preserved', () => {
  const src = 'Салом, дунё!\n\n1) 2026-йил — 21-октябр.\r\n«Тошкент»; (шаҳар)...\tOK';
  const out = cyr2cur(src);
  assert.equal(out, 'Salom, dunyo!\n\n1) 2026-yil — 21-oktyabr.\r\n«Toshkent»; (shahar)...\tOK');
  assert.equal(out.split('\n').length, src.split('\n').length);
});

test('15. URLs and e-mail addresses are never touched', () => {
  assert.equal(cyr2cur('Сайт: https://example.com/Ўзбек/shahar. Хат: info@example.uz, раҳмат'),
    'Sayt: https://example.com/Ўзбек/shahar. Xat: info@example.uz, rahmat');
  assert.equal(lat2cyr('Sayt: www.agame.uz va info@azbek.uz.'), 'Сайт: www.agame.uz ва info@azbek.uz.');
});

test('16. Round trips', () => {
  const sample = `Men bugun maktabga bordim. O${O}zbekiston — go${O}zal vatan! Shahar, choy, tong, ta${T}lim, yo${O}l, tayyor.`;
  assert.equal(cyr2cur(lat2cyr(sample)), sample);
  const sampleNew = lat2new(sample);
  assert.equal(cyr2new(lat2cyr(sampleNew)), sampleNew);
  const cyrSample = 'Мен бугун мактабга бордим. Ўзбекистон — гўзал ватан! Шаҳар, чой, тонг, таълим, йўл, тайёр.';
  assert.equal(lat2cyr(cyr2cur(cyrSample)), cyrSample);
});

test('17. Empty / odd input does not throw', () => {
  assert.equal(U.convert('', { from: 'latin', to: 'cyrillic' }), '');
  assert.equal(U.convert(null, { from: 'latin', to: 'cyrillic' }), '');
  assert.equal(cyr2cur('😀 ўзбек'), `😀 o${O}zbek`);
  assert.equal(lat2cyr('A1 B2'), 'А1 Б2');
});

test('18. Large text is converted quickly', () => {
  const para = 'Ўзбекистон Республикаси — Марказий Осиёдаги давлат. Шаҳар, чой, тонг.\n';
  const big = para.repeat(20000); // ~1.4 MB
  const t0 = Date.now();
  const out = cyr2new(big);
  assert.ok(Date.now() - t0 < 4000, 'must finish in a few seconds');
  assert.equal(out.split('\n').length, big.split('\n').length);
});

test('19. Script detection', () => {
  assert.equal(U.detectScript('Салом дунё').dominant, 'cyrillic');
  assert.equal(U.detectScript('Salom dunyo').dominant, 'latin');
  assert.equal(U.detectScript('123 !?').dominant, 'none');
  assert.equal(U.detectScript('şahar').newLatin, true);
});
