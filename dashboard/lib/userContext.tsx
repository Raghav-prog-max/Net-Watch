"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signInWithPopup, signOut, User } from "firebase/auth";
import { auth, googleProvider } from "./firebase";
import { usePathname, useRouter } from "next/navigation";

interface UserContextType {
  user: User | null;
  loading: boolean;
  login: () => void;
  logout: () => void;
}

const UserContext = createContext<UserContextType>({
  user: null,
  loading: true,
  login: () => {},
  logout: () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
      if (currentUser) {
        setShowLoginModal(false);
      } else if (pathname !== "/") {
        // If not authenticated and not on landing page, show modal
        setShowLoginModal(true);
      }
    });
    return () => unsubscribe();
  }, [pathname]);

  const login = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      router.push("/dashboard");
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const logout = async () => {
    await signOut(auth);
    router.push("/");
  };

  return (
    <UserContext.Provider value={{ user, loading, login, logout }}>
      {children}
      {showLoginModal && !user && !loading && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100%",
          height: "100%",
          backgroundColor: "rgba(0, 0, 0, 0.6)",
          backdropFilter: "blur(10px)",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}>
          <div style={{
            backgroundColor: "var(--nw-bg-panel)",
            padding: "40px",
            borderRadius: "20px",
            border: "1px solid rgba(255, 255, 255, 0.1)",
            textAlign: "center",
            maxWidth: "400px",
            width: "90%",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
          }}>
            <h2 style={{ fontSize: "24px", margin: "0 0 10px", color: "var(--nw-text-primary)" }}>Secure Access Required</h2>
            <p style={{ color: "var(--nw-text-muted)", fontSize: "14px", marginBottom: "30px" }}>
              Please sign in to access the SOC NetWatch dashboard.
            </p>
            <button
              onClick={login}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
                width: "100%",
                padding: "14px",
                borderRadius: "9999px",
                backgroundColor: "#FFFFFF",
                color: "#000000",
                fontSize: "14px",
                fontWeight: 700,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#E1E4EA")}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
            >
              Sign in with Google
            </button>
          </div>
        </div>
      )}
    </UserContext.Provider>
  );
}

export const useUser = () => useContext(UserContext);
