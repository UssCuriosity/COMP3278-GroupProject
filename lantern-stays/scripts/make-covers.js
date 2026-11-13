// Draws the listing cover illustrations in public/img/covers/ (6 scenes x 3 times of day).
// The generated SVG files are already included in the project; this script is
// only needed if you want to tweak the artwork:   node scripts/make-covers.js
const fs = require('fs');
const path = require('path');

const W = 800;
const H = 520;
const OUT = path.join(__dirname, '..', 'public', 'img', 'covers');

const PALETTES = {
  day: {
    sky: ['#6fbde6', '#bfe6f5', '#eef9f6'], orb: '#fff4b8', orbY: 120, stars: false,
    far: '#b4dccd', mid: '#7dbba6', near: '#46907f', dark: '#2a5f55',
    water: ['#58b4d6', '#a8dcec'], shine: '#ffffff',
    wall: '#fbf1df', wall2: '#eedcbd', tower: '#dfeaf0', tower2: '#c3d6e0', glass: '#6f9fb8',
    roof: '#e0623f', roof2: '#c9503a', sand: '#f7e3b0', trunk: '#7b5a3a', lit: '#fff1b8', sail: '#e0623f',
  },
  dusk: {
    sky: ['#3d2c6e', '#c9577a', '#fbb36b'], orb: '#ffe9a8', orbY: 300, stars: false,
    far: '#a45c84', mid: '#73406f', near: '#472a55', dark: '#2b1b3b',
    water: ['#d9736a', '#f7b877'], shine: '#ffe9a8',
    wall: '#f3c9a4', wall2: '#dba585', tower: '#5a3a68', tower2: '#3f2850', glass: '#ffcf7a',
    roof: '#8e2f4a', roof2: '#6f2340', sand: '#f0b98a', trunk: '#3a2233', lit: '#ffd77a', sail: '#8e2f4a',
  },
  night: {
    sky: ['#070f2b', '#152a5c', '#2b4c8c'], orb: '#f6f1dc', orbY: 110, stars: true,
    far: '#22407a', mid: '#19305f', near: '#11224a', dark: '#0a1633',
    water: ['#122b5c', '#1f4686'], shine: '#f6f1dc',
    wall: '#2c426f', wall2: '#22355c', tower: '#16264d', tower2: '#0f1c3d', glass: '#ffd166',
    roof: '#0d1936', roof2: '#0a1430', sand: '#2a3d63', trunk: '#0a1430', lit: '#ffd166', sail: '#c94f4f',
  },
};

// Small deterministic random generator so every run draws the same pictures.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const n = (v) => Math.round(v * 10) / 10;

function sky(p, rand) {
  const stops = p.sky.map((c, i) => `<stop offset="${n(i / (p.sky.length - 1))}" stop-color="${c}"/>`).join('');
  let out = `<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>` +
    `<linearGradient id="water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${p.water[0]}"/><stop offset="1" stop-color="${p.water[1]}"/></linearGradient></defs>` +
    `<rect width="${W}" height="${H}" fill="url(#sky)"/>`;
  if (p.stars) {
    for (let i = 0; i < 70; i += 1) {
      out += `<circle cx="${n(rand() * W)}" cy="${n(rand() * 300)}" r="${n(0.6 + rand() * 1.3)}" fill="#fff" opacity="${n(0.35 + rand() * 0.6)}"/>`;
    }
  }
  return out;
}

function orb(p, x) {
  return `<circle cx="${x}" cy="${p.orbY}" r="92" fill="${p.orb}" opacity="0.18"/>` +
    `<circle cx="${x}" cy="${p.orbY}" r="64" fill="${p.orb}" opacity="0.28"/>` +
    `<circle cx="${x}" cy="${p.orbY}" r="42" fill="${p.orb}"/>`;
}

function clouds(p, rand, count = 3) {
  if (p.stars) return '';
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const x = 60 + rand() * 640;
    const y = 50 + rand() * 120;
    const s = 0.7 + rand() * 0.7;
    out += `<g fill="#fff" opacity="0.55"><ellipse cx="${n(x)}" cy="${n(y)}" rx="${n(52 * s)}" ry="${n(13 * s)}"/>` +
      `<ellipse cx="${n(x + 30 * s)}" cy="${n(y - 9 * s)}" rx="${n(30 * s)}" ry="${n(12 * s)}"/></g>`;
  }
  return out;
}

