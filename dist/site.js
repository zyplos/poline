console.clear();

import { formatHex, converter, formatCss, inGamut } from 'https://cdn.skypack.dev/culori@^3.1.1';

import { rybHsl2rgb } from "https://esm.sh/rybitten/";

import {
  Poline,
  positionFunctions,
  randomHSLPair,
  hslToPoint,
} from "./index.mjs";

const toHSL = converter('hsl');
const toOKlab = converter('oklab');
const inRgb = inGamut('rgb')

const svgscale = 100;
const namespaceURI = 'http://www.w3.org/2000/svg';

const hueBasedModels = [{
  key: 'okhsl',
  label: 'OKHSL',
  fn: (hsl) => { return { h: hsl[0], s: hsl[1], l: hsl[2] } },
},
{
  key: 'hsl',
  label: 'HSL',
  fn: (hsl) => { return { h: hsl[0], s: hsl[1], l: hsl[2] } },
}, {
  key: 'rgb',
  label: 'RYBitten',
  fn: (hsl) => {
    const [r, g, b] = rybHsl2rgb(hsl);
    return { r, g, b };
  },
}, {
  key: 'jch',
  label: 'JCH',
  fn: (hsl) => { return { j: hsl[2] * 0.222, c: hsl[1] * 0.190, h: hsl[0] } },
}, {
  key: 'oklch',
  label: 'OKLCH',
  fn: (hsl) => { return { l: hsl[2] * 0.999, c: hsl[1] * 0.322, h: hsl[0] } },
}, {
  key: 'lch',
  label: 'LCH',
  fn: (hsl) => { return { l: hsl[2] * 100, c: hsl[1] * 51.484, h: hsl[0] } },
}, {
  key: 'dlch',
  label: 'DLCH',
  fn: (hsl) => { return { l: hsl[2] * 100, c: hsl[1] * 51.484, h: hsl[0] } },
},
];

let currentHueModel = 'hsl';
let currentModelFn = hueBasedModels.find(m => m.key === currentHueModel).fn;

const stepsToLabels = (steps = 360 / 10) => new Array(steps)
  .fill('')
  .map((_, i) => `
          <strong class="wheel__huelabel${i > 9 && i < 31 ? ' wheel__huelabel--flipped' : ''}" data-huelabel="${i}" style="--i: ${i / steps}">
            <b aria-label="${i * 10}°">${i * 10}</b>
          </strong>`)
  .join('')

const createCSSRainbowGradient = (steps = 360 / 10) => new Array(steps)
  .fill('')
  //.map((_, i) => `hsl(${i / (steps - 1) * 360}, calc(var(--s) * 100%), calc(var(--l,0) * 100%)) calc(${i / (steps - 1) * 100}% + 1px)`)
  .map((_, i) => `hsl(${i / (steps - 1) * 360}, calc(var(--s) * 100%), calc(var(--l,0) * 100%))`)
  .join(',');

const logColors = (colors, includeValue = false) => {
  let o = "", s = [];
  for (const c of colors) {
    o += `%c ${includeValue ? c : ''} `;
    s.push(`background:${c}; color:${c}`);
  }
  console.log(o, ...s);
  if (!includeValue) {
    console.log(colors);
  }
};

const createSVG = (svgscale = 100) => {
  const $svg = document.createElementNS(
    namespaceURI, 'svg'
  );
  $svg.setAttribute('viewBox', `0 0 ${svgscale} ${svgscale}`);
  return $svg;
}

const colorArrToSteppedGradient = (colorsArr) => colorsArr.map(
  (c, i) => `${c} ${i / colorsArr.length * 100}% ${(i + 1) / colorsArr.length * 100}%`
).join();

const $steps = document.querySelectorAll('[data-steps]');
const $colorAt = document.querySelector('[data-colorat]');
const $selects = document.querySelectorAll('[data-select]');
const $xSelect = document.querySelectorAll('[data-select="x"]');
const $ySelect = document.querySelectorAll('[data-select="y"]');
const $zSelect = document.querySelectorAll('[data-select="z"]');
const $allSelect = document.querySelector('[data-select="all"]');
const $models = document.querySelectorAll('[data-models]');
const $loop = document.querySelectorAll('[data-loop]');
const $invertLightness = document.querySelectorAll('[data-invertlightness]');
const $randomize = document.querySelectorAll('[data-randomize]');
const $toc = document.querySelector('[data-toc]');
const $export = document.querySelector('[data-export]');
const $draw = document.querySelector('[data-draw]');

const $stepsVal = document.getElementById('steps-val');
const $hueshiftVal = document.getElementById('hueshift-val');
const $referenceColorVal = document.getElementById('reference-color-val');
const $matchSaturationBtn = document.getElementById('match-saturation-btn');


$models.forEach($model => {
  $model.innerHTML = hueBasedModels
    .map(model => `<option ${model.key == currentHueModel ? 'selected="true"' : ""} value="${model.key}">${model.label}</option>`)
    .join('');

  $model.addEventListener('change', (e) => {
    currentHueModel = e.target.value;
    currentModelFn = hueBasedModels.find(m => m.key === currentHueModel).fn;
    $models.forEach($model => $model.value = currentHueModel);
    updateSVG();
  });
});

let fnx = 'sinusoidalPosition';
let fny = 'quadraticPosition';
let fnz = 'linearPosition';
let fnAll = 'sinusoidalPosition';

const systemDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
let invertedLightness = systemDarkMode;

$selects.forEach($select => {
  Object.keys(positionFunctions).forEach(fn => {
    const $option = document.createElement('option');
    if ($select === $xSelect && fn === fnx) $option.selected = true;
    if ($select === $ySelect && fn === fny) $option.selected = true;
    if ($select === $zSelect && fn === fnz) $option.selected = true;
    if ($select === $allSelect && fn === fnAll) $option.selected = true;
    $option.value = fn;
    $option.textContent = fn;
    $select.appendChild($option);
  });
});

let steps = parseInt($steps[0].value);
let startHue = Math.random() * 360;
let anchorColors = randomHSLPair(startHue);

let poline;

let savedClosedLoop = false;
let background = 'default';

const loadURL = () => {
  const search = window.location.search;
  if (search) {
    try {
      const params = new URLSearchParams(search);

      const a = JSON.parse(params.get('anchors'));
      const s = parseInt(params.get('steps'));
      const il = params.get('invertedLightness') === 'true';
      const cl = params.get('closedLoop') === 'true';
      const fx = params.get('fnx');
      const fy = params.get('fny');
      const fz = params.get('fnz');
      const model = params.get('model');
      const bg = params.get('bg');

      if (a && s) {
        steps = s;
        invertedLightness = il;
        savedClosedLoop = cl;
        fnx = fx || fnx;
        fny = fy || fny;
        fnz = fz || fnz;
        currentHueModel = model || currentHueModel;
        background = bg || 'default';

        // Update UI logic for model
        currentModelFn = hueBasedModels.find(m => m.key === currentHueModel).fn;
        $models.forEach($model => $model.value = currentHueModel);

        anchorColors = a;

        return true;
      }
    } catch (error) {
      console.error("Failed to load from URL", error);
    }
  }
  return false;
};

const loaded = loadURL();

if (background === 'dark') {
  document.documentElement.style.setProperty('--bg', '#000');
  document.documentElement.style.setProperty('--onBg', '#fff');
} else if (background === 'light') {
  document.documentElement.style.setProperty('--bg', '#fff');
  document.documentElement.style.setProperty('--onBg', '#000');
}

poline = new Poline({
  anchorColors,
  numPoints: steps,
  positionFunctionX: positionFunctions[fnx],
  positionFunctionY: positionFunctions[fny],
  positionFunctionZ: positionFunctions[fnz],
  closedLoop: loaded ? savedClosedLoop : false,
  invertedLightness: loaded ? invertedLightness : false,
});

if (invertedLightness) {
  poline.invertedLightness = true;
}

const updateURL = () => {
  const params = new URLSearchParams();

  // Anchors - map to HSL array
  const anchors = poline.anchorPoints.map(p => p.color);
  params.set('anchors', JSON.stringify(anchors));

  params.set('steps', poline.numPoints);
  params.set('invertedLightness', poline.invertedLightness);
  params.set('closedLoop', poline.closedLoop);

  const findFnName = (fn) => Object.keys(positionFunctions).find(key => positionFunctions[key] === fn);

  params.set('fnx', findFnName(poline.positionFunctionX) || 'sinusoidalPosition');
  params.set('fny', findFnName(poline.positionFunctionY) || 'sinusoidalPosition');
  params.set('fnz', findFnName(poline.positionFunctionZ) || 'sinusoidalPosition');
  params.set('model', currentHueModel);
  params.set('bg', background);

  window.history.replaceState(null, null, '?' + params.toString());
};



// favicon
let $favicon = document.querySelector('[rel="icon"]');
const $can = document.createElement('canvas');

$can.width = 256;
$can.height = 256;

let centerX = $can.width / 2;
let centerY = $can.height / 2;

const context = $can.getContext("2d");
const x = $can.width / 2;
const y = $can.height / 2;
const radius = Math.min($can.width, $can.height) * .5;
const counterClockwise = false;
let parts = 12;
let fraction = 360 / parts;
const overlapFix = .5;


const paintFavicon = (i = 0) => {
  parts = poline.colors.length;
  fraction = 360 / parts;

  context.clearRect(0, 0, $can.width, $can.height);

  context.beginPath();
  context.arc(x, y, radius, 0, 2 * Math.PI);
  context.closePath();
  context.fillStyle = `rgb(255 255 255 / 0.5)`;
  context.fill();

  for (let angle = 0; angle < 360; angle += fraction) {
    let startAngle = (i + angle - 90 - fraction - overlapFix - (fraction * .5)) * Math.PI / 180;
    let endAngle = (i + angle - 90 + overlapFix - (fraction * .5)) * Math.PI / 180;
    const color = poline.colorsCSS[angle / fraction];

    context.beginPath();
    context.moveTo(x, y);
    context.arc(x, y, radius, startAngle, endAngle, counterClockwise);
    context.closePath();
    context.fillStyle = color;
    context.fill();
  }

  context.beginPath();
  context.arc(0 + centerX, 0 + centerY, radius * 0.35, 0, 2 * Math.PI);
  context.fillStyle = `rgb(255 255 255 / 1)`;
  context.fill();


  $favicon.href = $can.toDataURL('image/png');
}

paintFavicon();

// favicon end

const $picker = document.querySelector('[data-picker]');
const hueSteps = 360 / 10;

