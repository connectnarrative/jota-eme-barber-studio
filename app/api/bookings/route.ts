import { NextResponse } from "next/server";
import { and, eq, gt, lt, or } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/db";
import { appointments, clients, notificationLogs } from "@/db/schema";
import { services } from "@/app/data";

const inputSchema=z.object({serviceId:z.string(),barber:z.string(),date:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),time:z.string(),name:z.string().min(2).max(100),phone:z.string().min(7).max(30),email:z.string().email().optional().or(z.literal("")),notes:z.string().max(500).optional()});
function to24(value:string){const match=value.match(/(\d+):(\d+)\s*(AM|PM)/i);if(!match)throw new Error("Invalid time");let hour=Number(match[1]);if(match[3].toUpperCase()==="PM"&&hour!==12)hour+=12;if(match[3].toUpperCase()==="AM"&&hour===12)hour=0;return `${String(hour).padStart(2,"0")}:${match[2]}`}

export async function POST(request:Request){
  try{
    const input=inputSchema.parse(await request.json());const service=services.find(s=>s.id===input.serviceId);if(!service)return NextResponse.json({error:"Servicio no encontrado"},{status:400});
    const db=getDb();const startDate=new Date(`${input.date}T${to24(input.time)}:00-05:00`);const startAt=Math.floor(startDate.getTime()/1000);const endAt=startAt+service.minutes*60;
    let barberId:string|null=null;
    const candidates=input.barber==="any"?["cheo","alejandro"]:[input.barber];
    for(const candidate of candidates){const conflicts=await db.select({id:appointments.id}).from(appointments).where(and(eq(appointments.barberId,candidate),lt(appointments.startAt,endAt),gt(appointments.endAt,startAt),or(eq(appointments.status,"confirmed"),eq(appointments.status,"arrived"),eq(appointments.status,"in_progress")))).limit(1);if(!conflicts.length){barberId=candidate;break}}
    if(!barberId)return NextResponse.json({error:"Ese horario acaba de ocuparse. Elige otra hora."},{status:409});
    const now=Math.floor(Date.now()/1000),clientId=crypto.randomUUID(),id=crypto.randomUUID(),publicToken=crypto.randomUUID().replaceAll("-","");
    await db.batch([
      db.insert(clients).values({id:clientId,name:input.name,phone:input.phone,email:input.email||null,preferredBarber:barberId,visitCount:0,createdAt:now}).onConflictDoUpdate({target:clients.phone,set:{name:input.name,email:input.email||null,preferredBarber:barberId}}),
      db.insert(appointments).values({id,publicToken,clientId,clientName:input.name,phone:input.phone,email:input.email||null,serviceId:service.id,barberId,date:input.date,time:input.time,startAt,endAt,price:service.price,status:"confirmed",notes:input.notes||null,createdAt:now}),
      db.insert(notificationLogs).values({id:crypto.randomUUID(),appointmentId:id,channel:"whatsapp",kind:"confirmation_queued",status:"queued",createdAt:now})
    ]);
    return NextResponse.json({id,status:"confirmed",barberId,manageUrl:`/booking/${publicToken}`},{status:201});
  }catch(error){if(error instanceof z.ZodError)return NextResponse.json({error:"Revisa los datos de la reserva."},{status:400});console.error(error);return NextResponse.json({error:"No pudimos confirmar la cita. Intenta de nuevo."},{status:503})}
}
