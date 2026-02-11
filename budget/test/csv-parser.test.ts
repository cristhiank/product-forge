import { describe, expect, test } from "vitest";
import { parseCSV, parseCSVHeaders, serializeCSV } from "../src/csv/csv-parser.js";

describe("CSV Parser", () => {
  test("parse simple CSV", () => {
    const csv = `name,age,city\nAlice,30,NYC\nBob,25,"San Francisco"\n`;
    const rows = parseCSV(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Alice");
    expect(rows[0].age).toBe("30");
    expect(rows[1].city).toBe("San Francisco");
  });

  test("parse CSV with quoted commas", () => {
    const csv = `id,notes\n1,"has, comma"\n2,no comma\n`;
    const rows = parseCSV(csv);
    expect(rows[0].notes).toBe("has, comma");
    expect(rows[1].notes).toBe("no comma");
  });

  test("parse CSV with escaped quotes", () => {
    const csv = `id,text\n1,"she said ""hello"""\n`;
    const rows = parseCSV(csv);
    expect(rows[0].text).toBe('she said "hello"');
  });

  test("parse empty fields", () => {
    const csv = `a,b,c\n1,,3\n`;
    const rows = parseCSV(csv);
    expect(rows[0].b).toBe("");
  });

  test("parseCSVHeaders extracts header row", () => {
    const csv = `name,age,city\nAlice,30,NYC\n`;
    expect(parseCSVHeaders(csv)).toEqual(["name", "age", "city"]);
  });

  test("serialize round-trips", () => {
    const original = [
      { name: "Alice", age: "30", city: "NYC" },
      { name: "Bob", age: "25", city: "San Francisco" },
    ];
    const serialized = serializeCSV(original, ["name", "age", "city"]);
    const parsed = parseCSV(serialized);
    expect(parsed).toEqual(original);
  });

  test("serialize quotes fields with commas", () => {
    const rows = [{ id: "1", notes: "has, comma" }];
    const csv = serializeCSV(rows, ["id", "notes"]);
    expect(csv).toContain('"has, comma"');
  });
});
