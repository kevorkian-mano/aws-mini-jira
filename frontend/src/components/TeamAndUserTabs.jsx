// ═══════════════════════════════════════════════════════════
//  TeamsTab.jsx
// ═══════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

export function TeamsTab() {
  const [teams, setTeams]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [teamName, setTeamName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchTeams(); }, []);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/teams');
      setTeams(res.data || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreating(true);
    try {
      const res = await api.post('/api/teams', { teamName: teamName.trim() });
      setTeams((prev) => [...prev, res.data]);
      setTeamName('');
      toast.success(`Team "${teamName}" created`);
    } catch (err) { toast.error(err.message); } finally { setCreating(false); }
  };

  const handleDelete = async (teamId, name) => {
    if (!window.confirm(`Delete team "${name}"?`)) return;
    try {
      await api.delete(`/api/teams/${teamId}`);
      setTeams((prev) => prev.filter((t) => t.teamId !== teamId));
      toast.success('Team deleted');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <LoadingSpinner message="Loading teams..." />;

  const TEAM_COLORS = ['bg-blue-100 text-blue-700', 'bg-green-100 text-green-700', 'bg-purple-100 text-purple-700', 'bg-amber-100 text-amber-700', 'bg-pink-100 text-pink-700'];

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">Teams ({teams.length})</h2>
      </div>

      {/* Quick create */}
      <form onSubmit={handleCreate} className="flex gap-2 mb-5">
        <input value={teamName} onChange={(e) => setTeamName(e.target.value)}
          placeholder="New team name (e.g. Frontend, QA, DevOps)"
          className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <button type="submit" disabled={creating || !teamName.trim()}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2.5 rounded-xl text-sm font-semibold whitespace-nowrap transition-colors">
          {creating ? 'Adding...' : '+ Add Team'}
        </button>
      </form>

      {teams.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3"></div>
          <p className="font-medium">No teams yet</p>
          <p className="text-sm mt-1">Add your first team above</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {teams.map((t, i) => (
            <div key={t.teamId}
              className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold ${TEAM_COLORS[i % TEAM_COLORS.length]}`}>
                  {t.teamName?.[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{t.teamName}</p>
                  <p className="text-xs text-gray-400">
                    {t.createdAt ? new Date(t.createdAt).toLocaleDateString('en-GB') : ''}
                  </p>
                </div>
              </div>
              <button onClick={() => handleDelete(t.teamId, t.teamName)}
                className="text-xs text-red-400 hover:text-red-600 hover:bg-red-50 p-1.5 rounded-lg transition-colors">
                x
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════
//  UsersTab.jsx
// ═══════════════════════════════════════════════════════════
export function UsersTab() {
  const [users, setUsers]       = useState([]);
  const [teams, setTeams]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [selected, setSelected] = useState(null);
  const [roleForm, setRoleForm] = useState({ role: 'employee', teamId: '' });
  const [saving, setSaving]     = useState(false);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [usersRes, teamsRes] = await Promise.all([
        api.get('/api/auth/users'),
        api.get('/api/teams'),
      ]);
      console.log('USERS FROM API:', usersRes.data); // ← check field names
      setUsers(usersRes.data || []);
      setTeams(teamsRes.data || []);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const openAssign = (user) => {
    console.log('SELECTED USER:', user); // ← verify the selected user object
    setSelected(user);
    setRoleForm({
      role:   user.role   || 'employee',
      teamId: user.teamId || '',
    });
  };

  const handleAssign = async (e) => {
    e.preventDefault();
    if (roleForm.role === 'employee' && !roleForm.teamId) {
      return toast.error('Select a team for employee');
    }

    // Get the most reliable identifier available
    const cognitoUsername = selected.email
      || selected.Username
      || selected.userId
      || selected.sub;

    if (!cognitoUsername) {
      return toast.error('Cannot identify user — missing email or ID');
    }

    console.log('ASSIGNING TO:', cognitoUsername, '→ role:', roleForm.role);

    setSaving(true);
    try {
      const teamObj = teams.find((t) => t.teamId === roleForm.teamId);

      await api.post('/api/auth/assign-role', {
        username: cognitoUsername,        // ← single clear identifier
        userId:   selected.userId || selected.Username || selected.sub,
        email:    selected.email,
        role:     roleForm.role,
        teamId:   roleForm.role === 'manager' ? '' : roleForm.teamId,
        teamName: roleForm.role === 'manager' ? '' : (teamObj?.teamName || teamObj?.name || ''),
      });

      toast.success('Role assigned!');
      setSelected(null);

      // Re-fetch from server instead of manual state update
      // This avoids any local state mismatch
      await fetchData();

    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const ROLE_STYLE = {
    manager:  'bg-purple-100 text-purple-700',
    employee: 'bg-green-100 text-green-700',
  };

  if (loading) return <LoadingSpinner message="Loading users..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">Users ({users.length})</h2>
        <button onClick={fetchData}
          className="text-sm text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg transition-colors">
          ↻ Refresh
        </button>
      </div>

      {users.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">👤</div>
          <p className="font-medium">No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u, index) => {
            // Use a reliable unique key
            const uniqueKey = u.userId || u.name || u.sub || u.email || index;
            return (
              <div key={uniqueKey}
                className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center justify-between hover:shadow-sm transition-shadow">
                    <div className="flex items-center gap-3">
                      {/* Update the Avatar initial to use name, then username, then email */}
                          {/* Update the Avatar Initial */}
                          <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600">
                            {/* Fallback to email first, then ? */}
                            {(u.name || u.email || '?')[0].toUpperCase()}
                          </div>
                          <div>
                            {/* Update the Name display to fallback to Email instead of username */}
                            <p className="font-medium text-gray-900 text-sm">
                              {u.name || u.email || 'No name provided'}
                            </p>
                            <p className="text-xs text-gray-400">{u.email}</p>
                          </div>
                    </div>
                <div className="flex items-center gap-2">
                  {u.teamName && (
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {u.teamName}
                    </span>
                  )}
                  {u.role ? (
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${ROLE_STYLE[u.role] || 'bg-gray-100 text-gray-600'}`}>
                      {u.role}
                    </span>
                  ) : (
                    <span className="text-xs bg-orange-100 text-orange-600 px-2 py-0.5 rounded-full">
                      No role
                    </span>
                  )}
                  <button onClick={() => openAssign(u)}
                    className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors font-medium">
                    Assign role
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Assign Role Modal */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Assign Role</h3>
              <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>

            {/* Show exactly who we are assigning to */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 mb-4">
              <p className="text-xs text-blue-500 mb-0.5">Assigning role to:</p>
              <p className="text-sm font-semibold text-blue-900">{selected.name || selected.email}</p>
              <p className="text-xs text-blue-600">{selected.email}</p>
            </div>

            <form onSubmit={handleAssign} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select
                  value={roleForm.role}
                  onChange={(e) => setRoleForm((f) => ({ ...f, role: e.target.value, teamId: '' }))}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="employee">Employee</option>
                  <option value="manager">Manager</option>
                </select>
              </div>

              {roleForm.role === 'employee' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Team *</label>
                  <select
                    value={roleForm.teamId}
                    onChange={(e) => setRoleForm((f) => ({ ...f, teamId: e.target.value }))}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="">Select a team</option>
                    {teams.map((t) => (
                      <option key={t.teamId} value={t.teamId}>
                        {t.teamName || t.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setSelected(null)}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold">
                  {saving ? 'Saving...' : 'Assign'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}