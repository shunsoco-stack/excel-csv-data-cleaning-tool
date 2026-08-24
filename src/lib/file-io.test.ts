import * as XLSX from "xlsx";
import { describe, expect, it, vi } from "vitest";

import {
  FileImportError,
  MAX_FILE_SIZE_BYTES,
  decodeCsvBuffer,
  detectCsvDelimiter,
  detectSupportedFileType,
  parseCsv,
  readBrowserFile,
  readDataFile,
} from "./file-io";
import { ROW_ID_KEY } from "./types";

function asBytes(value: unknown): Uint8Array {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(
      value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength),
    );
  }
  throw new TypeError("Expected XLSX bytes");
}

describe("CSV import", () => {
  it("parses BOM, quoted delimiters, escaped quotes, embedded newlines and safe headers", () => {
    const source =
      '\uFEFFname,,name,__rowId\r\n"Alice, A",x,duplicate,source\r\n"Bob\r\nB","He said ""hi""",duplicate2,source2\r\n';

    const result = parseCsv(source, { dataSetName: "customers" });

    expect(result.delimiter).toBe(",");
    expect(result.dataSet.headers).toEqual(["name", "列2", "name_2", "__rowId_2"]);
    expect(result.dataSet.rows).toHaveLength(2);
    expect(result.dataSet.rows[0].name).toBe("Alice, A");
    expect(result.dataSet.rows[1].name).toBe("Bob\nB");
    expect(result.dataSet.rows[1]["列2"]).toBe('He said "hi"');
    expect(result.dataSet.rows[0][ROW_ID_KEY]).toMatch(/^dataset-/u);
  });

  it("detects delimiter from consistent rows rather than commas inside values", () => {
    const source = "商品;価格;備考\r\nCoffee;1,280;定番\r\nTea;980;新商品";
    expect(detectCsvDelimiter(source)).toBe(";");
    const parsed = parseCsv(source);
    expect(parsed.dataSet.rows[0]).toMatchObject({ 商品: "Coffee", 価格: "1,280" });
  });

  it("skips physical blank lines but preserves an explicitly empty multi-cell row", () => {
    const result = parseCsv("a,b,c\r\n\r\n,,\r\nx,y,z\r\n");
    expect(result.dataSet.rows).toHaveLength(2);
    expect(result.dataSet.rows[0]).toMatchObject({ a: "", b: "", c: "" });
  });

  it("rejects malformed quoted fields and missing headers", () => {
    expect(() => parseCsv('a,b\n"open,b')).toThrowError(FileImportError);
    expect(() => parseCsv(",,\n1,2,3")).toThrowError(
      expect.objectContaining({ code: "missing-header" }),
    );
  });

  it("decodes strict UTF-8 and falls back to Shift-JIS", async () => {
    const source = "氏名,都道府県\r\n山田太郎,東京都";
    const utf8 = new TextEncoder().encode(source);
    await expect(decodeCsvBuffer(utf8)).resolves.toMatchObject({
      text: source,
      encoding: "utf-8",
      hadBom: false,
    });

    const Encoding = (await import("encoding-japanese")).default;
    const shiftJis = Uint8Array.from(
      Encoding.convert(Encoding.stringToCode(source), {
        from: "UNICODE",
        to: "SJIS",
        type: "array",
      }),
    );
    const imported = await readDataFile(shiftJis, {
      name: "customers.csv",
      size: shiftJis.byteLength,
    });
    expect(imported.metadata).toMatchObject({
      fileType: "csv",
      encoding: "shift-jis",
      delimiter: ",",
      rowCount: 1,
      columnCount: 2,
    });
    expect(imported.dataSet.rows[0]["都道府県"]).toBe("東京都");
  });
});

describe("XLSX import", () => {
  it("imports every usable worksheet and preserves primitive/date values", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["顧客ID", "登録日", "有効"],
        ["C001", new Date(2026, 7, 24), true],
      ]),
      "顧客",
    );
    XLSX.utils.book_append_sheet(
      workbook,
      XLSX.utils.aoa_to_sheet([
        ["商品コード", "価格"],
        ["P001", 1280],
      ]),
      "商品",
    );
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), "メモ");
    const bytes = asBytes(XLSX.write(workbook, { bookType: "xlsx", type: "array" }));

    const imported = await readDataFile(bytes, {
      name: "master.xlsx",
      size: bytes.byteLength,
    });

    expect(imported.dataSets.map((dataSet) => dataSet.name)).toEqual(["顧客", "商品"]);
    expect(imported.metadata).toMatchObject({
      fileType: "xlsx",
      encoding: "binary",
      sheetNames: ["顧客", "商品"],
      activeSheet: "顧客",
      skippedSheetNames: ["メモ"],
      rowCount: 2,
      columnCount: 3,
    });
    expect(imported.dataSets[0].rows[0]).toMatchObject({
      顧客ID: "C001",
      登録日: "2026-08-24",
      有効: true,
    });
    expect(imported.dataSets[1].rows[0].価格).toBe(1280);
  });

  it("reports a workbook with no usable header", async () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet([[]]), "空シート");
    const bytes = asBytes(XLSX.write(workbook, { bookType: "xlsx", type: "array" }));
    await expect(readDataFile(bytes, { name: "empty.xlsx" })).rejects.toMatchObject({
      code: "no-usable-sheet",
    });
  });
});

describe("file validation", () => {
  it("accepts only CSV/XLSX and rejects an oversized browser file before reading", async () => {
    expect(detectSupportedFileType({ name: "data.CSV" })).toBe("csv");
    expect(detectSupportedFileType({
      name: "upload",
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    })).toBe("xlsx");
    expect(() => detectSupportedFileType({ name: "legacy.xls" })).toThrowError(
      expect.objectContaining({ code: "unsupported-format" }),
    );

    const arrayBuffer = vi.fn(async () => new ArrayBuffer(0));
    await expect(readBrowserFile({
      name: "large.csv",
      size: MAX_FILE_SIZE_BYTES + 1,
      arrayBuffer,
    })).rejects.toMatchObject({ code: "file-too-large" });
    expect(arrayBuffer).not.toHaveBeenCalled();
  });
});
