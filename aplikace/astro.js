/* Výpočty: Slunce na ekliptice, tři zvěrokruhy, čínský kalendář, Velikonoce.
   Bez závislostí, používá app.js i testy (tools/test.mjs). */
(function (svet) {
  'use strict';

  var ZNAMENI = ['Beran', 'Býk', 'Blíženci', 'Rak', 'Lev', 'Panna', 'Váhy', 'Štír', 'Střelec', 'Kozoroh', 'Vodnář', 'Ryby'];
  var ZNAKY = ['♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐', '♑', '♒', '♓'].map(function (z) { return z + '︎'; });
  // Kde Slunce vstupuje do skutečného souhvězdí (hranice IAU), ekliptikální délka pro rok 2000
  var SOUHVEZDI = [
    { n: 'Ryby', od: 351.65, z: 11, h: 'Alrescha' },
    { n: 'Beran', od: 28.69, z: 0, h: 'Hamal' },
    { n: 'Býk', od: 53.42, z: 1, h: 'Aldebaran a Plejády' },
    { n: 'Blíženci', od: 90.14, z: 2, h: 'Castor a Pollux' },
    { n: 'Rak', od: 117.99, z: 3, h: 'hvězdokupa Jesličky' },
    { n: 'Lev', od: 138.04, z: 4, h: 'Regulus' },
    { n: 'Panna', od: 173.85, z: 5, h: 'Spica' },
    { n: 'Váhy', od: 217.81, z: 6, h: 'Zubenelgenubi' },
    { n: 'Štír', od: 241.05, z: 7, h: 'Antares' },
    { n: 'Hadonoš', od: 247.64, z: 12, h: 'Rasalhague' },
    { n: 'Střelec', od: 266.24, z: 8, h: 'Kaus Australis' },
    { n: 'Kozoroh', od: 299.66, z: 9, h: 'Deneb Algedi' },
    { n: 'Vodnář', od: 327.49, z: 10, h: 'Sadalsuud' }
  ];
  var PRECESE = 0.013969;          // stupňů za rok

  function mod(a, n) { return ((a % n) + n) % n; }

  /** Juliánské datum pro poledne UTC daného dne. */
  function jd(rok, mes, den) {
    return Date.UTC(rok, mes - 1, den, 12) / 86400000 + 2440587.5;
  }

  /** Zdánlivá ekliptikální délka Slunce ve stupních (Meeus, nízká přesnost, chyba do 0,01°). */
  function slunce(jdn) {
    var T = (jdn - 2451545.0) / 36525;
    var L0 = 280.46646 + 36000.76983 * T + 0.0003032 * T * T;
    var M = (357.52911 + 35999.05029 * T - 0.0001537 * T * T) * Math.PI / 180;
    var C = (1.914602 - 0.004817 * T - 0.000014 * T * T) * Math.sin(M) +
      (0.019993 - 0.000101 * T) * Math.sin(2 * M) + 0.000289 * Math.sin(3 * M);
    var om = (125.04 - 1934.136 * T) * Math.PI / 180;
    return mod(L0 + C - 0.00569 - 0.00478 * Math.sin(om), 360);
  }

  /** Posun siderického zvěrokruhu proti tropickému (ajanámša Lahiri), stupně. */
  function ajanamsa(rok) { return 23.853 + PRECESE * (rok - 2000); }

  function tropicke(delka) { return Math.floor(mod(delka, 360) / 30); }
  function sidericke(delka, rok) { return Math.floor(mod(delka - ajanamsa(rok), 360) / 30); }

  /** Hranice souhvězdí posunuté precesí do daného roku; seřazené od Ryb. */
  function hraniceSouhvezdi(rok) {
    return SOUHVEZDI.map(function (s) {
      return { n: s.n, z: s.z, h: s.h, od: mod(s.od + PRECESE * (rok - 2000), 360) };
    });
  }
  /** Index do SOUHVEZDI, ve kterém je Slunce. */
  function souhvezdi(delka, rok) {
    var h = hraniceSouhvezdi(rok), d = mod(delka, 360), vys = 0;
    // Ryby začínají kolem 352° a přetahují přes 0°
    for (var i = 1; i < h.length; i++) if (d >= h[i].od) vys = i;
    if (d >= h[0].od) vys = 0;
    return vys;
  }

  /** Všechno o jednom dni najednou. */
  function den(rok, mes, d) {
    var l = slunce(jd(rok, mes, d));
    var s = souhvezdi(l, rok);
    return { delka: l, trop: tropicke(l), sid: sidericke(l, rok), souhv: s, souhvNazev: SOUHVEZDI[s].n };
  }

  /** Délky Slunce pro každý den roku: [{m, d, delka}]. */
  function rokDelky(rok) {
    var out = [], dt = new Date(Date.UTC(rok, 0, 1, 12));
    while (dt.getUTCFullYear() === rok) {
      out.push({ m: dt.getUTCMonth() + 1, d: dt.getUTCDate(), delka: slunce(dt.getTime() / 86400000 + 2440587.5) });
      dt.setUTCDate(dt.getUTCDate() + 1);
    }
    return out;
  }

  /** Úseky roku podle soustavy: 'trop' | 'sid' | 'souhv' -> [{i, nazev, od:{m,d}, do:{m,d}, dni}] od prvního vstupu v roce. */
  function useky(rok, soustava) {
    var dny = rokDelky(rok), fn = function (x) {
      return soustava === 'trop' ? tropicke(x.delka) : soustava === 'sid' ? sidericke(x.delka, rok) : souhvezdi(x.delka, rok);
    };
    var bloky = [], akt = null;
    dny.forEach(function (x) {
      var i = fn(x);
      if (!akt || akt.i !== i) { akt = { i: i, od: x, do: x, dni: 0 }; bloky.push(akt); }
      akt.do = x; akt.dni++;
    });
    // úsek přes Nový rok spojit (první a poslední blok mají stejné znamení)
    if (bloky.length > 1 && bloky[0].i === bloky[bloky.length - 1].i) {
      var posl = bloky.pop();
      bloky[0].od = posl.od; bloky[0].dni += posl.dni;
      bloky.push(bloky.shift());
    }
    return bloky.map(function (b) {
      return { i: b.i, nazev: soustava === 'souhv' ? SOUHVEZDI[b.i].n : ZNAMENI[b.i], od: { m: b.od.m, d: b.od.d }, do: { m: b.do.m, d: b.do.d }, dni: b.dni };
    });
  }

  // ---------- čínský kalendář ----------
  var ZVIRATA = ['Krysa', 'Buvol', 'Tygr', 'Králík', 'Drak', 'Had', 'Kůň', 'Koza', 'Opice', 'Kohout', 'Pes', 'Prase'];
  var ZVIRATA_2P = ['Krysy', 'Buvola', 'Tygra', 'Králíka', 'Draka', 'Hada', 'Koně', 'Kozy', 'Opice', 'Kohouta', 'Psa', 'Prasete'];
  var ZVIRATA_OBR = ['🐀', '🐂', '🐅', '🐇', '🐉', '🐍', '🐎', '🐐', '🐒', '🐓', '🐕', '🐖'];
  // čínské znaky (zjednodušené, jak je píše pevninská Čína): zvířata a pět živlů
  var ZVIRATA_ZNAK = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
  var ZIVLY_ZNAK = ['木', '火', '土', '金', '水'];
  var ZIVLY_OBR = ['🌳', '🔥', '⛰️', '🪙', '💧'];
  /** Jak ukazovat zvířata v čínském kalendáři: 'emoji' (výchozí), nebo 'znaky' (pečeť s čínským znakem). */
  function cinaStyl(novy) {
    try { if (novy) localStorage.setItem('svatky.cinaStyl', novy); return localStorage.getItem('svatky.cinaStyl') === 'znaky' ? 'znaky' : 'emoji'; } catch (e) { return novy || 'emoji'; }
  }
  function cinaObr(styl) { return styl === 'znaky' ? { zvire: ZVIRATA_ZNAK, zivel: ZIVLY_ZNAK } : { zvire: ZVIRATA_OBR, zivel: ZIVLY_OBR }; }
  var ZIVLY = ['Dřevo', 'Oheň', 'Země', 'Kov', 'Voda'];
  var ZIVLY_PRID_M = ['Dřevěný', 'Ohnivý', 'Zemský', 'Kovový', 'Vodní'];
  var ZIVLY_PRID_Z = ['Dřevěná', 'Ohnivá', 'Zemská', 'Kovová', 'Vodní'];
  var ZVIRE_ROD = ['z', 'm', 'm', 'm', 'm', 'm', 'm', 'z', 'z', 'm', 'm', 'n'];

  function cinskyRok(rok) {
    var zv = mod(rok - 4, 12), kmen = mod(rok - 4, 10), ziv = Math.floor(kmen / 2);
    var prid = ZVIRE_ROD[zv] === 'z' ? ZIVLY_PRID_Z[ziv] : ZVIRE_ROD[zv] === 'n' ? ZIVLY_PRID_M[ziv].replace(/ý$/, 'é') : ZIVLY_PRID_M[ziv];
    return {
      rok: rok, zvire: zv, zivel: ziv, jang: kmen % 2 === 0, poradi: mod(rok - 4, 60) + 1,
      nazev: prid + ' ' + ZVIRATA[zv], zvireNazev: ZVIRATA[zv], zivelNazev: ZIVLY[ziv]
    };
  }
  /** Čínský nový rok v daném gregoriánském roce z tabulky "MMDD…" od roku 1900; mimo tabulku null. */
  function cny(tab, rok) {
    if (!tab || rok < 1900 || rok > 2100) return null;
    var s = tab.substr((rok - 1900) * 4, 4);
    return { m: +s.substr(0, 2), d: +s.substr(2, 2) };
  }
  /** Čínský rok, do kterého patří datum (před čínským novým rokem ještě předchozí). */
  function cinskyRokData(tab, rok, mes, den) {
    var n = cny(tab, rok);
    if (n && (mes < n.m || (mes === n.m && den < n.d))) return cinskyRok(rok - 1);
    return cinskyRok(rok);
  }

  // ---------- pohyblivé dny ----------
  /** Velikonoční neděle (gregoriánský kalendář) -> {m, d}. */
  function velikonoce(rok) {
    var a = rok % 19, b = Math.floor(rok / 100), c = rok % 100, d = Math.floor(b / 4), e = b % 4;
    var f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
    var i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
    var mes = Math.floor((h + l - 7 * m + 114) / 31), den = ((h + l - 7 * m + 114) % 31) + 1;
    return { m: mes, d: den };
  }
  /** n-tý den v týdnu (0 = neděle) v měsíci; n = -1 poslední. */
  function ntyDen(rok, mes, denTydne, n) {
    if (n > 0) {
      var prvni = new Date(rok, mes - 1, 1).getDay();
      return 1 + mod(denTydne - prvni, 7) + (n - 1) * 7;
    }
    var posl = new Date(rok, mes, 0);
    return posl.getDate() - mod(posl.getDay() - denTydne, 7);
  }

  svet.Astro = {
    ZNAMENI: ZNAMENI, ZNAKY: ZNAKY, SOUHVEZDI: SOUHVEZDI, ZVIRATA: ZVIRATA, ZVIRATA_2P: ZVIRATA_2P,
    ZVIRATA_OBR: ZVIRATA_OBR, ZVIRATA_ZNAK: ZVIRATA_ZNAK, ZIVLY_ZNAK: ZIVLY_ZNAK, ZIVLY_OBR: ZIVLY_OBR, cinaStyl: cinaStyl, cinaObr: cinaObr, ZIVLY: ZIVLY, mod: mod, jd: jd, slunce: slunce, ajanamsa: ajanamsa,
    tropicke: tropicke, sidericke: sidericke, souhvezdi: souhvezdi, hraniceSouhvezdi: hraniceSouhvezdi,
    den: den, rokDelky: rokDelky, useky: useky, cinskyRok: cinskyRok, cny: cny, cinskyRokData: cinskyRokData,
    velikonoce: velikonoce, ntyDen: ntyDen
  };
})(typeof window !== 'undefined' ? window : globalThis);
