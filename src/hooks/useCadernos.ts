import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { CadernoItem, ContextChainItem } from '@/types/caderno';
import { PROVISION_ROLE_LABELS } from '@/types/caderno';

// ============ Slug Set for instant lookups ============

export function useCadernos() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [items, setItems] = useState<CadernoItem[]>([]);
  const savedSlugsRef = useRef<Set<string>>(new Set());
  const [savedVersion, setSavedVersion] = useState(0);
  const defaultCadernoIdRef = useRef<string | null>(null);

  // ---- Ensure default caderno exists ----
  const ensureDefaultCaderno = useCallback(async (userId: string): Promise<string | null> => {
    if (defaultCadernoIdRef.current) return defaultCadernoIdRef.current;

    const { data: existing } = await (supabase as any)
      .from('cadernos')
      .select('id')
      .eq('user_id', userId)
      .limit(1);

    if (existing && existing.length > 0) {
      defaultCadernoIdRef.current = existing[0].id;
      return existing[0].id;
    }

    const { data: created, error } = await (supabase as any)
      .from('cadernos')
      .insert({ user_id: userId, title: 'Meu Caderno', color: '#8b5cf6', icon: 'notebook' })
      .select('id')
      .single();

    if (error) { console.error('Error creating default caderno:', error); return null; }
    defaultCadernoIdRef.current = created.id;
    return created.id;
  }, []);

  // ---- Fetch all saved items ----
  const fetchItems = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const cadernoId = await ensureDefaultCaderno(user.id);
      if (!cadernoId) return;

      const { data, error } = await (supabase as any)
        .from('caderno_items')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const fetchedItems = ((data || []) as any[]).map(d => ({
        ...d,
        markers: d.markers || [],
      })) as CadernoItem[];
      setItems(fetchedItems);
      savedSlugsRef.current = new Set(fetchedItems.map(i => i.provision_slug));
      setSavedVersion(v => v + 1);
    } catch (err) {
      console.error('Error fetching saved provisions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [ensureDefaultCaderno]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  // ---- Save provision (1 click) ----
  const saveProvision = useCallback(async (item: {
    lei_id: string;
    artigo_numero: string;
    provision_slug: string;
    provision_role: string;
    provision_text: string;
    lei_sigla: string | null;
    lei_nome: string | null;
    artigo_contexto: string | null;
    context_chain: ContextChainItem[];
  }): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const cadernoId = await ensureDefaultCaderno(user.id);
      if (!cadernoId) return false;

      const { data: existing } = await (supabase as any)
        .from('caderno_items')
        .select('position')
        .eq('caderno_id', cadernoId)
        .order('position', { ascending: false })
        .limit(1);

      const nextPos = existing?.[0] ? existing[0].position + 1 : 0;

      const { data, error } = await (supabase as any)
        .from('caderno_items')
        .insert({
          ...item,
          markers: [],
          caderno_id: cadernoId,
          user_id: user.id,
          position: nextPos,
        })
        .select()
        .single();

      if (error) throw error;

      const newItem = { ...data, markers: data.markers || [] } as CadernoItem;
      setItems(prev => [newItem, ...prev]);
      savedSlugsRef.current.add(item.provision_slug);
      setSavedVersion(v => v + 1);

      return true;
    } catch (err) {
      console.error('Error saving provision:', err);
      return false;
    }
  }, [ensureDefaultCaderno]);

  // ---- Unsave provision (1 click) ----
  const unsaveProvision = useCallback(async (provisionSlug: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await (supabase as any)
        .from('caderno_items')
        .delete()
        .eq('user_id', user.id)
        .eq('provision_slug', provisionSlug);

      if (error) throw error;

      setItems(prev => prev.filter(i => i.provision_slug !== provisionSlug));
      savedSlugsRef.current.delete(provisionSlug);
      setSavedVersion(v => v + 1);

      return true;
    } catch (err) {
      console.error('Error unsaving provision:', err);
      return false;
    }
  }, []);

  // ---- Toggle save (with toast feedback) ----
  const toggleSave = useCallback(async (item: {
    lei_id: string;
    artigo_numero: string;
    provision_slug: string;
    provision_role: string;
    provision_text: string;
    lei_sigla: string | null;
    lei_nome: string | null;
    artigo_contexto: string | null;
    context_chain: ContextChainItem[];
  }): Promise<boolean> => {
    const wasSaved = savedSlugsRef.current.has(item.provision_slug);
    const result = wasSaved
      ? await unsaveProvision(item.provision_slug)
      : await saveProvision(item);

    if (result) {
      const roleLabel = PROVISION_ROLE_LABELS[item.provision_role] || '';
      const preview = item.provision_text.length > 60
        ? item.provision_text.slice(0, 60) + '...'
        : item.provision_text;

      toast({
        title: wasSaved ? 'Removido do caderno' : 'Salvo no caderno',
        description: `${roleLabel} ${preview}`.trim(),
        duration: 2000,
      });
    }

    return result;
  }, [saveProvision, unsaveProvision, toast]);

  // ---- Lookups ----
  const isSaved = useCallback((slug: string): boolean => {
    return savedSlugsRef.current.has(slug);
  }, [savedVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Markers (personal tags) ----
  const addMarker = useCallback(async (provisionSlug: string, marker: string): Promise<boolean> => {
    try {
      const item = items.find(i => i.provision_slug === provisionSlug);
      if (!item) return false;

      const current = item.markers || [];
      if (current.includes(marker)) return true; // already has it

      const updated = [...current, marker];

      const { error } = await (supabase as any)
        .from('caderno_items')
        .update({ markers: updated })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.map(i =>
        i.provision_slug === provisionSlug ? { ...i, markers: updated } : i
      ));

      return true;
    } catch (err) {
      console.error('Error adding marker:', err);
      return false;
    }
  }, [items]);

  const removeMarker = useCallback(async (provisionSlug: string, marker: string): Promise<boolean> => {
    try {
      const item = items.find(i => i.provision_slug === provisionSlug);
      if (!item) return false;

      const updated = (item.markers || []).filter(m => m !== marker);

      const { error } = await (supabase as any)
        .from('caderno_items')
        .update({ markers: updated })
        .eq('id', item.id);

      if (error) throw error;

      setItems(prev => prev.map(i =>
        i.provision_slug === provisionSlug ? { ...i, markers: updated } : i
      ));

      return true;
    } catch (err) {
      console.error('Error removing marker:', err);
      return false;
    }
  }, [items]);

  // ---- Get unique leis for filter ----
  const getLeis = useCallback((): { id: string; sigla: string; nome: string }[] => {
    const map = new Map<string, { id: string; sigla: string; nome: string }>();
    for (const item of items) {
      if (!map.has(item.lei_id)) {
        map.set(item.lei_id, {
          id: item.lei_id,
          sigla: item.lei_sigla || item.lei_id,
          nome: item.lei_nome || '',
        });
      }
    }
    return Array.from(map.values());
  }, [items]);

  // ---- Update note ----
  const updateNote = useCallback(async (provisionSlug: string, note: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const { error } = await (supabase as any)
        .from('caderno_items')
        .update({ note: note || null })
        .eq('user_id', user.id)
        .eq('provision_slug', provisionSlug);

      if (error) throw error;

      setItems(prev => prev.map(i =>
        i.provision_slug === provisionSlug ? { ...i, note: note || null } : i
      ));
      return true;
    } catch (err) {
      console.error('Error updating note:', err);
      return false;
    }
  }, []);

  // ---- Get all unique markers across all items ----
  const getAllMarkers = useCallback((): string[] => {
    const set = new Set<string>();
    for (const item of items) {
      for (const m of (item.markers || [])) {
        set.add(m);
      }
    }
    return Array.from(set).sort();
  }, [items]);

  return {
    items,
    isLoading,
    saveProvision,
    unsaveProvision,
    toggleSave,
    updateNote,
    isSaved,
    addMarker,
    removeMarker,
    getLeis,
    getAllMarkers,
    refresh: fetchItems,
  };
}
