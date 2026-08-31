import crypto from "node:crypto";
import * as XLSX from "xlsx";
import type { ImportRow } from "./db.b2b";
const HEADERS=["sku","nome","categoria","unidade","multiplo_venda","preco_venda","estoque_fisico","ativo"];
function bool(v:unknown){const x=String(v??"").trim().toUpperCase();if(["SIM","S","TRUE","1"].includes(x))return true;if(["NAO","NÃO","N","FALSE","0"].includes(x))return false;if(!x)return undefined;throw new Error(`ativo inválido: ${v}`)}
function number(v:unknown,optional=false){if(v==null||String(v).trim()==="")return optional?null:undefined;const n=Number(String(v).trim().replace(",","."));if(!Number.isFinite(n)||n<0)throw new Error(`número inválido: ${v}`);return n}
function normalizeRow(row:any):ImportRow{return {sku:String(row.sku??"").trim(),nome:String(row.nome??"").trim()||undefined,categoria:String(row.categoria??"").trim()||undefined,unidade:String(row.unidade??"").trim()||undefined,multiplo_venda:number(row.multiplo_venda) as number|undefined,preco_venda:row.preco_venda,estoque_fisico:number(row.estoque_fisico,true) as number|null,ativo:bool(row.ativo)}}
export function parseImportBuffer(buffer:Buffer,filename:string){
 if(buffer.length>10*1024*1024)throw new Error("Arquivo excede 10MB");
 const ext=filename.toLowerCase().split('.').pop();let rows:any[]=[];
 if(ext==='csv'){const text=buffer.toString('utf8').replace(/^\uFEFF/,'');const lines=text.split(/\r?\n/).filter(Boolean);if(!lines.length)throw new Error('CSV vazio');const headers=lines[0].split(';').map(x=>x.trim());if(headers.join('|')!==HEADERS.join('|'))throw new Error('Cabeçalho CSV inválido');rows=lines.slice(1).map(line=>{const values=line.split(';');return Object.fromEntries(headers.map((h,i)=>[h,values[i]??'']))});}
 else if(ext==='xlsx'){const wb=XLSX.read(buffer,{type:'buffer',cellFormula:false,cellHTML:false,cellNF:false,cellStyles:false});if(!wb.SheetNames.includes('PRODUTOS'))throw new Error('XLSX deve conter a aba PRODUTOS');const ws=wb.Sheets.PRODUTOS;for(const key of Object.keys(ws)){if(key.startsWith('!'))continue;const cell:any=(ws as any)[key];if(cell?.f)throw new Error(`Fórmula proibida na célula ${key}`);} rows=XLSX.utils.sheet_to_json(ws,{defval:'',raw:false});const first=rows[0]||{};for(const h of HEADERS)if(!(h in first)&&rows.length)throw new Error(`Coluna ausente: ${h}`);}
 else throw new Error('Formato aceito: CSV ou XLSX');
 const normalized=rows.filter(r=>Object.values(r).some(v=>String(v).trim())).map(normalizeRow);return {rows:normalized,hash:crypto.createHash('sha256').update(buffer).digest('hex')};
}