const $svg = createSVG(svgscale);
$picker.innerHTML = stepsToLabels(hueSteps);
const $huelabels = document.querySelectorAll('[data-huelabel]');
$picker.appendChild($svg);

$picker.style.setProperty('--grad', createCSSRainbowGradient(hueSteps));

let timer = null;
// let exportAbortController = null;

function updateExport() {
  const colorsOKlab = poline.colors.map(color => toOKlab(
    { mode: currentHueModel, ...currentModelFn(color) }
  ));

  const colorCSSOKlab = colorsOKlab.map(color => formatCss(color));

  const colorsInGamut = colorsOKlab.map(c => inRgb(c))

  const colorsHEX = poline.colors.map(color => formatHex(
    { mode: currentHueModel, ...currentModelFn(color) }
  ));

  // console.log(poline);
  logColors(colorsHEX);

  let paletteTitle = "Poline Palette";

  $export.innerHTML = `
      <input type="text" class="export__title" value="${paletteTitle}" id="paletteTitleInput" style="background: transparent; border: none; border-bottom: 1px solid var(--line); color: inherit; width: 100%; box-sizing: border-box; font-family: inherit; font-size: 2.5rem; letter-spacing: -0.05em; margin-bottom: 0.5rem;" />
      <div class="export__actions" style="margin-top: 0.5rem; margin-bottom: 1rem; display: flex; gap: 1rem; flex-wrap: wrap;">
        <button id="copyHexBtn" style="padding: 0.5em 1rem; font-size: 0.8rem;">Copy Hex Colors</button>
        <button id="copyCssBtn" style="padding: 0.5em 1rem; font-size: 0.8rem;">Copy as CSS Variables</button>
        <button id="exportSvgBtn" style="padding: 0.5em 1rem; font-size: 0.8rem;">Copy SVG</button>
      </div>
      <ol class="export__list">
        ${colorsHEX.map((requestedHex, index) => {
    const oklabcss = colorCSSOKlab[index];
    const { l, a, b } = colorsOKlab[index];
    const isInSrgb = colorsInGamut[index];
    const exportValue = isInSrgb ? requestedHex : `oklab(${l.toFixed(2)} ${a.toFixed(2)} ${b.toFixed(2)})`;
    return `
          <li data-copy="${exportValue}" class="export__item ${isInSrgb ? ' export__item--notSrgb' : ''}" style="--c: ${oklabcss}; --cHex: ${requestedHex}; --i: ${index / colorsHEX.length};">
            <div class="export__sample">
            </div>
            <div class="export__label">
              <span class="export__hex">
                <span class="wrap">${exportValue}</span>
              </span>
            </div>
          </li>
        `}).join('')}
      </ol>
    `;


  const $copyHexBtn = document.getElementById('copyHexBtn');
  const $copyCssBtn = document.getElementById('copyCssBtn');
  const $exportSvgBtn = document.getElementById('exportSvgBtn');
  const $paletteTitleInput = document.getElementById('paletteTitleInput');

  if ($copyHexBtn) {
    $copyHexBtn.addEventListener('click', () => {
      const text = colorsHEX.join('\n');
      navigator.clipboard.writeText(text);
      const originalText = $copyHexBtn.innerText;
      $copyHexBtn.innerText = 'Copied!';
      setTimeout(() => $copyHexBtn.innerText = originalText, 1000);
    });
  }

  const toCamelCase = (str) => {
    return str.toLowerCase()
      .replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
  }

  if ($copyCssBtn) {
    $copyCssBtn.addEventListener('click', () => {
      const currentTitle = $paletteTitleInput ? $paletteTitleInput.value : paletteTitle;
      const camelCaseTitle = toCamelCase(currentTitle);
      const cssLines = colorsHEX.map((hex, i) => {
        const step = i === 0 ? 50 : i * 100;
        return `  --${camelCaseTitle}-${step}: ${hex};`;
      });
      const text = `:root {\n${cssLines.join('\n')}\n}`;
      navigator.clipboard.writeText(text);

      const originalText = $copyCssBtn.innerText;
      $copyCssBtn.innerText = 'Copied!';
      setTimeout(() => $copyCssBtn.innerText = originalText, 1000);
    });
  }

  if ($exportSvgBtn) {
    $exportSvgBtn.addEventListener('click', () => {
      const rectSize = 100;
      const width = colorsHEX.length * rectSize;
      const height = rectSize;

      const rects = colorsHEX.map((color, i) => {
        return `<rect x="${i * rectSize}" y="0" width="${rectSize}" height="${rectSize}" fill="${color}" />`;
      }).join('');

      const svgContent = `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">${rects}</svg>`;

      navigator.clipboard.writeText(svgContent);

      const originalText = $exportSvgBtn.innerText;
      $exportSvgBtn.innerText = 'Copied!';
      setTimeout(() => $exportSvgBtn.innerText = originalText, 1000);
    });
  }

  $export.style.height = 'auto';
}

