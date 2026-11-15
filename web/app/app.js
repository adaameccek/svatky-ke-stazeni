/* Svátky: rozhraní. Data v data.js (tools/data.py), výpočty v astro.js, horoskop v hvezdy.js.
   V telefonu běží ve WebView a s Androidem mluví přes window.Android (Most.java);
   v prohlížeči na PC jede s ukázkovými kontakty, ať jde vzhled zkoušet bez telefonu. */
(function () {
  'use strict';
  var D = window.DATA, A = window.Astro;
  var MES = ['Leden', 'Únor', 'Březen', 'Duben', 'Květen', 'Červen', 'Červenec', 'Srpen', 'Září', 'Říjen', 'Listopad', 'Prosinec'];
  var MES_2P = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  var DNY = ['neděle', 'pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota'];
  var DNY_ZK = ['ne', 'po', 'út', 'st', 'čt', 'pá', 'so'];
  var DRUHY = { statni: 'Státní svátek', svatek: 'Svátek, den pracovního klidu', vyznamny: 'Významný den', zvyk: 'Tradice' };
  var PORADI = { statni: 0, svatek: 1, vyznamny: 2, zvyk: 3 };
  // jméno má v kalendáři víc dní: který se bere jako hlavní
  var PREDNOST = { Petr: '06-29', Pavel: '06-29' };
  // běžná jména, která kalendář vede pod jinou podobou
  var ALIAS = { Sofie: 'Žofie', Nikolas: 'Mikuláš', Stella: 'Stela', Mia: 'Marie', Antonio: 'Antonín', Tina: 'Kristýna',
    Nikoleta: 'Nikola', Nikol: 'Nikola', Elen: 'Helena', Max: 'Maxmilián', Mikoláš: 'Mikuláš', Kristina: 'Kristýna',
    Vincent: 'Vincenc', Ella: 'Eleonora', Matyáš: 'Matěj', Rozárie: 'Růžena' };

  function $(s, k) { return (k || document).querySelector(s); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function norm(s) { return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); }
  function dnes() { var d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
  function plus(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function klic(d) { return pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function iso(d) { return d.getFullYear() + '-' + klic(d); }
  function zKlice(k) { return { m: +k.substr(0, 2), d: +k.substr(3, 2) }; }
  function kratce(k) { var x = zKlice(k); return x.d + '. ' + x.m + '.'; }
  function dlouze(k) { var x = zKlice(k); return x.d + '. ' + MES_2P[x.m - 1]; }
  function prestupny(r) { return (r % 4 === 0 && r % 100 !== 0) || r % 400 === 0; }
  /** Nejbližší datum s daným klíčem (dnes se počítá). 29. 2. až v přestupném roce. */
  function pristi(k) {
    var t = dnes(), x = zKlice(k), r = t.getFullYear();
    for (var i = 0; i < 9; i++, r++) {
      if (k === '02-29' && !prestupny(r)) continue;
      var d = new Date(r, x.m - 1, x.d);
      if (d >= t) return d;
    }
    return t;
  }
  function zaDni(d) { return Math.round((d - dnes()) / 86400000); }
  function zaText(n) { return n === 0 ? 'dnes' : n === 1 ? 'zítra' : n === 2 ? 'pozítří' : 'za ' + n + ' dní'; }
  function spoj(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' a ' + a[a.length - 1]; }

  // ---------- nastavení ----------
  var VYCHOZI = {
    zeme: 'cz', druha: '', vse: true, widget: 'svatky', mesic: 'mrizka',
    ozn: { zap: true, cas: '07:00', denne: true, statni: true, zvyky: false, lide: 'oblibeni', jmena: true },
    praniM: 'Všechno nej, šéfe 💪', praniZ: 'Všechno nej k svátečku 🎉', praniN: 'Radostné prožití narozeninového dne 🎉🎂', hledatSirsi: true, zeSiti: true, oblibeni: {}, hlidana: [], prirazeni: {}, rucni: [], site: {}, nar: {}
  };
  var nast = (function () {
    var n = JSON.parse(JSON.stringify(VYCHOZI));
    try {
      var u = JSON.parse(localStorage.getItem('svatky.nastaveni') || '{}');
      Object.keys(u).forEach(function (k) { if (k === 'ozn') Object.assign(n.ozn, u.ozn); else n[k] = u[k]; });
    } catch (e) { /* první spuštění */ }
    return n;
  })();
  function uloz() {
    try { localStorage.setItem('svatky.nastaveni', JSON.stringify(nast)); } catch (e) { /* plné úložiště */ }
    naplanujPlan();
  }

  // ---------- most do Androidu ----------
  var UKAZKA = [
    { id: 'u1', jmeno: 'Martin Dvořák', krestni: 'Martin', tel: ['+420 601 000 001'] },
    { id: 'u2', jmeno: 'Honza Svoboda', krestni: 'Honza', tel: ['601 000 002'] },
    { id: 'u3', jmeno: 'Katka Nováková', krestni: 'Katka', tel: ['601 000 003'], nar: '1996-08-30', ig: 'https://www.instagram.com/katka.ukazka/', site: { wa: 1, ms: 2 } },
    { id: 'u4', jmeno: 'Benedikt Černý', krestni: 'Benedikt', tel: [] },
    { id: 'u5', jmeno: 'Servis kotle', krestni: '', tel: ['601 000 005'] },
    { id: 'u6', jmeno: 'Mahulena Veselá', krestni: 'Mahulena', tel: ['601 000 006'] }
  ];
  // ukázka dat ze sítí (v telefonu je skutečný soubor z PC, tools/lide_ze_siti.py)
  var SITE_UKAZKA = { lide: [
    { jmeno: 'Katka Nováková', tel: ['601000003'], ig: 'katka.ukazka', vzajemne: true, ms: 'Katka Nováková', zprav: 962,
      kanaly: { messenger: { n: 842, do: '2026-10-30' }, instagram: { n: 120, do: '2026-09-02' } },
      prani: [{ d: '2024-11-25', kde: 'instagram', t: 'Všechno nejlepší k svátku, Katko!', druh: 'svatek' }, { d: '2025-11-25', kde: 'messenger', t: 'Všechno nej k svátečku 🎉', druh: 'svatek' }] },
    { jmeno: 'Ondřej Malý', tel: [], ig: 'ondra.maly.ukazka', vzajemne: true, ms: 'Ondřej Malý', zprav: 310,
      kanaly: { instagram: { n: 310, do: '2026-11-01' } }, prani: [{ d: '2025-11-30', kde: 'instagram', t: 'Všechno nej, šéfe 💪', druh: 'svatek' }] }
  ] };
  var N = window.Android;
  var Most = {
    telefon: !!N,
    maKontakty: function () { return N ? N.maKontakty() : true; },
    nactiKontakty: function () { if (N) N.nactiKontakty(); else setTimeout(function () { window.poKontaktech(JSON.stringify(UKAZKA)); }, 50); },
    otevri: function (url) { if (N) N.otevri(url); else window.open(url, '_blank'); },
    chat: function (kde, radek) { if (N && N.otevriChat) N.otevriChat(kde, String(radek)); else hlaska('Otevřít chat'); },
    volat: function (tel) { if (N) N.volat(tel); else hlaska('Volat ' + tel); },
    sms: function (tel, text) { if (N) N.sms(tel, text); else hlaska('SMS na ' + tel); },
    kontakt: function (id) { if (N) N.otevriKontakt(String(id)); else hlaska('Otevřít kontakt'); },
    zapisSvatek: function (id, k) { if (N) N.zapisSvatek(String(id), k); else hlaska('V telefonu se svátek zapíše do kontaktu'); },
    plan: function (json) { if (N) N.ulozPlan(json); else window.POSLEDNI_PLAN = json; },
    maOznameni: function () { return N ? N.maOznameni() : true; },
    zadejOznameni: function () { if (N) N.zadejOznameni(); },
    widget: function () { if (N) N.pridejWidget(); else hlaska('Widget jde přidat jen v telefonu'); },
    sdilej: function (t) { if (N) N.sdilej(t); else hlaska('Sdílet: ' + t); },
    fotka: function (uri) { return N && N.fotka ? N.fotka(uri) : ''; },
    soukroma: function () { return N ? (N.soukroma ? N.soukroma() : '') : JSON.stringify(SITE_UKAZKA); },
    schranka: function (t) { if (N && N.schranka) N.schranka(t); else try { navigator.clipboard.writeText(t); } catch (e) { /* bez schránky */ } }
  };

  // ---------- kalendář ----------
  var pohybCache = {};
  /** Pohyblivé dny roku: {klic: [den]} pro Česko a Slovensko. */
  function pohyblive(rok, zeme) {
    var ck = rok + zeme;
    if (pohybCache[ck]) return pohybCache[ck];
    var out = {}, v = A.velikonoce(rok), ned = new Date(rok, v.m - 1, v.d);
    function dej(d, t, n, k, p) { var kl = klic(d); (out[kl] = out[kl] || []).push({ d: kl, t: t, n: n, k: k, p: p }); }
    if (zeme === 'sk') {
      dej(plus(ned, -2), 'svatek', 'Veľký piatok', 'Veľký piatok', 'Den ukřižování Ježíše Krista, na Slovensku den pracovního klidu.');
      dej(plus(ned, 1), 'svatek', 'Veľkonočný pondelok', 'Veľká noc', 'Velikonoční pondělí: šibačka a oblévačka.');
    } else if (zeme === 'cz') {
      dej(plus(ned, -46), 'zvyk', 'Popeleční středa', 'Popeleční středa', 'Konec masopustu a začátek čtyřicetidenního půstu před Velikonocemi.');
      dej(plus(ned, -3), 'zvyk', 'Zelený čtvrtek', 'Zelený čtvrtek', 'Připomínka poslední večeře Páně. Zvony odlétají do Říma a místo nich chodí děti s řehtačkami.');
      dej(plus(ned, -2), 'svatek', 'Velký pátek', 'Velký pátek', 'Den ukřižování Ježíše Krista, den půstu a ticha. Státem uznaným svátkem je znovu od roku 2016.');
      dej(plus(ned, -1), 'zvyk', 'Bílá sobota', 'Bílá sobota', 'Den, kdy Ježíš ležel v hrobě. Večer začíná velikonoční vigilie.');
      dej(ned, 'zvyk', 'Velikonoční neděle', 'Velikonoce', 'Boží hod velikonoční, slavnost Zmrtvýchvstání Páně. Připadá na první neděli po prvním jarním úplňku, proto se datum každý rok mění.');
      dej(plus(ned, 1), 'svatek', 'Velikonoční pondělí', 'Velikonoční pondělí', 'Pomlázka: chlapci chodí koledovat s pomlázkou z vrbového proutí a dostávají malovaná vajíčka.');
      dej(new Date(rok, 4, A.ntyDen(rok, 5, 0, 2)), 'zvyk', 'Den matek', 'Den matek', 'Druhá květnová neděle patří maminkám. Svátek přišel z USA, u nás ho ve 20. letech prosadila Alice Masaryková.');
      dej(new Date(rok, 5, A.ntyDen(rok, 6, 0, 3)), 'zvyk', 'Den otců', 'Den otců', 'Třetí červnová neděle patří tatínkům.');
      dej(new Date(rok, 2, A.ntyDen(rok, 3, 0, -1)), 'zvyk', 'Začíná letní čas', 'Letní čas', 'Ve 2 hodiny ráno se hodiny posouvají na 3. Spíme o hodinu méně.');
      dej(new Date(rok, 9, A.ntyDen(rok, 10, 0, -1)), 'zvyk', 'Končí letní čas', 'Zimní čas', 'Ve 3 hodiny ráno se hodiny vracejí na 2. Spíme o hodinu déle.');
      var stedry = new Date(rok, 11, 24);
      dej(plus(stedry, -stedry.getDay() - 21), 'zvyk', 'První adventní neděle', '1. advent', 'Začíná advent, čtyři týdny čekání na Vánoce. Na věnci se zapaluje první svíčka.');
    }
    return (pohybCache[ck] = out);
  }
  /** Vše o jednom dni v dané zemi. */
  function infoDne(d, zeme) {
    var z = zeme || nast.zeme, k = klic(d), hl, dal = [], pr = [];
    if (z === 'cz') { var x = D.cz[k] || { h: [], v: [] }; hl = x.h; dal = x.v; pr = x.p || []; }
    else hl = (D.zeme[z] || {})[k] || [];
    var sp = (D.dny[z] || []).filter(function (s) { return s.d === k; }).concat(pohyblive(d.getFullYear(), z)[k] || []);
    sp.sort(function (a, b) { return PORADI[a.t] - PORADI[b.t]; });
    return { k: k, datum: d, zeme: z, hlavni: hl, dalsi: dal, pran: pr, dny: sp };
  }
  /** Jména dne podle nastavení (jen hlavní, nebo všechna). */
  function jmenaDne(info) { return nast.vse ? info.hlavni.concat(info.dalsi) : info.hlavni; }
  /** Den, který má na widgetu a v nadpisu přednost před jménem; null = ukázat jméno. */
  function prednostni(info) {
    var kdo = info.dny.filter(function (s) {
      return nast.widget === 'jmeno' ? false : nast.widget === 'vyznamne' ? s.t !== 'zvyk' : (s.t === 'statni' || s.t === 'svatek');
    })[0];
    if (!kdo && !info.hlavni.length) kdo = info.dny[0] || null;
    return kdo || null;
  }
  function slavi(jmena) { return (jmena.length > 1 ? 'Svátek mají ' : 'Svátek má ') + spoj(jmena); }

  // ---------- rejstřík jmen ----------
  var rejstrik = { seznam: [], podle: {}, zdrob: {} };
  function rod(j) {
    if (D.jmena[j]) return D.jmena[j].r;
    if (D.rod[j]) return D.rod[j];
    return /(a|e|ie|ě|á|é)$/.test(j) ? 'z' : 'm';
  }
  function postavRejstrik() {
    var podle = {}, seznam = [];
    function pridej(j, k, hl) {
      var e = podle[j];
      if (!e) { e = podle[j] = { j: j, n: norm(j), kl: [], hl: false, r: rod(j) }; seznam.push(e); }
      if (k && e.kl.indexOf(k) < 0) { if (hl && !e.hl) e.kl.unshift(k); else e.kl.push(k); }
      if (hl) e.hl = true;
    }
    if (nast.zeme === 'cz') {
      Object.keys(D.cz).sort().forEach(function (k) {
        D.cz[k].h.forEach(function (j) { pridej(j, k, true); });
      });
      Object.keys(D.cz).sort().forEach(function (k) {
        D.cz[k].v.forEach(function (j) { pridej(j, k, false); });
      });
      Object.keys(D.jmena).forEach(function (j) { pridej(j, null, false); });
      seznam.forEach(function (e) {
        if (PREDNOST[e.j] && e.kl.indexOf(PREDNOST[e.j]) > 0) { e.kl.splice(e.kl.indexOf(PREDNOST[e.j]), 1); e.kl.unshift(PREDNOST[e.j]); }
        if (!e.kl.length && ALIAS[e.j] && podle[ALIAS[e.j]]) { e.kl = podle[ALIAS[e.j]].kl.slice(0, 1); e.alias = ALIAS[e.j]; }
      });
    } else {
      var z = D.zeme[nast.zeme] || {};
      Object.keys(z).sort().forEach(function (k) { z[k].forEach(function (j) { pridej(j, k, true); }); });
    }
    var zdrob = {};
    Object.keys(D.jmena).forEach(function (j) {
      D.jmena[j].z.forEach(function (zd) { var n = norm(zd); (zdrob[n] = zdrob[n] || []).push(j); });
    });
    seznam.sort(function (a, b) { return a.j.localeCompare(b.j, 'cs'); });
    rejstrik = { seznam: seznam, podle: podle, zdrob: zdrob };
  }
  /** Najde jméno z kalendáře pro křestní jméno nebo zdrobnělinu; {j, k, nejiste} nebo null. */
  function najdiJmeno(text) {
    var slova = String(text || '').split(/[\s,.;()\-]+/).filter(function (s) { return s.length > 1; });
    for (var i = 0; i < slova.length; i++) {
      var n = norm(slova[i]), e = null;
      for (var x = 0; x < rejstrik.seznam.length; x++) if (rejstrik.seznam[x].n === n && rejstrik.seznam[x].kl.length) { e = rejstrik.seznam[x]; break; }
      if (e) return { j: e.j, k: e.kl[0], nejiste: false };
      var zd = rejstrik.zdrob[n];
      if (zd) for (var y = 0; y < zd.length; y++) { var b = rejstrik.podle[zd[y]]; if (b && b.kl.length) return { j: b.j, k: b.kl[0], nejiste: zd.length > 1 }; }
    }
    return null;
  }
  /** Hledání: dotaz, rod ('' | 'm' | 'z'), písmeno. */
  function hledej(q, r, pismeno) {
    var n = norm(q.trim()), out = [], videl = {};
    rejstrik.seznam.forEach(function (e) {
      if (r && e.r !== r) return;
      if (pismeno && e.j.charAt(0).toLocaleUpperCase('cs') !== pismeno && !(pismeno === 'CH' && /^ch/i.test(e.j))) return;
      if (!n) { out.push({ e: e, v: 0 }); return; }
      var p = e.n.indexOf(n);
      if (p === 0) { out.push({ e: e, v: e.n === n ? 0 : 1 }); videl[e.j] = 1; }
      else if (p > 0 && n.length > 2) { out.push({ e: e, v: 4 }); videl[e.j] = 1; }
    });
    if (n) {
      Object.keys(rejstrik.zdrob).forEach(function (zn) {
        if (zn.indexOf(n) !== 0) return;
        rejstrik.zdrob[zn].forEach(function (j) {
          var e = rejstrik.podle[j];
          if (!e || videl[j] || (r && e.r !== r)) return;
          videl[j] = 1;
          var puvodni = D.jmena[j].z.filter(function (z) { return norm(z) === zn; })[0];
          out.push({ e: e, v: zn === n ? 2 : 3, pres: puvodni });
        });
      });
      out.sort(function (a, b) { return a.v - b.v || (b.e.hl - a.e.hl) || a.e.j.localeCompare(b.e.j, 'cs'); });
    }
    return out;
  }

  // ---------- lidé ----------
  var kontakty = [], lide = [], nenalezeni = [], kontaktyStav = 'ceka';
  var site = null;
  function nactiSite() { try { var s = Most.soukroma(); site = s ? JSON.parse(s) : null; } catch (e) { site = null; } }
  function konec9(t) { var c = String(t || '').replace(/\D/g, ''); return c.length >= 9 ? c.slice(-9) : ''; }
  function prepocitejLidi() {
    lide = []; nenalezeni = [];
    var sl = (site && site.lide) || [], podleTel = {}, podleJm = {}, uzite = {};
    sl.forEach(function (s, i) { (s.tel || []).forEach(function (x) { podleTel[x] = i; }); var n = norm(s.jmeno); (podleJm[n] = podleJm[n] || []).push(i); });
    function sitPro(c) {
      for (var i = 0; i < (c.tel || []).length; i++) { var k = konec9(c.tel[i]); if (k && podleTel[k] !== undefined) return podleTel[k]; }
      var p = podleJm[norm(c.jmeno)]; return p && p.length === 1 ? p[0] : -1;
    }
    kontakty.concat(nast.rucni).forEach(function (c) {
      var p = nast.prirazeni[c.id], m = null;
      if (p && p.k) m = { j: p.j, k: p.k, nejiste: false };
      else if (c.svatek) m = { j: (najdiJmeno(c.krestni || c.jmeno) || {}).j || '', k: c.svatek, nejiste: false };
      else m = najdiJmeno(c.krestni) || najdiJmeno(c.jmeno);
      var o = { id: String(c.id), jmeno: c.jmeno, tel: c.tel || [], nar: c.nar || '', rucni: !!c.rucni, vKontaktu: !!c.svatek, chat: c.site || {}, foto: c.foto || '' };
      var si = sitPro(c); if (si >= 0) { uzite[si] = 1; o.sit = sl[si]; }
      // profily: co si Adam uložil v appce, má přednost před odkazem z pole Web a před párováním ze sítí
      var s = nast.site[c.id] || {};
      o.ig = igJmeno(s.ig || c.ig || (o.sit && o.sit.ig) || ''); o.fb = fbJmeno(s.fb || c.fb || (o.sit && o.sit.fb) || '');
      if (m && !(p && p.zadne)) { o.kal = m.j; o.k = m.k; o.nejiste = m.nejiste; lide.push(o); }
      else nenalezeni.push(o);
    });
    // lidé, které nemám v kontaktech, ale píšu si s nimi nebo se sledujeme na Instagramu
    if (nast.zeSiti) sl.forEach(function (s, i) {
      if (uzite[i] || !(s.zprav >= 30 || (s.prani && s.prani.length) || s.vzajemne)) return;
      var id = 's:' + norm(s.jmeno), p = nast.prirazeni[id], m = p && p.k ? { j: p.j, k: p.k, nejiste: false } : najdiJmeno(s.jmeno.split(/\s+/)[0]);
      if (!m || (p && p.zadne) || lide.some(function (o) { return o.id === id; })) return;
      var su = nast.site[id] || {};
      lide.push({ id: id, jmeno: s.jmeno, tel: [], nar: '', rucni: false, zeSiti: true, vKontaktu: false, chat: {}, foto: '', sit: s,
        ig: igJmeno(su.ig || s.ig || ''), fb: fbJmeno(su.fb || s.fb || ''), kal: m.j, k: m.k, nejiste: m.nejiste });
    });
    lide.forEach(function (o) {
      o.kdy = pristi(o.k); o.za = zaDni(o.kdy);
      var n = narozeniny(o); o.nk = n.k; o.nrok = n.r; o.narOdhad = n.odhad;
      if (o.nk) { o.nkdy = pristi(o.nk); o.nza = zaDni(o.nkdy); }
    });
    lide.sort(function (a, b) { return a.za - b.za || a.jmeno.localeCompare(b.jmeno, 'cs'); });
  }
  /** Z odkazu, @jména nebo holého jména udělá uživatelské jméno na Instagramu. */
  function igJmeno(t) {
    t = String(t || '').trim(); if (!t) return '';
    var m = /instagram\.com\/([^/?#\s]+)/i.exec(t);
    t = (m ? m[1] : t).replace(/^@/, '');
    return /^[A-Za-z0-9._]{1,30}$/.test(t) ? t : '';
  }
  /** Facebook: uživatelské jméno, nebo číslo profilu (z profile.php?id=). */
  function fbJmeno(t) {
    t = String(t || '').trim(); if (!t) return '';
    var m = /[?&]id=(\d+)/.exec(t); if (m) return m[1];
    m = /(?:facebook\.com|fb\.com|m\.me)\/([^/?#\s]+)/i.exec(t);
    t = (m ? m[1] : t).replace(/^@/, '');
    return /^[A-Za-z0-9.\-]{2,60}$/.test(t) && !/^(profile\.php|people|search)$/i.test(t) ? t : '';
  }
  function fbOdkaz(j) { return 'https://www.facebook.com/' + (/^\d+$/.test(j) ? 'profile.php?id=' + j : j); }
  var KANAL = { messenger: 'Messenger', instagram: 'Instagram', whatsapp: 'WhatsApp', sms: 'SMS', wa: 'WhatsApp', ig: 'Instagram', fb: 'Facebook', ms: 'Messenger', tg: 'Telegram', sg: 'Signal', jinam: 'Jinam' };
  var historie = (function () { try { return JSON.parse(localStorage.getItem('svatky.historie') || '{}'); } catch (e) { return {}; } })();
  /** Co jsem člověku přál: ze zpráv (soubor z PC) a z klepnutí v appce. Nejnovější první. */
  function praniCloveka(c) {
    var a = ((c.sit && c.sit.prani) || []).concat(historie[c.id] || []);
    var vid = {};
    return a.filter(function (x) { var k = x.d + x.kde; if (vid[k]) return false; vid[k] = 1; return true; }).sort(function (x, y) { return x.d < y.d ? 1 : -1; });
  }
  function zapisPrani(c, kde, text) {
    var druh = druhPrani(c), kl = druh === 'nar' ? c && c.nk : c && c.k;
    if (!kl) return;
    var t = dnes(), x = zKlice(kl), blizko = [-1, 0, 1].some(function (r) { return Math.abs((new Date(t.getFullYear() + r, x.m - 1, x.d) - t) / 86400000) <= 7; });
    if (!blizko) return;                                   // mimo svátek je to jen otevřený chat, ne přání
    var a = historie[c.id] || (historie[c.id] = []), d = iso(t);
    if (a.some(function (y) { return y.d === d && y.kde === kde; })) return;
    a.push({ d: d, kde: kde, t: text, druh: druh, appka: true });
    try { localStorage.setItem('svatky.historie', JSON.stringify(historie)); } catch (e) { /* plné úložiště */ }
  }
  function praniPro(c) { if (druhPrani(c) === 'nar') return nast.praniN || ''; var r = c ? rod(c.kal || (c.jmeno || '').split(' ')[0]) : 'm'; return (r === 'z' ? nast.praniZ : nast.praniM) || ''; }
  function iniciala(j) {
    var s = String(j).split(/\s+/), a = (s[0].match(/[A-Za-zÀ-ž]/) || ['?'])[0], b = s[1] ? (s[1].match(/[A-Za-zÀ-ž]/) || [''])[0] : '';
    return esc((a + b).toUpperCase());
  }
  function avatar(c, velky) { return '<span class="foto' + (velky ? ' velka' : '') + '"' + (c.foto ? ' data-foto="' + esc(c.foto) + '"' : '') + '>' + iniciala(c.jmeno) + '</span>'; }
  var fotky = {};
  /** Fotky z kontaktů se načítají až ve chvíli, kdy se řádek ukáže. */
  var pozorovatel = 'IntersectionObserver' in window ? new IntersectionObserver(function (zaznamy) {
    zaznamy.forEach(function (z) { if (z.isIntersecting) { pozorovatel.unobserve(z.target); vlozFotku(z.target); } });
  }, { rootMargin: '200px' }) : null;
  function vlozFotku(el) {
    var u = el.getAttribute('data-foto'); if (!u) return;
    if (!(u in fotky)) fotky[u] = Most.fotka(u);
    if (fotky[u]) { el.style.backgroundImage = 'url(' + fotky[u] + ')'; el.classList.add('ma'); }
  }
  function nactiFotky(koren) {
    (koren || document).querySelectorAll('.foto[data-foto]:not(.ma)').forEach(function (el) { if (pozorovatel) pozorovatel.observe(el); else vlozFotku(el); });
  }
  /** Narozeniny: ručně zadané, z kontaktu, jinak odhad podle dne, kdy jsem přál k narozeninám (nejčastější den). */
  function narozeniny(o) {
    var z = nast.nar[o.id] || o.nar, m = z && /(\d{4})?-?-?(\d\d)-(\d\d)$/.exec(z);
    if (m) return { k: m[2] + '-' + m[3], r: m[1] ? +m[1] : 0, odhad: false };
    var p = ((o.sit && o.sit.prani) || []).filter(function (x) { return x.druh === 'nar'; }), c = {}, nej = '';
    p.forEach(function (x) { var k = x.d.substr(5); c[k] = (c[k] || 0) + 1; if (!nej || c[k] >= c[nej]) nej = k; });
    return { k: nej, r: 0, odhad: !!nej };
  }
  function lideNar(k) { return lide.filter(function (o) { return o.nk === k; }); }
  /** K čemu se zrovna přeje: co je blíž, nebo co jsem v listu člověka přepnul. */
  function druhPrani(c) {
    if (!c) return 'svatek';
    if (stav.druh && stav.druh[c.id]) return stav.druh[c.id];
    return c.nk && (!c.k || c.nza < c.za) ? 'nar' : 'svatek';
  }
  function lideDne(k) { return lide.filter(function (o) { return o.k === k; }); }
  function clovek(id) { return lide.concat(nenalezeni).filter(function (o) { return o.id === String(id); })[0]; }
  window.poKontaktech = function (json) {
    try { kontakty = JSON.parse(json) || []; } catch (e) { kontakty = []; }
    kontaktyStav = 'ok';
    prepocitejLidi(); naplanujPlan();
    if (karta === 'lide' || karta === 'dnes') kresli();
  };
  window.poPovoleni = function (co, ok) {
    if (co === 'kontakty') { if (ok) { kontaktyStav = 'ceka'; Most.nactiKontakty(); } else { kontaktyStav = 'zakaz'; kresli(); } }
    if (co === 'oznameni' && !ok) hlaska('Oznámení jsou v telefonu vypnutá');
    if (co === 'zapis') hlaska(ok ? 'Svátek je zapsaný v kontaktu' : 'Zápis do kontaktu se nepovedl');
  };

  // ---------- plán pro widget a oznámení ----------
  var planCas = null;
  function naplanujPlan() { clearTimeout(planCas); planCas = setTimeout(ulozPlan, 400); }
  function oznameniDne(info) {
    var o = nast.ozn;
    if (!o.zap) return null;
    var sp = info.dny.filter(function (s) { return s.t === 'zvyk' ? o.zvyky : o.statni; });
    var ld = o.lide === 'nikdo' ? [] : lideDne(info.k).filter(function (c) { return o.lide === 'vsichni' || nast.oblibeni[c.id]; });
    var vsechna = info.hlavni.concat(info.dalsi);
    var hl = o.jmena ? vsechna.filter(function (j) { return nast.hlidana.indexOf(j) >= 0; }) : [];
    var jm = jmenaDne(info), radky = [], titul;
    var lidi = ld.length ? 'Z tvých lidí: ' + spoj(ld.map(function (c) { return c.jmeno; })) + '.' : '';
    var nd = o.lide === 'nikdo' ? [] : lideNar(info.k).filter(function (c) { return o.lide === 'vsichni' || nast.oblibeni[c.id]; });
    if (sp.length) {
      titul = 'Dnes je ' + sp[0].n;
      radky.push(sp[0].p);
      sp.slice(1).forEach(function (s) { radky.push('Také: ' + s.n + '.'); });
      if (info.hlavni.length) radky.push(slavi(info.hlavni) + '.');
    } else if (o.denne && jm.length) {
      titul = (info.hlavni.length > 1 ? 'Dnes mají svátek ' : 'Dnes má svátek ') + spoj(info.hlavni.length ? info.hlavni : jm.slice(0, 2));
      if (nast.vse && info.hlavni.length && info.dalsi.length) radky.push('Také ' + info.dalsi.slice(0, 8).join(', ') + '.');
    } else if (ld.length || hl.length || nd.length) {
      titul = !ld.length && !hl.length ? 'Narozeniny: ' + spoj(nd.map(function (c) { return c.jmeno; })) : hl.length ? 'Dnes má svátek ' + spoj(hl) : 'Dnes má svátek ' + spoj(ld.map(function (c) { return c.jmeno; }));
      if (hl.length && !ld.length) radky.push('Jméno, které hlídáš.');
    } else return null;
    if (lidi && !(titul.indexOf(ld[0].jmeno) >= 0)) radky.push(lidi);
    if (nd.length && titul.indexOf('Narozeniny') !== 0) radky.push('Narozeniny: ' + spoj(nd.map(function (c) { return c.jmeno; })) + ' 🎂');
    return { t: titul, x: radky.join('\n') };
  }
  function ulozPlan() {
    var dny = {}, d = dnes();
    for (var i = 0; i < 400; i++, d = plus(d, 1)) {
      var info = infoDne(d), p = prednostni(info), z = {};
      if (p) { z.a = 'Dnes je'; z.b = p.k; z.c = info.hlavni.join(', '); }
      else { z.a = info.hlavni.length > 1 ? 'Dnes mají svátek' : 'Dnes má svátek'; z.b = info.hlavni.join(info.hlavni.length === 2 ? ' a ' : ', '); z.c = ''; }
      var n = oznameniDne(info);
      if (n) { z.t = n.t; z.x = n.x; }
      dny[iso(d)] = z;
    }
    Most.plan(JSON.stringify({ cas: nast.ozn.cas, zap: nast.ozn.zap, dny: dny }));
  }

  // ---------- kreslení ----------
  var karta = 'dnes', stav = { posun: 0, mesic: null, q: '', rod: '', pismeno: '', razeni: 'datum', lideFiltr: 'vse', lideQ: '', hv: 'zver' };
  var obsah = $('#obsah');
  function hlaska(t) {
    var h = $('#hlaska'); h.textContent = t; h.hidden = false;
    clearTimeout(hlaska.c); hlaska.c = setTimeout(function () { h.hidden = true; }, 2600);
  }
  function tlJmeno(j) { return '<button data-akce="jmeno" data-j="' + esc(j) + '">' + esc(j) + '</button>'; }
  function htmlSvatecni(s) {
    return '<div class="karta svatecni' + (s.t === 'zvyk' ? ' zvyk' : '') + '"><div class="vnitrek"><div class="druh">' + DRUHY[s.t] +
      '</div><h3>' + esc(s.n) + '</h3><p>' + esc(s.p) + '</p></div></div>';
  }
  function htmlZnameni(d) {
    var a = A.den(d.getFullYear(), d.getMonth() + 1, d.getDate());
    var c = A.cinskyRokData(D.cny, d.getFullYear(), d.getMonth() + 1, d.getDate());
    return '<div class="karta"><div class="znam">' +
      '<div data-akce="hvezdy" data-hv="zver"><div class="zn">' + A.ZNAKY[a.trop] + '</div><b>' + A.ZNAMENI[a.trop] + '</b><span>tropický</span></div>' +
      '<div data-akce="hvezdy" data-hv="zver"><div class="zn">' + A.ZNAKY[a.sid] + '</div><b>' + A.ZNAMENI[a.sid] + '</b><span>siderický</span></div>' +
      '<div data-akce="hvezdy" data-hv="cina"><div class="zn">' + pecet(c) + '</div><b>' + c.nazev + '</b><span>čínský rok ' + c.rok + '</span></div>' +
      '</div></div>';
  }
  /** Čínská pečeť: znak zvířete v barvě živlu, v rohu znak živlu. */
  function pecet(c) { var s = A.cinaStyl(), o = A.cinaObr(s); return '<span class="pecet' + (s === 'emoji' ? ' emo' : '') + ' z' + c.zivel + '" title="' + c.nazev + '"><b>' + o.zvire[c.zvire] + '</b><i>' + o.zivel[c.zivel] + '</i></span>'; }
  /** Kolik lidí v Česku jméno nosí (evidence obyvatel MV ČR, stav 2016). */
  function popisNar(z) { var m = /(\d{4})?-?-?(\d\d)-(\d\d)$/.exec(z); return m ? (+m[3]) + '. ' + (+m[2]) + '.' + (m[1] ? ' ' + m[1] : '') : ''; }
  function pocet0(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }
  function pocet(j) { var n = D.pocty && D.pocty[j]; return n ? String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : ''; }
  function nositele(j) {
    var n = D.pocty && D.pocty[j]; if (!n) return '';
    return pocet(j) + (n === 1 ? ' člověk' : n < 5 ? ' lidé' : ' lidí');
  }
  function radekNar(c) {
    var vek = c.nrok ? dnes().getFullYear() - c.nrok : 0;
    return '<div>' + avatar(c) + '<button class="hl" data-akce="clovek" data-id="' + esc(c.id) + '"><b>' + esc(c.jmeno) + '</b><span>🎂 ' +
      (vek ? vek + ' let' : 'narozeniny') + (c.narOdhad ? ' · podle loňského přání' : '') + '</span></button>' +
      '<button class="hvezda' + (nast.oblibeni[c.id] ? ' ano' : '') + '" data-akce="hvezda" data-id="' + esc(c.id) + '" aria-label="Oblíbený">★</button></div>';
  }
  function radekCloveka(c, sDatem) {
    var pr = praniCloveka(c).filter(function (x) { return x.druh !== 'nar'; })[0];
    var pod = (sDatem ? esc(c.kal || '') + ' · ' + dlouze(c.k) + ' · ' + zaText(c.za) : 'slaví jako ' + esc(c.kal || '')) +
      (pr ? ' · ' + (pr.d.substr(0, 4) === String(dnes().getFullYear()) ? 'letos' : pr.d.substr(0, 4)) + ' ' + esc(KANAL[pr.kde] || pr.kde) : '') + (c.zeSiti ? ' · ze sítí' : '');
    if (c.nk && c.nza <= 30) pod = '🎂 ' + (c.nza === 0 ? 'dnes narozeniny' : 'narozeniny ' + zaText(c.nza)) + ' · ' + pod;
    return '<div>' + avatar(c) + '<button class="hl" data-akce="clovek" data-id="' + esc(c.id) + '"><b>' + esc(c.jmeno) + '</b><span>' + pod + '</span></button>' +
      '<button class="hvezda' + (nast.oblibeni[c.id] ? ' ano' : '') + '" data-akce="hvezda" data-id="' + esc(c.id) + '" aria-label="Oblíbený">★</button></div>';
  }
  /** Tělo jednoho dne: používá karta Dnes i list dne z kalendáře. */
  function htmlDne(d, vListu) {
    var info = infoDne(d), p = prednostni(info), jm = info.hlavni, h = '';
    var hlavicka = DNY[d.getDay()] + ' · ' + MES[d.getMonth()] + ' ' + d.getFullYear();
    h += '<div class="karta trhaci"><div class="pas">' +
      (vListu ? '' : '<button data-akce="posun" data-o="-1" aria-label="Předchozí den">‹</button>') +
      '<div class="datum">' + hlavicka + '</div>' +
      (vListu ? '' : '<button data-akce="posun" data-o="1" aria-label="Další den">›</button>') + '</div><div class="telo">' +
      '<div class="cislo">' + d.getDate() + '</div>';
    if (p) {
      h += '<div class="popisek">' + (zaDni(d) === 0 ? 'Dnes je' : 'Je') + '</div><div class="jmeno' + (p.n.length > 22 ? ' dlouhe' : '') + '">' + esc(p.n) + '</div>';
      if (jm.length) h += '<div class="take">' + (jm.length > 1 ? 'Svátek mají ' : 'Svátek má ') + jm.map(tlJmeno).join(', ') + '</div>';
    } else {
      var txt = jm.length > 1 ? 'Svátek mají' : 'Svátek má';
      h += '<div class="popisek">' + (zaDni(d) === 0 ? 'Dnes ' + txt.toLowerCase().replace('svátek ', '') + ' svátek' : txt) + '</div>' +
        '<div class="jmeno' + (jm.join('').length > 16 ? ' dlouhe' : '') + '">' + (jm.length ? jm.map(tlJmeno).join(jm.length === 2 ? ' a ' : ', ') : 'nikdo') + '</div>';
    }
    var podlePoctu = info.dalsi.slice().sort(function (a, b) { return ((D.pocty && D.pocty[b]) || 0) - ((D.pocty && D.pocty[a]) || 0); });
    if (nast.vse && info.dalsi.length) h += '<div class="take">Také ' + podlePoctu.map(tlJmeno).join(', ') + '</div>';
    var sPoctem = jm.filter(function (j) { return D.pocty && D.pocty[j]; });
    var vsePocty = jm.concat(nast.vse ? info.dalsi : []).filter(function (j, i, a) { return a.indexOf(j) === i; });
    if (nast.zeme === 'cz' && sPoctem.length) {
      h += '<button class="pocet" data-akce="pocty">' + (sPoctem.length === 1 ? 'V Česku ' + (D.pocty[sPoctem[0]] < 5 ? 'jsou ' : 'je ') + nositele(sPoctem[0]) + ' s tímhle jménem'
        : 'V Česku ' + sPoctem.map(function (j) { return esc(j) + ' ' + pocet(j); }).join(', ') + ' lidí') + (vsePocty.length > 1 ? ' <i>' + (stav.pocty ? '▴' : '▾') + '</i>' : '') + '</button>';
      if (stav.pocty && vsePocty.length > 1) h += '<div class="pocty">' + vsePocty.map(function (j) {
        return '<button data-akce="jmeno" data-j="' + esc(j) + '"><span>' + esc(j) + '</span><b>' + (pocet(j) || 'méně než 5') + '</b></button>';
      }).join('') + '<small>Kolik lidí v Česku nosí jméno (MV ČR, 2016)</small></div>';
    }
    if (nast.druha && nast.druha !== nast.zeme) {
      var dr = infoDne(d, nast.druha), nz = D.zemeNazvy.filter(function (z) { return z[0] === nast.druha; })[0];
      if (dr.hlavni.length) h += '<div class="take">' + esc(nz ? nz[1] : '') + ': ' + esc(dr.hlavni.join(', ')) + '</div>';
    }
    h += '</div></div>';
    if (!vListu && stav.posun !== 0) h += '<button class="zpetDnes" data-akce="posunDnes">Zpět na dnešek</button>';
    info.dny.forEach(function (s) { h += htmlSvatecni(s); });
    var ld = lideDne(info.k);
    var nd = lideNar(info.k);
    if (nd.length) h += '<div class="nadpis">Narozeniny 🎂</div><div class="karta radky">' + nd.map(radekNar).join('') + '</div>';
    if (ld.length) h += '<div class="nadpis">Z tvých lidí slaví</div><div class="karta radky">' + ld.map(function (c) { return radekCloveka(c, false); }).join('') + '</div>';
    h += htmlZnameni(d);
    h += htmlSvet(d);
    if (info.pran.length) h += '<div class="karta"><div class="vnitrek"><div class="nadpis" style="margin:0 0 6px">Pranostika</div><p style="font-family:var(--patka);font-style:italic">' + esc(info.pran[0]) + '</p></div></div>';
    return h;
  }
  /** Kdo slaví týž den v ostatních zemích (zahraniční kalendáře). */
  function htmlSvet(d) {
    var r = D.zemeNazvy.filter(function (z) { return z[0] !== nast.zeme; }).map(function (z) {
      return { z: z, j: infoDne(d, z[0]).hlavni };
    }).filter(function (x) { return x.j.length; });
    if (!r.length) return '';
    var ukaz = stav.svetVse ? r : r.slice(0, 4);
    return '<div class="nadpis">Ve světě slaví</div><div class="karta svet">' + ukaz.map(function (x) {
      return '<div><span>' + esc(x.z[1]) + '</span><b>' + esc(x.j.join(', ')) + '</b></div>';
    }).join('') + (r.length > 4 ? '<button data-akce="svetVse">' + (stav.svetVse ? 'Méně zemí' : 'Další země (' + (r.length - 4) + ')') + '</button>' : '') + '</div>';
  }
  function radekDne(d, trida, bezSirsiho) {
    var info = infoDne(d), p = prednostni(info), jm = info.hlavni, ld = lideDne(info.k);
    var hl = p ? p.k : (jm.join(', ') || (info.dalsi[0] || ''));
    var pod = [];
    if (p && jm.length) pod.push(jm.join(', '));
    if (nast.vse && !bezSirsiho && info.dalsi.length) pod.push(info.dalsi.join(', '));
    if (!p && info.dny.length) pod.unshift(info.dny.map(function (s) { return s.k; }).join(', '));
    return '<button data-akce="den" data-d="' + iso(d) + '"' + (trida ? ' class="' + trida + '"' : '') + '><span class="den"><b>' + d.getDate() + '</b><span>' + DNY_ZK[d.getDay()] + '</span></span>' +
      '<span class="hl"><b' + (p ? ' style="color:var(--cervena)"' : '') + '>' + esc(hl) + (ld.length ? '<i class="znacka zl"></i>' : '') + '</b>' + (pod.length ? '<span>' + esc(pod.join(' · ')) + '</span>' : '') + '</span></button>';
  }

  function kresliDnes() {
    var d = plus(dnes(), stav.posun), h = htmlDne(d, false);
    var zitra = infoDne(plus(d, 1)), pozitri = infoDne(plus(d, 2));
    function kdo(i) { var p = prednostni(i); return esc(p ? p.k : i.hlavni.join(', ') || 'nikdo'); }
    h += '<button class="karta dalsiDny" data-akce="doKalendare"><span><small>Zítra</small>' + kdo(zitra) + '</span><span><small>Pozítří</small>' + kdo(pozitri) + '</span>' +
      '<em>Všechny dny<i>›</i></em></button>';
    var bl = lide.filter(function (c) { return c.za > 0 && c.za <= 30 && (nast.oblibeni[c.id] || lide.length < 40); }).slice(0, 5);
    if (bl.length) h += '<div class="nadpis">Blíží se u tvých lidí</div><div class="karta radky">' + bl.map(function (c) { return radekCloveka(c, true); }).join('') + '</div>';
    obsah.innerHTML = h;
  }

  function kresliMesic() {
    var t = dnes();
    if (!stav.mesic) stav.mesic = { r: t.getFullYear(), m: t.getMonth() };
    var r = stav.mesic.r, m = stav.mesic.m, dni = new Date(r, m + 1, 0).getDate();
    var h = '<div class="mesicHlava"><button class="mesicNazev" data-akce="vyberMesic"><h2>' + MES[m] + '<small>' + r + '</small><i>▾</i></h2></button><div class="sipky">' +
      '<button class="ikona" data-akce="mesic" data-o="-1" aria-label="Předchozí měsíc">‹</button>' +
      '<button class="ikona" data-akce="mesicDnes" aria-label="Tento měsíc">●</button>' +
      '<button class="ikona" data-akce="mesic" data-o="1" aria-label="Další měsíc">›</button></div></div>' +
      '<div class="prepinac"><button data-akce="mesicVzhled" data-v="mrizka" class="' + (nast.mesic === 'mrizka' ? 'akt' : '') + '">Mřížka</button>' +
      '<button data-akce="mesicVzhled" data-v="seznam" class="' + (nast.mesic === 'seznam' ? 'akt' : '') + '">Seznam se všemi jmény</button></div>';
    if (nast.mesic === 'mrizka') {
      h += '<div class="mrizka' + (stav.jizda ? ' jede-' + stav.jizda : '') + '" id="mrizka">' + ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'].map(function (x, i) { return '<div class="dt' + (i > 4 ? ' vik' : '') + '">' + x + '</div>'; }).join('');
      var prvni = (new Date(r, m, 1).getDay() + 6) % 7;
      for (var i = 0; i < prvni; i++) h += '<div class="bunka prazdna"></div>';
      for (var den = 1; den <= dni; den++) {
        var d = new Date(r, m, den), info = infoDne(d), p = prednostni(info), vik = d.getDay() === 0 || d.getDay() === 6;
        var volno = info.dny.some(function (s) { return s.t === 'statni' || s.t === 'svatek'; });
        var txt = p ? p.k : info.hlavni.join(', ');
        h += '<button style="--i:' + (prvni + den) + '" class="bunka' + (vik ? ' vik' : '') + (volno || p ? ' sv' : '') + (+d === +t ? ' dnes' : '') + '" data-akce="den" data-d="' + iso(d) + '"><b>' + den + '</b><span>' + esc(txt) + '</span>' +
          (lideDne(info.k).length ? '<i class="tecka"></i>' : '') + (lideNar(info.k).length ? '<i class="tecka nar"></i>' : '') + '</button>';
      }
      h += '</div><p class="tlum maly" style="margin-top:10px">Červeně státní svátky, zlatá tečka svátek někoho z tvých lidí, růžová narozeniny. Tažením nahoru a dolů přejdeš na další měsíc.</p>';
    } else {
      h += '<div class="karta radky seznamMesic">';
      for (var e = 1; e <= dni; e++) { var dd = new Date(r, m, e); h += radekDne(dd, +dd === +t ? 'dnesRadek' : ''); }
      h += '</div>';
    }
    obsah.innerHTML = h;
    stav.jizda = '';
  }
  /** Posun měsíce s animací: +1 další (mřížka přijede zespodu), −1 předchozí (shora). */
  function jedMesic(o) {
    var m = stav.mesic.m + o; stav.mesic = { r: stav.mesic.r + Math.floor(m / 12), m: A.mod(m, 12) };
    stav.jizda = o > 0 ? 'dolu' : 'nahoru'; kresliMesic();
  }
  (function () {
    var y0 = null, x0 = 0, s0 = 0, kolecko = 0;
    obsah.addEventListener('touchstart', function (e) {
      if (karta !== 'kalendar' || nast.mesic !== 'mrizka' || !e.target.closest('#mrizka')) { y0 = null; return; }
      y0 = e.touches[0].clientY; x0 = e.touches[0].clientX; s0 = obsah.scrollTop;
    }, { passive: true });
    obsah.addEventListener('touchend', function (e) {
      if (y0 === null) return;
      var dy = e.changedTouches[0].clientY - y0, dx = e.changedTouches[0].clientX - x0, dole = obsah.scrollTop + obsah.clientHeight >= obsah.scrollHeight - 2;
      y0 = null;
      if (Math.abs(dy) > 60 && Math.abs(dy) > Math.abs(dx) * 1.4) {
        if (dy < 0 && (dole || obsah.scrollTop === s0)) jedMesic(1);
        else if (dy > 0 && obsah.scrollTop <= 0 && s0 <= 0) jedMesic(-1);
      } else if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.4) jedMesic(dx < 0 ? 1 : -1);
    }, { passive: true });
    obsah.addEventListener('wheel', function (e) {
      if (karta !== 'kalendar' || nast.mesic !== 'mrizka' || !e.target.closest('#mrizka')) return;
      var dole = obsah.scrollTop + obsah.clientHeight >= obsah.scrollHeight - 2, nahore = obsah.scrollTop <= 0;
      if ((e.deltaY > 0 && !dole) || (e.deltaY < 0 && !nahore)) return;
      e.preventDefault();
      var t = Date.now(); if (t - kolecko < 450) return; kolecko = t;
      jedMesic(e.deltaY > 0 ? 1 : -1);
    }, { passive: false });
  })();

  /** Vlastní výběr data nebo měsíce (místo systémového kalendáře). volby: {r, m, d, jenMesic, znameni}, hotovo(r, m, d).
   *  Klepnutí na den rovnou potvrdí; když člověk jen listuje měsíci, potvrdí tlačítkem Potvrdit (den zůstává vybraný).
   *  Klepnutím na název měsíce se ukáže mřížka měsíců. Rok jde přepsat, dvě číslice doplní na 20xx. */
  function vyber(volby, hotovo) {
    var v = { r: volby.r, m: volby.m, d: volby.d || 1 }, mesice = !!volby.jenMesic, okno = document.createElement('div');
    okno.className = 'vyberZavoj';
    okno.innerHTML = '<div class="vyber" role="dialog" aria-label="' + (volby.jenMesic ? 'Vybrat měsíc' : 'Vybrat datum') + '">' +
      '<div class="vyberRok"><button data-v="r-1" aria-label="Rok zpět">‹</button><input class="prepis" id="vyberRok" type="text" inputmode="numeric" maxlength="4" autocomplete="off" enterkeyhint="done" value="' + v.r + '" aria-label="Rok, klepni a přepiš"><button data-v="r1" aria-label="Rok dál">›</button></div>' +
      '<div class="vyberTelo"></div>' +
      '<div class="vyberPata"><button data-v="dnes">' + (volby.jenMesic ? 'Tento měsíc' : 'Dnes') + '</button><span></span><button data-v="zavri">Zavřít</button><button data-v="ok" class="vyberOk">Potvrdit</button></div></div>';
    var pole = okno.querySelector('#vyberRok'), telo = okno.querySelector('.vyberTelo');
    function rokZPole() {
      var s = pole.value.trim(), r = parseInt(s, 10);
      if (/^\d{1,2}$/.test(s)) r = 2000 + r;
      if (r >= 1 && r <= 9999) v.r = r;
      v.d = Math.min(v.d, new Date(v.r, v.m + 1, 0).getDate());
    }
    function kresliV() {
      if (document.activeElement !== pole) pole.value = v.r;
      var h;
      if (mesice) {
        h = '<div class="vyberMesice">' + MES.map(function (n, i) { return '<button data-m="' + i + '" class="' + (i === v.m ? 'akt' : '') + '">' + n + '</button>'; }).join('') + '</div>';
      } else {
        var dni = new Date(v.r, v.m + 1, 0).getDate(), zn = [], i, d;
        // tropické znamení každého dne (jen pro horoskop): jemně v hlavičce a malou značkou v den, kdy začíná
        if (volby.znameni) for (d = 1; d <= dni; d++) zn[d] = A.den(v.r, v.m + 1, d).trop;
        var pod = '';
        if (volby.znameni) {
          var useky = [];
          for (d = 1; d <= dni; d++) if (d === 1 || zn[d] !== zn[d - 1]) useky.push(d);
          pod = '<small class="vyberZn">' + useky.map(function (od, k) {
            var doo = k + 1 < useky.length ? useky[k + 1] - 1 : dni;
            return A.ZNAKY[zn[od]] + ' ' + A.ZNAMENI[zn[od]] + ' ' + (od === 1 ? 'do ' + doo + '.' : 'od ' + od + '.');
          }).join(' · ') + '</small>';
        }
        h = '<div class="vyberHlava"><button data-v="m-1" aria-label="Měsíc zpět">‹</button><button class="vyberMes" data-v="mesice" aria-label="Vybrat měsíc"><b>' + MES[v.m] + ' <i>▾</i></b>' + pod + '</button><button data-v="m1" aria-label="Měsíc dál">›</button></div><div class="vyberDny">' +
          ['po', 'út', 'st', 'čt', 'pá', 'so', 'ne'].map(function (x) { return '<span>' + x + '</span>'; }).join('');
        var prvni = (new Date(v.r, v.m, 1).getDay() + 6) % 7, tt = dnes();
        for (i = 0; i < prvni; i++) h += '<span></span>';
        for (d = 1; d <= dni; d++) {
          var jeDnes = tt.getFullYear() === v.r && tt.getMonth() === v.m && tt.getDate() === d;
          var zmena = volby.znameni && d > 1 && zn[d] !== zn[d - 1];
          h += '<button data-d="' + d + '" class="' + (d === v.d ? 'akt' : '') + (jeDnes ? ' dnes' : '') + '"' + (zmena ? ' title="Od dneška ' + A.ZNAMENI[zn[d]] + '"' : '') + '>' + d + (zmena ? '<i>' + A.ZNAKY[zn[d]] + '</i>' : '') + '</button>';
        }
        h += '</div>';
      }
      telo.innerHTML = h;
    }
    function hotovy(r, m, d) { okno.remove(); hotovo(r, m, d); }
    okno.addEventListener('click', function (e) {
      e.stopPropagation();
      if (e.target === okno) { okno.remove(); return; }
      var b = e.target.closest('button'); if (!b) return;
      var a = b.getAttribute('data-v');
      rokZPole();
      if (b.hasAttribute('data-m')) {
        v.m = +b.getAttribute('data-m');
        if (volby.jenMesic) { hotovy(v.r, v.m, 1); return; }
        v.d = Math.min(v.d, new Date(v.r, v.m + 1, 0).getDate()); mesice = false; kresliV(); return;
      }
      if (b.hasAttribute('data-d')) { hotovy(v.r, v.m, +b.getAttribute('data-d')); return; }
      if (a === 'zavri') { okno.remove(); return; }
      if (a === 'ok') { hotovy(v.r, v.m, v.d); return; }
      if (a === 'dnes') { var t = dnes(); hotovy(t.getFullYear(), t.getMonth(), t.getDate()); return; }
      if (a === 'mesice') mesice = true;
      if (a === 'r-1' || a === 'r1') { v.r = Math.max(1, Math.min(9999, v.r + (a === 'r1' ? 1 : -1))); pole.value = v.r; }
      if (a === 'm-1' || a === 'm1') { var m = v.m + (a === 'm1' ? 1 : -1); v.r += Math.floor(m / 12); v.m = A.mod(m, 12); pole.value = v.r; }
      v.d = Math.min(v.d, new Date(v.r, v.m + 1, 0).getDate());
      kresliV();
    });
    // rok: čtyři číslice platí hned, dvě se doplní na 20xx po odchodu z pole nebo Enteru
    pole.addEventListener('input', function () { if (/^\d{4}$/.test(pole.value.trim())) { rokZPole(); kresliV(); } });
    pole.addEventListener('change', function (e) { e.stopPropagation(); rokZPole(); pole.value = v.r; kresliV(); });
    pole.addEventListener('keydown', function (e) { if (e.key === 'Enter') pole.blur(); });
    kresliV(); document.body.appendChild(okno);
  }
  window.Vyber = vyber;

  var ABECEDA = 'A B C Č D E F G H CH I J K L M N O P R Ř S Š T U V X Z Ž'.split(' ');
  function kresliHledat(jenVysledky) {
    if (!jenVysledky) {
      obsah.innerHTML = '<div class="hledat"><label class="pole"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
        '<input id="q" type="search" placeholder="Jméno nebo zdrobnělina, třeba Honza" autocomplete="off" autocapitalize="words" value="' + esc(stav.q) + '"></label>' +
        '<div class="filtry"><div class="prepinac" id="fRod"></div><div class="prepinac" id="fRaz"></div></div><button class="sirsi" id="fSirsi" data-akce="fSirsi"></button><div class="pismena" id="fPis"></div></div><div id="vysledky"></div>';
      $('#q').addEventListener('input', function () { stav.q = this.value; kresliHledat(true); });
    }
    $('#fRod').innerHTML = [['', 'Všechna'], ['m', 'Mužská'], ['z', 'Ženská']].map(function (x) { return '<button data-akce="fRod" data-v="' + x[0] + '" class="' + (stav.rod === x[0] ? 'akt' : '') + '">' + x[1] + '</button>'; }).join('');
    $('#fRaz').innerHTML = [['datum', 'Podle dne'], ['abc', 'A–Ž']].map(function (x) { return '<button data-akce="fRaz" data-v="' + x[0] + '" class="' + (stav.razeni === x[0] ? 'akt' : '') + '">' + x[1] + '</button>'; }).join('');
    $('#fPis').innerHTML = ABECEDA.map(function (p) { return '<button data-akce="fPis" data-v="' + p + '" class="' + (stav.pismeno === p ? 'akt' : '') + '">' + p + '</button>'; }).join('');
    $('#fSirsi').innerHTML = '<i class="' + (nast.hledatSirsi ? 'ano' : '') + '"></i>' + (nast.hledatSirsi ? 'I širší kalendář jmen' : 'Jen občanský kalendář');
    var v = hledej(stav.q, stav.rod, stav.pismeno).filter(function (x) { return nast.hledatSirsi || x.e.hl || nast.zeme !== 'cz'; }), h = '';
    var filtrovano = stav.q.trim() || stav.rod || stav.pismeno;
    function radek(x) {
      var e = x.e, k = e.kl[0], pod = [];
      if (x.pres) pod.push(x.pres + ' je ' + e.j);
      if (e.alias) pod.push('slaví jako ' + e.alias);
      if (!e.hl && nast.zeme === 'cz' && k) pod.push('širší kalendář');
      if (e.kl.length > 1) pod.push('také ' + e.kl.slice(1, 4).map(kratce).join(', '));
      if (D.jmena[e.j] && !x.pres && D.jmena[e.j].z.length) pod.push(D.jmena[e.j].z.slice(0, 3).join(', '));
      return '<button data-akce="jmeno" data-j="' + esc(e.j) + '"><span class="hl"><b>' + esc(e.j) + '</b>' + (pod.length ? '<span>' + esc(pod.join(' · ')) + '</span>' : '') + '</span>' +
        '<span class="pr">' + (k ? dlouze(k) : 'bez dne') + '</span></button>';
    }
    if (!filtrovano && stav.razeni === 'datum') {
      // rok zpět a rok dopředu den po dni; otevře se na dnešku, nahoru se jde do minulosti
      var t = dnes(), d = plus(t, -365);
      var posledniM = -1;
      for (var i = -365; i <= 365; i++, d = plus(d, 1)) {
        if (d.getMonth() !== posledniM) { if (posledniM >= 0) h += '</div>'; posledniM = d.getMonth(); h += '<div class="mesicPruh">' + MES[posledniM] + ' ' + d.getFullYear() + '</div><div class="karta radky seznamMesic">'; }
        h += radekDne(d, i === 0 ? 'dnesRadek' : '', !nast.hledatSirsi);
      }
      h += '</div><p class="tlum maly" style="margin:8px 2px">Rok zpět a rok dopředu. Klepni na den nebo piš jméno.</p>';
      stav.naDnes = true;
    } else if (!v.length) {
      h = '<div class="nic">Takové jméno v kalendáři není.<br>Zkus jinou podobu nebo vypni filtr.</div>';
    } else {
      if (stav.razeni === 'datum' && !stav.q.trim()) {
        var t0 = klic(dnes());
        v.sort(function (a, b) { var ka = a.e.kl[0] || '99', kb = b.e.kl[0] || '99'; return ((ka < t0) - (kb < t0)) || (ka < kb ? -1 : ka > kb ? 1 : 0); });
      }
      h = '<p class="tlum maly" style="margin:2px 2px 8px">' + v.length + (v.length === 1 ? ' jméno' : v.length < 5 ? ' jména' : ' jmen') + '</p><div class="karta radky">' + v.slice(0, 400).map(radek).join('') + '</div>' +
        (v.length > 400 ? '<p class="tlum maly">Zobrazeno prvních 400, zpřesni hledání.</p>' : '');
    }
    $('#vysledky').innerHTML = h;
    if (stav.naDnes) {
      stav.naDnes = false;
      var kotva = $('#vysledky .dnesRadek'), pruh = $('.mesicPruh'), hl = $('.hledat');
      if (kotva) obsah.scrollTop = kotva.getBoundingClientRect().top - obsah.getBoundingClientRect().top + obsah.scrollTop - (hl ? hl.offsetHeight : 0) - (pruh ? pruh.offsetHeight : 0) - 8;
    }
  }

  function kresliLide() {
    var h = '';
    if (!Most.maKontakty() || kontaktyStav === 'zakaz') {
      h = '<div class="karta"><div class="vnitrek"><h3 style="font:600 19px var(--patka)">Svátky tvých lidí</h3><p class="tlum" style="margin-top:6px">Appka si přečte kontakty v telefonu, podle křestního jména (i zdrobněliny jako Honza nebo Katka) najde svátek a ukáže, kdo slaví. Kontakty zůstávají v telefonu, nikam se neposílají.</p>' +
        '<button class="tl sirka" data-akce="povolKontakty">Propojit kontakty</button></div></div>';
    } else if (kontaktyStav === 'ceka') {
      h = '<div class="nic">Načítám kontakty…</div>';
    } else {
      var q = norm(stav.lideQ);
      var s = lide.filter(function (c) { return (stav.lideFiltr === 'vse' || nast.oblibeni[c.id]) && (!q || norm(c.jmeno).indexOf(q) >= 0 || norm(c.kal || '').indexOf(q) >= 0); });
      h = (Most.telefon ? '' : '<div class="karta"><div class="vnitrek maly"><b>Ukázka s vymyšlenými lidmi.</b> Kontakty z telefonu načte jen appka pro Android, v prohlížeči to nejde. Ručně přidaný člověk se uloží jen v tomhle prohlížeči.</div></div>') +
        '<div class="hledat"><label class="pole"><svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg><input id="lq" type="search" placeholder="Hledat v lidech" autocomplete="off" value="' + esc(stav.lideQ) + '"></label>' +
        '<div class="filtry"><div class="prepinac"><button data-akce="lideFiltr" data-v="vse" class="' + (stav.lideFiltr === 'vse' ? 'akt' : '') + '">Všichni (' + lide.length + ')</button>' +
        '<button data-akce="lideFiltr" data-v="obl" class="' + (stav.lideFiltr === 'obl' ? 'akt' : '') + '">★ Oblíbení</button></div></div></div><div id="lideSeznam">';
      if (!s.length) h += '<div class="nic">' + (stav.lideFiltr === 'obl' ? 'Zatím žádní oblíbení. Hvězdičkou u člověka si ho přidáš a můžeš dostávat oznámení jen o nich.' : 'Nikdo nenalezen.') + '</div>';
      else h += '<div class="karta radky">' + s.slice(0, 300).map(function (c) { return radekCloveka(c, true); }).join('') + '</div>';
      h += '<button class="tl vedl sirka" data-akce="pridejCloveka">Přidat člověka ručně</button>';
      if (nenalezeni.length && !q) h += '<button class="tl vedl sirka" data-akce="nenalezeni">Kontakty bez svátku (' + nenalezeni.length + ')</button>';
      h += '</div>';
    }
    obsah.innerHTML = h;
    var lq = $('#lq');
    if (lq) lq.addEventListener('input', function () { stav.lideQ = this.value; var p = this.selectionStart; kresliLide(); var n = $('#lq'); n.focus(); n.setSelectionRange(p, p); });
  }

  function kresli() {
    setTimeout(nactiFotky, 0);
    document.querySelectorAll('#lista button').forEach(function (b) { b.classList.toggle('akt', b.dataset.karta === karta); });
    $('#titulek').textContent = { dnes: 'Svátky', kalendar: 'Měsíc', hledat: 'Hledat jméno', hvezdy: 'Horoskop', lide: 'Lidé' }[karta];
    if (karta === 'dnes') kresliDnes();
    else if (karta === 'kalendar') kresliMesic();
    else if (karta === 'hledat') kresliHledat(false);
    else if (karta === 'hvezdy') window.Hvezdy.kresli(obsah, stav);
    else kresliLide();
  }
  function prepni(k) { karta = k; obsah.scrollTop = 0; kresli(); }

  // ---------- spodní listy ----------
  var listy = [];
  function otevriList(fn) { listy.push(fn); ukazList(); }
  function ukazList() {
    var fn = listy[listy.length - 1];
    $('#zavoj').hidden = !fn; $('#list').hidden = !fn;
    if (fn) { $('#listObsah').innerHTML = fn(); setTimeout(function () { nactiFotky($('#listObsah')); }, 0); }
  }
  function prekresliList() { if (listy.length) { var s = $('#listObsah').scrollTop; ukazList(); $('#listObsah').scrollTop = s; } }
  function zavriList() { listy.pop(); ukazList(); if (!listy.length) kresli(); }
  window.zpet = function () {
    if (listy.length) { zavriList(); return true; }
    if (karta !== 'dnes') { prepni('dnes'); return true; }
    if (stav.posun) { stav.posun = 0; kresli(); return true; }
    return false;
  };

  function ik(d) { return '<svg viewBox="0 0 24 24">' + d + '</svg>'; }
  var IK = {
    tel: ik('<path d="M5 4h4l2 5-2.500 1.500a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>'),
    sms: ik('<path d="M4 5h16v11H9l-5 4z"/>'),
    wa: ik('<path d="M3.600 20.400l1.250-4.300a8.600 8.600 0 1 1 3.100 3.050z"/><path d="M9.100 7.900c.4-.4 1-.3 1.200.2l.6 1.400c.1.300 0 .600-.2.800l-.5.500a6 6 0 0 0 2.900 2.900l.5-.5c.2-.2.500-.3.800-.2l1.400.6c.5.2.6.800.2 1.200l-.6.6c-.6.600-1.500.800-2.300.5a8.400 8.400 0 0 1-4.700-4.700c-.3-.8-.1-1.700.5-2.300z"/>'),
    fb: ik('<circle cx="12" cy="12" r="9"/><path d="M13 21v-8h2.500M13 13v-2.500c0-1 .5-1.500 1.500-1.500H16M10.500 13H13"/>'),
    ig: ik('<rect x="4" y="4" width="16" height="16" rx="4.500"/><circle cx="12" cy="12" r="3.500"/><circle cx="16.700" cy="7.300" r=".6"/>'),
    ms: ik('<path d="M12 3.500c-5 0-9 3.700-9 8.300 0 2.600 1.300 4.900 3.300 6.400V21l2.800-1.500c.9.200 1.900.400 2.900.400 5 0 9-3.700 9-8.300s-4-8.100-9-8.100z"/><path d="M7.500 13.500l3-3 2.500 2 3.500-3"/>'),
    tg: ik('<path d="M20.500 4.500L3.500 11l5 2 2 6 3-4 4.500 3.500z"/><path d="M8.500 13l8-6"/>'),
    kon: ik('<circle cx="12" cy="9" r="3.500"/><path d="M5 20c.7-3.500 3.300-5.500 7-5.500s6.300 2 7 5.500"/>'),
    kal: ik('<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M8 3v4M16 3v4M12 13v4M10 15h4"/>'),
    sdil: ik('<circle cx="6" cy="12" r="2.500"/><circle cx="17" cy="6" r="2.500"/><circle cx="17" cy="18" r="2.500"/><path d="M8.200 10.800l6.600-3.600M8.200 13.200l6.600 3.600"/>')
  };
  function cisloProWa(tel) {
    var c = String(tel).replace(/[^\d+]/g, '');
    if (c.indexOf('+') === 0) return c.substr(1);
    if (c.indexOf('00') === 0) return c.substr(2);
    return c.length === 9 ? '420' + c : c;
  }

  function listJmena(j) {
    return function () {
      var e = rejstrik.podle[j] || { j: j, kl: [], r: rod(j) }, info = D.jmena[j], h = '';
      var hlid = nast.hlidana.indexOf(j) >= 0;
      h += '<h2>' + esc(j) + '</h2><div class="pod">' + (e.r === 'z' ? 'ženské jméno' : 'mužské jméno') +
        (e.alias ? ' · v kalendáři jako ' + esc(e.alias) : '') + '</div>';
      if (D.pocty && D.pocty[j]) h += '<div class="karta"><div class="vnitrek pocetJm"><b>' + pocet(j) + '</b><span>' + (D.pocty[j] === 1 ? 'člověk' : D.pocty[j] < 5 ? 'lidé' : 'lidí') + ' v Česku nosí tohle jméno<small>evidence obyvatel MV ČR, stav 2016 (novější čísla ministerstvo nezveřejňuje)</small></span></div></div>';
      if (e.kl.length) {
        h += '<div class="karta radky">';
        e.kl.forEach(function (k, i) {
          var d = pristi(k), n = zaDni(d);
          h += '<button data-akce="den" data-d="' + iso(d) + '"><span class="den"><b>' + zKlice(k).d + '</b><span>' + MES_2P[zKlice(k).m - 1].substr(0, 3) + '</span></span><span class="hl"><b>' + dlouze(k) + '</b><span>' +
            DNY[d.getDay()] + ' · ' + zaText(n) + (k === '02-29' ? ' · jen v přestupném roce' : '') + (i === 0 && e.kl.length > 1 ? ' · hlavní den' : '') + '</span></span></button>';
        });
        h += '</div>';
        var x = zKlice(e.kl[0]), d0 = pristi(e.kl[0]), a = A.den(d0.getFullYear(), x.m, x.d);
        h += '<div class="nadpis">Narozený v den svátku by byl</div><div class="karta"><div class="znam">' +
          '<div><div class="zn">' + A.ZNAKY[a.trop] + '</div><b>' + A.ZNAMENI[a.trop] + '</b><span>tropicky</span></div>' +
          '<div><div class="zn">' + A.ZNAKY[a.sid] + '</div><b>' + A.ZNAMENI[a.sid] + '</b><span>sidericky</span></div>' +
          '<div><div class="zn">✦</div><b>' + a.souhvNazev + '</b><span>IAU</span></div></div></div>';
      } else h += '<div class="karta"><div class="vnitrek tlum">Tohle jméno nemá v kalendáři vlastní den.</div></div>';
      if (info) {
        h += '<div class="karta"><div class="vnitrek"><p class="popis">' + esc(info.p) + '</p>';
        if (info.z.length) h += '<div class="nadpis" style="margin:12px 0 0">Doma se říká</div><div class="stitky">' + info.z.map(function (z) { return '<span>' + esc(z) + '</span>'; }).join('') + '</div>';
        h += '</div></div>';
      }
      var ld = lide.filter(function (c) { return c.kal === j; });
      if (ld.length) h += '<div class="nadpis">Tví lidé s tímhle jménem</div><div class="karta radky">' + ld.map(function (c) { return radekCloveka(c, false); }).join('') + '</div>';
      h += '<div class="karta"><div class="volba"><div>Hlídat tohle jméno<small>V den svátku přijde oznámení</small></div><button class="vyp' + (hlid ? ' ano' : '') + '" data-akce="hlidat" data-j="' + esc(j) + '"></button></div></div>';
      return h;
    };
  }
  function listDne(d) { return function () { return htmlDne(d, true); }; }

  var hledaniVPriradit = '';
  function listCloveka(id) {
    return function () {
      var c = clovek(id); if (!c) return '<p class="nic">Kontakt nenalezen.</p>';
      var tel = c.tel[0], h = '';
      h += '<div style="display:flex;align-items:center;gap:12px">' + avatar(c, true) + '<div style="flex:1;min-width:0"><h2>' + esc(c.jmeno) + '</h2><div class="pod">' +
        (c.k ? 'svátek ' + dlouze(c.k) + ' (' + esc(c.kal || 'vlastní den') + '), ' + zaText(zaDni(pristi(c.k))) : 'svátek nenalezen') + (c.nk ? '<br>narozeniny ' + dlouze(c.nk) + (c.nrok ? ' ' + c.nrok : '') + ', ' + zaText(c.nza) + (c.narOdhad ? ' (podle přání)' : '') : '') + (c.zeSiti ? '<br>není v kontaktech, znám ze sítí' : '') + '</div></div>' +
        '<button class="hvezda' + (nast.oblibeni[c.id] ? ' ano' : '') + '" data-akce="hvezda" data-id="' + esc(c.id) + '" aria-label="Oblíbený">★</button></div>';
      h += '<div class="akce">' +
        (tel ? '<button data-akce="volat" data-id="' + esc(id) + '">' + IK.tel + 'Zavolat</button><button data-akce="sms" data-id="' + esc(id) + '">' + IK.sms + 'SMS</button><button data-akce="wa" data-id="' + esc(id) + '">' + IK.wa + 'WhatsApp</button>' : '') +
        (c.fb || c.chat.ms ? '<button data-akce="ms" data-id="' + esc(id) + '">' + IK.ms + 'Messenger</button>' : '') +
        '<button data-akce="fb" data-id="' + esc(id) + '">' + IK.fb + 'Facebook</button><button data-akce="ig" data-id="' + esc(id) + '">' + IK.ig + 'Instagram</button>' +
        (c.chat.tg ? '<button data-akce="chat" data-kde="tg" data-id="' + esc(id) + '">' + IK.tg + 'Telegram</button>' : '') +
        (c.chat.sg ? '<button data-akce="chat" data-kde="sg" data-id="' + esc(id) + '">' + IK.sms + 'Signal</button>' : '') +
        (c.rucni || c.zeSiti ? '' : '<button data-akce="kontakt" data-id="' + esc(id) + '">' + IK.kon + 'Kontakt</button>') +
        '<button data-akce="sdilejPrani" data-id="' + esc(id) + '">' + IK.sdil + 'Jinam</button>' +
        (c.k && !c.rucni && !c.zeSiti && !c.vKontaktu ? '<button data-akce="zapis" data-id="' + esc(id) + '">' + IK.kal + 'Do kontaktu</button>' : '') + '</div>';
      if (c.nk && c.k) h += '<div class="prepinac" style="margin:12px 0 0"><button data-akce="druh" data-v="svatek" data-id="' + esc(id) + '" class="' + (druhPrani(c) === 'svatek' ? 'akt' : '') + '">K svátku</button>' +
        '<button data-akce="druh" data-v="nar" data-id="' + esc(id) + '" class="' + (druhPrani(c) === 'nar' ? 'akt' : '') + '">K narozeninám 🎂</button></div>';
      h += '<div class="praniText">„' + esc(praniPro(c)) + '“</div>';
      h += '<p class="tlum maly" style="margin-top:6px">SMS a WhatsApp se otevřou s tímhle přáním, u Messengeru, Facebooku a Instagramu je ve schránce, stačí vložit. Odešleš ho sám. ' +
        (c.fb && c.ig ? 'Facebook otevře profil, kde napíšeš na zeď, Instagram rovnou profil.' : c.fb ? 'Facebook otevře profil, kde napíšeš na zeď, Instagram hledání jména.' : c.ig ? 'Instagram otevře rovnou profil, Facebook hledání jména.' : 'Facebook a Instagram otevřou hledání jména, dokud níž neuložíš profil.') +
        (c.k && !c.rucni && !c.zeSiti && !c.vKontaktu ? ' Do kontaktu zapíše svátek jako událost, uvidíš ho pak i v kalendáři telefonu.' : '') + '</p>';
      var hi = praniCloveka(c);
      h += '<div class="nadpis">Co jsi přál</div>';
      if (hi.length) h += '<div class="karta radky praniHist">' + hi.slice(0, 10).map(function (x) {
        var p = x.d.split('-');
        return '<div><span class="den"><b>' + p[0] + '</b><span>' + (+p[2]) + '. ' + (+p[1]) + '.</span></span><span class="hl"><b>' + esc(KANAL[x.kde] || x.kde) + (x.druh === 'nar' ? ' · k narozeninám' : '') + (x.appka ? ' · z appky' : '') + '</b><span class="cely">' + esc(x.t) + '</span></span></div>';
      }).join('') + '</div>';
      else h += '<div class="karta"><div class="vnitrek tlum maly">Zatím nic. ' + (site ? 'Ve zprávách jsem přání k svátku ani k narozeninám nenašel.' : 'Zprávy z PC v telefonu nejsou.') + ' Až budeš přát přes appku, zapíše se sem den a kam.</div></div>';
      if (c.sit && c.sit.kanaly) {
        var kn = Object.keys(c.sit.kanaly).sort(function (a, b) { return c.sit.kanaly[b].n - c.sit.kanaly[a].n; });
        h += '<p class="tlum maly" style="margin:8px 2px 0">Píšete si: ' + kn.map(function (k) { var x = c.sit.kanaly[k]; return esc(KANAL[k] || k) + ' ' + pocet0(x.n) + ' zpráv (naposledy ' + (+x.do.substr(8, 2)) + '. ' + (+x.do.substr(5, 2)) + '. ' + x.do.substr(0, 4) + ')'; }).join(', ') +
          (c.sit.vzajemne ? '. Na Instagramu se sledujete navzájem.' : '.') + '</p>';
      }
      var ul = nast.site[c.id] || {};
      h += '<div class="nadpis">Profily na sítích</div>' +
        '<label class="pole">' + IK.ig + '<input data-sit="ig" data-id="' + esc(id) + '" type="text" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Instagram: jméno nebo odkaz" value="' + esc(ul.ig || c.ig) + '"></label>' +
        '<label class="pole" style="margin-top:8px">' + IK.fb + '<input data-sit="fb" data-id="' + esc(id) + '" type="text" inputmode="url" autocapitalize="off" autocomplete="off" spellcheck="false" placeholder="Facebook: jméno nebo odkaz" value="' + esc(ul.fb || c.fb) + '"></label>' +
        '<p class="tlum maly" style="margin-top:8px">Stačí vložit odkaz zkopírovaný z profilu (v appce Sdílet profil, Kopírovat odkaz). Zůstane jen v telefonu.</p>';
      if (c.nar) {
        var m = /(\d{4})?-?-?(\d\d)-(\d\d)$/.exec(c.nar);
        if (m) {
          var r = m[1] ? +m[1] : dnes().getFullYear(), a = A.den(r, +m[2], +m[3]);
          h += '<div class="nadpis">Podle narozenin ' + (+m[3]) + '. ' + (+m[2]) + '.' + (m[1] ? ' ' + m[1] : '') + '</div><div class="karta"><div class="znam">' +
            '<div><div class="zn">' + A.ZNAKY[a.trop] + '</div><b>' + A.ZNAMENI[a.trop] + '</b><span>tropicky</span></div>' +
            '<div><div class="zn">' + A.ZNAKY[a.sid] + '</div><b>' + A.ZNAMENI[a.sid] + '</b><span>sidericky</span></div>';
          if (m[1]) { var cr = A.cinskyRokData(D.cny, r, +m[2], +m[3]); h += '<div><div class="zn">' + pecet(cr) + '</div><b>' + cr.nazev + '</b><span>čínský rok ' + cr.rok + '</span></div>'; }
          else h += '<div><div class="zn">✦</div><b>' + a.souhvNazev + '</b><span>IAU</span></div>';
          h += '</div></div>';
        }
      }
      h += '<div class="nadpis">Narozeniny</div><label class="pole"><input data-nar="' + esc(id) + '" type="text" inputmode="decimal" autocomplete="off" placeholder="Třeba 30. 8. 1996" value="' + esc(nast.nar[id] ? popisNar(nast.nar[id]) : c.nk && !c.narOdhad ? popisNar((c.nrok ? c.nrok + '-' : '') + c.nk) : '') + '"></label>' +
        '<p class="tlum maly" style="margin-top:8px">' + (c.narOdhad ? 'Den jsem odhadl podle toho, kdy jsi přál k narozeninám. Když nesedí, přepiš ho.' : c.nk ? 'Z kontaktu v telefonu, přepsáním ho opravíš jen tady.' : 'Zatím neznám. Napiš den a appka ti je připomene.') + '</p>';
      h += '<div class="nadpis">Slaví jako</div><label class="pole"><input id="priradQ" type="search" placeholder="Jiné jméno z kalendáře" autocomplete="off" value="' + esc(hledaniVPriradit) + '"></label><div id="priradV" class="karta radky" style="margin-top:8px"></div>';
      if (c.rucni) h += '<button class="tl vedl sirka" data-akce="smazRucni" data-id="' + esc(id) + '">Odebrat člověka</button>';
      setTimeout(function () {
        var q = $('#priradQ'); if (!q) return;
        function v() {
          var out = hledaniVPriradit.trim() ? hledej(hledaniVPriradit, '', '').filter(function (x) { return x.e.kl.length; }).slice(0, 6) : [];
          $('#priradV').innerHTML = out.map(function (x) { return x.e.kl.map(function (k) { return '<button data-akce="prirad" data-id="' + esc(id) + '" data-j="' + esc(x.e.j) + '" data-k="' + k + '"><span class="hl"><b>' + esc(x.e.j) + '</b></span><span class="pr">' + dlouze(k) + '</span></button>'; }).join(''); }).join('');
          $('#priradV').hidden = !out.length;
        }
        q.addEventListener('input', function () { hledaniVPriradit = this.value; v(); }); v();
      }, 0);
      return h;
    };
  }
  function listNenalezeni() {
    return function () {
      return '<h2>Bez svátku</h2><div class="pod">U těchto kontaktů jsem jméno v kalendáři nenašel. Klepni a přiřaď ho ručně.</div><div class="karta radky">' +
        nenalezeni.slice(0, 500).map(function (c) { return '<button data-akce="clovek" data-id="' + esc(c.id) + '"><span class="hl"><b>' + esc(c.jmeno) + '</b></span></button>'; }).join('') + '</div>';
    };
  }
  function listPridat() {
    return function () {
      return '<h2>Přidat člověka</h2><div class="pod">Pro někoho, kdo není v kontaktech.</div><label class="pole"><input id="noveJmeno" type="text" placeholder="Jméno a příjmení" autocapitalize="words"></label>' +
        '<button class="tl sirka" data-akce="ulozRucni">Přidat</button>';
    };
  }

  function volbaVyp(popis, pod, cesta, ano) {
    return '<div class="volba"><div>' + popis + (pod ? '<small>' + pod + '</small>' : '') + '</div><button class="vyp' + (ano ? ' ano' : '') + '" data-akce="vyp" data-c="' + cesta + '"></button></div>';
  }
  function volbaVyber(popis, pod, cesta, hodnota, moznosti) {
    return '<div class="volba"><div>' + popis + (pod ? '<small>' + pod + '</small>' : '') + '</div><select data-c="' + cesta + '">' +
      moznosti.map(function (m) { return '<option value="' + m[0] + '"' + (m[0] === hodnota ? ' selected' : '') + '>' + esc(m[1]) + '</option>'; }).join('') + '</select></div>';
  }
  function listNastaveni() {
    return function () {
      var o = nast.ozn, zeme = D.zemeNazvy, h = '<h2>Nastavení</h2><div class="pod"></div>';
      h += '<div class="nadpis">Kalendář</div><div class="karta">' +
        volbaVyber('Země', 'Čí kalendář jmen se používá', 'zeme', nast.zeme, zeme) +
        volbaVyber('Ukázat i druhou zemi', 'Řádek navíc u každého dne', 'druha', nast.druha, [['', 'Ne']].concat(zeme)) +
        volbaVyp('Všechna jména', 'I ta ze širšího kalendáře, ne jen jedno hlavní', 'vse', nast.vse) + '</div>';
      h += '<div class="nadpis">Widget a nadpis dne</div><div class="karta">' +
        volbaVyber('Místo jména ukázat', 'Když na den připadá něco zvláštního', 'widget', nast.widget, [['svatky', 'Státní a jiné svátky'], ['vyznamne', 'I významné dny'], ['jmeno', 'Vždy jméno']]) +
        '<div class="volba"><div>Widget na plochu<small>Čtvereček 1×1: Dnes má svátek a velké jméno</small></div><button class="tl" data-akce="widget">Přidat</button></div></div>';
      h += '<div class="nadpis">Ranní oznámení</div><div class="karta">' +
        volbaVyp('Posílat oznámení', 'Jedno denně, jen když je o čem', 'ozn.zap', o.zap);
      if (o.zap) h +=
        '<div class="volba"><div>V kolik</div><input type="time" data-c="ozn.cas" value="' + esc(o.cas) + '"></div>' +
        volbaVyp('Kdo má dnes svátek', 'Každý den', 'ozn.denne', o.denne) +
        volbaVyp('Státní svátky a významné dny', 'S vysvětlením, co se ten den stalo', 'ozn.statni', o.statni) +
        volbaVyp('Tradice a zvyky', 'Hromnice, čarodějnice, Dušičky, změna času…', 'ozn.zvyky', o.zvyky) +
        volbaVyber('Lidé z kontaktů', 'Když slaví někdo, koho znáš', 'ozn.lide', o.lide, [['oblibeni', 'Jen oblíbení ★'], ['vsichni', 'Všichni'], ['nikdo', 'Nikdo']]) +
        volbaVyp('Hlídaná jména', nast.hlidana.length ? nast.hlidana.join(', ') : 'Zapneš u jména v hledání', 'ozn.jmena', o.jmena);
      h += '</div>';
      h += '<div class="nadpis">Přání</div><div class="karta"><div class="volba"><div style="flex:1">Mužům<input type="text" data-c="praniM" value="' + esc(nast.praniM) + '"></div></div>' +
        '<div class="volba"><div style="flex:1">K narozeninám<input type="text" data-c="praniN" value="' + esc(nast.praniN) + '"></div></div>' +
        '<div class="volba"><div style="flex:1">Ženám<input type="text" data-c="praniZ" value="' + esc(nast.praniZ) + '"><small>Připraví se do SMS a WhatsAppu, do Messengeru, Facebooku a Instagramu přes schránku</small></div></div></div>';
      h += '<div class="nadpis">Lidé</div><div class="karta">' + volbaVyp('Lidé ze sítí', 'I ti, které nemáš v kontaktech, ale píšete si nebo se sledujete', 'zeSiti', nast.zeSiti) + '</div>';
      h += '<p class="tlum maly" style="margin-top:14px">Česká jména: občanský kalendář a širší kalendář jmen z české Wikipedie (' + rejstrikPocet() + ' jmen). Ostatní země: otevřená sada nameday-api. Data z ' + esc(D.sestaveno) + '. Vše běží v telefonu, bez internetu.</p>';
      return h;
    };
  }
  function rejstrikPocet() { var s = {}; Object.keys(D.cz).forEach(function (k) { D.cz[k].h.concat(D.cz[k].v).forEach(function (j) { s[j] = 1; }); }); return Object.keys(s).length; }
  function nastavCestu(c, v) {
    if (c.indexOf('ozn.') === 0) nast.ozn[c.substr(4)] = v; else nast[c] = v;
    if (c === 'zeme' || c === 'zeSiti') { postavRejstrik(); prepocitejLidi(); }
    if (c === 'ozn.zap' && v && !Most.maOznameni()) Most.zadejOznameni();
    uloz();
  }

  // ---------- události ----------
  /** Otevře chat s přáním: u sítí bez předvyplnění dá přání do schránky. Zapíše, kam jsem přál. */
  function prej(c, kde, url, doSchranky) {
    var t = praniPro(c);
    if (doSchranky) { Most.schranka(t); hlaska('Přání je ve schránce, stačí vložit'); }
    zapisPrani(c, kde, t);
    if (url) Most.otevri(url);
  }
  var AKCE = {
    posun: function (e) { stav.posun += +e.dataset.o; kresli(); },
    posunDnes: function () { stav.posun = 0; kresli(); },
    doKalendare: function () { stav.q = ''; stav.rod = ''; stav.pismeno = ''; stav.razeni = 'datum'; prepni('hledat'); },
    svetVse: function () { var s = obsah.scrollTop; stav.svetVse = !stav.svetVse; kresli(); obsah.scrollTop = s; },
    jmeno: function (e) { otevriList(listJmena(e.dataset.j)); },
    den: function (e) { var p = e.dataset.d.split('-'); otevriList(listDne(new Date(+p[0], +p[1] - 1, +p[2]))); },
    hvezdy: function (e) { listy = []; ukazList(); stav.hv = e.dataset.hv; prepni('hvezdy'); },
    mesic: function (e) { jedMesic(+e.dataset.o); },
    mesicDnes: function () { stav.mesic = null; kresli(); },
    mesicVzhled: function (e) { nast.mesic = e.dataset.v; uloz(); kresli(); },
    fRod: function (e) { stav.rod = e.dataset.v; kresliHledat(true); },
    fRaz: function (e) { stav.razeni = e.dataset.v; kresliHledat(true); },
    fPis: function (e) { stav.pismeno = stav.pismeno === e.dataset.v ? '' : e.dataset.v; kresliHledat(true); },
    clovek: function (e) { hledaniVPriradit = ''; otevriList(listCloveka(e.dataset.id)); },
    hvezda: function (e) {
      var id = e.dataset.id; if (nast.oblibeni[id]) delete nast.oblibeni[id]; else nast.oblibeni[id] = 1;
      uloz(); e.classList.toggle('ano', !!nast.oblibeni[id]);
      if (!listy.length && karta === 'lide' && stav.lideFiltr === 'obl') kresli();
    },
    hlidat: function (e) { var j = e.dataset.j, i = nast.hlidana.indexOf(j); if (i >= 0) nast.hlidana.splice(i, 1); else nast.hlidana.push(j); uloz(); e.classList.toggle('ano', i < 0); },
    lideFiltr: function (e) { stav.lideFiltr = e.dataset.v; kresli(); },
    povolKontakty: function () { if (N) N.zadejKontakty(); else window.poPovoleni('kontakty', true); },
    nenalezeni: function () { otevriList(listNenalezeni()); },
    pridejCloveka: function () { otevriList(listPridat()); },
    ulozRucni: function () {
      var j = ($('#noveJmeno').value || '').trim(); if (!j) return;
      var id = 'r' + Date.now(); nast.rucni.push({ id: id, jmeno: j, krestni: '', tel: [], rucni: true }); nast.oblibeni[id] = 1;
      uloz(); prepocitejLidi(); listy.pop(); hledaniVPriradit = ''; otevriList(listCloveka(id));
    },
    smazRucni: function (e) { nast.rucni = nast.rucni.filter(function (c) { return c.id !== e.dataset.id; }); delete nast.oblibeni[e.dataset.id]; uloz(); prepocitejLidi(); zavriList(); },
    prirad: function (e) { nast.prirazeni[e.dataset.id] = { j: e.dataset.j, k: e.dataset.k }; hledaniVPriradit = ''; uloz(); prepocitejLidi(); prekresliList(); hlaska('Slaví jako ' + e.dataset.j + ', ' + dlouze(e.dataset.k)); },
    volat: function (e) { Most.volat(clovek(e.dataset.id).tel[0]); },
    sms: function (e) { var c = clovek(e.dataset.id); zapisPrani(c, 'sms', praniPro(c)); Most.sms(c.tel[0], praniPro(c)); },
    wa: function (e) { var c = clovek(e.dataset.id); prej(c, 'wa', 'https://wa.me/' + cisloProWa(c.tel[0]) + '?text=' + encodeURIComponent(praniPro(c))); },
    fb: function (e) { var c = clovek(e.dataset.id); prej(c, 'fb', c.fb ? fbOdkaz(c.fb) : 'https://www.facebook.com/search/people/?q=' + encodeURIComponent(c.jmeno), true); },
    ig: function (e) { var c = clovek(e.dataset.id); prej(c, 'ig', c.ig ? 'https://www.instagram.com/' + c.ig + '/' : 'https://www.instagram.com/explore/search/keyword/?q=' + encodeURIComponent(c.jmeno), true); },
    ms: function (e) { var c = clovek(e.dataset.id); if (c.fb) prej(c, 'ms', 'https://m.me/' + c.fb, true); else { prej(c, 'ms', '', true); Most.chat('ms', c.chat.ms); } },
    chat: function (e) { var c = clovek(e.dataset.id); prej(c, e.dataset.kde, '', true); Most.chat(e.dataset.kde, c.chat[e.dataset.kde]); },
    kontakt: function (e) { Most.kontakt(e.dataset.id); },
    sdilejPrani: function (e) { var c = clovek(e.dataset.id); zapisPrani(c, 'jinam', praniPro(c)); Most.sdilej(praniPro(c)); },
    druh: function (e) { (stav.druh || (stav.druh = {}))[e.dataset.id] = e.dataset.v; prekresliList(); },
    pocty: function () { stav.pocty = !stav.pocty; var s = obsah.scrollTop; if (listy.length) prekresliList(); else { kresli(); obsah.scrollTop = s; } },
    fSirsi: function () { nast.hledatSirsi = !nast.hledatSirsi; uloz(); kresliHledat(true); },
    vyberMesic: function () { vyber({ r: stav.mesic.r, m: stav.mesic.m, jenMesic: true }, function (r, m) { stav.jizda = (r * 12 + m) >= (stav.mesic.r * 12 + stav.mesic.m) ? 'dolu' : 'nahoru'; stav.mesic = { r: r, m: m }; kresliMesic(); }); },
    zapis: function (e) { var c = clovek(e.dataset.id); Most.zapisSvatek(c.id, c.k); },
    widget: function () { Most.widget(); },
    nastaveni: function () { otevriList(listNastaveni()); },
    vyp: function (e) { var c = e.dataset.c, v = c.indexOf('ozn.') === 0 ? !nast.ozn[c.substr(4)] : !nast[c]; nastavCestu(c, v); prekresliList(); }
  };
  document.addEventListener('click', function (ev) {
    var e = ev.target.closest('[data-akce]');
    if (e) { ev.preventDefault(); AKCE[e.dataset.akce](e); return; }
    var k = ev.target.closest('#lista button');
    if (k) { if (k.dataset.karta === 'dnes') stav.posun = 0; prepni(k.dataset.karta); }
  });
  document.addEventListener('change', function (ev) {
    var e = ev.target;
    if (e.dataset && e.dataset.sit) {
      var sit = e.dataset.sit, kdo = e.dataset.id, t = e.value.trim(), j = sit === 'ig' ? igJmeno(t) : fbJmeno(t);
      if (t && !j) { hlaska('Tohle nevypadá jako ' + (sit === 'ig' ? 'instagramový' : 'facebookový') + ' profil'); return; }
      var z = nast.site[kdo] || (nast.site[kdo] = {});
      if (j) z[sit] = j; else delete z[sit];
      if (!z.ig && !z.fb) delete nast.site[kdo];
      uloz(); prepocitejLidi(); prekresliList(); hlaska(j ? 'Profil uložen' : 'Profil odebrán');
      return;
    }
    if (e.dataset && e.dataset.nar) {
      var kdo = e.dataset.nar, v = e.value.trim(), m = /^(\d{1,2})\s*[.\/ -]\s*(\d{1,2})\s*\.?\s*(?:[.\/ -]?\s*(\d{4}))?\s*\.?$/.exec(v);
      if (!v) delete nast.nar[kdo];
      else if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) nast.nar[kdo] = (m[3] ? m[3] + '-' : '') + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2);
      else { hlaska('Napiš den jako 30. 8. nebo 30. 8. 1996'); return; }
      uloz(); prepocitejLidi(); prekresliList(); naplanujPlan(); hlaska(v ? 'Narozeniny uloženy' : 'Narozeniny odebrány');
      return;
    }
    if (e.dataset && e.dataset.c) { nastavCestu(e.dataset.c, e.value); if (e.tagName === 'SELECT') prekresliList(); }
  });
  $('#zavoj').addEventListener('click', function () { listy = []; ukazList(); kresli(); });
  $('#listUchyt').addEventListener('click', zavriList);
  $('#btnNastaveni').addEventListener('click', AKCE.nastaveni);
  // z oznámení nebo widgetu: otevřít dnešek
  window.naDnesek = function () { listy = []; ukazList(); stav.posun = 0; prepni('dnes'); };
  // přes půlnoc a po návratu do appky
  var posledniDen = iso(dnes());
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) return;
    if (iso(dnes()) !== posledniDen) { posledniDen = iso(dnes()); prepocitejLidi(); naplanujPlan(); kresli(); }
    if (Most.maKontakty() && kontaktyStav !== 'ceka') { nactiSite(); Most.nactiKontakty(); }
  });

  window.Svatky = { infoDne: infoDne, hledej: hledej, najdiJmeno: najdiJmeno, nast: nast, kresli: kresli, prepni: prepni, oznameniDne: oznameniDne, ulozPlan: ulozPlan, dlouze: dlouze, MES: MES, MES_2P: MES_2P, esc: esc };
  postavRejstrik();
  nactiSite();
  prepocitejLidi();
  // index.html#kalendar, #hledat, #hvezdy, #cina, #lide: rovnou na kartu (náhledy a makety)
  var kotva = location.hash.replace('#', '');
  if (kotva === 'cina') { karta = 'hvezdy'; stav.hv = 'cina'; }
  else if (['kalendar', 'hledat', 'hvezdy', 'lide'].indexOf(kotva) >= 0) karta = kotva;
  kresli();
  if (Most.maKontakty()) Most.nactiKontakty(); else kontaktyStav = 'zakaz';
  naplanujPlan();
})();
