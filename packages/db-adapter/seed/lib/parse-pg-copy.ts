export interface CopyBlock {
  table: string;
  columns: string[];
  rows: CopyField[][];
}

export type CopyField = string | null;

/**
 * Parses pg_dump text-format COPY ... FROM stdin blocks.
 */
export function parsePgCopyDump(sql: string): CopyBlock[] {
  const blocks: CopyBlock[] = [];
  let current: CopyBlock | null = null;

  for (const line of sql.split(/\r?\n/)) {
    if (line.startsWith("COPY ")) {
      const match = line.match(
        /^COPY public\."([^"]+)" \((.+)\) FROM stdin;$/,
      );
      if (!match) {
        throw new Error(`Unsupported COPY header: ${line.slice(0, 80)}`);
      }
      const columns = match[2].split(",").map((c) =>
        c.trim().replace(/^"|"$/g, ""),
      );
      current = { table: match[1], columns, rows: [] };
      blocks.push(current);
      continue;
    }

    if (line === "\\.") {
      current = null;
      continue;
    }

    if (line.startsWith("SET ") || line.startsWith("--") || line.trim() === "") {
      continue;
    }
    if (line.startsWith("SELECT pg_catalog") || line.startsWith("\\restrict")) {
      continue;
    }

    if (current) {
      current.rows.push(splitCopyRow(line));
    }
  }

  return blocks;
}

/** PostgreSQL COPY text format: tab-separated, \\N null, backslash escapes. */
export function splitCopyRow(line: string): CopyField[] {
  const fields: CopyField[] = [];
  let buf = "";

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === "\t") {
      fields.push(decodeCopyField(buf));
      buf = "";
      continue;
    }

    if (ch !== "\\") {
      buf += ch;
      continue;
    }

    if (i + 1 >= line.length) {
      buf += ch;
      continue;
    }

    const next = line[i + 1];
    const escaped: Record<string, string> = {
      b: "\b",
      f: "\f",
      n: "\n",
      r: "\r",
      t: "\t",
      v: "\v",
      "\\": "\\",
    };

    if (next === "N") {
      buf += "\\N";
      i += 1;
      continue;
    }

    if (next in escaped) {
      buf += escaped[next]!;
      i += 1;
      continue;
    }

    if (next >= "0" && next <= "7") {
      let oct = next;
      let j = i + 2;
      while (j < line.length && j < i + 4 && line[j]! >= "0" && line[j]! <= "7") {
        oct += line[j]!;
        j++;
      }
      buf += String.fromCharCode(parseInt(oct, 8));
      i = j - 1;
      continue;
    }

    buf += next;
    i += 1;
  }

  fields.push(decodeCopyField(buf));
  return fields;
}

function decodeCopyField(raw: string): string | null {
  if (raw === "\\N") return null;
  return raw;
}
