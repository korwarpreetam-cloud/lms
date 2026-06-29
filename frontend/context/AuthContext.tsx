"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient, getAppClaims, switchActiveOrganization, AppClaims } from '../lib/auth';
import type { Session, User } from '@supabase/supabase-js';

type AuthContextType = {
  user: User | null;
  session: Session | null;
  claims: AppClaims | null;
  loading: boolean;
  switchOrg: (orgId: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshClaims: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [claims, setClaims] = useState<AppClaims | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  const handleSession = useCallback((currentSession: Session | null) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    if (currentSession) {
      const decodedClaims = getAppClaims(currentSession);
      setClaims(decodedClaims);
    } else {
      setClaims(null);
    }
  }, []);

  const refreshClaims = useCallback(async () => {
    try {
      const { data: { session: currentSession }, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      handleSession(currentSession);
    } catch (err) {
      console.error('Error refreshing claims (falling back to getSession):', err);
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        handleSession(currentSession);
      } catch (sessErr) {
        console.error('Fallback getSession failed:', sessErr);
      }
    }
  }, [supabase.auth, handleSession]);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      handleSession(currentSession);
      setLoading(false);
    }).catch((err) => {
      console.error('Error getting initial session:', err);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        handleSession(currentSession);
        setLoading(false);
        
        if (event === 'SIGNED_OUT') {
          router.push('/login');
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase.auth, handleSession, router]);

  const switchOrg = async (orgId: string) => {
    setLoading(true);
    try {
      const newClaims = await switchActiveOrganization(orgId);
      setClaims(newClaims);
      // Let layouts know we updated org. Since we refresh the session,
      // the new claims are active now. Let's do a soft router refresh
      // to let layouts reload their data dependencies.
      router.refresh();
    } catch (err) {
      console.error('Failed to switch organization:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      router.push('/login');
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, session, claims, loading, switchOrg, logout, refreshClaims }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
