// Data hooks: every read is a React Query (cached, refetched when stale) and
// every write goes through useAction, which refreshes the data afterwards.
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { type HostDashboard, type ListingPage, type ListingSummary, type Meta, type SearchResult, type Trip, api, errorMessage } from './api';
import { toast } from './ui';

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api<Meta>('GET', '/meta') });

export const useSearch = (queryString: string) =>
  useQuery({
    queryKey: ['listings', queryString],
    queryFn: () => api<SearchResult>('GET', `/listings${queryString ? `?${queryString}` : ''}`),
    placeholderData: keepPreviousData, // keep showing the old page while the next one loads
  });

export const useListing = (id: string | undefined) =>
  useQuery({ queryKey: ['listing', id], queryFn: () => api<ListingPage>('GET', `/listings/${id}`), enabled: Boolean(id) });

export const useTrips = () => useQuery({ queryKey: ['trips'], queryFn: () => api<{ bookings: Trip[] }>('GET', '/bookings') });

export const useFavorites = () => useQuery({ queryKey: ['favorites'], queryFn: () => api<{ listings: ListingSummary[] }>('GET', '/favorites') });

export const useDashboard = () => useQuery({ queryKey: ['host'], queryFn: () => api<HostDashboard>('GET', '/host/dashboard') });

// Runs a write (POST / PUT / PATCH / DELETE). On success every cached query is
// marked stale so the screen shows fresh data; on failure a toast explains why.
export function useAction() {
  const queryClient = useQueryClient();
  return useCallback(
    async (work: () => Promise<unknown>, successMessage?: string) => {
      try {
        await work();
        await queryClient.invalidateQueries();
        if (successMessage) toast(successMessage);
        return true;
      } catch (error) {
        toast(errorMessage(error), 'error');
        return false;
      }
    },
    [queryClient]
  );
}

// Same, for forms inside dialogs: errors are thrown so the form can show them.
export function useRefresh() {
  const queryClient = useQueryClient();
  return useCallback(() => queryClient.invalidateQueries(), [queryClient]);
}
