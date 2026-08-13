import { QueryClient } from '@tanstack/react-query';

// Shared query defaults tuned for a mobile client on variable connectivity:
// keep data fresh for a minute before refetching in the background, and
// don't hammer the API with retries on every screen focus.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
    },
  },
});