const updateReferenceStar = () => {
  if (!$referenceColorVal) return;
  const val = $referenceColorVal.value;
  let $star = $svg.querySelector('.reference-star');

  if (!val || val.length < 4) {
    if ($star) $star.style.display = 'none';
    if ($matchSaturationBtn) $matchSaturationBtn.style.display = 'none';
    return;
  }

  const hsl = toHSL(val);
  if (!hsl) {
    if ($star) $star.style.display = 'none';
    if ($matchSaturationBtn) $matchSaturationBtn.style.display = 'none';
    return;
  }

  if ($matchSaturationBtn) $matchSaturationBtn.style.display = 'block';

  const point = hslToPoint([hsl.h || 0, hsl.s, hsl.l], invertedLightness);

  if (!$star) {
    $star = document.createElementNS(namespaceURI, 'path');
    $star.classList.add('reference-star');
    // star shape
    const d = "M0,-2.5 L0.6,-0.8 L2.4,-0.8 L1,0.2 L1.5,1.9 L0,0.9 L-1.5,1.9 L-1,0.2 L-2.4,-0.8 L-0.6,-0.8 Z";
    $star.setAttribute('d', d);
    $star.style.fill = 'none';
    $star.style.strokeWidth = '1px';
    $star.style.vectorEffect = 'non-scaling-stroke';
    $svg.appendChild($star);
  }

  $star.style.display = 'block';
  const x = point[0] * svgscale;
  const y = point[1] * svgscale;

  $star.setAttribute('transform', `translate(${x}, ${y}) scale(1.5)`);
  $star.style.stroke = invertedLightness ? '#fff' : '#000';
}

let drawTimer = null;
function updateDrawer() {
  if (drawTimer) clearTimeout(drawTimer);
  const $oldDraw = $draw.querySelectorAll('.draw');
  const $newDraw = document.createElement('div');
  $newDraw.classList.add('draw');
  $newDraw.innerHTML = poline.colors.map((c, i) => {
    return `
          <div class="draw__item" style="--i: ${i / poline.colors.length
      }; --c: ${formatCss(toOKlab(
        { mode: currentHueModel, ...currentModelFn(c) }
      ))
      //formatHex({ mode: currentHueModel, ...currentModelFn(c) })
      }"></div>
        `;
  }).join('');
  $draw.appendChild($newDraw);
  drawTimer = setTimeout(() => {
    $oldDraw.forEach($el => $el.remove());
  }, 1000);
}

let untilDrawTimer = null;

function updateUI() {
  $steps.forEach(el => el.value = poline.numPoints);
  if ($stepsVal) $stepsVal.value = poline.numPoints;
  $invertLightness.forEach(el => el.checked = poline.invertedLightness);
  $loop.forEach(el => el.checked = poline.closedLoop);

  const findFnName = (fn) => Object.keys(positionFunctions).find(key => positionFunctions[key] === fn);

  const currentFnx = findFnName(poline.positionFunctionX);
  if (currentFnx) {
    fnx = currentFnx;
    $xSelect.forEach(el => el.value = fnx);
  }

  const currentFny = findFnName(poline.positionFunctionY);
  if (currentFny) {
    fny = currentFny;
    $ySelect.forEach(el => el.value = fny);
  }

  const currentFnz = findFnName(poline.positionFunctionZ);
  if (currentFnz) {
    fnz = currentFnz;
    $zSelect.forEach(el => el.value = fnz);
  }

  if (currentFnx && currentFnx === currentFny && currentFny === currentFnz) {
    fnAll = currentFnx;
    if ($allSelect) $allSelect.value = fnAll;
  }
}

const ROTARY_TURNS_TO_FULL = 1.0;
const ROTARY_TURNS_TO_FULL_SHIFT = 2.5;

let ringAdjust = null;
let ringHoverIndex = null;

// Helper to pick ring from coordinates
function pickRing(normalizedX, normalizedY) {
  if (!poline) return null;
  const svgX = normalizedX * svgscale;
  const svgY = normalizedY * svgscale;
  for (let i = 0; i < poline.anchorPoints.length; i++) {
    const anchor = poline.anchorPoints[i];
    const cx = anchor.x * svgscale;
    const cy = anchor.y * svgscale;
    const dist = Math.hypot(svgX - cx, svgY - cy);
    if (dist > 2 && dist <= 5) {
      return i;
    }
  }
  return null;
}

// Helper to describe SVG arc
function describeArc(cx, cy, r, startAngle, endAngle) {
  const angleDiff = endAngle - startAngle;
  if (Math.abs(angleDiff) < 0.001) return "";
  if (Math.abs(angleDiff) > Math.PI * 2 - 0.01) {
    const midAngle = startAngle + Math.PI;
    const startX = cx + r * Math.cos(startAngle);
    const startY = cy + r * Math.sin(startAngle);
    const midX = cx + r * Math.cos(midAngle);
    const midY = cy + r * Math.sin(midAngle);
    return `M ${startX} ${startY} A ${r} ${r} 0 1 1 ${midX} ${midY} A ${r} ${r} 0 1 1 ${startX} ${startY}`;
  }
  const startX = cx + r * Math.cos(startAngle);
  const startY = cy + r * Math.sin(startAngle);
  const endX = cx + r * Math.cos(endAngle);
  const endY = cy + r * Math.sin(endAngle);
  const largeArc = angleDiff > Math.PI ? 1 : 0;
  return `M ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY}`;
}