// A rolling hill line filled down to the bottom of the picture.
function hill(base, amp, freq, phase, fill) {
  let d = `M0 ${H}`;
  for (let x = 0; x <= W; x += 20) {
    const y = base + amp * Math.sin(x * freq + phase) + (amp / 2) * Math.sin(x * freq * 2.3 + phase * 1.7);
    d += ` L${x} ${n(y)}`;
  }
  return `<path d="${d} L${W} ${H} Z" fill="${fill}"/>`;
}

function peaks(base, heights, fill, cap) {
  const step = W / (heights.length - 1);
  let d = `M0 ${H} L0 ${base}`;
  let caps = '';
  heights.forEach((hgt, i) => {
    const x = i * step;
    d += ` L${n(x - step / 2)} ${base} L${n(x)} ${base - hgt}`;
    if (cap && hgt > 90) {
      const c = hgt * 0.28;
      const half = (c / hgt) * (step / 2);
      caps += `<path d="M${n(x)} ${base - hgt} L${n(x - half)} ${n(base - hgt + c)} L${n(x - half / 3)} ${n(base - hgt + c * 0.7)} ` +
        `L${n(x + half / 3)} ${n(base - hgt + c)} L${n(x + half)} ${n(base - hgt + c * 0.75)} Z" fill="${cap}" opacity="0.9"/>`;
    }
  });
  return `<path d="${d} L${W + step / 2} ${base} L${W} ${H} Z" fill="${fill}"/>${caps}`;
}

function tower(x, ground, w, hgt, fill, glass, rand, litChance) {
  let out = `<rect x="${n(x)}" y="${n(ground - hgt)}" width="${n(w)}" height="${n(hgt)}" fill="${fill}"/>`;
  const cols = Math.max(2, Math.floor(w / 14));
  const gap = w / (cols + 0.5);
  for (let row = 0; row * 16 + 22 < hgt; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      if (rand() > litChance) continue;
      out += `<rect x="${n(x + gap * 0.5 + col * gap)}" y="${n(ground - hgt + 12 + row * 16)}" width="${n(gap * 0.5)}" height="8" fill="${glass}" opacity="${n(0.55 + rand() * 0.45)}"/>`;
    }
  }
  return out;
}

function pine(x, y, s, fill, trunk) {
  return `<rect x="${n(x - 3 * s)}" y="${n(y - 8 * s)}" width="${n(6 * s)}" height="${n(10 * s)}" fill="${trunk}"/>` +
    [0, 1, 2].map((i) => `<path d="M${n(x)} ${n(y - (70 - i * 4) * s)} L${n(x - (14 + i * 7) * s)} ${n(y - (44 - i * 18) * s)} L${n(x + (14 + i * 7) * s)} ${n(y - (44 - i * 18) * s)} Z" fill="${fill}"/>`).join('');
}

function house(x, y, w, p, wall, roof) {
  const hgt = w * 0.62;
  return `<rect x="${n(x)}" y="${n(y - hgt)}" width="${n(w)}" height="${n(hgt)}" fill="${wall}"/>` +
    `<path d="M${n(x - w * 0.1)} ${n(y - hgt)} L${n(x + w / 2)} ${n(y - hgt - w * 0.42)} L${n(x + w * 1.1)} ${n(y - hgt)} Z" fill="${roof}"/>` +
    `<rect x="${n(x + w * 0.16)}" y="${n(y - hgt * 0.72)}" width="${n(w * 0.22)}" height="${n(hgt * 0.34)}" fill="${p.lit}"/>` +
    `<rect x="${n(x + w * 0.58)}" y="${n(y - hgt * 0.62)}" width="${n(w * 0.22)}" height="${n(hgt * 0.62)}" fill="${p.dark}"/>`;
}

