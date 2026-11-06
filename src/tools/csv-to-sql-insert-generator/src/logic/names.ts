import type { Dialect } from "./types";

/** Identifier length limits: MySQL 64, PostgreSQL 63 (bytes), SQL Server 128; SQLite has none. */
export const MAX_IDENT: Record<Dialect, number> = { mysql: 64, postgresql: 63, sqlite: 128, sqlserver: 128 };

/** Reserved in at least one of the four dialects; quoting them avoids surprises when switching. */
const RESERVED = new Set(
  `add all alter analyze and as asc between both by case cast check collate column constraint create cross current_date current_time current_timestamp current_user database default delete desc distinct drop else end except exists false fetch for foreign from full grant group having if in index inner insert intersect into is join key leading left like limit natural not null of offset on or order outer primary references right row rows select session_user set some table then to top trailing true union unique update user using values view when where with window
   backup begin break browse bulk cascade checkpoint close clustered commit compute contains continue convert cursor dbcc deallocate declare deny disk distributed double dump errlvl escape exec execute exit file fillfactor function goto holdlock identity identitycol if kill lineno load merge national nocheck nonclustered off offsets open opendatasource openquery openrowset openxml option over percent pivot plan precision print proc procedure public raiserror read readtext reconfigure replication restore restrict return revert revoke rollback rowcount rowguidcol rule save schema securityaudit semantickeyphrasetable shutdown statistics system_user tablesample textsize transaction trigger truncate try_convert tsequal unpivot updatetext use varying waitfor while writetext
   accessible asensitive before bigint binary blob call change char character condition databases day_hour dec decimal delayed describe deterministic distinctrow div dual each elseif enclosed escaped explain float float4 float8 force fulltext generated get high_priority hour_minute iterate int int1 int2 int3 int4 int8 integer interval keys lateral leave lines linear lock long longblob longtext loop low_priority match mediumint minute_second mod modifies no_write_to_binlog numeric optimize optionally out outfile partition range reads real regexp release rename repeat replace require resignal rlike schemas second_microsecond sensitive separator show signal smallint spatial specific sql sqlexception sqlstate sqlwarning ssl starting stored straight_join terminated tinyint undo unlock unsigned usage utc_date utc_time utc_timestamp varbinary varchar virtual write xor year_month zerofill
   analyse array asymmetric authorization binary concurrently current_catalog current_role current_schema deferrable do freeze ilike initially isnull localtime localtimestamp notnull only overlaps placing returning similar symmetric variadic verbose abort autoincrement attach detach exclusive fail glob ignore immediate indexed instead nothing notnull pragma raise recursive regexp reindex temp temporary vacuum date time timestamp`.split(/\s+/),
);

export function isReserved(name: string): boolean {
  return RESERVED.has(name.toLowerCase());
}

// Letters that NFKD does not split into a base letter and an accent.
const LETTERS: Record<string, string> = { ß: "ss", æ: "ae", œ: "oe", ø: "o", ł: "l", đ: "d", Æ: "Ae", Œ: "Oe", Ø: "O", Ł: "L", Đ: "D" };

/**
 * A safe column or table name: letters, digits and underscores, accents
 * removed, lower snake case, not starting with a digit, within the dialect's
 * length limit. "Unit Price (€)" → unit_price.
 */
export function safeName(raw: string, fallback: string, dialect: Dialect): string {
  let s = raw
    .replace(/[ßæœøłđÆŒØŁĐ]/g, (c) => LETTERS[c] ?? "")
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  if (s === "") s = fallback;
  if (/^\d/.test(s)) s = `c_${s}`;
  return s.slice(0, MAX_IDENT[dialect]).replace(/_+$/, "");
}

/** Cleans every header and makes the names unique (email, email_2, email_3). */
export function columnNames(headers: string[], dialect: Dialect): string[] {
  const used = new Set<string>();
  return headers.map((h, i) => {
    const base = safeName(h, `column_${i + 1}`, dialect);
    let name = base;
    for (let k = 2; used.has(name); k++) {
      const suffix = `_${k}`;
      name = base.slice(0, MAX_IDENT[dialect] - suffix.length) + suffix;
    }
    used.add(name);
    return name;
  });
}

export function quoteIdent(name: string, dialect: Dialect, always: boolean): string {
  if (!always && /^[a-z_][a-z0-9_]*$/.test(name) && !isReserved(name)) return name;
  switch (dialect) {
    case "mysql":
      return `\`${name.replace(/`/g, "``")}\``;
    case "sqlserver":
      return `[${name.replace(/]/g, "]]")}]`;
    default:
      return `"${name.replace(/"/g, "\"\"")}"`;
  }
}
