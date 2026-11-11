// The rows an import left out or could not make, as a CSV to download: one
// line per row of the file, with where it was, why, and its cells as written.

export type ReportLine = { file: string; line: number; id: string; reason: string; cells: string[] };

const quote = (value: string) => (/[",;\r\n]/.test(value) || value !== value.trim() ? `"${value.replace(/"/g, '""')}"` : value);

/** With a byte order mark, so that Excel reads the letters as UTF-8. */
export function csvOf(lines: ReportLine[], header: string[]): string {
  const rows = [header, ...lines.map((line) => [line.file, String(line.line), line.id, line.reason, ...line.cells])];
  return `﻿${rows.map((row) => row.map(quote).join(',')).join('\r\n')}\r\n`;
}
