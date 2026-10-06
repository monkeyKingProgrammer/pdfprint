import * as pdfjsLib from '../node_modules/pdfjs-dist/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  '../node_modules/pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).href;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const PAPER = {
  a3: { label: 'A3', width: 297, height: 420 },
  a4: { label: 'A4', width: 210, height: 297 },
  a5: { label: 'A5', width: 148, height: 210 },
  letter: { label: 'US Letter', width: 215.9, height: 279.4 },
  legal: { label: 'US Legal', width: 215.9, height: 355.6 }
};

const state = {
  pdf: null,
  file: null,
  currentPage: 1,
  pageMode: 'all',
  scaleMode: 'fit',
  zoom: 1,
  renderVersion: 0,
  previewTimer: null
};

const el = {
  openFileBtn: $('#openFileBtn'), replaceFileBtn: $('#replaceFileBtn'), emptyOpenBtn: $('#emptyOpenBtn'),
  fileName: $('#fileName'), fileDetails: $('#fileDetails'), printerSelect: $('#printerSelect'),
  copies: $('#copies'), collate: $('#collate'), colorMode: $('#colorMode'), duplex: $('#duplex'),
  rangeField: $('#rangeField'), pageRange: $('#pageRange'), paperSize: $('#paperSize'),
  orientation: $('#orientation'), rotation: $('#rotation'), customScaleField: $('#customScaleField'),
  customScale: $('#customScale'), shrinkOversize: $('#shrinkOversize'), marginTop: $('#marginTop'),
  marginRight: $('#marginRight'), marginBottom: $('#marginBottom'), marginLeft: $('#marginLeft'),
  alignX: $('#alignX'), alignY: $('#alignY'), showGuides: $('#showGuides'), quality: $('#quality'),
  resetMargins: $('#resetMargins'), centerBtn: $('#centerBtn'), previewStatus: $('#previewStatus'),
  previewViewport: $('#previewViewport'), emptyState: $('#emptyState'), previewStage: $('#previewStage'),
  previewCanvas: $('#previewCanvas'), zoomOut: $('#zoomOut'), zoomIn: $('#zoomIn'), zoomLabel: $('#zoomLabel'),
  pageNavigator: $('#pageNavigator'), prevPage: $('#prevPage'), nextPage: $('#nextPage'),
  currentPage: $('#currentPage'), pageCount: $('#pageCount'), summaryTitle: $('#summaryTitle'),
  summaryDetail: $('#summaryDetail'), dialogPrintBtn: $('#dialogPrintBtn'), quickPrintBtn: $('#quickPrintBtn'),
  printRoot: $('#printRoot'), toast: $('#toast'), busyOverlay: $('#busyOverlay'),
  busyTitle: $('#busyTitle'), busyDetail: $('#busyDetail')
};

function numberValue(input, fallback = 0) {
  const value = Number(input.value);
  return Number.isFinite(value) ? value : fallback;
}

function settings() {
  return {
    paper: el.paperSize.value,
    orientation: el.orientation.value,
    rotation: numberValue(el.rotation),
    scaleMode: state.scaleMode,
    customScale: Math.max(10, Math.min(500, numberValue(el.customScale, 100))) / 100,
    shrinkOversize: el.shrinkOversize.checked,
    margins: {
      top: Math.max(0, numberValue(el.marginTop)),
      right: Math.max(0, numberValue(el.marginRight)),
      bottom: Math.max(0, numberValue(el.marginBottom)),
      left: Math.max(0, numberValue(el.marginLeft))
    },
    alignX: el.alignX.value,
    alignY: el.alignY.value
  };
}

function paperDimensions(config = settings()) {
  const base = PAPER[config.paper];
  return config.orientation === 'landscape'
    ? { width: base.height, height: base.width }
    : { width: base.width, height: base.height };
}

