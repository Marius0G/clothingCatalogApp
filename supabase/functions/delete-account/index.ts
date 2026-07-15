// Deletes the calling user's account: storage photos first, then the auth user
// (DB rows cascade from auth.users). Required by App Store guideline 5.1.1(v).
import { createClient } from 'npm:@supabase/supabase-js@2';

import { handleOptions, jsonResponse } from '../_shared/cors.ts';

const BUCKET = 'item-photos';

Deno.serve(async (req) => {
  const options = handleOptions(req);
  if (options) return options;

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return jsonResponse({ error: 'missing authorization' }, 401);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Resolve the caller from their JWT — never trust a user id from the body.
  const jwt = authHeader.replace('Bearer ', '');
  const { data: userData, error: userError } = await admin.auth.getUser(jwt);
  if (userError || !userData.user) {
    return jsonResponse({ error: 'invalid token' }, 401);
  }
  const userId = userData.user.id;

  // Purge storage under {userId}/... (two levels: {userId}/{itemId}/file).
  const paths: string[] = [];
  const { data: itemFolders } = await admin.storage.from(BUCKET).list(userId, { limit: 1000 });
  for (const folder of itemFolders ?? []) {
    if (folder.id) {
      // a file directly under {userId}/
      paths.push(`${userId}/${folder.name}`);
      continue;
    }
    const { data: files } = await admin.storage
      .from(BUCKET)
      .list(`${userId}/${folder.name}`, { limit: 1000 });
    for (const file of files ?? []) {
      paths.push(`${userId}/${folder.name}/${file.name}`);
    }
  }
  if (paths.length > 0) {
    const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
    if (removeError) {
      return jsonResponse({ error: 'failed to delete photos' }, 500);
    }
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) {
    return jsonResponse({ error: 'failed to delete account' }, 500);
  }

  return jsonResponse({ ok: true });
});
