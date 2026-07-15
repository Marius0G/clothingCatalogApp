import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProfileUpdate } from '@shared/types';

import { useAuth } from '@/features/auth/provider';

import { fetchProfile, updateProfile } from './api';

export function useProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useQuery({
    queryKey: ['profile', userId],
    queryFn: () => fetchProfile(userId!),
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const { session } = useAuth();
  const userId = session?.user.id;
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (update: ProfileUpdate) => updateProfile(userId!, update),
    onSuccess: (profile) => {
      queryClient.setQueryData(['profile', userId], profile);
    },
  });
}