function calculateLayout(page, config = settings()) {
  const paper = paperDimensions(config);
  const viewport = page.getViewport({ scale: 1, rotation: config.rotation });
  const sourceMm = { width: viewport.width * 25.4 / 72, height: viewport.height * 25.4 / 72 };
  const available = {
    width: Math.max(1, paper.width - config.margins.left - config.margins.right),
    height: Math.max(1, paper.height - config.margins.top - config.margins.bottom)
  };
  const fit = Math.min(available.width / sourceMm.width, available.height / sourceMm.height);
  const fill = Math.max(available.width / sourceMm.width, available.height / sourceMm.height);
  let scale = 1;

  if (config.scaleMode === 'fit') scale = config.shrinkOversize ? Math.min(1, fit) : fit;
  if (config.scaleMode === 'fill') scale = fill;
  if (config.scaleMode === 'custom') scale = config.customScale;

  const content = { width: sourceMm.width * scale, height: sourceMm.height * scale };
  let x = config.margins.left;
  let y = config.margins.top;
  if (config.alignX === 'center') x += (available.width - content.width) / 2;
  if (config.alignX === 'right') x += available.width - content.width;
  if (config.alignY === 'center') y += (available.height - content.height) / 2;
  if (config.alignY === 'bottom') y += available.height - content.height;

  return { paper, viewport, sourceMm, available, content, x, y, scale };
}

async function renderComposedPage(pageNumber, dpi, guides = false, expectedVersion = null) {
  const page = await state.pdf.getPage(pageNumber);
  if (expectedVersion !== null && expectedVersion !== state.renderVersion) return null;
  const config = settings();
  const layout = calculateLayout(page, config);
  const pxPerMm = dpi / 25.4;
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(layout.paper.width * pxPerMm);
  canvas.height = Math.round(layout.paper.height * pxPerMm);
  const ctx = canvas.getContext('2d', { alpha: false });
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const pdfViewport = page.getViewport({ scale: (dpi / 72) * layout.scale, rotation: config.rotation });
  const pageCanvas = document.createElement('canvas');
  pageCanvas.width = Math.max(1, Math.round(pdfViewport.width));
  pageCanvas.height = Math.max(1, Math.round(pdfViewport.height));
  const pageContext = pageCanvas.getContext('2d', { alpha: false });
  pageContext.fillStyle = '#fff';
  pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  await page.render({ canvasContext: pageContext, viewport: pdfViewport }).promise;
  if (expectedVersion !== null && expectedVersion !== state.renderVersion) return null;

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, canvas.width, canvas.height);
  ctx.clip();
  ctx.drawImage(pageCanvas, Math.round(layout.x * pxPerMm), Math.round(layout.y * pxPerMm));
  ctx.restore();

  if (guides) {
    ctx.save();
    ctx.strokeStyle = '#e65235';
    ctx.lineWidth = Math.max(1, dpi / 96);
    ctx.setLineDash([5 * dpi / 96, 4 * dpi / 96]);
    ctx.strokeRect(
      config.margins.left * pxPerMm,
      config.margins.top * pxPerMm,
      layout.available.width * pxPerMm,
      layout.available.height * pxPerMm
    );
    ctx.restore();
  }
  return { canvas, layout };
}

async function renderPreview() {
  if (!state.pdf) return;
  const version = ++state.renderVersion;
  try {
    const result = await renderComposedPage(state.currentPage, 96, el.showGuides.checked, version);
    if (!result || version !== state.renderVersion) return;
    const target = el.previewCanvas;
    target.width = result.canvas.width;
    target.height = result.canvas.height;
    target.getContext('2d', { alpha: false }).drawImage(result.canvas, 0, 0);

    const maxWidth = Math.max(280, el.previewViewport.clientWidth - 100);
    const maxHeight = Math.max(300, el.previewViewport.clientHeight - 80);
    const baseScale = Math.min(maxWidth / target.width, maxHeight / target.height, 0.82);
    target.style.width = `${Math.round(target.width * baseScale * state.zoom)}px`;
    target.style.height = `${Math.round(target.height * baseScale * state.zoom)}px`;

    const percent = Math.round(result.layout.scale * 100);
    el.previewStatus.textContent = `Page ${state.currentPage} · ${percent}% content scale · ${result.layout.paper.width} × ${result.layout.paper.height} mm`;
    updateSummary();
  } catch (error) {
    console.error(error);
    showToast(`Preview failed: ${error.message}`, true);
  }
}

function schedulePreview() {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(renderPreview, 90);
}

function updateSummary() {
  if (!state.pdf) return;
  const pages = selectedPages(false);
  const pageText = pages.length === 1 ? '1 page' : `${pages.length} pages`;
  const paper = PAPER[el.paperSize.value].label;
  el.summaryTitle.textContent = `${pageText} · ${paper} · ${el.orientation.value}`;
  el.summaryDetail.textContent = `${state.scaleMode === 'custom' ? `${el.customScale.value}%` : state.scaleMode} sizing · ${el.colorMode.value === 'color' ? 'Color' : 'Grayscale'} · ${el.duplex.options[el.duplex.selectedIndex].text}`;
}

