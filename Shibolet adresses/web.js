import './web.css';
import { fields, outputFields, splitAddress, statuses } from './address.js';
import { readFile, writeWorkbook } from './workbook.js';

const byId = id => document.getElementById(id);
const file = byId('file');
const sheet = byId('sheet');
const column = byId('column');
const exportButton = byId('export');
const status = byId('status');
const pageSize = 50;

let sheets = [];
let headers = [];
let rows = [];
let results = [];
let page = 0;
let loadId = 0;

function options(select, labels) {
  select.replaceChildren(...labels.map((label, index) => new Option(label, index)));
}

file.addEventListener('change', async () => {
  const id = ++loadId;
  const selected = file.files[0];
  byId('sheet-field').hidden = true;
  byId('column-field').hidden = true;
  byId('review').hidden = true;
  exportButton.hidden = true;
  status.textContent = selected ? 'קוראת את הקובץ…' : 'אפשר להעלות קובץ XLSX או CSV.';
  if (!selected) return;
  try {
    const loaded = await readFile(selected);
    if (id !== loadId) return;
    sheets = loaded;
    options(sheet, sheets.map(item => item.name));
    byId('sheet-field').hidden = sheets.length < 2;
    chooseSheet();
  } catch {
    if (id === loadId) status.textContent = 'לא ניתן לקרוא את הקובץ. בדקו את הפורמט ונסו שוב.';
  }
});

function chooseSheet() {
  const [first, ...data] = sheets[Number(sheet.value)]?.data ?? [];
  if (!first?.length || !data.length) {
    byId('column-field').hidden = true;
    byId('review').hidden = true;
    exportButton.hidden = true;
    status.textContent = 'אין שורות נתונים בגיליון שנבחר.';
    return;
  }
  const width = data.reduce((max, row) => Math.max(max, row.length), first.length);
  headers = Array.from({ length: width }, (_, index) => first[index] || `עמודה ${index + 1}`);
  rows = data.map(row => Array.from({ length: width }, (_, index) => row[index] ?? ''));
  options(column, headers);
  column.selectedIndex = Math.max(0, headers.findIndex(label => label.includes('כתובת')));
  byId('column-field').hidden = false;
  chooseColumn();
}

function chooseColumn() {
  results = rows.map(row => splitAddress(row[column.selectedIndex]));
  const heading = document.createElement('tr');
  for (const title of [headers[column.selectedIndex], ...outputFields(headers)]) {
    const cell = document.createElement('th');
    cell.scope = 'col';
    cell.textContent = title;
    heading.append(cell);
  }
  byId('head').replaceChildren(heading);
  byId('review').hidden = false;
  exportButton.hidden = false;
  page = 0;
  renderPage();
  updateStatus();
}

function updateStatus() {
  const pending = results.filter(row => row[4] === 'לבדיקה' || row[4] === 'חסרה כתובת').length;
  status.textContent = `${rows.length.toLocaleString('he')} רשומות · ${pending.toLocaleString('he')} לבדיקה או עם כתובת חסרה`;
}

function renderPage() {
  const first = page * pageSize;
  const body = byId('rows');
  body.replaceChildren();
  results.slice(first, first + pageSize).forEach((result, offset) => {
    const index = first + offset;
    const row = body.insertRow();
    row.insertCell().textContent = rows[index][column.selectedIndex];
    result.forEach((value, field) => {
      const control = document.createElement(field === 4 ? 'select' : 'input');
      if (field === 4) control.replaceChildren(...statuses.map(label => new Option(label)));
      control.value = value;
      control.setAttribute('aria-label', `${fields[field]}, שורה ${index + 1}`);
      control.addEventListener('input', () => {
        result[field] = control.value;
        if (field === 4) updateStatus();
      });
      row.insertCell().append(control);
    });
  });
  const pages = Math.ceil(rows.length / pageSize);
  byId('prev').disabled = page === 0;
  byId('next').disabled = page + 1 === pages;
  byId('page').textContent = `עמוד ${page + 1} מתוך ${pages}`;
}

sheet.addEventListener('change', chooseSheet);
column.addEventListener('change', chooseColumn);
byId('prev').addEventListener('click', () => { page--; renderPage(); });
byId('next').addEventListener('click', () => { page++; renderPage(); });
exportButton.addEventListener('click', async () => {
  exportButton.disabled = true;
  const name = file.files[0].name.replace(/\.[^.]+$/, '');
  try {
    const data = await writeWorkbook(headers, rows, outputFields(headers), results);
    const url = URL.createObjectURL(new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${name}-כתובות.xlsx`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch {
    status.textContent = 'הכנת קובץ ה־Excel נכשלה. נסו שוב.';
  } finally {
    exportButton.disabled = false;
  }
});
