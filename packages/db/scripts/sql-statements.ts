function isCommentOnly(sql: string): boolean {
  return sql
    .split("\n")
    .every((line) => {
      const trimmed = line.trim();
      return !trimmed || trimmed.startsWith("--");
    });
}

export function splitSqlStatements(sql: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollarQuote = false;
  let dollarTag = "";

  for (let i = 0; i < sql.length; i++) {
    const char = sql[i];

    if (!inDollarQuote && char === "$") {
      const match = sql.slice(i).match(/^\$([A-Za-z0-9_]*)\$/);
      if (match) {
        inDollarQuote = true;
        dollarTag = match[0];
        current += dollarTag;
        i += dollarTag.length - 1;
        continue;
      }
    } else if (inDollarQuote && char === "$" && sql.slice(i).startsWith(dollarTag)) {
      current += dollarTag;
      i += dollarTag.length - 1;
      inDollarQuote = false;
      dollarTag = "";
      continue;
    }

    if (char === ";" && !inDollarQuote) {
      const trimmed = current.trim();
      if (trimmed && !isCommentOnly(trimmed)) {
        statements.push(trimmed);
      }
      current = "";
      continue;
    }

    current += char;
  }

  const trimmed = current.trim();
  if (trimmed && !isCommentOnly(trimmed)) {
    statements.push(trimmed);
  }

  return statements;
}