function parsePageRange(text, count) {
  const pages = new Set();
  const value = text.trim();
  if (!value) return [];
  for (const part of value.split(',')) {
    const token = part.trim();
    if (!token) continue;
    if (/^\d+$/.test(token)) {
      const n = Number(token);
      if (n >= 1 && n <= count) pages.add(n);
      continue;
    }
    const match = token.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!match) throw new Error(`“${token}” is not a valid page or range.`);
    const start = Number(match[1]);
    const end = Number(match[2]);
    if (start < 1 || end > count || start > end) throw new Error(`Range ${token} is outside this document.`);
    for (let n = start; n <= end; n += 1) pages.add(n);
  }
  return [...pages].sort((a, b) => a - b);
}

function selectedPages(strict = true) {
  if (!state.pdf) return [];
  if (state.pageMode === 'current') return [state.currentPage];
  if (state.pageMode === 'custom') {
    try {
      const pages = parsePageRange(el.pageRange.value, state.pdf.numPages);
      if (strict && pages.length === 0) throw new Error('Enter at least one page to print.');
      return pages;
    } catch (error) {
      if (strict) throw error;
      return [];
    }
  }
  return Array.from({ length: state.pdf.numPages }, (_, index) => index + 1);
}

async function loadPdfFile(file) {
  try {
    if (!file) return;
    showBusy('Opening document…', file.name);
    const bytes = file.data instanceof Uint8Array ? file.data : new Uint8Array(file.data);
    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    state.pdf = pdf;
    state.file = file;
    state.currentPage = 1;
    el.fileName.textContent = file.name;
    el.fileDetails.textContent = `${pdf.numPages} ${pdf.numPages === 1 ? 'page' : 'pages'} · ${file.path}`;
    el.pageCount.textContent = pdf.numPages;
    el.currentPage.max = pdf.numPages;
    el.currentPage.value = '1';
    el.emptyState.classList.add('hidden');
    el.previewStage.classList.remove('hidden');
    el.pageNavigator.classList.remove('disabled');
    el.dialogPrintBtn.disabled = false;
    el.quickPrintBtn.disabled = false;
    hideBusy();
    await renderPreview();
  } catch (error) {
    hideBusy();
    console.error(error);
    showToast(error?.name === 'PasswordException' ? 'This PDF is password protected.' : `Could not open PDF: ${error.message}`, true);
  }
}

async function openPdf() {
  const file = await window.printCraft.openPdf();
  await loadPdfFile(file);
}

function setCurrentPage(value) {
  if (!state.pdf) return;
  state.currentPage = Math.max(1, Math.min(state.pdf.numPages, Number(value) || 1));
  el.currentPage.value = state.currentPage;
  renderPreview();
}

function showBusy(title, detail = '') {
  el.busyTitle.textContent = title;
  el.busyDetail.textContent = detail;
  el.busyOverlay.classList.remove('hidden');
}

function hideBusy() { el.busyOverlay.classList.add('hidden'); }

let toastTimer;
function showToast(message, error = false) {
  clearTimeout(toastTimer);
  el.toast.textContent = message;
  el.toast.classList.toggle('error', error);
  el.toast.classList.add('show');
  toastTimer = setTimeout(() => el.toast.classList.remove('show'), 3200);
}

async function refreshPrinters() {
  try {
    const printers = await window.printCraft.listPrinters();
    for (const printer of printers) {
      const option = document.createElement('option');
      option.value = printer.name;
      option.textContent = `${printer.displayName || printer.name}${printer.isDefault ? ' · Default' : ''}`;
      if (printer.isDefault) option.selected = true;
      el.printerSelect.append(option);
    }
  } catch (error) {
    console.warn('Printer discovery failed', error);
  }
}

