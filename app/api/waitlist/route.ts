import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/db";
import { waitlist } from "@/db/schema";
import { loadBarbers, loadService } from "@/lib/catalog";

const schema=z.object({name:z.string().trim().min(2).max(100),phone:z.string().trim().min(7).max(30),serviceId:z.string().min(1),barber:z.string().min(1),preferredDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/),preferredTime:z.string().max(20).optional()});

export async function POST(request:Request){
  try{
    const input=schema.parse(await request.json());
    const [service,barbers]=await Promise.all([loadService(input.serviceId),loadBarbers()]);
    if(!service)return NextResponse.json({error:"Servicio no disponible."},{status:400});
    const barberId=input.barber==="any"?null:barbers.find(item=>item.id===input.barber)?.id;
    if(input.barber!=="any"&&!barberId)return NextResponse.json({error:"Barbero no disponible."},{status:400});
    const id=crypto.randomUUID();
    await getDb().insert(waitlist).values({id,name:input.name,phone:input.phone,serviceId:input.serviceId,barberId,preferredDate:input.preferredDate,preferredTime:input.preferredTime||null,status:"waiting",createdAt:Math.floor(Date.now()/1000)});
    return NextResponse.json({ok:true,id},{status:201});
  }catch(error){
    if(error instanceof z.ZodError)return NextResponse.json({error:"Revisa tus datos."},{status:400});
    console.error("Waitlist request failed",error);
    return NextResponse.json({error:"No pudimos agregarte a la lista de espera."},{status:503});
  }
}
