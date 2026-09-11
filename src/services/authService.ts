import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session, AuthChangeEvent } from '@supabase/supabase-js';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: string | null;
}

export const authService = {
  isConfigured(): boolean {
    return isSupabaseConfigured;
  },

  async getSession(): Promise<Session | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Failed to get Supabase session:', error);
        return null;
      }
      return data.session;
    } catch (err) {
      console.error('Session retrieval error:', err);
      return null;
    }
  },

  async getUser(): Promise<User | null> {
    if (!isSupabaseConfigured) return null;
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) return null;
      return data.user;
    } catch {
      return null;
    }
  },

  async signIn(email: string, password: string): Promise<{ user: User | null; error: string | null }> {
    if (!isSupabaseConfigured) {
      return { user: null, error: '未检测到 Supabase 配置，请先在环境变量中配置 VITE_SUPABASE_URL 与 VITE_SUPABASE_ANON_KEY' };
    }
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        return { user: null, error: error.message };
      }
      return { user: data.user, error: null };
    } catch (err: any) {
      return { user: null, error: err.message || '登录发生异常，请检查网络连接' };
    }
  },

  async signUp(email: string, password: string): Promise<{ user: User | null; error: string | null; confirmationRequired?: boolean }> {
    if (!isSupabaseConfigured) {
      return { user: null, error: '未检测到 Supabase 配置，请先配置环境变量' };
    }
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
      });
      if (error) {
        return { user: null, error: error.message };
      }
      const confirmationRequired = Boolean(data.user && !data.session);
      return { user: data.user, error: null, confirmationRequired };
    } catch (err: any) {
      return { user: null, error: err.message || '注册发生异常，请稍后重试' };
    }
  },

  async signOut(): Promise<{ error: string | null }> {
    if (!isSupabaseConfigured) return { error: null };
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        return { error: error.message };
      }
      return { error: null };
    } catch (err: any) {
      return { error: err.message || '登出异常' };
    }
  },

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    if (!isSupabaseConfigured) {
      return { data: { subscription: { unsubscribe: () => {} } } };
    }
    return supabase.auth.onAuthStateChange(callback);
  },
};
