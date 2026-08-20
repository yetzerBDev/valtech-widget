// Test: verificar que toCleanDate no corrige fechas un dia atras
const { toCleanDate, isoLocal } = require("../lib/excel-parser.cjs");

let passed = 0;
let failed = 0;

function assert(label, actual, expected) {
  if (actual === expected) {
    passed++;
    console.log(`  OK: ${label}`);
  } else {
    failed++;
    console.error(`  FALLO: ${label} -> obtuve "${actual}", esperaba "${expected}"`);
  }
}

console.log("--- Test isoLocal ---");
// Date local: 1 de enero 2026 00:00 en hora local (Honduras UTC-6)
const d1 = new Date(2026, 0, 1, 0, 0, 0); // mes es 0-indexed
assert("1 enero 2026 local -> 2026-01-01", isoLocal(d1), "2026-01-01");

// Date local: 31 de diciembre 2025 00:00
const d2 = new Date(2025, 11, 31, 0, 0, 0);
assert("31 dic 2025 local -> 2025-12-31", isoLocal(d2), "2025-12-31");

// Date local: 15 de agosto 2026
const d3 = new Date(2026, 7, 15, 10, 30, 0);
assert("15 ago 2026 local -> 2026-08-15", isoLocal(d3), "2026-08-15");

console.log("\n--- Test toCleanDate con Date nativo ---");
// Simula lo que XLSX hace con cellDates: true en UTC-6
// Una celda con 01/08/2026 00:00 en Excel se convierte a Date(2026, 7, 1) en local
const excelDate = new Date(2026, 0, 1, 0, 0, 0);
assert("Date(2026,0,1) -> 2026-01-01", toCleanDate(excelDate), "2026-01-01");

const excelDate2 = new Date(2026, 7, 15);
assert("Date(2026,7,15) -> 2026-08-15", toCleanDate(excelDate2), "2026-08-15");

console.log("\n--- Test toCleanDate con serial de Excel ---");
// Serial 46023 = 2026-01-01 en UTC (excelSerialToDate usa Date.UTC)
assert("serial 46023 -> 2026-01-01", toCleanDate(46023), "2026-01-01");

// Serial 45834 = 2025-06-26 en UTC
assert("serial 45834 -> 2025-06-26", toCleanDate(45834), "2025-06-26");

console.log("\n--- Test toCleanDate con texto ---");
assert("texto 01/08/2026 -> 2026-08-01", toCleanDate("01/08/2026"), "2026-08-01");
assert("texto 2026-01-15 -> 2026-01-15", toCleanDate("2026-01-15"), "2026-01-15");
assert("texto 18-Ago-2026 -> 2026-08-18", toCleanDate("18-Ago-2026"), "2026-08-18");

console.log(`\n=== Resultado: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
