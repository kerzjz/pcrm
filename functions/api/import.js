// functions/api/import.js
export async function onRequest({ request, env }) {
  if (request.method !== 'POST') return new Response("only POST", { status: 405 });
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file) return Response.json({ err: "无文件" }, { status: 400 });
    const buf = await file.arrayBuffer();
    const name = file.name.toLowerCase();
    let rows = [];

    // 1. Excel xlsx/xls：使用SheetJS ESM（适配CF Worker，不需要npm装xlsx）
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      // 动态导入SheetJS ESM，CDN，不打包进function
      const { read, utils } = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
      const wb = read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = utils.sheet_to_json(sheet);
    }
    // 2. CSV / TXT（原生JS解析，干掉csv-parser依赖！）
    else if (name.endsWith('.csv') || name.endsWith('.txt')) {
      const text = new TextDecoder().decode(buf);
      rows = parseCsv(text);
    }
    // 3. JSON
    else if (name.endsWith('.json')) {
      rows = JSON.parse(new TextDecoder().decode(buf));
    } else {
      return Response.json({ err: "仅支持 xlsx/csv/txt/json" }, { status: 400 });
    }

    // 写入Pageel customers表，按需映射字段
    const stmt = env.DB.prepare(`INSERT INTO customers (name,email,phone,address) VALUES (?,?,?,?)`);
    const batch = rows.map(r => stmt.bind(r.name || "", r.email || "", r.phone || "", r.address || ""));
    await env.DB.batch(batch);

    return Response.json({ ok: true, count: rows.length });
  } catch (e) {
    return Response.json({ err: e.message, stack: e.stack }, { status: 500 });
  }
}

/**
 * 极简CSV解析（原生JS，替代csv-parser，兼容CF Worker）
 * 基础支持逗号分隔、双引号转义（适合常规线索CSV）
 */
function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const res = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = splitCsvLine(lines[i]);
    const row = {};
    headers.forEach((h, idx) => row[h.trim()] = vals[idx]?.trim() ?? "");
    res.push(row);
  }
  return res;
}
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (const c of line) {
    if (c === '"') inQuote = !inQuote;
    else if (c === ',' && !inQuote) { out.push(cur); cur = ""; }
    else cur += c;
  }
  out.push(cur);
  return out;
}
