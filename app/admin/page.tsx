import Admin from '@/components/Admin';
import { authenticated } from '@/lib/auth';
export const dynamic='force-dynamic';
export default async function AdminPage(){return <Admin loggedIn={await authenticated()}/>}
