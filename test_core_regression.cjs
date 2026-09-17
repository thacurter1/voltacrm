const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const req = createRequire(__dirname + '/server/package.json');
req('dotenv').config = () => ({});
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'isolated-regression-secret-not-for-deployment';
for (const key of Object.keys(process.env)) if (/^(SUPABASE_|TWILIO_|WHATSAPP_|ADMIN_|OPERATOR_|CUSTOMER_|TOTEM_)/.test(key)) delete process.env[key];
process.env.VOLTA_DEMO_MODE = 'true';
req('express-async-errors');
const express = req('express');
const store = require('./server/dist/services/dataStore.js');
const db = require('./server/dist/services/dbClient.js');
const app = express(); app.use(express.json());
app.use('/auth', require('./server/dist/routes/auth.js').authRouter);
app.use('/messaging', require('./server/dist/routes/messaging.js').messagingRouter);
app.use((err, request, response, next) => response.status(err.status || 500).json({ success: false, message: err.message }));

test('core persistence and identity regressions', async t => {
 const server = app.listen(0, '127.0.0.1'); await new Promise(r => server.once('listening', r));
 const base = `http://127.0.0.1:${server.address().port}`;
 const post = async (url, body, headers = {}) => { const res = await fetch(base + url, { method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)}); return {status:res.status,data:await res.json()}; };
 try {
  await t.test('failed customer commit does not publish to memory', async () => {
   const before = store.getCustomers().length;
   db.isSupabaseConfigured = true;
   db.supabase = {from:()=>({upsert:()=>Promise.resolve({error:{message:'database unavailable'}})})};
   const customer={...store.getCustomers()[0],id:'audit-failed-commit'};
   try { await assert.rejects(async()=>store.addCustomer(customer), /database unavailable/); assert.equal(store.getCustomers().length,before); }
   finally { db.isSupabaseConfigured=false;db.supabase=null; }
  });
  await t.test('registration requires password', async()=> {
   assert.equal((await post('/auth/register-customer',{name:'Audit',email:'no-password@example.invalid',phone:'+393331234567',fiscalCode:'RSSMRA80A01H501U'})).status,400);
  });
  await t.test('registration creates customer and rejects duplicate normalized email', async()=> {
   const body={name:'Audit Person',email:'new-customer@example.invalid',phone:'+393331234567',fiscalCode:'RSSMRA80A01H501U',password:'strong-audit-password-42'};
   const first=await post('/auth/register-customer',body);assert.equal(first.status,201);
   assert.ok(store.getCustomers().some(c=>c.id===first.data.user.customerId));
   assert.equal((await post('/auth/register-customer',{...body,email:'NEW-CUSTOMER@example.invalid'})).status,409);
  });
  await t.test('failed account transaction returns error and publishes neither user nor customer', async()=> {
   const users=store.users.length,customers=store.getCustomers().length;
   db.isSupabaseConfigured=true;db.supabase={rpc:async()=>({error:{message:'registration transaction failed'}})};
   try { const r=await post('/auth/register-customer',{name:'Failure',email:'failure@example.invalid',phone:'+393331234567',fiscalCode:'RSSMRA80A01H501U',password:'strong-audit-password-42'});assert.equal(r.status,503);assert.equal(store.users.length,users);assert.equal(store.getCustomers().length,customers); }
   finally {db.isSupabaseConfigured=false;db.supabase=null;}
  });
  await t.test('default Totem key is rejected in production',async()=> {
   process.env.NODE_ENV='production';
   delete process.env.VOLTA_DEMO_MODE;
   try {assert.equal((await post('/messaging/send-offer-whatsapp',{phone:'+390000000001',customerName:'Audit',savingsEur:10,utilityType:'luce'},{'x-totem-token':'KIOSK-TOKEN-RETAIL-01'})).status,401);}
   finally {process.env.NODE_ENV='test';process.env.VOLTA_DEMO_MODE='true';}
  });
 } finally {server.close();}
});
