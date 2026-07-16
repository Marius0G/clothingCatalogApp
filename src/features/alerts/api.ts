import { AlertSchema, ProductSnapshotSchema, type Alert, type ProductSnapshot } from '@shared/types';
import { z } from 'zod';

import { supabase } from '@/lib/supabase';

export async function listAlerts(trackedProductId: string): Promise<Alert[]> {
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('tracked_product_id', trackedProductId)
    .eq('active', true);
  if (error) throw error;
  return z.array(AlertSchema).parse(data);
}

export async function toggleAlert(
  userId: string,
  trackedProductId: string,
  kind: Alert['kind'],
  existing: Alert | undefined,
): Promise<void> {
  if (existing) {
    const { error } = await supabase.from('alerts').delete().eq('id', existing.id);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('alerts').insert({
    user_id: userId,
    tracked_product_id: trackedProductId,
    kind,
  });
  if (error) throw error;
}

export async function listSnapshots(trackedProductId: string): Promise<ProductSnapshot[]> {
  const { data, error } = await supabase
    .from('product_snapshots')
    .select('id, tracked_product_id, price, currency, in_stock, captured_at')
    .eq('tracked_product_id', trackedProductId)
    .order('captured_at', { ascending: true })
    .limit(60);
  if (error) throw error;
  return z.array(ProductSnapshotSchema).parse(data);
}
