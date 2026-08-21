const ExcelJS = require("exceljs");
const fs = require("fs");

(async () => {
  const data = JSON.parse(
    fs.readFileSync("C:\\Users\\user\\Desktop\\RECOVERY_AVALUOS.json", "utf8")
  );
  console.log("Registros:", data.length);

  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Avaluos");

  const cols = Object.keys(data[0]);
  ws.columns = cols.map((c) => ({ header: c, key: c, width: 22 }));

  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF4472C4" },
  };
  headerRow.font = { bold: true, color: { argb: "FFFFFFFF" } };

  data.forEach((row) => ws.addRow(row));

  const outPath =
    "C:\\Users\\user\\Desktop\\EXCEL_MAESTRO_RECOVERED.xlsx";
  await wb.xlsx.writeFile(outPath);
  console.log("Guardado en:", outPath);
})();
