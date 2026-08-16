import * as XLSX from 'xlsx';
import csv from 'csv-parser';

export async function onRequest({request, env}) {
  if(request.method !== 'POST') return new Response("only POST", {status:405});
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if(!file) return Response.json({err:"无文件"},{status:400});
    const buf = await file.arrayBuffer();
    let rows = [];
    const name = file.name.toLowerCase();
    // Excel xlsx/xls
    if(name.endsWith('.xlsx')||name.endsWith('.xls')){
      const wb = XLSX.read(buf);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json(sheet);
    }
    // CSV / TXT结构化
    else if(name.endsWith('.csv')||name.endsWith('.txt')){
      const text = new TextDecoder().decode(buf);
      rows = await new Promise(res=>{
        const arr=[];
        csv().on('data',d=>arr.push(d)).on('end',()=>res(arr)).write(text);
      })
    }
    // JSON
    else if(name.endsWith('.json')){
      rows = JSON.parse(new TextDecoder().decode(buf));
    }else{
      return Response.json({err:"仅支持 xlsx/csv/txt/json"},{status:400});
    }
    // 批量写入D1 customers表（按Pageel原有字段映射，你可以自行扩字段）
    const stmt = env.DB.prepare(`INSERT INTO customers (name,email,phone,address) VALUES (?,?,?,?)`);
    const batch = rows.map(r=>stmt.bind(r.name||"",r.email||"",r.phone||"",r.address||""));
    await env.DB.batch(batch);
    return Response.json({ok:true,count:rows.length});
  }catch(e){
    return Response.json({err:e.message},{status:500});
  }
}