function updateSVG() {
  if (untilDrawTimer) clearTimeout(untilDrawTimer);
  untilDrawTimer = setTimeout(() => {
    updateDrawer();
  }, 100);


  if (invertedLightness) {
    $picker.style.setProperty('--minL', '#fff');
    $picker.style.setProperty('--maxL', '#18191b');
  } else {
    $picker.style.setProperty('--minL', '#000');
    $picker.style.setProperty('--maxL', '#fff');
  }

  $huelabels.forEach(($huelabel, i) => {
    $huelabel.classList.remove('wheel__huelabel--active');
    // if the HUE label is within the range of the current anchor point
    poline.anchorPoints.forEach(anchor => {
      const currentHue = anchor.color[0];
      const currentHueDec = Math.round(currentHue / 10);

      if (
        //(Math.abs((currentHueDec - i + 36) % 36) <= 1) || (Math.abs((currentHueDec - i + 36) % 36) >= 35)
        (currentHueDec - i + 36) % 36 === 0
      ) {
        $huelabel.classList.add('wheel__huelabel--active');
      }
    });
  });

  // 0. Update Saturation Ring Groups (before anchors so they render behind)
  const anchors = poline.anchorPoints;
  let ringGroups = Array.from($svg.querySelectorAll('.wheel__ring-group'));

  // Remove excess
  while (ringGroups.length > anchors.length) ringGroups.pop().remove();

  anchors.forEach((anchor, i) => {
    const cx = anchor.x * svgscale;
    const cy = anchor.y * svgscale;
    const saturation = anchor.z;
    const ringRadius = 2.5;
    const isHovered = ringHoverIndex === i || (ringAdjust && ringAdjust.anchorIndex === i);

    // Get or create the group for this anchor's ring elements
    let group = ringGroups[i];
    if (!group) {
      group = document.createElementNS(namespaceURI, 'g');
      group.classList.add('wheel__ring-group');
      // Create elements inside the group: bg first, then arc, then tick
      const bgRing = document.createElementNS(namespaceURI, 'circle');
      bgRing.classList.add('wheel__ring-bg');
      group.appendChild(bgRing);
      const satArc = document.createElementNS(namespaceURI, 'path');
      satArc.classList.add('wheel__saturation-ring');
      group.appendChild(satArc);
      const tick = document.createElementNS(namespaceURI, 'line');
      tick.classList.add('wheel__ring-tick');
      group.appendChild(tick);
      // Insert before anchors
      const firstAnchor = $svg.querySelector('.wheel__anchor');
      if (firstAnchor) {
        $svg.insertBefore(group, firstAnchor);
      } else {
        $svg.appendChild(group);
      }
      ringGroups = Array.from($svg.querySelectorAll('.wheel__ring-group'));
    }

    // Toggle hover on the group
    group.classList.toggle('wheel__ring-group--hover', !!isHovered);

    // Update bg ring
    const bgRing = group.querySelector('.wheel__ring-bg');
    bgRing.setAttribute('cx', cx);
    bgRing.setAttribute('cy', cy);
    bgRing.setAttribute('r', ringRadius);

    // Update saturation arc
    const satArc = group.querySelector('.wheel__saturation-ring');
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + saturation * Math.PI * 2;
    satArc.setAttribute('d', describeArc(cx, cy, ringRadius, startAngle, endAngle));

    // Update tick
    const tick = group.querySelector('.wheel__ring-tick');
    const tickGap = 0.5;
    const tickLength = 1.5;
    const tickStartX = cx + (ringRadius + tickGap) * Math.cos(endAngle);
    const tickStartY = cy + (ringRadius + tickGap) * Math.sin(endAngle);
    const tickEndX = tickStartX + Math.cos(endAngle) * tickLength;
    const tickEndY = tickStartY + Math.sin(endAngle) * tickLength;
    tick.setAttribute('x1', tickStartX);
    tick.setAttribute('y1', tickStartY);
    tick.setAttribute('x2', tickEndX);
    tick.setAttribute('y2', tickEndY);
  });

  // 1. Update Anchors
  let anchorCircles = Array.from($svg.querySelectorAll('.wheel__anchor'));

  // Remove excess
  while (anchorCircles.length > anchors.length) {
    anchorCircles.pop().remove();
  }

  anchors.forEach((anchor, i) => {
    let $circle = anchorCircles[i];
    if (!$circle) {
      $circle = document.createElementNS(namespaceURI, 'circle');
      $circle.classList.add('wheel__anchor');
      $circle.setAttribute('r', 2);
      $svg.appendChild($circle);
    }
    $circle.setAttribute('cx', anchor.x * svgscale);
    $circle.setAttribute('cy', anchor.y * svgscale);
    $circle.style.setProperty('--s', anchor.color[1]);
  });

  // 2. Update Polyline
  let $polylines = $svg.querySelector('.wheel__line');
  if (!$polylines) {
    $polylines = document.createElementNS(namespaceURI, 'polyline');
    $polylines.classList.add('wheel__line');
    $svg.appendChild($polylines);
  }
  const pointsStr = poline.flattenedPoints.map(point => `${point.x * svgscale},${point.y * svgscale}`).join(' ');
  $polylines.setAttribute('points', pointsStr);
  const length = $polylines.getTotalLength();
  $polylines.style.setProperty('--length', length);

  // 3. Update Points
  const points = poline.flattenedPoints;
  let pointCircles = Array.from($svg.querySelectorAll('.wheel__point'));

  // Remove excess
  while (pointCircles.length > points.length) {
    pointCircles.pop().remove();
  }

  points.forEach((point, i) => {
    let $circle = pointCircles[i];
    if (!$circle) {
      $circle = document.createElementNS(namespaceURI, 'circle');
      $circle.classList.add('wheel__point');
      $svg.appendChild($circle);
    }
    $circle.setAttribute('cx', point.x * svgscale);
    $circle.setAttribute('cy', point.y * svgscale);
    const radius = .5 + point.color[1];
    $circle.setAttribute('r', radius);
    $circle.style.setProperty('--i', i);
    $circle.style.setProperty('--circ', 2 * Math.PI * radius);
    $circle.style.setProperty('--s', point.color[1]);
    const c = formatHex({ mode: currentHueModel, ...currentModelFn(point.color) });
    $circle.style.setProperty('--c', c);
  });

  let cssColors = [...poline.colorsCSS];
  let colors = [...poline.colors].map(c => formatHex({ mode: currentHueModel, ...currentModelFn(c) }));

  document.documentElement.style.setProperty(
    '--prev',
    colorArrToSteppedGradient(colors)
  )

  document.documentElement.style.setProperty(
    '--prev-smooth',
    colors.join(',')
  )

  document.documentElement.style.setProperty(
    '--c0',
    colors[colors.length - 1]
  );

  document.documentElement.style.setProperty(
    '--c1',
    colors[0]
  );

  document.documentElement.style.setProperty(
    '--c-length',
    colors.length
  );

  clearTimeout(timer);
  timer = setTimeout(() => {
    paintFavicon();
    updateExport();
    updateURL();
    updateReferenceStar();
  }, 100);

  updateUI();
}

