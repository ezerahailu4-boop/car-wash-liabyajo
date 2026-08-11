'use server';

import { createClient } from '@/lib/supabase/server';
import { revalidatePath } from 'next/cache';

export async function inviteUser(formData: FormData) {
  const email = formData.get('email') as string;
  const name = formData.get('name') as string;
  const role = formData.get('role') as string;
  const phone = formData.get('phone') as string;

  const supabase = await createClient();

  // Invite the user via Supabase Auth Admin API
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(
    email,
    {
      data: {
        full_name: name,
        role,
        phone: phone || null,
      },
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback` // Adjust as needed
    }
  );

  if (error) {
    return { error: error.message };
  }

  // Optionally, you can also create a profile entry here, but the invite already creates a user in auth.users
  // The profile will be created via a trigger or you can insert it now if needed.
  // However, note that the auth.user.id will be available in data.user.id after the user accepts the invite.
  // For now, we rely on the database trigger to create the profile when the user signs up.

  // Revalidate the admin page to update the staff list (if we were to fetch the invited user, but we don't have the ID until they accept)
  // We'll skip revalidation for now because the user isn't in the database until they accept the invite.

  return { data, error: null };
}