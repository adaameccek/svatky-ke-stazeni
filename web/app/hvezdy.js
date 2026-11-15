/* Svátky: karta Horoskop. Kolo se třemi zvěrokruhy (tropický, siderický, skutečná souhvězdí)
   a čínský kalendář. Počítá astro.js, tady se jen kreslí. */
(function () {
  'use strict';
  var A = window.Astro;
  var MES_2P = ['ledna', 'února', 'března', 'dubna', 'května', 'června', 'července', 'srpna', 'září', 'října', 'listopadu', 'prosince'];
  var MES_ZK = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro'];
  var HADONOS = '⛎︎';
  var BARVY = { trop: 'var(--cervena)', sid: 'var(--zlata)', souhv: 'var(--nocni)' };
  var HVEZDY = {
    Ryby: 'Alrescha, arabsky „provaz“: uzel, který svazuje obě ryby k sobě.',
    Beran: 'Hamal, oranžový obr vzdálený asi 66 světelných let.',
    'Býk': 'Aldebaran, červené oko býka, a hned vedle hvězdokupa Plejády (Kuřátka).',
    'Blíženci': 'Castor a Pollux, dvojčata vedle sebe. Pollux je nejbližší obří hvězda, u které známe planetu.',
    Rak: 'Jesličky (M44), hvězdokupa viditelná pouhým okem jako mlhavá skvrna.',
    Lev: 'Regulus, „malý král“. Leží skoro přesně na dráze Slunce.',
    Panna: 'Spica, modrá dvojhvězda. Podle její polohy objevil Hipparchos, že se obloha pomalu stáčí.',
    'Váhy': 'Zubenelgenubi, „jižní klepeto“: Váhy bývaly klepety Štíra.',
    'Štír': 'Antares, „soupeř Marsu“, červený veleobr mnohosetkrát větší než Slunce.',
    'Hadonoš': 'Rasalhague, „hlava zaříkávače hadů“. Třinácté souhvězdí, které astrologie vynechává.',
    'Střelec': 'Kaus Australis. Tímhle směrem leží střed naší Galaxie.',
    Kozoroh: 'Deneb Algedi, „ocas kozy“.',
    'Vodnář': 'Sadalsuud, „štěstí šťastných“.'
  };
  var ZIVLY_BARVA = ['#5E8F4E', 'var(--cervena)', 'var(--zlata)', '#8C8F94', 'var(--nocni)'];

  var t = new Date();
  var sel = { r: t.getFullYear(), m: t.getMonth() + 1, d: t.getDate() };
  var crok = null, kolaRok = null, delky = null, kam = null, stavApp = null;
  var SOUSTAVY = ['trop', 'sid', 'souhv'], skryte = {};
  try { skryte = JSON.parse(localStorage.getItem('svatky.hvSkryte') || '{}') || {}; } catch (e) { skryte = {}; }
  function vidim() { return SOUSTAVY.filter(function (s) { return !skryte[s]; }); }
  var DNES_IK = '<svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.500 12a8.500 8.500 0 1 0 2.500-6"/><path d="M3.500 4v4.500H8"/><circle cx="12" cy="12" r="1.600" fill="currentColor" stroke="none"/></svg>';

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function bod(r, uhel, cx) { var a = uhel * Math.PI / 180; return [(cx + r * Math.sin(a)).toFixed(1), (cx - r * Math.cos(a)).toFixed(1)]; }
  /** Výseč mezikruží od úhlu a do b (po směru hodin, 0 nahoře). */
  function vysec(r1, r2, a, b, cx) {
    var velky = A.mod(b - a, 360) > 180 ? 1 : 0, p1 = bod(r2, a, cx), p2 = bod(r2, b, cx), p3 = bod(r1, b, cx), p4 = bod(r1, a, cx);
    return 'M' + p1 + 'A' + r2 + ' ' + r2 + ' 0 ' + velky + ' 1 ' + p2 + 'L' + p3 + 'A' + r1 + ' ' + r1 + ' 0 ' + velky + ' 0 ' + p4 + 'Z';
  }
  function znak(soustava, i) { return soustava === 'souhv' ? (A.SOUHVEZDI[i].z === 12 ? HADONOS : A.ZNAKY[A.SOUHVEZDI[i].z]) : A.ZNAKY[i]; }
  function rozsah(u) { return u ? u.od.d + '. ' + u.od.m + '.–' + u.do.d + '. ' + u.do.m + '.' : ''; }
  function dni(n) { return n + (n === 1 ? ' den' : n < 5 ? ' dny' : ' dní'); }

  // ---------- zvěrokruhy ----------
  function prstenec(soustava, r1, r2, rok) {
    var h = '', seg = [], i;
    if (soustava === 'souhv') {
      var hr = A.hraniceSouhvezdi(rok);
      for (i = 0; i < hr.length; i++) seg.push({ i: i, a: hr[i].od, b: hr[(i + 1) % hr.length].od });
    } else {
      var posun = soustava === 'sid' ? A.ajanamsa(rok) : 0;
      for (i = 0; i < 12; i++) seg.push({ i: i, a: i * 30 + posun, b: i * 30 + 30 + posun });
    }
    seg.forEach(function (s) {
      var sirka = A.mod(s.b - s.a, 360), stred = s.a + sirka / 2, p = bod((r1 + r2) / 2, stred, 200);
      h += '<path class="vys" data-s="' + soustava + '" data-i="' + s.i + '" d="' + vysec(r1, r2, s.a, s.b, 200) + '" fill="' + BARVY[soustava] + '" fill-opacity="' + (s.i % 2 ? '.2' : '.32') + '"/>';
      if (sirka > 11) h += '<text x="' + p[0] + '" y="' + p[1] + '" font-size="15">' + znak(soustava, s.i) + '</text>';
    });
    return h;
  }
  function htmlKolo(rok) {
    var h = '<svg class="kolo" id="hvKolo" viewBox="0 0 400 400" role="img" aria-label="Kolo zvěrokruhů">';
    for (var m = 1; m <= 12; m++) {
      var l1 = A.slunce(A.jd(rok, m, 1)), l15 = A.slunce(A.jd(rok, m, 15)), a = bod(183, l1, 200), b = bod(189, l1, 200), p = bod(193, l15, 200);
      h += '<path d="M' + a + 'L' + b + '" stroke="var(--tlum)" stroke-width="1"/><text x="' + p[0] + '" y="' + p[1] + '" font-size="9" style="fill:var(--tlum)">' + MES_ZK[m - 1] + '</text>';
    }
    var POL = [[151, 181], [118, 148], [85, 115]], vid = vidim(), ID = { trop: 'hvZnT', sid: 'hvZnS', souhv: 'hvZnI' };
    vid.forEach(function (s, k) { h += prstenec(s, POL[k][0], POL[k][1], rok); });
    var vnitr = POL[vid.length - 1][0], paprsky = '';
    for (var k = 0; k < 8; k++) { var u = k * 45 * Math.PI / 180; paprsky += 'M' + (200 + 14 * Math.sin(u)).toFixed(1) + ' ' + (15 - 14 * Math.cos(u)).toFixed(1) + 'L' + (200 + 18.5 * Math.sin(u)).toFixed(1) + ' ' + (15 - 18.5 * Math.cos(u)).toFixed(1); }
    h += '<g id="hvSlunce"><path d="M200 ' + vnitr + 'V34" stroke="var(--zlata)" stroke-width="1.6" stroke-dasharray="1 3.500" stroke-linecap="round"/>' +
      '<circle cx="200" cy="15" r="24" fill="transparent"/>' +
      '<path d="' + paprsky + '" stroke="var(--zlata)" stroke-width="2.200" stroke-linecap="round"/>' +
      '<circle cx="200" cy="15" r="10.500" fill="var(--zlata)" stroke="var(--karta)" stroke-width="2"/></g>';
    var y0 = 200 - (vid.length - 1) * 10;
    h += '<text id="hvDen" x="200" y="' + (y0 - 40) + '" font-size="30" style="font-family:var(--patka);font-weight:700"></text>' +
      '<text id="hvMes" x="200" y="' + (y0 - 22) + '" font-size="11" style="fill:var(--tlum)"></text>';
    vid.forEach(function (s, k) { h += '<text id="' + ID[s] + '" x="200" y="' + (y0 + 5 + k * 20) + '" font-size="14.5" style="fill:' + BARVY[s] + ';font-weight:700"></text>'; });
    h += '</svg>';
    return h;
  }
  function htmlTabulka(rok) {
    var u = { trop: {}, sid: {}, souhv: {} };
    ['trop', 'sid', 'souhv'].forEach(function (s) { A.useky(rok, s).forEach(function (x) { u[s][x.i] = x; }); });
    // stupně: kolik ekliptiky Slunce v znamení urazí (součet denních posunů)
    var dl = A.rokDelky(rok), st = { trop: {}, sid: {}, souhv: {} }, n = dl.length;
    dl.forEach(function (x, k) {
      var krok = A.mod((k + 1 < n ? dl[k + 1].delka : x.delka + 0.9856) - x.delka, 360);
      var i = { trop: A.tropicke(x.delka), sid: A.sidericke(x.delka, rok), souhv: A.souhvezdi(x.delka, rok) };
      ['trop', 'sid', 'souhv'].forEach(function (s) { st[s][i[s]] = (st[s][i[s]] || 0) + krok; });
    });
    function proc(x) { return (Math.round(x * 1000) / 10).toFixed(1).replace('.', ',') + ' %'; }
    function bunka(x, s) {
      return x ? rozsah(x) + '<br><span class="dni">' + dni(x.dni) + '</span><span class="navic">' + proc(x.dni / n) + ' roku · ' + (s === 'souhv' ? Math.round(st[s][x.i]) : 30) + '°</span>' : '<span class="dni">není</span>';
    }
    var h = '<table class="tab"><tr><th>Znamení</th><th>Tropický</th><th>Siderický</th><th>IAU</th></tr>';
    for (var z = 0; z <= 12; z++) {
      var si = -1; A.SOUHVEZDI.forEach(function (s, i) { if (s.z === z) si = i; });
      h += '<tr data-z="' + z + '" data-h="radek"><td><b>' + (z === 12 ? 'Hadonoš' : A.ZNAMENI[z]) + '</b> <i class="sip">▾</i></td><td>' + bunka(z < 12 ? u.trop[z] : null, 'trop') + '</td><td>' + bunka(z < 12 ? u.sid[z] : null, 'sid') + '</td><td>' + bunka(u.souhv[si], 'souhv') + '</td></tr>';
    }
    return { html: h + '</table><p class="tlum maly" style="padding:8px 14px 10px">Klepni na řádek: ukáže, kolik procent roku a kolik stupňů na obloze znamení zabírá. Tropické a siderické má vždy 30°, souhvězdí podle IAU jsou různě velká.</p>', u: u };
  }
  function kresliZver(el) {
    var rok = sel.r, tab = htmlTabulka(rok), so = A.useky(rok, 'souhv').slice().sort(function (a, b) { return b.dni - a.dni; });
    delky = A.rokDelky(rok); kolaRok = rok;
    var shoda = 0, shodaObl = 0, shodaSid = 0, vsechny = 0, tri = [], akt = null;
    delky.forEach(function (x) {
      var tr = A.tropicke(x.delka), sd = A.sidericke(x.delka, rok), si = A.souhvezdi(x.delka, rok), ob = A.SOUHVEZDI[si].z;
      if (tr === sd) shoda++;
      if (tr === ob) shodaObl++;
      if (sd === ob) shodaSid++;
      if (tr === sd && sd === ob) vsechny++;
      if (tr !== sd && sd !== ob && tr !== ob) {
        var klic = tr + '-' + sd + '-' + si;
        if (akt && akt.klic === klic) { akt.do = x; akt.dni++; }
        else { akt = { klic: klic, tr: tr, sd: sd, si: si, od: x, do: x, dni: 1 }; tri.push(akt); }
      } else akt = null;
    });
    // matice: kolik procent roku mají dvě soustavy stejné znamení
    var SOU = [['Tropický', BARVY.trop], ['Siderický', BARVY.sid], ['IAU', BARVY.souhv]], SH = [[0, shoda, shodaObl], [shoda, 0, shodaSid], [shodaObl, shodaSid, 0]];
    // 2×2: řádky Siderický a Tropický, sloupce IAU a Tropický; nahoře vlevo 80 %, pravý dolní roh (Tropický se sebou) prázdný
    var RAD = [1, 0], SLO = [2, 0];
    var htmlMatice = '<div class="nadpis">Kolik mají společného</div><div class="karta"><table class="matice"><tr><th></th>' +
      SLO.map(function (i) { return '<th style="color:' + SOU[i][1] + '">' + SOU[i][0] + '</th>'; }).join('') + '</tr>' +
      RAD.map(function (a) {
        return '<tr><th style="color:' + SOU[a][1] + '">' + SOU[a][0] + '</th>' + SLO.map(function (b) {
          if (a === b) return '<td class="diag"></td>';
          var p = Math.round(SH[a][b] / delky.length * 100);
          return '<td style="--p:' + p + '"><b>' + p + ' %</b><span>' + dni(SH[a][b]) + '</span></td>';
        }).join('') + '</tr>';
      }).join('') + '</table><p class="tlum maly" style="padding:0 14px 12px">Kolik dní v roce ' + rok + ' ukazují dvě soustavy stejné znamení. Všechny tři najednou se shodnou <b>' + dni(vsechny) + '</b> (' + Math.round(vsechny / delky.length * 100) + ' %).</p></div>';
    var dniTri = tri.reduce(function (s, x) { return s + x.dni; }, 0);
    function pr(n) { return Math.round(n / delky.length * 100) + ' %'; }
    var htmlTri = '<div class="nadpis">Kdy jsou všechna tři různá</div><div class="karta"><div class="vnitrek text"><p>V roce ' + rok + ' má člověk tři různá znamení <b>' + dni(dniTri) + '</b> (' + pr(dniTri) + ' roku). Všechna tři stejná vyjdou jen <b>' + dni(vsechny) + '</b> (' + pr(vsechny) + ').</p></div>' +
      '<div class="radky triRadky">' + tri.map(function (x) {
        return '<div><span class="den"><b>' + x.od.d + '. ' + x.od.m + '.</b><span>' + (x.dni > 1 ? 'do ' + x.do.d + '. ' + x.do.m + '.' : '') + '</span></span><span class="hl"><b>' +
          '<i style="color:' + BARVY.trop + '">' + A.ZNAMENI[x.tr] + '</i> · <i style="color:' + BARVY.sid + '">' + A.ZNAMENI[x.sd] + '</i> · <i style="color:' + BARVY.souhv + '">' + A.SOUHVEZDI[x.si].n + '</i></b><span>' + dni(x.dni) + '</span></span></div>';
      }).join('') + '</div><p class="tlum maly" style="padding:8px 14px 10px">Pořadí: tropické · siderické · IAU.</p></div>';
    var posun = A.ajanamsa(rok), zpet = Math.round((2000 - 23.853 / 0.013969) / 10) * 10;
    el.innerHTML += '<div class="datumOvl"><button class="ikona" data-h="den" data-v="-1" aria-label="Den zpět">‹</button><span class="datumPole"><input id="hvDatum" class="prepis" type="text" inputmode="decimal" autocomplete="off" enterkeyhint="done" aria-label="Datum, klepni a přepiš, třeba 24. 12. 1990"><button class="kalBtn" data-h="kal" aria-label="Vybrat v kalendáři"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg></button></span><button class="ikona" data-h="den" data-v="1" aria-label="Den dál">›</button></div>' +
      '<div class="karta"><div class="vnitrek kolemKola" style="padding-bottom:4px"><button class="rohDnes" data-h="dnes" id="hvDnes" aria-label="Zpět na dnešek" title="Zpět na dnešek" hidden>' + DNES_IK + '</button>' + htmlKolo(rok) + '<p class="tlum maly" style="text-align:center;margin:4px 0 8px">' + popisKol() + '</p></div>' +
      '<div class="legenda" id="hvLegenda"></div><p class="tlum maly legendaTip">Podržením řádku soustavu skryješ nebo zase ukážeš.</p></div>' +
      '<div class="nadpis">Proč jsou tři</div><div class="karta"><div class="vnitrek text">' +
      '<p><b>Tropický</b> zvěrokruh používá západní astrologie. Ptolemaios ho ve 2. století přivázal k jarní rovnodennosti, takže Beran začíná vždy 20. nebo 21. března a znamení drží s ročními obdobími, ne s hvězdami.</p>' +
      '<p><b>Siderický</b> zvěrokruh používá indická astrologie a drží se hvězd. Zemská osa se ale pomalu stáčí (o 1° za 72 let, celé kolo za 25 800 let), a tak se oba kruhy rozcházejí: kolem roku ' + zpet + ' se kryly, dnes je mezi nimi ' + posun.toFixed(1).replace('.', ',') + '°, tedy skoro celé znamení.</p>' +
      '<p><b>IAU</b> (Mezinárodní astronomická unie) ukazuje skutečná souhvězdí na obloze. Jsou různě velká. Hranice jim IAU nakreslila v roce 1930 a Slunce jich během roku projde třináct, mezi Štírem a Střelcem ještě Hadonoše.</p></div></div>' +
      '<div class="nadpis">Astrologie, nebo astronomie</div><div class="karta"><div class="vnitrek text">' +
      '<p><b>Astrologie</b> jsou oba vnější kruhy: dvanáct stejně velkých znamení po 30°. Je to výklad, ne měření.</p>' +
      '<p><b>Astronomie</b> je jen vnitřní kruh: kde Slunce skutečně stojí mezi hvězdami. Souhvězdí jsou nestejně velká a je jich třináct.</p>' +
      '<p>Siderický kruh se obloze hodně blíží, protože se drží hvězd, ale totéž to není. Znamení má pořád 30°, kdežto Panna na obloze zabírá 44° a Štír jen 7°. Proto se siderické znamení se souhvězdím shodne <b>' + dni(shodaSid) + '</b> v roce, zbytek ne.</p></div></div>' +
      htmlMatice +
      '<div class="nadpis">V číslech, rok ' + rok + '</div><div class="karta"><div class="vnitrek text">' +
      '<p>Tropické a siderické znamení se shodne jen <b>' + shoda + ' dní</b> v roce. Se skutečným souhvězdím podle IAU sedí tropické znamení <b>' + dni(shodaObl) + '</b> (' + pr(shodaObl) + ' roku), siderické <b>' + dni(shodaSid) + '</b> (' + pr(shodaSid) + ' roku).</p>' +
      '<p>Nejdéle je Slunce v souhvězdí <b>' + so[0].nazev + '</b> (' + dni(so[0].dni) + '), nejkratší dobu ve <b>' + so[so.length - 1].nazev.replace('Štír', 'Štíru') + '</b> (' + dni(so[so.length - 1].dni) + '). V Hadonoši stráví ' + dni((so.filter(function (x) { return x.nazev === 'Hadonoš'; })[0] || { dni: 0 }).dni) + '.</p>' +
      '<p>Tropické i siderické znamení trvá 29 až 32 dní, protože Země obíhá v lednu rychleji než v červenci.</p></div></div>' +
      '<div class="nadpis">Kdy je které znamení</div><div class="karta" style="overflow-x:auto">' + tab.html + '</div>' + htmlTri +
      '<div class="nadpis">Hvězdy, podle kterých je poznáš</div><div class="karta radky">' +
      A.SOUHVEZDI.slice(1).concat(A.SOUHVEZDI.slice(0, 1)).map(function (s) {
        return '<div><span class="den"><b style="font-size:20px">' + (s.z === 12 ? HADONOS : A.ZNAKY[s.z]) + '</b></span><span class="hl"><b>' + s.n + '</b><span style="white-space:normal">' + esc(HVEZDY[s.n]) + '</span></span></div>';
      }).join('') + '</div>';
    kolo.u = tab.u;
    obnovZver();
  }
  var kolo = { u: null };
  function obnovZver() {
    var a = A.den(sel.r, sel.m, sel.d), sl = document.getElementById('hvSlunce');
    if (!sl) return;
    sl.setAttribute('transform', 'rotate(' + a.delka.toFixed(2) + ' 200 200)');
    document.getElementById('hvDen').textContent = sel.d + '.';
    document.getElementById('hvMes').textContent = MES_2P[sel.m - 1] + ' ' + sel.r;
    var pole = document.getElementById('hvDatum');
    if (document.activeElement !== pole) pole.value = popisData();
    var je = { trop: a.trop, sid: a.sid, souhv: a.souhv };
    document.querySelectorAll('#hvKolo .vys').forEach(function (p) {
      var i = +p.getAttribute('data-i'), on = je[p.getAttribute('data-s')] === i;
      p.setAttribute('fill-opacity', on ? '1' : (i % 2 ? '.2' : '.32'));
    });
    var s = A.SOUHVEZDI[a.souhv];
    function text(id, x) { var e = document.getElementById(id); if (e) e.textContent = x; }
    text('hvZnT', A.ZNAKY[a.trop] + ' ' + A.ZNAMENI[a.trop]);
    text('hvZnS', A.ZNAKY[a.sid] + ' ' + A.ZNAMENI[a.sid]);
    text('hvZnI', znak('souhv', a.souhv) + ' ' + s.n);
    function radek(so, nazev, jmeno, u) {
      return '<div data-s="' + so + '" class="' + (skryte[so] ? 'skryta' : '') + '"><i style="background:' + BARVY[so] + '"></i><div class="co">' + nazev + '<small>' + (skryte[so] ? 'Skryto, podrž pro ukázání' : u ? rozsah(u) + ' · ' + dni(u.dni) : '') + '</small></div><b>' + jmeno + '</b></div>';
    }
    document.getElementById('hvLegenda').innerHTML =
      radek('trop', 'Tropický', A.ZNAMENI[a.trop], kolo.u.trop[a.trop]) +
      radek('sid', 'Siderický', A.ZNAMENI[a.sid], kolo.u.sid[a.sid]) +
      radek('souhv', 'IAU (astronomie)', s.n, kolo.u.souhv[a.souhv]);
    document.querySelectorAll('.tab tr[data-z]').forEach(function (tr) { tr.classList.toggle('akt', +tr.getAttribute('data-z') === a.trop); });
    var n = new Date();
    document.getElementById('hvDnes').hidden = sel.r === n.getFullYear() && sel.m === n.getMonth() + 1 && sel.d === n.getDate();
  }
  function popisKol() {
    var vid = vidim(), N = { trop: 'tropický', sid: 'siderický', souhv: 'IAU (skutečná souhvězdí)' };
    if (vid.length === 1) return 'Kruh je ' + N[vid[0]] + '.';
    var P = vid.length === 3 ? ['Vnější kruh je ', ', prostřední ', ', vnitřní '] : ['Vnější kruh je ', ', vnitřní '];
    return vid.map(function (s, k) { return P[k] + N[s]; }).join('') + '.';
  }
  function popisData() { return sel.d + '. ' + sel.m + '. ' + sel.r; }
  function nastavDatum(d) {
    sel = { r: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate() };
    if (sel.r !== kolaRok) kresli(kam, stavApp); else obnovZver();
  }
  function tah(ev) {
    var sv = document.getElementById('hvKolo'), o = sv.getBoundingClientRect();
    var x = ev.clientX - o.left - o.width / 2, y = ev.clientY - o.top - o.height / 2;
    if (Math.sqrt(x * x + y * y) < o.width * 0.12) return;
    var uhel = A.mod(Math.atan2(x, -y) * 180 / Math.PI, 360), nej = null, min = 999;
    delky.forEach(function (z) { var r = Math.abs(A.mod(z.delka - uhel + 180, 360) - 180); if (r < min) { min = r; nej = z; } });
    if (nej && (nej.m !== sel.m || nej.d !== sel.d)) { sel.m = nej.m; sel.d = nej.d; obnovZver(); }
  }

  // ---------- čínský kalendář ----------
  /** Pečeť jako v SVG: čtverec v barvě živlu, uvnitř znak zvířete, v rohu kolečko se znakem živlu. */
  function pecetSvg(cx, cy, s, zvire, zivel) {
    var x = cx - s / 2, y = cy - s / 2, r = s * 0.11, k = s * 0.27, barva = 'var(--z' + zivel + ')';
    if (A.cinaStyl() === 'emoji') {
      return '<rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" rx="' + r + '" fill="' + barva + '" fill-opacity=".16" stroke="' + barva + '" stroke-width="' + s * 0.05 + '"/>' +
        '<text class="emo" x="' + cx + '" y="' + (cy + s * 0.03) + '" font-size="' + s * 0.58 + '">' + A.ZVIRATA_OBR[zvire] + '</text>' +
        '<circle cx="' + (x + s) + '" cy="' + (y + s) + '" r="' + k + '" fill="var(--karta)" stroke="' + barva + '" stroke-width="' + s * 0.05 + '"/>' +
        '<text class="emo" x="' + (x + s) + '" y="' + (y + s + s * 0.01) + '" font-size="' + k * 1.05 + '">' + A.ZIVLY_OBR[zivel] + '</text>';
    }
    return '<rect x="' + x + '" y="' + y + '" width="' + s + '" height="' + s + '" rx="' + r + '" fill="' + barva + '"/>' +
      '<rect x="' + (x + s * 0.06) + '" y="' + (y + s * 0.06) + '" width="' + s * 0.88 + '" height="' + s * 0.88 + '" rx="' + r * 0.7 + '" fill="none" stroke="#FBF4E8" stroke-opacity=".55" stroke-width="' + s * 0.025 + '"/>' +
      '<text class="cina" x="' + cx + '" y="' + (cy + s * 0.02) + '" font-size="' + s * 0.6 + '" style="fill:#FBF4E8">' + A.ZVIRATA_ZNAK[zvire] + '</text>' +
      '<circle cx="' + (x + s) + '" cy="' + (y + s) + '" r="' + k + '" fill="var(--karta)" stroke="' + barva + '" stroke-width="' + s * 0.05 + '"/>' +
      '<text class="cina" x="' + (x + s) + '" y="' + (y + s + s * 0.01) + '" font-size="' + k * 1.1 + '" style="fill:' + barva + '">' + A.ZIVLY_ZNAK[zivel] + '</text>';
  }
  function htmlCinaKolo(c) {
    var h = '<svg class="kolo" viewBox="0 0 400 400" style="touch-action:auto" role="img" aria-label="Kolo dvanácti zvířat">', i, p;
    var emo = A.cinaStyl() === 'emoji', o = A.cinaObr(emo ? 'emoji' : 'znaky'), tr = emo ? 'emo' : 'cina';
    h += '<circle cx="200" cy="200" r="193" fill="none" stroke="var(--linka)" stroke-width="1"/>';
    for (i = 0; i < 12; i++) {
      var on = i === c.zvire;
      p = bod(158, i * 30, 200);
      h += '<path class="vys" data-h="zvire" data-v="' + i + '" d="' + vysec(126, 188, i * 30 - 15, i * 30 + 15, 200) + '" fill="' + (on ? 'var(--z' + c.zivel + ')' : 'var(--linka)') + '" fill-opacity="' + (on ? '1' : i % 2 ? '.45' : '.8') + '"/>' +
        '<text class="' + tr + '" x="' + p[0] + '" y="' + (+p[1] - 6) + '" font-size="' + (emo ? 23 : 25) + '"' + (on ? ' style="fill:#FBF4E8"' : '') + '>' + o.zvire[i] + '</text>' +
        '<text x="' + p[0] + '" y="' + (+p[1] + 17) + '" font-size="8.500" style="fill:' + (on ? '#FBF4E8' : 'var(--tlum)') + ';letter-spacing:.06em">' + A.ZVIRATA[i].toUpperCase() + '</text>';
    }
    var kmen = A.mod(c.rok - 4, 10);
    for (i = 0; i < 10; i++) {
      var zv = Math.floor(i / 2), je = i === kmen;
      p = bod(103, i * 36, 200);
      h += '<path class="vys" d="' + vysec(86, 120, i * 36 - 18, i * 36 + 18, 200) + '" fill="var(--z' + zv + ')" fill-opacity="' + (je ? '1' : i % 2 ? '.16' : '.3') + '"/>' +
        '<text class="' + tr + '" x="' + p[0] + '" y="' + p[1] + '" font-size="' + (emo ? 13 : 14) + '" style="fill:' + (je ? '#FBF4E8' : 'var(--z' + zv + ')') + '">' + o.zivel[zv] + '</text>';
    }
    h += '<circle cx="200" cy="200" r="80" fill="var(--karta)"/>' + pecetSvg(196, 172, 50, c.zvire, c.zivel) +
      '<text x="200" y="222" font-size="14" style="font-family:var(--patka);font-weight:700">' + c.nazev + '</text>' +
      '<text x="200" y="240" font-size="10.500" style="fill:var(--tlum)">' + c.rok + ' · ' + (c.jang ? 'jang' : 'jin') + ' · ' + c.poradi + '. z 60</text></svg>';
    return h;
  }
  function kresliCina(el) {
    var D = window.DATA, n = new Date();
    if (crok === null) crok = A.cinskyRokData(D.cny, n.getFullYear(), n.getMonth() + 1, n.getDate()).rok;
    var c = A.cinskyRok(crok), zac = A.cny(D.cny, crok), dal = A.cny(D.cny, crok + 1), h = '', styl = A.cinaStyl(), o = A.cinaObr(styl);
    h += '<div class="rokOvl"><button data-h="rok" data-v="-1" aria-label="Rok zpět">−</button><input id="hvRok" class="prepis" type="text" inputmode="numeric" maxlength="4" autocomplete="off" enterkeyhint="done" aria-label="Rok, klepni a přepiš" value="' + crok + '"><button data-h="rok" data-v="1" aria-label="Rok dál">+</button></div>';
    h += '<div class="karta"><div class="vnitrek kolemKola" style="padding-bottom:6px">' +
      (crok !== new Date().getFullYear() ? '<button class="rohDnes" data-h="letos" aria-label="Zpět na letošek" title="Zpět na letošek">' + DNES_IK + '</button>' : '') +
      '<button class="stylRoh" data-h="styl" data-s="' + (styl === 'emoji' ? 'znaky' : 'emoji') + '" aria-label="' + (styl === 'emoji' ? 'Ukázat znaky' : 'Ukázat obrázky') + '">' +
      (styl === 'emoji' ? '<b class="cina">' + A.ZVIRATA_ZNAK[4] + '</b>' : A.ZVIRATA_OBR[4]) + '</button>' + htmlCinaKolo(c) + '</div><div class="legenda">';
    if (zac && dal) {
      var konec = new Date(crok + 1, dal.m - 1, dal.d - 1);
      h += '<div><div class="co">Rok ' + A.ZVIRATA_2P[c.zvire] + ' trvá<small>Kdo se narodil dřív, patří ještě k roku ' + A.ZVIRATA_2P[A.mod(c.zvire - 1, 12)] + '</small></div><b style="font-size:14px">' + zac.d + '. ' + zac.m + '. ' + crok + ' – ' + konec.getDate() + '. ' + (konec.getMonth() + 1) + '. ' + konec.getFullYear() + '</b></div>';
    }
    var stejne = [-24, -12, 12, 24].map(function (x) { return crok + x; });
    h += '<div><div class="co">Stejné zvíře<small>Vrací se každých 12 let</small></div><b style="font-size:14px">' + stejne.join(', ') + '</b></div>' +
      '<div><div class="co">Přesně ' + esc(c.nazev) + '<small>Stejné zvíře i živel jednou za 60 let</small></div><b style="font-size:14px">' + (crok - 60) + ' a ' + (crok + 60) + '</b></div></div></div>';
    // mřížka šedesátiletého cyklu
    var start = crok - (c.poradi - 1);
    h += '<div class="cyklusHlava"><button class="ikona" data-h="rok" data-v="-60" aria-label="Předchozí cyklus">‹</button><div><span>Celý cyklus</span><b>' + start + '–' + (start + 59) + '</b></div><button class="ikona" data-h="rok" data-v="60" aria-label="Další cyklus">›</button></div>' +
      '<div class="karta"><div class="vnitrek"><div class="cyklus"><span></span>' +
      o.zvire.map(function (z, i) { return '<span class="zv' + (styl === 'emoji' ? ' emo' : '') + (i === c.zvire ? ' akt' : '') + '" title="' + A.ZVIRATA[i] + '">' + z + '</span>'; }).join('');
    for (var z = 0; z < 5; z++) {
      h += '<span class="zi" style="--z:var(--z' + z + ')"><b' + (styl === 'emoji' ? ' class="emo"' : '') + '>' + o.zivel[z] + '</b>' + A.ZIVLY[z] + '</span>';
      for (var zv = 0; zv < 12; zv++) {
        var rok = null;
        for (var y = start; y < start + 60; y++) { var cy = A.cinskyRok(y); if (cy.zivel === z && cy.zvire === zv) { rok = y; break; } }
        h += rok === null ? '<span></span>' : '<button data-h="rokPrimo" data-v="' + rok + '" style="--z:var(--z' + z + ')" class="' + (rok === crok ? 'akt' : '') + '">' + String(rok).slice(-2) + '</button>';
      }
    }
    h += '</div><p class="tlum maly" style="margin-top:10px">Každý rok se posune zvíře o jedno doprava a po dvou letech živel o řádek níž. Čísla jsou poslední dvě číslice roku. Šipkami nahoře skočíš o 60 let.</p></div></div>';
    h += '<div class="nadpis">Proč zrovna tohle pořadí</div><div class="karta"><div class="vnitrek text">' +
      '<p>Podle pověsti svolal Nefritový císař zvířata k závodu přes řeku a roky rozdal podle toho, jak doběhla. Krysa se svezla na hřbetě Buvola a před cílem mu skočila přes hlavu, proto je první a Buvol druhý.</p>' +
      '<p>Za nimi doplaval silný Tygr, Králík přeskákal po kamenech, Drak se zdržel, protože cestou přivolával lidem déšť. Had se schoval na kopytě Koně a v cíli ho vylekal. Koza, Opice a Kohout přepluli spolu na voru, Pes se cestou koupal a Prase se najedlo a usnulo.</p></div></div>' +
      '<div class="nadpis">Jak se to počítá</div><div class="karta"><div class="vnitrek text">' +
      '<p><b>Zvíře:</b> zbytek po dělení (rok − 4) dvanácti. Pro rok ' + crok + ' vyjde ' + c.zvire + ', což je ' + A.ZVIRATA[c.zvire] + ' (Krysa je 0).</p>' +
      '<p><b>Živel:</b> zbytek po dělení (rok − 4) deseti dává jeden z deseti „nebeských kmenů“. Každý živel má dva roky po sobě, první jang, druhý jin. Pro rok ' + crok + ' vyjde ' + A.mod(crok - 4, 10) + ', tedy ' + c.zivelNazev.toLowerCase() + ' ' + (c.jang ? 'jang' : 'jin') + '.</p>' +
      '<p><b>Proč 60 let:</b> kolo zvířat má 12 dílků, kolo živlů 10. Točí se spolu po jednom dílku a do stejné polohy se vrátí až po 60 krocích (nejmenší společný násobek 12 a 10). Proto existuje jen 60 kombinací ze 120 možných: jangová zvířata se nikdy nepotkají s jinovým rokem.</p>' +
      '<p><b>Začátek roku:</b> čínský Nový rok je druhý nov po zimním slunovratu, někdy mezi 21. lednem a 20. únorem. Kdo se narodil v lednu, patří skoro vždy ještě k předchozímu zvířeti.</p></div></div>';
    el.innerHTML += h;
  }

  // ---------- společné ----------
  function kresli(el, stav) {
    kam = el; stavApp = stav;
    el.innerHTML = '<div class="prepinac"><button data-akce="hvezdy" data-hv="zver" class="' + (stav.hv !== 'cina' ? 'akt' : '') + '">Zvěrokruh</button>' +
      '<button data-akce="hvezdy" data-hv="cina" class="' + (stav.hv === 'cina' ? 'akt' : '') + '">Čínský kalendář</button></div>';
    if (stav.hv === 'cina') kresliCina(el); else kresliZver(el);
  }
  function zmenRok(r) {
    if (!isFinite(r)) return;
    crok = Math.max(1, Math.min(9999, Math.round(r)));
    var s = kam.scrollTop; kresli(kam, stavApp); kam.scrollTop = s;
  }
  document.addEventListener('click', function (ev) {
    var e = ev.target.closest('[data-h]'); if (!e || !kam) return;
    var co = e.getAttribute('data-h'), v = +e.getAttribute('data-v');
    if (co === 'den') nastavDatum(new Date(sel.r, sel.m - 1, sel.d + v));
    else if (co === 'dnes') nastavDatum(new Date());
    else if (co === 'rok') zmenRok(crok + v);
    else if (co === 'rokPrimo') zmenRok(v);
    else if (co === 'styl') { A.cinaStyl(e.getAttribute('data-s')); zmenRok(crok); }
    else if (co === 'kal') window.Vyber({ r: sel.r, m: sel.m - 1, d: sel.d, znameni: true }, function (r, m, d) { var x = new Date(r, m, d); x.setFullYear(r); nastavDatum(x); });
    else if (co === 'radek') e.classList.toggle('roz');
    else if (co === 'letos') zmenRok(new Date().getFullYear());
    else if (co === 'rok2') { var dq = document.getElementById('hvDotaz'); if (dq) dq.remove(); if (e.hasAttribute('data-d')) { var p = e.getAttribute('data-d').split('-'); var x = new Date(+p[0], +p[1] - 1, +p[2]); x.setFullYear(+p[0]); nastavDatum(x); } else zmenRok(v); }
    else if (co === 'zvire') { var c = A.cinskyRok(crok), o = A.mod(v - c.zvire, 12); zmenRok(crok + (o > 6 ? o - 12 : o)); }
  });
  document.addEventListener('change', function (ev) {
    var id = ev.target.id;
    if (id === 'hvRok') {
      var t = ev.target.value.trim(), r = parseInt(t, 10);
      if (/^\d{1,2}$/.test(t) && r > 0) { ev.target.value = crok; dotazRok(ev.target.closest('.rokOvl'), r, null); }
      else if (r > 0) zmenRok(r); else ev.target.value = crok;
    }
    else if (id === 'hvDatum') zadejDatum(ev.target);
  });
  // pole k přepsání: klepnutím se celé označí (modře) a rovnou se píše nové
  document.addEventListener('focusin', function (ev) {
    var e = ev.target; if (!e.classList || !e.classList.contains('prepis')) return;
    setTimeout(function () { try { e.select(); e.setSelectionRange(0, e.value.length); } catch (x) { /* nejde */ } }, 0);
  });
  document.addEventListener('keydown', function (ev) { if (ev.key === 'Enter' && ev.target.classList && ev.target.classList.contains('prepis')) ev.target.blur(); });
  /** Rok napsaný jednou nebo dvěma číslicemi: zeptá se, jestli 2026, nebo opravdu rok 26. */
  function dotazRok(kde, r, den) {
    var st = document.getElementById('hvDotaz'); if (st) st.remove();
    var dlouhy = 2000 + r > new Date().getFullYear() + 10 ? 1900 + r : 2000 + r;
    function tl(rok) { return '<button data-h="rok2" data-v="' + rok + '"' + (den ? ' data-d="' + rok + '-' + den.m + '-' + den.d + '"' : '') + '>' + (rok < 100 ? 'rok ' + rok : rok) + '</button>'; }
    var d = document.createElement('div'); d.id = 'hvDotaz'; d.className = 'dotazRok';
    d.innerHTML = '<span>Myslíš ' + dlouhy + ', nebo rok ' + r + '?</span>' + tl(dlouhy) + tl(r);
    kde.insertAdjacentElement('afterend', d);
  }
  /** Datum napsané rukou: „24.12.", „24. 12. 1990", „24/12", „2412". */
  function zadejDatum(el) {
    var t = el.value.trim(), m = /^(\d{1,2})\s*[.\/ ,-]\s*(\d{1,2})\s*\.?\s*(?:[.\/ ,-]?\s*(\d{1,4}))?\s*\.?$/.exec(t) || /^(\d{2})(\d{2})(\d{4})?$/.exec(t);
    if (m) {
      var r = m[3] ? +m[3] : sel.r, mes = +m[2], d = +m[1];
      var dt = new Date(2000, mes - 1, d);
      if (m[3] && m[3].length <= 2 && mes >= 1 && mes <= 12 && dt.getDate() === d) { el.value = popisData(); dotazRok(el.closest('.datumOvl'), r, { m: mes, d: d }); return; }
      dt = new Date(r, mes - 1, d);
      if (mes >= 1 && mes <= 12 && dt.getDate() === d && r >= 1 && r <= 9999) { dt.setFullYear(r); nastavDatum(dt); return; }
    }
    el.value = popisData(); el.classList.add('chyba'); setTimeout(function () { el.classList.remove('chyba'); }, 900);
  }
  var drz = null;
  function pustDrz() { if (drz) { clearTimeout(drz.t); drz.el.classList.remove('drzi'); drz = null; } }
  document.addEventListener('pointerdown', function (ev) {
    var r = ev.target.closest && ev.target.closest('#hvLegenda > div[data-s]'); if (!r) return;
    pustDrz();
    r.classList.add('drzi');
    drz = { el: r, x: ev.clientX, y: ev.clientY, t: setTimeout(function () {
      var so = r.getAttribute('data-s');
      pustDrz();
      if (!skryte[so] && vidim().length === 1) { r.classList.add('chyba'); setTimeout(function () { r.classList.remove('chyba'); }, 700); return; }
      if (skryte[so]) delete skryte[so]; else skryte[so] = 1;
      try { localStorage.setItem('svatky.hvSkryte', JSON.stringify(skryte)); } catch (e) { /* nejde */ }
      try { if (navigator.vibrate) navigator.vibrate(18); } catch (e) { /* nejde */ }
      var sc = kam.scrollTop; kresli(kam, stavApp); kam.scrollTop = sc;
    }, 550) };
  });
  document.addEventListener('pointermove', function (ev) { if (drz && Math.abs(ev.clientX - drz.x) + Math.abs(ev.clientY - drz.y) > 10) pustDrz(); });
  ['pointerup', 'pointercancel'].forEach(function (u) { document.addEventListener(u, pustDrz); });
  document.addEventListener('contextmenu', function (ev) { if (ev.target.closest && ev.target.closest('#hvLegenda')) ev.preventDefault(); });

  var tahne = false;
  document.addEventListener('pointerdown', function (ev) {
    var sv = ev.target.closest && ev.target.closest('#hvKolo'); if (!sv) return;
    tahne = true; try { sv.setPointerCapture(ev.pointerId); } catch (e) { /* starší WebView */ }
    tah(ev);
  });
  document.addEventListener('pointermove', function (ev) { if (tahne && document.getElementById('hvKolo')) { ev.preventDefault(); tah(ev); } });
  ['pointerup', 'pointercancel'].forEach(function (u) { document.addEventListener(u, function () { tahne = false; }); });

  window.Hvezdy = { kresli: kresli, nastavDatum: nastavDatum };
})();