updateSVG();


$invertLightness.forEach($l => {
  $l.checked = poline.invertedLightness;
  $l.addEventListener('change', () => {
    poline.invertedLightness = $l.checked;
    invertedLightness = $l.checked;
    updateSVG();

    $invertLightness.forEach($l => {
      $l.checked = poline.invertedLightness;
    });
  });
});

$loop.forEach($l => {
  $l.checked = poline.closedLoop;
  $l.addEventListener('change', () => {
    poline.closedLoop = $l.checked;
    updateSVG();

    $loop.forEach($l => {
      $l.checked = poline.closedLoop;
    });
  });
});

$steps.forEach($step => {
  $step.addEventListener('input', () => {
    steps = parseInt($step.value);
    if ($stepsVal) $stepsVal.value = steps;
    poline.numPoints = steps;
    updateSVG();

    $steps.forEach($step => {
      $step.value = steps;
    });
  });
});

if ($stepsVal) {
  $stepsVal.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
      $steps.forEach(el => {
        el.value = val;
        el.dispatchEvent(new Event('input'));
      });
    }
  });
}


if ($referenceColorVal) {
  $referenceColorVal.addEventListener('input', () => {
    updateReferenceStar();
  });
}

if ($matchSaturationBtn) {
  $matchSaturationBtn.addEventListener('click', () => {
    if (!$referenceColorVal) return;
    const hsl = toHSL($referenceColorVal.value);
    if (!hsl) return;

    const s = hsl.s;
    poline.anchorPoints.forEach(anchor => {
      anchor.hsl = [anchor.color[0], s, anchor.color[2]];
    });
    poline.updateAnchorPairs();
    updateSVG();
  });
}

$xSelect.forEach($xSelect => {
  $xSelect.addEventListener('input', () => {
    fnx = $xSelect.value;
    poline.positionFunctionX = positionFunctions[fnx];
    updateSVG();

    $xSelect.forEach($el => {
      $el.value = fnx;
    });
  });
});


$ySelect.forEach($ySelect => {
  $ySelect.addEventListener('input', () => {
    fny = $ySelect.value;
    poline.positionFunctionY = positionFunctions[fny];
    updateSVG();

    $ySelect.forEach($el => {
      $el.value = fny;
    });
  });
});

$zSelect.forEach($zSelect => {
  $zSelect.addEventListener('input', () => {
    fnz = $zSelect.value;
    poline.positionFunctionZ = positionFunctions[fnz];
    updateSVG();

    $zSelect.forEach($el => {
      $el.value = fnz;
    });
  });
});

$randomize.forEach($randomize => {
  $randomize.addEventListener('click', () => {
    poline.anchorPoints.forEach(anchor => {
      anchor.hsl = [
        (anchor.color[0] + (-90 + Math.random() * 90)) % 360,
        Math.random(),
        anchor.color[2] + (-.05 + Math.random() * .1)
      ];
    });
    poline.updateAnchorPairs();
    updateSVG();

  });
});

let currentPoint = null;
let lastSelectedPoint = null;
let lastX = 0;
let lastY = 0;

