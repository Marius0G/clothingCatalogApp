// Backfills the v2 structured attributes (formality, warmth, seasons, …) on
// items tagged before migration 0003 by re-running the tag-item edge function
// on their stored photos. Run with:
//
//   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-tags.mjs
//
// Uses the service-role path in tag-item; AI usage still counts against each
// item owner's daily 'tag' cap (50/day), so large wardrobes may need several
// runs on consecutive days — the script skips a user for the day on 429.

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

const headers = { apikey: key, Authorization: `Bearer ${key}` };

const res = await fetch(
  `${url}/rest/v1/items?select=id,user_id,title&image_path=not.is.null&formality=is.null&order=user_id,created_at`,
  { headers },
);
if (!res.ok) {
  console.error(`Failed to list items: ${res.status} ${await res.text()}`);
  process.exit(1);
}
const items = await res.json();
console.log(`${items.length} item(s) need backfill.`);

const cappedUsers = new Set();
let done = 0;
let failed = 0;

for (const item of items) {
  if (cappedUsers.has(item.user_id)) continue;
  const tag = await fetch(`${url}/functions/v1/tag-item`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ item_id: item.id }),
  });
  if (tag.ok) {
    done++;
    console.log(`ok    ${item.id} ${item.title ?? ''}`);
  } else if (tag.status === 429) {
    cappedUsers.add(item.user_id);
    console.log(`cap   user ${item.user_id} hit the daily tag limit — rerun tomorrow`);
  } else {
    failed++;
    console.log(`fail  ${item.id} → ${tag.status} ${await tag.text()}`);
  }
  // stay gentle with the AI provider
  await new Promise((resolve) => setTimeout(resolve, 1500));
}

console.log(`Done: ${done} tagged, ${failed} failed, ${cappedUsers.size} user(s) capped.`);
