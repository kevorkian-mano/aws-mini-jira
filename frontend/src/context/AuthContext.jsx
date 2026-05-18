import { createContext, useContext, useState, useEffect } from 'react';
import { Auth } from 'aws-amplify';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [role, setRole]       = useState(null);
  const [teamId, setTeamId]   = useState(null);
  const [teamName, setTeamName] = useState(null);
  const [email, setEmail]     = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { restoreSession(); }, []);

  const restoreSession = async () => {
    try {
      const cognitoUser = await Auth.currentAuthenticatedUser();
      const attrs = cognitoUser.attributes;
      setUser(cognitoUser);
      setEmail(attrs.email);
      setRole(attrs['custom:role'] || null);
      setTeamId(attrs['custom:teamId'] || null);
      setTeamName(attrs['custom:teamName'] || null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const cognitoUser = await Auth.signIn(email, password);
    const attrs = cognitoUser.attributes;
    setUser(cognitoUser);
    setEmail(attrs.email);
    setRole(attrs['custom:role'] || null);
    setTeamId(attrs['custom:teamId'] || null);
    setTeamName(attrs['custom:teamName'] || null);
    return cognitoUser;
  };

  const logout = async () => {
    await Auth.signOut();
    setUser(null); setRole(null); setTeamId(null); setTeamName(null); setEmail(null);
  };

  const refreshUser = async () => { await restoreSession(); };

  return (
    <AuthContext.Provider value={{ user, role, teamId, teamName, email, loading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);