$picker.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  const x = lastX = e.offsetX / $picker.offsetWidth;
  const y = lastY = e.offsetY / $picker.offsetHeight;

  // Check for ring hit first (skip on touch devices and if rings not enabled)
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  const ringsEnabled = $picker.classList.contains('rings-enabled');
  const ringHit = (isTouch || !ringsEnabled) ? null : pickRing(x, y);
  if (ringHit !== null) {
    const anchor = poline.anchorPoints[ringHit];
    if (!anchor) return;
    const cx = anchor.x * svgscale;
    const cy = anchor.y * svgscale;
    const svgX = x * svgscale;
    const svgY = y * svgscale;
    const startAngle = Math.atan2(svgY - cy, svgX - cx);
    ringAdjust = {
      anchorIndex: ringHit,
      startSaturation: anchor.color[1],
      startAngle,
      prevAngle: startAngle,
      accumulatedAngle: 0,
    };
    ringHoverIndex = ringHit;
    $picker.classList.add('ring-adjusting');
    updateSVG();
    try { $picker.setPointerCapture(e.pointerId); } catch { }
    return;
  }

  if (!currentPoint) {
    // Larger grab distance when rings aren't enabled
    const grabDistance = ringsEnabled ? 0.05 : 0.1;
    currentPoint = poline.getClosestAnchorPoint({
      xyz: [x, y, null],
      maxDistance: grabDistance
    });
    lastSelectedPoint = currentPoint;
  } else {
    currentPoint = null;
  }
});

$picker.addEventListener('pointermove', (e) => {
  const x = lastX = e.offsetX / $picker.offsetWidth;
  const y = lastY = e.offsetY / $picker.offsetHeight;

  // Handle ring adjustment (rotary drag)
  if (ringAdjust) {
    const anchor = poline.anchorPoints[ringAdjust.anchorIndex];
    if (!anchor) return;
    const cx = anchor.x * svgscale;
    const cy = anchor.y * svgscale;
    const svgX = x * svgscale;
    const svgY = y * svgscale;
    const curAngle = Math.atan2(svgY - cy, svgX - cx);
    let dA = curAngle - ringAdjust.prevAngle;
    if (dA > Math.PI) dA -= Math.PI * 2;
    else if (dA < -Math.PI) dA += Math.PI * 2;
    ringAdjust.accumulatedAngle += dA;
    ringAdjust.prevAngle = curAngle;
    const turns = ringAdjust.accumulatedAngle / (Math.PI * 2);
    const turnsToFull = e.shiftKey ? ROTARY_TURNS_TO_FULL_SHIFT : ROTARY_TURNS_TO_FULL;
    const deltaSat = turns / turnsToFull;
    let newSaturation = Math.max(0, Math.min(1, ringAdjust.startSaturation + deltaSat));
    if (newSaturation > 0.99) newSaturation = 1;
    if (newSaturation < 0.01) newSaturation = 0;
    const atBound = newSaturation === 0 || newSaturation === 1;
    const movingPastBound = (newSaturation === 1 && deltaSat > 0) || (newSaturation === 0 && deltaSat < 0);
    if (atBound && movingPastBound) {
      ringAdjust.startSaturation = newSaturation;
      ringAdjust.accumulatedAngle = 0;
      ringAdjust.prevAngle = curAngle;
    }
    poline.updateAnchorPoint({
      point: anchor,
      color: [anchor.color[0], newSaturation, anchor.color[2]]
    });
    updateSVG();

    return;
  }

  if (currentPoint) {
    e.stopPropagation();
    poline.updateAnchorPoint({ point: currentPoint, xyz: [x, y, currentPoint.z] });
    updateSVG();

    return;
  }

  // Handle ring hover detection (skip on touch devices and if rings not enabled)
  if (!window.matchMedia('(pointer: coarse)').matches && $picker.classList.contains('rings-enabled')) {
    const ringHover = pickRing(x, y);
    if (ringHover !== ringHoverIndex) {
      ringHoverIndex = ringHover;
      $picker.classList.toggle('ring-hover', ringHover !== null);
      // Just update hover classes, don't call full updateSVG
      const ringGroups = $svg.querySelectorAll('.wheel__ring-group');
      ringGroups.forEach((group, i) => {
        group.classList.toggle('wheel__ring-group--hover', i === ringHoverIndex);
      });
    }
  }
});

$picker.addEventListener('pointerup', (e) => {
  if (ringAdjust) {
    try { $picker.releasePointerCapture(e.pointerId); } catch { }
    $picker.classList.remove('ring-adjusting');
  }
  ringAdjust = null;
  currentPoint = null;
  // Re-check hover state (only if rings enabled)
  if ($picker.classList.contains('rings-enabled') && !window.matchMedia('(pointer: coarse)').matches) {
    const x = e.offsetX / $picker.offsetWidth;
    const y = e.offsetY / $picker.offsetHeight;
    const ringHover = pickRing(x, y);
    if (ringHover !== ringHoverIndex) {
      ringHoverIndex = ringHover;
      $picker.classList.toggle('ring-hover', ringHover !== null);
      // Just update hover classes, don't call full updateSVG
      const ringGroups = $svg.querySelectorAll('.wheel__ring-group');
      ringGroups.forEach((group, i) => {
        group.classList.toggle('wheel__ring-group--hover', i === ringHoverIndex);
      });
    }
  }
});

// Color At functionality for sections that don't have their own handler
if ($colorAt) {
  $colorAt.addEventListener('input', (e) => {
    const val = Math.max(0, Math.min(1, parseFloat(e.target.value)));
    const color = poline.getColorAt(val);
    document.documentElement.style.setProperty('--color-at', color.hslCSS);
  });
}

// copy code to clipboard
document.addEventListener('click', (e) => {
  const $target = e.target.closest('[data-copy-code]');
  if ($target) {
    const code = $target.parentElement.querySelector('[data-code]').innerText;
    navigator.clipboard.writeText(code).then(() => {
      $target.classList.add('copied');
      setTimeout(() => {
        $target.classList.remove('copied');
      }, 1000);
    });
  }
});

