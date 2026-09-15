// Run only against an isolated local D1 instance. Never uses the production DB.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFile, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const require=createRequire(import.meta.resolve("wrangler"));
const {Miniflare}=require("miniflare");
const persist=await mkdtemp(path.join(tmpdir(),"jota-booking-test-"));
const scriptPath=process.argv[2];
if(!scriptPath)throw new Error("Pass the bundled Worker path from a wrangler --dry-run build.");
const options={host:"127.0.0.1",port:0,modulesRoot:path.dirname(path.resolve(scriptPath)),modules:[{type:"ESModule",path:path.resolve(scriptPath)}],compatibilityDate:"2026-05-15",compatibilityFlags:["nodejs_compat"],d1Databases:{DB:"isolated-verification-db"},d1Persist:persist,bindings:{ADMIN_PASSWORD:"local-verification-only"}};
let mf=new Miniflare(options);
const request=(route,init)=>mf.dispatchFetch("https://test.local"+route,init);
const post=value=>({method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
const patch=value=>({method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify(value)});
const addDays=(date,amount)=>{const next=new Date(date+"T12:00:00-05:00");next.setUTCDate(next.getUTCDate()+amount);return new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota"}).format(next)};

try{
  const db=await mf.getD1Database("DB");
  const migration=await readFile(new URL("../drizzle/0000_aberrant_gwen_stacy.sql",import.meta.url),"utf8");
  for(const statement of migration.split(";").map(value=>value.trim()).filter(Boolean))await db.prepare(statement).run();
  assert.equal((await request("/api/admin/studio")).status,401);
  assert.equal((await request("/api/admin/appointments",{headers:{"cf-access-authenticated-user-email":"forged@example.invalid"}})).status,401);
  const login=await request("/api/admin/session",post({password:"local-verification-only"}));
  assert.equal(login.status,200);
  const cookie=login.headers.get("set-cookie").split(";")[0];
  const adminHeaders={cookie,"content-type":"application/json"};
  const adminPost=value=>request("/api/admin/studio",{method:"POST",headers:adminHeaders,body:JSON.stringify(value)});

  const initialStudio=await request("/api/admin/studio",{headers:{cookie}});
  assert.equal(initialStudio.status,200);
  const initialData=await initialStudio.json();
  assert.equal(initialData.services.length,14);
  assert.equal(initialData.barbers.length,2);
  console.log("PASS: every Studio OS data surface loads behind authenticated admin access");

  const savedService={id:"haircut",nameEs:"Corte Signature",nameEn:"Signature Haircut",price:55000,minutes:50,active:true,featured:true,sortOrder:0};
  assert.equal((await adminPost({action:"service:save",value:savedService})).status,200);
  assert.equal((await adminPost({action:"settings:save",value:{openingTime:"09:15",closingTime:"20:20",slotInterval:"15",bookingLeadMinutes:"0",bookingWindowDays:"45",bufferMinutes:"5",cancellationHours:"4",monday:"open",tuesday:"open",wednesday:"open",thursday:"open",friday:"open",saturday:"open",sunday:"open"}})).status,200);
  const catalog=await (await request("/api/catalog")).json();
  assert.equal(catalog.services.find(item=>item.id==="haircut").price,55000);
  console.log("PASS: service and booking-rule CMS changes save and control the public catalog");

  const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/Bogota"}).format(new Date());
  const blockDate=addDays(today,1);
  const availabilityBefore=await request(`/api/availability?serviceId=haircut&barber=cheo&date=${blockDate}`);
  assert.equal(availabilityBefore.status,200);
  const firstSlot=(await availabilityBefore.json()).slots[0]?.time;
  assert.ok(firstSlot,"expected at least one available slot");
  const block=await adminPost({action:"block:create",barberId:"cheo",date:blockDate,startTime:firstSlot,endTime:"11:15 AM",reason:"Prueba de bloqueo"});
  assert.equal(block.status,201,await block.clone().text());
  const blockId=(await block.json()).id;
  const availabilityAfter=await (await request(`/api/availability?serviceId=haircut&barber=cheo&date=${blockDate}`)).json();
  assert.equal(availabilityAfter.slots.some(item=>item.time===firstSlot),false);
  console.log("PASS: blocked time removes conflicting slots from customer availability");

  const wait=await adminPost({action:"waitlist:create",name:"TEST Waitlist",phone:"0000000099",serviceId:"haircut",barberId:"cheo",preferredDate:blockDate,preferredTime:firstSlot});
  assert.equal(wait.status,201);
  const waitId=(await wait.json()).id;
  assert.equal((await adminPost({action:"waitlist:update",id:waitId,status:"contacted"})).status,200);
  const studioWithWaitlist=await (await request("/api/admin/studio",{headers:{cookie}})).json();
  assert.equal(studioWithWaitlist.waitlist.find(item=>item.id===waitId).status,"contacted");
  console.log("PASS: waitlist creation and workflow status persist in Studio OS");

  const manual=await request("/api/admin/appointments",{method:"POST",headers:adminHeaders,body:JSON.stringify({name:"TEST Walk-in",phone:"0000000088",email:"",serviceId:"haircut",barberId:"alejandro",date:blockDate,time:firstSlot,status:"confirmed",notes:"Admin-created verification"})});
  assert.equal(manual.status,201,await manual.clone().text());
  const manualId=(await manual.json()).id;
  const manualRows=await (await request("/api/admin/appointments",{headers:{cookie}})).json();
  assert.equal(manualRows.appointments.some(item=>item.id===manualId),true);
  console.log("PASS: new appointment / walk-in saves to the real calendar");

  const bookingDate=addDays(today,2);
  const available=await (await request(`/api/availability?serviceId=haircut&barber=alejandro&date=${bookingDate}`)).json();
  const bookingTime=available.slots[0]?.time;
  assert.ok(bookingTime);
  const input={serviceId:"haircut",barber:"alejandro",date:bookingDate,time:bookingTime,name:"TEST Persistence Verification",phone:"0000000000",notes:"Isolated local verification only"};
  const booking=await request("/api/bookings",post(input));
  assert.equal(booking.status,201,await booking.clone().text());
  const created=await booking.json();
  const duplicate=await request("/api/bookings",post({...input,name:"TEST Double Booking Rejected",phone:"0000000001"}));
  assert.equal(duplicate.status,409,"the same barber and time must reject a double booking");
  console.log("PASS: occupied barber and time rejects a double booking");

  const verify=async phase=>{
    const saved=await request(created.manageUrl.replace("/booking/","/api/booking/"));
    assert.equal(saved.status,200);
    const row=await saved.json();
    for(const [key,value] of Object.entries({clientName:input.name,date:bookingDate,time:bookingTime,barberId:input.barber,serviceId:input.serviceId,status:"confirmed",price:55000}))assert.equal(row[key],value,phase+": "+key);
    const admin=await request("/api/admin/studio",{headers:{cookie}});
    assert.equal(admin.status,200);
    const studio=await admin.json();
    const matches=studio.appointments.filter(item=>item.id===created.id);
    assert.equal(matches.length,1);
    assert.equal(matches[0].clientName,input.name);
    assert.equal(studio.services.find(item=>item.id==="haircut").price,55000);
    assert.equal(studio.waitlist.find(item=>item.id===waitId).status,"contacted");
    assert.equal(studio.blockedTime.some(item=>item.id===blockId),true);
    console.log("PASS:",phase,"— appointments, CMS settings, blocked time and waitlist are intact");
  };
  await verify("immediate read");
  await verify("fresh request / refresh");
  await mf.dispose();
  mf=new Miniflare(options);
  await verify("new Worker instance with persisted D1");
  const studioPage=await request("/admin",{headers:{cookie}});
  assert.equal(studioPage.status,200,"authenticated Studio OS page must render");
  assert.match(await studioPage.text(),/Studio OS|Hoy en Jota Eme/);
  console.log("PASS: authenticated Studio OS renders after Worker replacement");
  console.log("Studio OS operations, booking availability and persistence passed.");
}finally{await mf.dispose()}