async function prepareAndPrint(silent) {
  if (!state.pdf) return;
  if (silent && !el.printerSelect.value) {
    showToast('Choose a printer for direct printing, or use “Print with dialog”.', true);
    return;
  }

  let pages;
  try { pages = selectedPages(true); }
  catch (error) { showToast(error.message, true); return; }

  const config = settings();
  const paper = paperDimensions(config);
  const dpi = numberValue(el.quality, 150);
  showBusy('Preparing pages…', `0 of ${pages.length}`);
  el.printRoot.replaceChildren();

  try {
    for (let index = 0; index < pages.length; index += 1) {
      el.busyDetail.textContent = `Rendering page ${index + 1} of ${pages.length}`;
      const result = await renderComposedPage(pages[index], dpi, false);
      const sheet = document.createElement('div');
      sheet.className = 'print-page';
      sheet.style.width = `${paper.width}mm`;
      sheet.style.height = `${paper.height}mm`;
      sheet.append(result.canvas);
      el.printRoot.append(sheet);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }

    let style = $('#dynamicPrintStyle');
    if (!style) {
      style = document.createElement('style');
      style.id = 'dynamicPrintStyle';
      document.head.append(style);
    }
    style.textContent = `@media print { @page { size: ${paper.width}mm ${paper.height}mm; margin: 0; } }`;
    el.busyTitle.textContent = silent ? 'Sending to printer…' : 'Opening print dialog…';
    el.busyDetail.textContent = `${pages.length} ${pages.length === 1 ? 'page' : 'pages'} ready`;
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

    const result = await window.printCraft.print({
      silent,
      deviceName: el.printerSelect.value,
      copies: numberValue(el.copies, 1),
      collate: el.collate.checked,
      color: el.colorMode.value === 'color',
      duplex: el.duplex.value,
      orientation: el.orientation.value
    });
    hideBusy();
    if (result.success) showToast(silent ? 'Print job sent successfully.' : 'Print request completed.');
    else if (result.reason && !/cancel/i.test(result.reason)) showToast(`Printing failed: ${result.reason}`, true);
  } catch (error) {
    hideBusy();
    console.error(error);
    showToast(`Printing failed: ${error.message}`, true);
  } finally {
    setTimeout(() => el.printRoot.replaceChildren(), 500);
  }
}

function bindControls() {
  [el.openFileBtn, el.replaceFileBtn, el.emptyOpenBtn].forEach((button) => button.addEventListener('click', openPdf));

  $$('[data-page-mode]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-page-mode]').forEach((item) => item.classList.toggle('active', item === button));
    state.pageMode = button.dataset.pageMode;
    el.rangeField.classList.toggle('hidden', state.pageMode !== 'custom');
    updateSummary();
  }));

  $$('[data-scale-mode]').forEach((button) => button.addEventListener('click', () => {
    $$('[data-scale-mode]').forEach((item) => item.classList.toggle('active', item === button));
    state.scaleMode = button.dataset.scaleMode;
    el.customScaleField.classList.toggle('hidden', state.scaleMode !== 'custom');
    schedulePreview();
  }));

  const previewControls = [el.paperSize, el.orientation, el.rotation, el.customScale, el.shrinkOversize,
    el.marginTop, el.marginRight, el.marginBottom, el.marginLeft, el.alignX, el.alignY, el.showGuides];
  previewControls.forEach((control) => {
    control.addEventListener('input', schedulePreview);
    control.addEventListener('change', schedulePreview);
  });

  [el.colorMode, el.duplex, el.pageRange].forEach((control) => {
    control.addEventListener('input', updateSummary);
    control.addEventListener('change', updateSummary);
  });

  el.centerBtn.addEventListener('click', () => {
    el.alignX.value = 'center';
    el.alignY.value = 'center';
    schedulePreview();
  });
  el.resetMargins.addEventListener('click', () => {
    [el.marginTop, el.marginRight, el.marginBottom, el.marginLeft].forEach((input) => { input.value = '10'; });
    schedulePreview();
  });
  el.prevPage.addEventListener('click', () => setCurrentPage(state.currentPage - 1));
  el.nextPage.addEventListener('click', () => setCurrentPage(state.currentPage + 1));
  el.currentPage.addEventListener('change', () => setCurrentPage(el.currentPage.value));
  el.zoomOut.addEventListener('click', () => {
    state.zoom = Math.max(.5, state.zoom - .1);
    el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
    renderPreview();
  });
  el.zoomIn.addEventListener('click', () => {
    state.zoom = Math.min(2, state.zoom + .1);
    el.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
    renderPreview();
  });
  el.dialogPrintBtn.addEventListener('click', () => prepareAndPrint(false));
  el.quickPrintBtn.addEventListener('click', () => prepareAndPrint(true));
  window.addEventListener('resize', schedulePreview);
}

bindControls();
refreshPrinters();
window.printCraft.getLaunchPdf().then(loadPdfFile).catch((error) => console.warn('Launch PDF failed', error));
