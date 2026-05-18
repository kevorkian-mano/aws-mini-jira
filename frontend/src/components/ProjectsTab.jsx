import { useState, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';
import LoadingSpinner from './LoadingSpinner';

export default function ProjectsTab() {
  const [projects, setProjects]   = useState([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [editing, setEditing]     = useState(null); // project being edited
  const [form, setForm]           = useState({ name: '', description: '' });
  const [saving, setSaving]       = useState(false);

  useEffect(() => { fetchProjects(); }, []);

  const fetchProjects = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/projects');
      setProjects(res.data || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const openCreate = () => { setEditing(null); setForm({ name: '', description: '' }); setShowForm(true); };
  const openEdit   = (p)  => { setEditing(p); setForm({ name: p.name, description: p.description || '' }); setShowForm(true); };
  const closeForm  = ()   => { setShowForm(false); setEditing(null); };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Project name is required');
    setSaving(true);
    try {
      if (editing) {
        const res = await api.put(`/api/projects/${editing.projectId}`, form);
        setProjects((prev) => prev.map((p) => p.projectId === editing.projectId ? res.data : p));
        toast.success('Project updated');
      } else {
        const res = await api.post('/api/projects', form);
        setProjects((prev) => [res.data, ...prev]);
        toast.success('Project created');
      }
      closeForm();
    } catch (err) { toast.error(err.message); } finally { setSaving(false); }
  };

  const handleDelete = async (projectId) => {
    if (!window.confirm('Delete this project?')) return;
    try {
      await api.delete(`/api/projects/${projectId}`);
      setProjects((prev) => prev.filter((p) => p.projectId !== projectId));
      toast.success('Project deleted');
    } catch (err) { toast.error(err.message); }
  };

  if (loading) return <LoadingSpinner message="Loading projects..." />;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-lg font-bold text-gray-900">Projects ({projects.length})</h2>
        <button onClick={openCreate}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
          + New Project
        </button>
      </div>

      {/* Empty state */}
      {projects.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-3">📁</div>
          <p className="font-medium">No projects yet</p>
          <p className="text-sm mt-1">Create your first project to get started</p>
        </div>
      )}

      {/* Project list */}
      <div className="grid gap-3">
        {projects.map((p) => (
          <div key={p.projectId}
            className="bg-white border border-gray-200 rounded-xl p-4 flex items-center justify-between hover:shadow-sm transition-shadow">
            <div>
              <h3 className="font-semibold text-gray-900">{p.name}</h3>
              {p.description && <p className="text-sm text-gray-500 mt-0.5">{p.description}</p>}
              <p className="text-xs text-gray-400 mt-1">
                Created {p.createdAt ? new Date(p.createdAt).toLocaleDateString('en-GB') : '—'}
              </p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => openEdit(p)}
                className="text-xs text-blue-600 hover:text-blue-800 border border-blue-200 hover:border-blue-400 px-3 py-1.5 rounded-lg transition-colors font-medium">
                Edit
              </button>
              <button onClick={() => handleDelete(p.projectId)}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors font-medium">
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={(e) => e.target === e.currentTarget && closeForm()}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Project' : 'New Project'}</h3>
              <button onClick={closeForm} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
            </div>
            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
                <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Project name" required
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
                <textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  rows={3} placeholder="What is this project about?"
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={closeForm}
                  className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold">
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}