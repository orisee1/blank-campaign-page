export async function exportToXlsx(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Central de Campanha"; workbook.created = new Date();
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), { views: [{ state: "frozen", ySplit: 1 }] });
  const headers = rows.length ? Object.keys(rows[0]) : ["Sem registros"];
  worksheet.columns = headers.map((header) => ({ header, key: header, width: Math.min(42, Math.max(14, header.length + 2, ...rows.map((row) => String(row[header] ?? "").length + 2))) }));
  rows.forEach((row) => worksheet.addRow(row));
  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, worksheet.rowCount), column: headers.length } };
  const header = worksheet.getRow(1); header.font = { bold: true, color: { argb: "FFFFFFFF" } }; header.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF183F34" } }; header.alignment = { vertical: "middle" }; header.height = 24;
  worksheet.eachRow((row, rowNumber) => { if (rowNumber > 1 && rowNumber % 2 === 0) row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F2EC" } }; row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFE4E0D7" } } }; }); });
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = `${filename}.xlsx`; anchor.click(); URL.revokeObjectURL(url);
}

export function importSpreadsheet(file: File): Promise<Record<string, unknown>[]> {
  return file.arrayBuffer().then(async (buffer) => {
    if (file.name.toLowerCase().endsWith(".csv")) {
      const text = new TextDecoder().decode(buffer); const lines = text.split(/\r?\n/).filter(Boolean); const separator = lines[0]?.includes(";") ? ";" : ","; const headers = lines[0]?.split(separator).map((item) => item.trim().replace(/^"|"$/g, "")) ?? [];
      return lines.slice(1).map((line) => Object.fromEntries(line.split(separator).map((value, index) => [headers[index], value.trim().replace(/^"|"$/g, "")])));
    }
    const { default: ExcelJS } = await import("exceljs"); const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer); const sheet = workbook.worksheets[0]; if (!sheet) return [];
    const headers = (sheet.getRow(1).values as unknown[]).slice(1).map(String); const rows: Record<string, unknown>[] = [];
    sheet.eachRow((row, rowNumber) => { if (rowNumber === 1) return; const values = (row.values as unknown[]).slice(1); rows.push(Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]))); }); return rows;
  });
}

export async function exportTablePdf(title: string, subtitle: string, columns: string[], rows: (string | number)[][], campaignName: string, generatedBy: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const document = new jsPDF({ orientation: columns.length > 6 ? "landscape" : "portrait", unit: "mm", format: "a4" });
  document.setFillColor(24, 63, 52); document.rect(0, 0, document.internal.pageSize.getWidth(), 28, "F");
  document.setTextColor(255, 255, 255); document.setFontSize(16); document.text(campaignName, 14, 12); document.setFontSize(10); document.text(title, 14, 20);
  document.setTextColor(70, 76, 72); document.setFontSize(10); document.text(subtitle, 14, 36);
  autoTable(document, { head: [columns], body: rows, startY: 42, theme: "striped", headStyles: { fillColor: [42, 115, 88], fontSize: 8 }, bodyStyles: { fontSize: 8 }, margin: { bottom: 18 } });
  const total = document.getNumberOfPages();
  for (let page = 1; page <= total; page += 1) {
    document.setPage(page); document.setFontSize(7); document.setTextColor(110, 110, 110);
    document.text(`Gerado em ${new Date().toLocaleString("pt-BR")} por ${generatedBy}`, 14, document.internal.pageSize.getHeight() - 8);
    document.text(`Página ${page} de ${total}`, document.internal.pageSize.getWidth() - 28, document.internal.pageSize.getHeight() - 8);
  }
  document.save(`${title.toLocaleLowerCase("pt-BR").replace(/[^a-z0-9]+/gi, "-")}.pdf`);
}
