import { BookingManager } from "./booking-manager";
export const dynamic="force-dynamic";
export default async function BookingPage({params}:{params:Promise<{token:string}>}){return <BookingManager token={(await params).token}/>}
