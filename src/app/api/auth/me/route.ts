import { json, getSessionUser } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await getSessionUser();
  return json({ user });
}
