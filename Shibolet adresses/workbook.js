import ExcelJS from 'exceljs';
import Papa from 'papaparse';

export async function readFile(file) {
  const bytes = await file.arrayBuffer();
  if (/\.csv$/i.test(file.name)) {
    let csv;
    try {
      csv = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      csv = new TextDecoder('windows-1255').decode(bytes);
    }
    const { data, errors } = Papa.parse(csv, {
      delimitersToGuess: [',', ';', '\t'],
      skipEmptyLines: 'greedy',
    });
    if (errors.some(error => error.code !== 'UndetectableDelimiter')) throw new Error('Invalid CSV');
    return [{ name: 'CSV', data }];
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return workbook.worksheets.map(sheet => ({
    name: sheet.name,
    data: Array.from({ length: sheet.rowCount }, (_, index) => {
      const row = sheet.getRow(index + 1);
      return Array.from({ length: sheet.columnCount }, (_, col) => row.getCell(col + 1).text);
    }),
  }));
}

export async function writeWorkbook(headers, rows, fields, results) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('כתובות', { views: [{ rightToLeft: true }] });
  sheet.addRow([...headers, ...fields]);
  rows.forEach((row, index) => sheet.addRow([...row, ...results[index]]));
  return workbook.xlsx.writeBuffer();
}
