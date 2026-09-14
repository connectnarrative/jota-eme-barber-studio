import { NextResponse } from "next/server";
import { asc, eq, gte } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { appointments } from "@/db/schema";

async function authorized(){const h=await headers();return Boolean(h.get("oai-authenticated-user-id")||h.get("cf-access-authenticated-user-email"))}
export async function GET(){if(!(await authorized()))return NextResponse.json({error:"Unauthorized"},{status:401});try{const now=Math.floor(Date.now()/1000)-86400;const rows=await getDb().select().from(appointments).where(gte(appointments.startAt,now)).orderBy(asc(appointments.startAt)).limit(100);return NextResponse.json({appointments:rows})}catch(error){console.error(error);return NextResponse.json({appointments:[],unavailable:true})}}
export async function PATCH(request:Request){if(!(await authorized()))return NextResponse.json({error:"Unauthorized"},{status:401});const body=await request.json() as {id?:string,status?:string};const allowed=["pending","confirmed","arrived","in_progress","completed","cancelled","no_show"];if(!body.id||!body.status||!allowed.includes(body.status))return NextResponse.json({error:"Invalid update"},{status:400});await getDb().update(appointments).set({status:body.status}).where(eq(appointments.id,body.id));return NextResponse.json({ok:true})}