// listen for keypresses
document.addEventListener('keydown', (e) => {
  // Add pressing class to matching key elements
  document.querySelectorAll(`[data-key="${e.key}"], [data-key="${e.key.toLowerCase()}"]`).forEach(el => {
    el.classList.add('key--pressing');
  });

  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (!lastSelectedPoint) return;
    poline.removeAnchorPoint({ point: lastSelectedPoint });
    updateSVG();

  }

  if (e.key === 'p') {
    lastSelectedPoint = poline.addAnchorPoint({ xyz: [lastX, lastY, lastY], clamp: true });
    updateSVG();

  }

  if (e.key === 'k') {
    if (!lastSelectedPoint) return;
    const $color = document.createElement('input');
    $color.type = 'color';
    $color.classList.add('hidden-color-picker');
    $color.setAttribute('aria-hidden', 'true');
    $color.style.position = 'absolute';
    $color.style.top = '-1000px';
    $color.style.right = '-1000px';
    $color.value = formatHex(lastSelectedPoint.hslCSS);
    $color.addEventListener('input', () => {
      const hslObj = toHSL($color.value);
      poline.updateAnchorPoint({
        point: lastSelectedPoint, color: [hslObj.h || 0, hslObj.s, hslObj.l]
      });

      updateSVG();

    });
    document.body.appendChild($color);
    $color.click();
    document.querySelectorAll('[data-key="k"]').forEach(el => {
      el.classList.remove('key--pressing');
    });
  }

  if (e.key === 'ArrowLeft') {
    poline.shiftHue(-2)
    updateSVG();

  }

  if (e.key === 'ArrowRight') {
    poline.shiftHue(2)
    updateSVG();

  }

  if (e.key === 's' || e.key === 'S') {
    $picker.classList.toggle('rings-enabled');
  }
});

document.addEventListener('keyup', (e) => {
  document.querySelectorAll(`[data-key="${e.key}"], [data-key="${e.key.toLowerCase()}"]`).forEach(el => {
    el.classList.remove('key--pressing');
  });
});

let exStartHue = Math.random() * 360;
let globalInterval = null;

// Helper to generate well-spaced random anchor colors
function generateSpacedAnchorColors(count, jitter = 20) {
  const baseHue = Math.random() * 360; // Random starting point
  const hueStep = 360 / count; // Even distribution

  return Array.from({ length: count }, (_, i) => {
    // Evenly spaced hue with random jitter
    const hue = (baseHue + i * hueStep + (Math.random() - 0.5) * jitter * 2) % 360;
    const sat = 0.5 + Math.random() * 0.5; // 0.5 to 1
    const light = 0.3 + Math.random() * 0.5; // 0.3 to 0.8
    return [hue, sat, light];
  });
}



const $hueshift = document.querySelector('[data-hueshift]');
const $addAnchor = document.querySelector('[data-add-anchor]');
const $removeAnchor = document.querySelector('[data-remove-anchor]');

if ($hueshift) {
  let initialHueShift = 0;
  $hueshift.addEventListener('input', (e) => {
    const newVal = parseInt(e.target.value);
    if ($hueshiftVal) $hueshiftVal.value = newVal;
    const delta = newVal - initialHueShift;
    poline.shiftHue(delta);
    initialHueShift = newVal;
    updateSVG();
    // updateFullCode(); // Code block removed
  });

  if ($hueshiftVal) {
    $hueshiftVal.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      if (!isNaN(val)) {
        $hueshift.value = val;
        $hueshift.dispatchEvent(new Event('input'));
      }
    });
  }
}

if ($addAnchor) {
  $addAnchor.addEventListener('click', () => {
    poline.addAnchorPoint({
      color: [(Math.random() * 360), Math.random(), Math.random()],
    });
    updateSVG();
  });
}

if ($removeAnchor) {
  $removeAnchor.addEventListener('click', () => {
    if (poline.anchorPoints.length > 2) {
      poline.removeAnchorPoint({ index: poline.anchorPoints.length - 1 });
      updateSVG();
    }
  });
}

// Ensure proper initial state for playground
$picker.classList.add('rings-enabled');
updateSVG();
// updateFullCode(); 

// Background controls
const $bgDarkBtn = document.getElementById('bg-dark-btn');
const $bgLightBtn = document.getElementById('bg-light-btn');
const $bgDefaultBtn = document.getElementById('bg-default-btn');

if ($bgDarkBtn) {
  $bgDarkBtn.addEventListener('click', () => {
    document.documentElement.style.setProperty('--bg', '#000');
    document.documentElement.style.setProperty('--onBg', '#fff');
    background = 'dark';
    updateURL();
  });
}

if ($bgLightBtn) {
  $bgLightBtn.addEventListener('click', () => {
    document.documentElement.style.setProperty('--bg', '#fff');
    document.documentElement.style.setProperty('--onBg', '#000');
    background = 'light';
    updateURL();
  });
}

if ($bgDefaultBtn) {
  $bgDefaultBtn.addEventListener('click', () => {
    document.documentElement.style.removeProperty('--bg');
    document.documentElement.style.removeProperty('--onBg');
    background = 'default';
    updateURL();
  });
}
