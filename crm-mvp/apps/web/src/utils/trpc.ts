import { createTRPCReact, httpBatchLink } from '@trpc/react-query';
import type { AppRouter } from '@crm-mvp/trpc';

export const trpc = createTRPCReact<AppRouter>();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: `${API_URL}/trpc`,
      headers: () => {
        const devUser = sessionStorage.getItem('dev_user');
        return devUser ? { 'X-Dev-User': devUser } : {};
      },
    }),
  ],
});