function palm(x, y, s, p) {
  const top = { x: x + 26 * s, y: y - 150 * s };
  const leaf = (dx, dy) => `<path d="M${n(top.x)} ${n(top.y)} Q${n(top.x + dx * 0.5 * s)} ${n(top.y + (dy - 34) * s)} ${n(top.x + dx * s)} ${n(top.y + dy * s)} ` +
    `Q${n(top.x + dx * 0.45 * s)} ${n(top.y + (dy - 12) * s)} ${n(top.x)} ${n(top.y)} Z" fill="${p.near}"/>`;
  return `<path d="M${n(x)} ${n(y)} Q${n(x + 4 * s)} ${n(y - 80 * s)} ${n(top.x)} ${n(top.y)}" stroke="${p.trunk}" stroke-width="${n(9 * s)}" fill="none" stroke-linecap="round"/>` +
    leaf(-78, 18) + leaf(-52, 46) + leaf(74, 14) + leaf(54, 44) + leaf(-18, -34) + leaf(30, -30);
}

function boat(x, y, s, p) {
  return `<path d="M${n(x - 46 * s)} ${n(y)} L${n(x + 50 * s)} ${n(y)} L${n(x + 36 * s)} ${n(y + 16 * s)} L${n(x - 34 * s)} ${n(y + 16 * s)} Z" fill="${p.dark}"/>` +
    `<rect x="${n(x - 2 * s)}" y="${n(y - 74 * s)}" width="${n(3 * s)}" height="${n(74 * s)}" fill="${p.dark}"/>` +
    `<path d="M${n(x + 4 * s)} ${n(y - 72 * s)} Q${n(x + 46 * s)} ${n(y - 48 * s)} ${n(x + 34 * s)} ${n(y - 8 * s)} L${n(x + 4 * s)} ${n(y - 8 * s)} Z" fill="${p.sail}"/>` +
    `<path d="M${n(x - 6 * s)} ${n(y - 60 * s)} Q${n(x - 36 * s)} ${n(y - 40 * s)} ${n(x - 28 * s)} ${n(y - 8 * s)} L${n(x - 6 * s)} ${n(y - 8 * s)} Z" fill="${p.sail}" opacity="0.85"/>`;
}

function ripples(p, rand, top, count) {
  let out = '';
  for (let i = 0; i < count; i += 1) {
    const y = top + 12 + rand() * (H - top - 30);
    const x = rand() * (W - 120);
    out += `<rect x="${n(x)}" y="${n(y)}" width="${n(40 + rand() * 90)}" height="3" rx="1.5" fill="${p.shine}" opacity="${n(0.18 + rand() * 0.25)}"/>`;
  }
  return out;
}

