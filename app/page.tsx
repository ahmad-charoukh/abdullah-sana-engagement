import Invitation from '@/components/Invitation';
import { publicData } from '@/lib/db';
export const dynamic='force-dynamic';
export default async function Page(){return <Invitation initial={await publicData()}/>}
