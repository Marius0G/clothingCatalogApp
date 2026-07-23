import { useMutation } from '@tanstack/react-query';

import { useAuth } from '@/features/auth/provider';

import { submitFeedback } from './api';

export function useSubmitFeedback() {
  const { session } = useAuth();
  const userId = session?.user.id;
  return useMutation({
    mutationFn: (message: string) => submitFeedback(userId!, message),
  });
}
