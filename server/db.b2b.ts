import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import { Pool, PoolClient } from "pg";
import { BUYER_DEFAULT_PERMISSIONS } from "../shared/permissions";

let pool: Pool | null = null;
function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não definida");
  if (!pool) pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: true } : false,
    max: 10,
  });
  return pool;
}
export async function pingDatabase() { const r = await getPool().query("select 1 as ok"); return r.rows[0]?.ok === 1; }

export function normalizeCnpj(value: string) { return value.replace(/\D/g, ""); }
export function normalizeSku(value: string) { return value.trim().toUpperCase(); }
export function parseMoneyToCents(value: unknown): number {
  if (typeof value === "number") return Math.round(value * 100);
  let text = String(value ?? "").trim();
  if (!text) throw new Error("preço vazio");
  text = text.replace(/R\$/gi, "").replace(/\s/g, "");
  if (/^-?\d{1,3}(\.\d{3})*,\d{1,2}$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  else if (/^-?\d+,\d{1,2}$/.test(text)) text = text.replace(",", ".");
  else if (!/^-?\d+(\.\d{1,2})?$/.test(text)) throw new Error(`valor monetário ambíguo: ${value}`);
  const n = Number(text); if (!Number.isFinite(n) || n < 0) throw new Error("preço inválido"); return Math.round(n * 100);
}

export async function signupBusiness(input:{legalName:string;tradeName?:string;cnpj:string;email:string;phone?:string;name:string;password:string}) {
  const cnpj = normalizeCnpj(input.cnpj); if (cnpj.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");
  const c = await getPool().connect();
  try {
    await c.query("BEGIN");
    const dup = await c.query("select 1 from permupay_business_accounts where cnpj=$1",[cnpj]);
    if (dup.rowCount) throw new Error("CNPJ já cadastrado");
    const email = input.email.toLowerCase().trim();
    const exists = await c.query("select 1 from permupay_users where lower(email)=$1",[email]);
    if (exists.rowCount) throw new Error("Email já cadastrado");
    const hash = await bcrypt.hash(input.password,12);
    const u = await c.query(`insert into permupay_users (email,name,"passwordHash",role,account_type,permissions,active) values ($1,$2,$3,'user','BUYER',$4::jsonb,true) returning id,email,name,role,account_type as "accountType",permissions,active`,[email,input.name.trim(),hash,JSON.stringify(BUYER_DEFAULT_PERMISSIONS)]);
    const b = await c.query(`insert into permupay_business_accounts (legal_name,trade_name,cnpj,email,phone,status) values ($1,$2,$3,$4,$5,'PENDING') returning *`,[input.legalName.trim(),input.tradeName?.trim()||null,cnpj,email,input.phone?.trim()||null]);
    await c.query(`insert into permupay_business_memberships (business_account_id,user_id,role) values ($1,$2,'MANAGER')`,[b.rows[0].id,u.rows[0].id]);
    await c.query("COMMIT"); return { user:u.rows[0], business:b.rows[0] };
  } catch(e){ await c.query("ROLLBACK").catch(()=>{}); throw e; } finally { c.release(); }
}

export async function getMyBusiness(userId:number){
  const {rows}=await getPool().query(`select b.*,m.role as membership_role from permupay_business_memberships m join permupay_business_accounts b on b.id=m.business_account_id where m.user_id=$1 and m.active=true limit 1`,[userId]); return rows[0]??null;
}
export async function listBusinesses(){ const {rows}=await getPool().query(`select b.*,u.name as account_manager_name from permupay_business_accounts b left join permupay_users u on u.id=b.account_manager_user_id order by b.created_at desc`); return rows; }
export async function approveBusiness(id:number, input:{priceListId?:number|null;accountManagerUserId?:number|null;paymentTerms?:unknown;minOrderCents?:number}){
  const {rows}=await getPool().query(`update permupay_business_accounts set status='APPROVED', assigned_price_list_id=coalesce($2,assigned_price_list_id), account_manager_user_id=coalesce($3,account_manager_user_id), payment_terms=coalesce($4::jsonb,payment_terms), min_order_cents=coalesce($5,min_order_cents), updated_at=now() where id=$1 returning *`,[id,input.priceListId??null,input.accountManagerUserId??null,input.paymentTerms?JSON.stringify(input.paymentTerms):null,input.minOrderCents??null]);
  if(!rows[0]) throw new Error("Empresa não encontrada"); return rows[0];
}
export async function suspendBusiness(id:number){ const {rows}=await getPool().query(`update permupay_business_accounts set status='SUSPENDED',updated_at=now() where id=$1 returning *`,[id]); return rows[0]; }

export async function listPriceLists(){ const {rows}=await getPool().query(`select p.*,coalesce((select max(version) from permupay_price_list_versions v where v.price_list_id=p.id),0) as latest_version from permupay_price_lists p order by p.is_default desc,p.name`); return rows; }
export async function createPriceList(name:string,isDefault:boolean){
 const c=await getPool().connect(); try { await c.query('BEGIN'); if(isDefault) await c.query(`update permupay_price_lists set is_default=false where is_default=true`); const {rows}=await c.query(`insert into permupay_price_lists(name,is_default) values($1,$2) returning *`,[name.trim(),isDefault]); await c.query('COMMIT'); return rows[0]; } catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}
async function resolveBusinessContext(c:PoolClient,userId:number){
 const {rows}=await c.query(`select b.*,m.role as membership_role from permupay_business_memberships m join permupay_business_accounts b on b.id=m.business_account_id where m.user_id=$1 and m.active=true limit 1`,[userId]);
 const b=rows[0]; if(!b) throw new Error("Usuário não vinculado a empresa"); if(b.status!=="APPROVED") throw new Error("Empresa ainda não está aprovada para pedidos"); return b;
}
async function resolvePriceListVersion(c:PoolClient,business:any){
 let priceListId=business.assigned_price_list_id;
 if(!priceListId){const r=await c.query(`select id from permupay_price_lists where is_default=true and active=true limit 1`);priceListId=r.rows[0]?.id}
 if(!priceListId) throw new Error("Nenhuma tabela de preços disponível");
 const r=await c.query(`select id,version from permupay_price_list_versions where price_list_id=$1 and effective_from<=now() order by version desc limit 1`,[priceListId]);
 if(!r.rows[0]) throw new Error("Tabela de preços ainda não possui versão vigente"); return {priceListId,versionId:r.rows[0].id,version:r.rows[0].version};
}
export async function buyerCatalog(userId:number){
 const c=await getPool().connect(); try { const b=await resolveBusinessContext(c,userId); const v=await resolvePriceListVersion(c,b); const {rows}=await c.query(`
 select p.id,p.sku,p.name,p.category,p.category_label,p.unit,p.sales_multiple,p.image_url,p.short_description,pli.price_cents,
 greatest(0,floor(p.stock_quantity)::int-coalesce(r.reserved,0)) as available_quantity
 from permupay_products p join permupay_price_list_items pli on pli.product_id=p.id and pli.version_id=$1 and pli.active=true
 left join (select product_id,sum(quantity)::int reserved from permupay_b2b_stock_reservations where status='ACTIVE' group by product_id) r on r.product_id=p.id
 where p.active=true and p.b2b_enabled=true and p.sku is not null order by p.name`,[v.versionId]); return {business:{id:b.id,legalName:b.legal_name,tradeName:b.trade_name,minOrderCents:b.min_order_cents,paymentTerms:b.payment_terms},priceListVersion:v.version,items:rows};
 } finally {c.release()}
}

export async function createOrder(userId:number,input:{items:{productId:number;quantity:number}[];paymentMethod?:string;delivery?:unknown;idempotencyKey:string}){
 const c=await getPool().connect(); try {
  await c.query('BEGIN ISOLATION LEVEL SERIALIZABLE'); const b=await resolveBusinessContext(c,userId);
  const previous=await c.query(`select * from permupay_b2b_orders where business_account_id=$1 and idempotency_key=$2`,[b.id,input.idempotencyKey]); if(previous.rows[0]){await c.query('COMMIT');return previous.rows[0]}
  const v=await resolvePriceListVersion(c,b); const merged=new Map<number,number>(); for(const x of input.items) merged.set(x.productId,(merged.get(x.productId)||0)+x.quantity); if(!merged.size)throw new Error('Carrinho vazio');
  const ids=[...merged.keys()]; const products=await c.query(`select p.id,p.sku,p.name,p.unit,p.sales_multiple,p.stock_quantity,pli.price_cents from permupay_products p join permupay_price_list_items pli on pli.product_id=p.id and pli.version_id=$1 and pli.active=true where p.id=any($2::int[]) and p.active=true and p.b2b_enabled=true for update of p`,[v.versionId,ids]);
  if(products.rows.length!==ids.length) throw new Error('Um ou mais produtos estão indisponíveis comercialmente');
  let total=0; const normalized:any[]=[];
  for(const p of products.rows){ const q=merged.get(p.id)!; if(!Number.isInteger(q)||q<=0)throw new Error(`Quantidade inválida para ${p.name}`); const mult=Math.max(1,Number(p.sales_multiple||1)); if(q%mult!==0)throw new Error(`${p.name}: quantidade deve ser múltipla de ${mult}`); const rr=await c.query(`select coalesce(sum(quantity),0)::int as reserved from permupay_b2b_stock_reservations where product_id=$1 and status='ACTIVE'`,[p.id]); const avail=Math.floor(Number(p.stock_quantity||0))-Number(rr.rows[0].reserved||0); if(q>avail)throw new Error(`${p.name}: estoque disponível ${avail}`); const itemTotal=q*Number(p.price_cents);total+=itemTotal; normalized.push({...p,quantity:q,total:itemTotal}); }
  if(total<Number(b.min_order_cents||0))throw new Error(`Pedido mínimo: R$ ${(Number(b.min_order_cents)/100).toFixed(2)}`);
  const orderNumber=`IP-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const o=await c.query(`insert into permupay_b2b_orders(order_number,business_account_id,buyer_user_id,price_list_version_id,idempotency_key,payment_method,total_cents,delivery_snapshot,terms_snapshot,assigned_to_user_id) values($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10) returning *`,[orderNumber,b.id,userId,v.versionId,input.idempotencyKey,input.paymentMethod||null,total,JSON.stringify(input.delivery||{}),JSON.stringify(b.payment_terms||{}),b.account_manager_user_id]);
  for(const p of normalized){ const ir=await c.query(`insert into permupay_b2b_order_items(order_id,product_id,sku_snapshot,name_snapshot,unit_snapshot,quantity,unit_price_cents,total_cents) values($1,$2,$3,$4,$5,$6,$7,$8) returning id`,[o.rows[0].id,p.id,p.sku,p.name,p.unit,p.quantity,p.price_cents,p.total]); await c.query(`insert into permupay_b2b_stock_reservations(order_id,order_item_id,product_id,quantity,status,expires_at) values($1,$2,$3,$4,'ACTIVE',now()+interval '24 hours')`,[o.rows[0].id,ir.rows[0].id,p.id,p.quantity]); }
  await c.query(`insert into permupay_b2b_notifications(user_id,order_id,title,body) values($1,$2,$3,$4)`,[b.account_manager_user_id||null,o.rows[0].id,'Novo pedido empresarial',`Pedido ${orderNumber} recebido`]);
  await c.query('COMMIT'); return o.rows[0];
 } catch(e:any){await c.query('ROLLBACK').catch(()=>{}); if(e?.code==='40001')throw new Error('Estoque alterado por outra compra; revise o carrinho e tente novamente'); throw e} finally{c.release()}
}

export async function myOrders(userId:number){ const {rows}=await getPool().query(`select o.* from permupay_b2b_orders o join permupay_business_memberships m on m.business_account_id=o.business_account_id where m.user_id=$1 and m.active=true order by o.created_at desc`,[userId]); return rows; }
export async function getOrder(userId:number,orderId:number,isStaff:boolean){
 const p=getPool(); const o=await p.query(isStaff?`select o.*,b.legal_name,b.trade_name from permupay_b2b_orders o join permupay_business_accounts b on b.id=o.business_account_id where o.id=$1`:`select o.*,b.legal_name,b.trade_name from permupay_b2b_orders o join permupay_business_accounts b on b.id=o.business_account_id join permupay_business_memberships m on m.business_account_id=o.business_account_id where o.id=$1 and m.user_id=$2 and m.active=true`,isStaff?[orderId]:[orderId,userId]); if(!o.rows[0])throw new Error('Pedido não encontrado'); const items=await p.query(`select * from permupay_b2b_order_items where order_id=$1 order by id`,[orderId]); return {...o.rows[0],items:items.rows};
}
export async function listOrders(){ const {rows}=await getPool().query(`select o.*,b.legal_name,b.trade_name,u.name as buyer_name from permupay_b2b_orders o join permupay_business_accounts b on b.id=o.business_account_id join permupay_users u on u.id=o.buyer_user_id order by o.created_at desc`); return rows; }
export async function transitionOrder(orderId:number,action:'ACCEPT'|'PAY'|'SHIP'|'CANCEL'){
 const c=await getPool().connect();try{await c.query('BEGIN');const o=(await c.query(`select * from permupay_b2b_orders where id=$1 for update`,[orderId])).rows[0];if(!o)throw new Error('Pedido não encontrado');
 if(action==='ACCEPT') await c.query(`update permupay_b2b_orders set commercial_status='ACEITO',updated_at=now() where id=$1`,[orderId]);
 if(action==='PAY') await c.query(`update permupay_b2b_orders set payment_status='PAGO',updated_at=now() where id=$1`,[orderId]);
 if(action==='CANCEL'){if(o.fulfillment_status==='ENVIADO'||o.fulfillment_status==='ENTREGUE')throw new Error('Pedido já expedido não pode ser cancelado por este fluxo');await c.query(`update permupay_b2b_orders set commercial_status='CANCELADO',updated_at=now() where id=$1`,[orderId]);await c.query(`update permupay_b2b_stock_reservations set status='RELEASED',updated_at=now() where order_id=$1 and status='ACTIVE'`,[orderId]);}
 if(action==='SHIP'){if(o.payment_status!=='PAGO' && !Boolean(o.terms_snapshot?.allowShippingBeforePayment))throw new Error('Pagamento precisa estar confirmado antes da expedição');const rs=await c.query(`select * from permupay_b2b_stock_reservations where order_id=$1 and status='ACTIVE' for update`,[orderId]);for(const r of rs.rows){const up=await c.query(`update permupay_products set stock_quantity=stock_quantity-$2,updated_at=now() where id=$1 and stock_quantity >= $2 returning id`,[r.product_id,r.quantity]);if(!up.rowCount)throw new Error('Saldo insuficiente durante expedição');}await c.query(`update permupay_b2b_stock_reservations set status='CONSUMED',updated_at=now() where order_id=$1 and status='ACTIVE'`,[orderId]);await c.query(`update permupay_b2b_orders set fulfillment_status='ENVIADO',updated_at=now() where id=$1`,[orderId]);}
 await c.query('COMMIT');return (await getPool().query(`select * from permupay_b2b_orders where id=$1`,[orderId])).rows[0];}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}
}

export type ImportRow={sku:string;nome?:string;categoria?:string;unidade?:string;multiplo_venda?:number;preco_venda:unknown;estoque_fisico?:number|null;ativo?:boolean};
export async function applyImport(actorUserId:number,input:{hash:string;profileKey:string;mode:'PRICES'|'INVENTORY';priceListId:number;referenceAt?:Date|null;rows:ImportRow[]}){
 const c=await getPool().connect();try{await c.query('BEGIN');const prev=await c.query(`select * from permupay_import_jobs where content_hash=$1 and profile_key=$2`,[input.hash,input.profileKey]);if(prev.rows[0]){await c.query('COMMIT');return {repeated:true,job:prev.rows[0]}}
 if(!input.rows.length)throw new Error('Arquivo sem linhas');const seen=new Set<string>();const normalized=input.rows.map((r,i)=>{const sku=normalizeSku(r.sku);if(!sku)throw new Error(`Linha ${i+2}: SKU obrigatório`);if(seen.has(sku))throw new Error(`Linha ${i+2}: SKU duplicado ${sku}`);seen.add(sku);const mult=Number(r.multiplo_venda??1);if(!Number.isInteger(mult)||mult<=0)throw new Error(`Linha ${i+2}: múltiplo inválido`);return {...r,sku,multiplo_venda:mult,priceCents:parseMoneyToCents(r.preco_venda)};});
 const ver=(await c.query(`select coalesce(max(version),0)+1 as next from permupay_price_list_versions where price_list_id=$1`,[input.priceListId])).rows[0].next;const v=(await c.query(`insert into permupay_price_list_versions(price_list_id,version,created_by) values($1,$2,$3) returning id`,[input.priceListId,ver,actorUserId])).rows[0];
 const job=(await c.query(`insert into permupay_import_jobs(content_hash,profile_key,mode,price_list_id,reference_at,actor_user_id,status) values($1,$2,$3,$4,$5,$6,'RUNNING') returning *`,[input.hash,input.profileKey,input.mode,input.priceListId,input.referenceAt??null,actorUserId])).rows[0];let created=0,updated=0;
 for(let i=0;i<normalized.length;i++){const r=normalized[i];const existing=(await c.query(`select * from permupay_products where upper(trim(sku))=$1 for update`,[r.sku])).rows[0];let productId:number;let before=existing||null;
  if(existing){if(input.mode==='INVENTORY'&&r.estoque_fisico!=null){const reserved=Number((await c.query(`select coalesce(sum(quantity),0) as q from permupay_b2b_stock_reservations where product_id=$1 and status='ACTIVE'`,[existing.id])).rows[0].q||0);if(Number(r.estoque_fisico)<reserved)throw new Error(`Linha ${i+2}: estoque físico menor que reservas ativas`);} const q=await c.query(`update permupay_products set name=coalesce($2,name),category_label=coalesce($3,category_label),unit=coalesce($4,unit),sales_multiple=$5,active=coalesce($6,active),b2b_enabled=true,stock_quantity=case when $7::boolean then coalesce($8,stock_quantity) else stock_quantity end,updated_at=now() where id=$1 returning *`,[existing.id,r.nome?.trim()||null,r.categoria?.trim()||null,r.unidade?.trim().toUpperCase()||null,r.multiplo_venda,r.ativo??null,input.mode==='INVENTORY',r.estoque_fisico??null]);productId=existing.id;updated++;await c.query(`insert into permupay_import_rows(job_id,row_number,sku,status,before_data,after_data) values($1,$2,$3,'UPDATED',$4::jsonb,$5::jsonb)`,[job.id,i+2,r.sku,JSON.stringify(before),JSON.stringify(q.rows[0])]);}
  else {if(!r.nome||!r.categoria||!r.unidade)throw new Error(`Linha ${i+2}: produto novo exige nome, categoria e unidade`);const q=await c.query(`insert into permupay_products(sku,name,category,category_label,unit,sales_multiple,b2b_enabled,active,stock_quantity) values($1,$2,'OUTRO',$3,$4,$5,true,$6,$7) returning *`,[r.sku,r.nome.trim(),r.categoria.trim(),r.unidade.trim().toUpperCase(),r.multiplo_venda,r.ativo??true,input.mode==='INVENTORY'?(r.estoque_fisico??0):0]);productId=q.rows[0].id;created++;await c.query(`insert into permupay_import_rows(job_id,row_number,sku,status,after_data) values($1,$2,$3,'CREATED',$4::jsonb)`,[job.id,i+2,r.sku,JSON.stringify(q.rows[0])]);}
  await c.query(`insert into permupay_price_list_items(version_id,product_id,price_cents,active) values($1,$2,$3,true)`,[v.id,productId,r.priceCents]);
 }
 const summary={created,updated,total:normalized.length,version:Number(ver)};await c.query(`update permupay_import_jobs set status='COMPLETED',summary=$2::jsonb,completed_at=now() where id=$1`,[job.id,JSON.stringify(summary)]);await c.query('COMMIT');return {repeated:false,job:{...job,status:'COMPLETED',summary}};
 }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e}finally{c.release()}
}
export async function listImportJobs(){const {rows}=await getPool().query(`select j.*,u.name as actor_name,p.name as price_list_name from permupay_import_jobs j left join permupay_users u on u.id=j.actor_user_id left join permupay_price_lists p on p.id=j.price_list_id order by j.created_at desc limit 100`);return rows}


export type B2BQuoteAction = 'APPROVE' | 'REJECT' | 'CANCEL';

type BasketItem = { productId: number; quantity: number };

async function loadQuoteBasket(c: PoolClient, business: any, items: BasketItem[]) {
  const v = await resolvePriceListVersion(c, business);
  const merged = new Map<number, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) || 0) + item.quantity);
  }
  if (!merged.size) throw new Error('A cotação precisa ter ao menos um produto');

  const ids = [...merged.keys()];
  const result = await c.query(
    `select p.id,p.sku,p.name,p.unit,p.sales_multiple,p.stock_quantity,pli.price_cents
     from permupay_products p
     join permupay_price_list_items pli on pli.product_id=p.id and pli.version_id=$1 and pli.active=true
     where p.id=any($2::int[]) and p.active=true and p.b2b_enabled=true`,
    [v.versionId, ids],
  );
  if (result.rows.length !== ids.length) {
    throw new Error('Um ou mais produtos não estão disponíveis para cotação');
  }

  let total = 0;
  const normalized: any[] = [];
  for (const product of result.rows) {
    const quantity = merged.get(product.id)!;
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw new Error(`Quantidade inválida para ${product.name}`);
    }
    const multiple = Math.max(1, Number(product.sales_multiple || 1));
    if (quantity % multiple !== 0) {
      throw new Error(`${product.name}: quantidade deve ser múltipla de ${multiple}`);
    }
    const available = Math.floor(Number(product.stock_quantity || 0));
    if (quantity > available) {
      throw new Error(`${product.name}: estoque disponível ${available}`);
    }
    const lineTotal = quantity * Number(product.price_cents);
    total += lineTotal;
    normalized.push({ ...product, quantity, total: lineTotal });
  }
  return { version: v, normalized, total };
}

export async function createQuote(
  userId: number,
  input: { items: BasketItem[]; notes?: string; idempotencyKey: string },
) {
  const c = await getPool().connect();
  try {
    await c.query('BEGIN');
    const business = await resolveBusinessContext(c, userId);
    const previous = await c.query(
      `select * from permupay_b2b_quotes where business_account_id=$1 and idempotency_key=$2`,
      [business.id, input.idempotencyKey],
    );
    if (previous.rows[0]) {
      await c.query('COMMIT');
      return previous.rows[0];
    }

    const basket = await loadQuoteBasket(c, business, input.items);
    const quoteNumber = `QC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    const quote = await c.query(
      `insert into permupay_b2b_quotes(quote_number,business_account_id,buyer_user_id,price_list_version_id,status,notes,total_cents,idempotency_key)
       values($1,$2,$3,$4,'PENDING',$5,$6,$7) returning *`,
      [quoteNumber, business.id, userId, basket.version.versionId, input.notes?.trim() || null, basket.total, input.idempotencyKey],
    );

    for (const product of basket.normalized) {
      await c.query(
        `insert into permupay_b2b_quote_items(quote_id,product_id,sku_snapshot,name_snapshot,unit_snapshot,quantity,unit_price_cents,total_cents)
         values($1,$2,$3,$4,$5,$6,$7,$8)`,
        [quote.rows[0].id, product.id, product.sku, product.name, product.unit, product.quantity, product.price_cents, product.total],
      );
    }
    if (business.account_manager_user_id) {
      await c.query(
        `insert into permupay_b2b_notifications(user_id,title,body) values($1,$2,$3)`,
        [business.account_manager_user_id, 'Nova cotação empresarial', `Cotação ${quoteNumber} recebida`],
      );
    }
    await c.query('COMMIT');
    return quote.rows[0];
  } catch (error) {
    await c.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    c.release();
  }
}

export async function myQuotes(userId: number) {
  const { rows } = await getPool().query(
    `select q.*,b.legal_name,b.trade_name,
      coalesce(json_agg(json_build_object('id',qi.id,'productId',qi.product_id,'sku',qi.sku_snapshot,'name',qi.name_snapshot,'unit',qi.unit_snapshot,'quantity',qi.quantity,'unitPriceCents',qi.unit_price_cents,'totalCents',qi.total_cents) order by qi.id) filter (where qi.id is not null),'[]'::json) as items
     from permupay_b2b_quotes q
     join permupay_business_accounts b on b.id=q.business_account_id
     join permupay_business_memberships m on m.business_account_id=q.business_account_id and m.user_id=$1 and m.active=true
     left join permupay_b2b_quote_items qi on qi.quote_id=q.id
     group by q.id,b.id order by q.created_at desc`,
    [userId],
  );
  return rows;
}

export async function listQuotes() {
  const { rows } = await getPool().query(
    `select q.*,b.legal_name,b.trade_name,u.name as buyer_name
     from permupay_b2b_quotes q
     join permupay_business_accounts b on b.id=q.business_account_id
     join permupay_users u on u.id=q.buyer_user_id
     order by q.created_at desc`,
  );
  return rows;
}

export async function transitionQuote(id: number, action: B2BQuoteAction) {
  const status = { APPROVE: 'APPROVED', REJECT: 'REJECTED', CANCEL: 'CANCELLED' }[action];
  const { rows } = await getPool().query(
    `update permupay_b2b_quotes set status=$2,updated_at=now() where id=$1 and status in ('PENDING','APPROVED') returning *`,
    [id, status],
  );
  if (!rows[0]) throw new Error('Cotação não encontrada ou não pode ser alterada');
  return rows[0];
}

export async function createOrderFromQuote(userId: number, quoteId: number, idempotencyKey: string) {
  const { rows } = await getPool().query(
    `select q.* from permupay_b2b_quotes q
     join permupay_business_memberships m on m.business_account_id=q.business_account_id and m.user_id=$1 and m.active=true
     where q.id=$2`,
    [userId, quoteId],
  );
  const quote = rows[0];
  if (!quote) throw new Error('Cotação não encontrada');
  if (quote.status !== 'APPROVED') throw new Error('A cotação precisa ser aprovada antes de virar pedido');
  const itemRows = await getPool().query(
    `select product_id as "productId",quantity from permupay_b2b_quote_items where quote_id=$1 order by id`,
    [quoteId],
  );
  const order = await createOrder(userId, {
    items: itemRows.rows,
    paymentMethod: 'QUOTE',
    delivery: { quoteId },
    idempotencyKey,
  });
  await getPool().query(
    `update permupay_b2b_quotes set status='CONVERTED',updated_at=now() where id=$1 and status='APPROVED'`,
    [quoteId],
  );
  return order;
}
