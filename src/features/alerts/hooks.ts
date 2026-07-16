import type { Alert } from '@shared/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

import { listAlerts, listSnapshots, toggleAlert } from './api';

export function useAlerts(trackedProductId: string | null) {
  return useQuery({
    queryKey: ['alerts', trackedProductId],
    queryFn: () => listAlerts(trackedProductId!),
    enabled: !!trackedProductId,
  });
}

export function useToggleAlert(trackedProductId: string | null) {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ kind, existing }: { kind: Alert['kind']; existing: Alert | undefined }) =>
      toggleAlert(session!.user.id, trackedProductId!, kind, existing),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts', trackedProductId] });
    },
  });
}

export function useSnapshots(trackedProductId: string | null) {
  return useQuery({
    queryKey: ['snapshots', trackedProductId],
    queryFn: () => listSnapshots(trackedProductId!),
    enabled: !!trackedProductId,
  });
}
