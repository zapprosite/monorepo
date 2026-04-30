import { createTRPCReact, httpLink } from '@trpc/react-query';
import type { AppRouter } from '../../../../packages/trpc/src/index';

export const trpc = createTRPCReact<AppRouter>();

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4088';

export const trpcClient = trpc.createClient({
  links: [
    httpLink({
      url: `${API_URL}/trpc`,
      headers: () => {
        const devUser = sessionStorage.getItem('dev_user');
        return devUser ? { 'X-Dev-User': devUser } : {};
      },
    }),
  ],
});
