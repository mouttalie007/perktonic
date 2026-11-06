import { describe, expect, test } from "vitest";
import { checkPandas } from "../src/logic/pandasCheck";
import { sourceWarnings } from "../src/logic/sourceNotes";
import { checkSql } from "../src/logic/sqlCheck";

describe("SQL syntax check per dialect (never run)", () => {
  test("valid queries parse in their dialect: GROUP BY, LEFT JOIN, CASE WHEN, window functions, TOP", () => {
    expect(checkSql("SELECT region, SUM(amount) AS total FROM sales WHERE order_date >= DATE '2026-01-01' GROUP BY region;", "postgresql")).toEqual({ status: "ok" });
    expect(checkSql("SELECT o.id, p.price FROM orders AS o LEFT JOIN products AS p ON p.code = o.product_code;", "sqlite")).toEqual({ status: "ok" });
    expect(checkSql("SELECT TOP 10 customer, SUM(amount) AS total FROM sales GROUP BY customer ORDER BY total DESC;", "sqlserver")).toEqual({ status: "ok" });
    expect(checkSql("SELECT paid_on, SUM(amount) OVER (ORDER BY paid_on ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS rt FROM payments;", "mysql")).toEqual({ status: "ok" });
  });

  test("a syntax error is reported as failed with the parser's message and line", () => {
    const r = checkSql("SELECT region,\n  SUM(amount\nFROM sales GROUP BY region", "postgresql");
    expect(r.status).toBe("failed");
    if (r.status === "failed") {
      expect(r.message).toMatch(/Expected/);
      expect(r.line).toBe(3);
    }
  });

  test("the dialect matters: FILTER (WHERE …) parses in PostgreSQL but not in SQL Server", () => {
    const q = "SELECT region, COUNT(*) FILTER (WHERE status = 'Open') AS open_count FROM tickets GROUP BY region;";
    expect(checkSql(q, "postgresql").status).toBe("ok");
    expect(checkSql(q, "sqlserver").status).toBe("failed");
  });

  test("features the checker does not support are reported as skipped (not checked)", () => {
    expect(checkSql("SELECT * FROM t PIVOT (SUM(x) FOR y IN ([a],[b])) AS p", "sqlserver")).toMatchObject({ status: "skipped", reason: expect.stringMatching(/PIVOT/) });
    expect(checkSql("SELECT a FROM t WHERE b LIKE 'x!%' ESCAPE '!'", "sqlite").status).toBe("skipped");
  });
});

describe("pandas: imports and brackets only (not run, not syntax-checked)", () => {
  test("lists import lines and accepts balanced code with brackets inside strings and comments", () => {
    const r = checkPandas('import numpy as np\nfrom pandas import DataFrame\n# a comment with (\ndf["x)"] = np.where(df["a"] > 1, "(", "]")\ns = """multi\n( line"""');
    expect(r).toEqual({ imports: ["import numpy as np", "from pandas import DataFrame"], balanced: true, message: null });
  });
  test("reports an unclosed bracket and a mismatched bracket with the line", () => {
    expect(checkPandas("import pandas as pd\nx = pd.concat([a, b]\n").message).toBe('"(" opened on line 2 is never closed.');
    expect(checkPandas("x = [1, 2)").message).toBe('Unexpected ")" on line 1.');
    expect(checkPandas("x = 'open").message).toMatch(/never closed/);
  });
});

describe("our own warnings about the spreadsheet logic", () => {
  test("approximate VLOOKUP, volatile functions and array formulas are flagged; text in quotes is ignored", () => {
    expect(sourceWarnings("=VLOOKUP(D2,Rates!A:B,2,TRUE)")[0]).toMatch(/approximate-match/);
    expect(sourceWarnings("=VLOOKUP(D2,Rates!A:B,2)")[0]).toMatch(/approximate-match/);
    expect(sourceWarnings("=VLOOKUP(D2,Rates!A:B,2,FALSE)")).toEqual([]);
    expect(sourceWarnings("=IF(A2<TODAY(),OFFSET(B1,1,0),0)")[0]).toMatch(/TODAY, OFFSET .*volatile/);
    expect(sourceWarnings('=IF(A2="TODAY()",1,0)')).toEqual([]);
    expect(sourceWarnings("=FILTER(A2:C9,B2:B9>5)").join(" ")).toMatch(/dynamic-array/);
  });
});