const SCENES = {
  skyline(p, rand) {
    let out = sky(p, rand) + orb(p, 610) + clouds(p, rand) + hill(360, 22, 0.006, 1, p.far);
    for (let x = -10; x < W; ) {
      const w = 46 + rand() * 50;
      out += tower(x, 440, w, 90 + rand() * 150, p.tower, p.glass, rand, p.stars ? 0.45 : 0.3);
      x += w + 4 + rand() * 16;
    }
    for (let x = -20; x < W; ) {
      const w = 60 + rand() * 60;
      out += tower(x, 470, w, 110 + rand() * 250, p.tower2, p.glass, rand, p.stars ? 0.6 : 0.5);
      x += w + 8 + rand() * 26;
    }
    return out + `<rect y="462" width="${W}" height="58" fill="${p.dark}"/>` + hill(492, 6, 0.02, 0, p.near);
  },
  harbour(p, rand) {
    let out = sky(p, rand) + orb(p, 220) + clouds(p, rand) + hill(300, 26, 0.007, 2.4, p.far);
    for (let x = 330; x < W; ) {
      const w = 26 + rand() * 30;
      out += tower(x, 330, w, 40 + rand() * 120, p.tower, p.glass, rand, p.stars ? 0.5 : 0.3);
      x += w + 3 + rand() * 8;
    }
    out += `<rect y="330" width="${W}" height="${H - 330}" fill="url(#water)"/>` + ripples(p, rand, 330, 16);
    out += boat(250, 400, 1.15, p) + boat(590, 366, 0.6, p);
    return out + `<path d="M0 470 L250 486 L250 ${H} L0 ${H} Z" fill="${p.dark}"/>` +
      [30, 110, 190].map((x) => `<rect x="${x}" y="446" width="8" height="40" fill="${p.dark}"/>`).join('');
  },
  beach(p, rand) {
    let out = sky(p, rand) + orb(p, 560) + clouds(p, rand, 4);
    out += `<rect y="300" width="${W}" height="${H - 300}" fill="url(#water)"/>` + hill(304, 10, 0.004, 5, p.far).replace(`L${W} ${H} Z`, `L${W} 318 L0 318 Z`);
    out += ripples(p, rand, 310, 12);
    out += `<path d="M0 ${H} L0 420 Q260 350 520 410 T${W} 440 L${W} ${H} Z" fill="${p.sand}"/>`;
    out += palm(130, 440, 1.25, p) + palm(230, 452, 0.9, p);
    out += house(520, 452, 130, p, p.wall, p.roof);
    return out + `<path d="M0 ${H} L0 486 Q200 462 420 492 T${W} 486 L${W} ${H} Z" fill="${p.wall2}" opacity="0.5"/>`;
  },
  mountain(p, rand) {
    let out = sky(p, rand) + orb(p, 170) + clouds(p, rand);
    out += peaks(400, [150, 250, 170, 290, 190, 240], p.far, p.stars ? '#c9d6ee' : '#ffffff');
    out += peaks(440, [120, 90, 200, 130, 220, 110, 160], p.mid, null);
    out += hill(430, 18, 0.008, 0.6, p.near);
    for (let i = 0; i < 12; i += 1) out += pine(30 + i * 68 + rand() * 20, 446 + rand() * 14, 0.7 + rand() * 0.45, p.dark, p.trunk);
    out += house(330, 470, 120, p, p.wall, p.roof);
    return out + hill(488, 8, 0.012, 2, p.dark);
  },
  forest(p, rand) {
    let out = sky(p, rand) + orb(p, 640) + clouds(p, rand) + hill(330, 30, 0.006, 0.4, p.far);
    for (let i = 0; i < 20; i += 1) out += pine(i * 42 + rand() * 16, 392 + rand() * 12, 1.1 + rand() * 0.5, p.mid, p.mid);
    out += hill(410, 12, 0.01, 3, p.near);
    for (let i = 0; i < 13; i += 1) {
      const x = i * 64 + rand() * 24;
      if (x > 290 && x < 480) continue;
      out += pine(x, 470 + rand() * 16, 1.6 + rand() * 0.7, p.dark, p.trunk);
    }
    out += house(320, 472, 136, p, p.wall, p.roof);
    return out + hill(494, 6, 0.015, 1, p.dark);
  },
  village(p, rand) {
    let out = sky(p, rand) + orb(p, 130) + clouds(p, rand) + hill(310, 34, 0.005, 1.2, p.far) + hill(372, 22, 0.008, 4, p.mid);
    for (let i = 0; i < 7; i += 1) out += house(20 + i * 112 + rand() * 18, 404 + rand() * 10, 70 + rand() * 16, p, p.wall2, p.roof2);
    out += hill(430, 10, 0.011, 2, p.near);
    for (let i = 0; i < 5; i += 1) out += house(-30 + i * 172 + rand() * 20, 486 + rand() * 8, 112 + rand() * 20, p, p.wall, p.roof);
    out += pine(160, 492, 1.2, p.dark, p.trunk) + pine(505, 496, 1.4, p.dark, p.trunk) + pine(690, 490, 1.1, p.dark, p.trunk);
    return out + hill(500, 5, 0.02, 0, p.dark);
  },
};

fs.mkdirSync(OUT, { recursive: true });
let seed = 7;
for (const [scene, draw] of Object.entries(SCENES)) {
  for (const [time, palette] of Object.entries(PALETTES)) {
    seed += 13;
    const body = draw(palette, rng(seed * 2654435761));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${body}</svg>\n`;
    fs.writeFileSync(path.join(OUT, `${scene}-${time}.svg`), svg);
  }
}
console.log(`Wrote ${Object.keys(SCENES).length * Object.keys(PALETTES).length} covers to ${OUT}`);
