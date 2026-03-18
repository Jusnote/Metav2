import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { CadernoSavedView, CadernoFilters } from '@/types/caderno';

export function useCadernoViews() {
  const [views, setViews] = useState<CadernoSavedView[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ---- Fetch all saved views ----
  const fetchViews = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await (supabase as any)
        .from('caderno_saved_views')
        .select('*')
        .eq('user_id', user.id)
        .order('position', { ascending: true });

      if (error) throw error;
      setViews((data || []) as CadernoSavedView[]);
    } catch (err) {
      console.error('Error fetching saved views:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchViews(); }, [fetchViews]);

  // ---- Create (pin) a saved view ----
  const pinView = useCallback(async (params: {
    title: string;
    color: string;
    icon?: string;
    filters: CadernoFilters;
  }): Promise<CadernoSavedView | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const nextPos = views.length;

      const { data, error } = await (supabase as any)
        .from('caderno_saved_views')
        .insert({
          user_id: user.id,
          title: params.title,
          color: params.color,
          icon: params.icon || 'notebook',
          filters: params.filters,
          position: nextPos,
        })
        .select()
        .single();

      if (error) throw error;

      const view = data as CadernoSavedView;
      setViews(prev => [...prev, view]);
      return view;
    } catch (err) {
      console.error('Error pinning view:', err);
      return null;
    }
  }, [views.length]);

  // ---- Remove (unpin) a saved view ----
  const unpinView = useCallback(async (viewId: string): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('caderno_saved_views')
        .delete()
        .eq('id', viewId);

      if (error) throw error;

      setViews(prev => prev.filter(v => v.id !== viewId));
      return true;
    } catch (err) {
      console.error('Error unpinning view:', err);
      return false;
    }
  }, []);

  // ---- Update view title/color ----
  const updateView = useCallback(async (
    viewId: string,
    updates: Partial<Pick<CadernoSavedView, 'title' | 'color' | 'icon'>>
  ): Promise<boolean> => {
    try {
      const { error } = await (supabase as any)
        .from('caderno_saved_views')
        .update(updates)
        .eq('id', viewId);

      if (error) throw error;

      setViews(prev => prev.map(v =>
        v.id === viewId ? { ...v, ...updates } : v
      ));
      return true;
    } catch (err) {
      console.error('Error updating view:', err);
      return false;
    }
  }, []);

  // ---- Check if a filter set is already pinned ----
  const isPinned = useCallback((filters: CadernoFilters): string | null => {
    const match = views.find(v => {
      const vf = v.filters;
      const sameIds = JSON.stringify((vf.lei_ids || []).sort()) === JSON.stringify((filters.lei_ids || []).sort());
      const sameMarkers = JSON.stringify((vf.markers || []).sort()) === JSON.stringify((filters.markers || []).sort());
      return sameIds && sameMarkers;
    });
    return match?.id || null;
  }, [views]);

  return {
    views,
    isLoading,
    pinView,
    unpinView,
    updateView,
    isPinned,
    refresh: fetchViews,
  };
}
