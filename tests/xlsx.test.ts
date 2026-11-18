import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { asDate, cellText, xlsxBlob } from "@/lib/xlsx";

describe("excel file", () => {
  it("builds a zip with real dates and numbers", async () => {
    const t = new Date(2026, 10, 18, 15, 30).getTime();
    const blob = xlsxBlob([{ name: "Bills", rows: [["Bills - Café & Co <Pune>"], ["From", asDate(t)], [], ["Date", "Total (Rs)", "Note"], [asDate(t), 273.5, "2 x Naan"]] }]);
    const buf = new Uint8Array(await blob.arrayBuffer());
    expect(buf[0]).toBe(0x50); // PK
    if (process.env.XLSX_OUT) writeFileSync(process.env.XLSX_OUT, buf);
    expect(cellText(asDate(t))).toBe("18-11-2026");
  });
});
