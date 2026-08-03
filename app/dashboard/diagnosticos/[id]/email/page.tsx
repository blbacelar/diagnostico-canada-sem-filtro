import { DeliveryComposer } from "../../../../../components/DeliveryComposer";
export default async function EmailPage({params}:{params:Promise<{id:string}>}){const{id}=await params;return <DeliveryComposer caseId={id}/>}
