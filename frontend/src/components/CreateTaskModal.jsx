import { useState, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';

const PRIORITIES = ['Low', 'Medium', 'High'];

export default function CreateTaskModal({ onClose, onCreate }) {
  const [form, setForm] = useState({
    title: '', description: '', priority: 'Medium',
    deadline: '', assigneeId: '', teamId: '', projectId: '',
  });
  const [teams, setTeams]         = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projects, setProjects]   = useState([]);
  const [imageFile, setImageFile] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [loadingData, setLoadingData] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/api/teams'),
      api.get('/api/auth/users'),
      api.get('/api/projects'),
    ]).then(([teamsRes, usersRes, projectsRes]) => {
      setTeams(teamsRes.data || []);
      setEmployees((usersRes.data || []).filter((u) => (u.role || 'employee').toLowerCase() === 'employee'));      
      setProjects(projectsRes.data || []);
    }).catch(() => toast.error('Failed to load form data'))
      .finally(() => setLoadingData(false));
  }, []);

  // When team changes, reset assignee
  const handleTeamChange = (teamId) => {
    setForm((f) => ({ ...f, teamId, assigneeId: '' }));
  };

  // Filter employees by selected team
  const filteredEmployees = form.teamId
    ? employees.filter((u) => u.teamId === form.teamId)
    : employees;

  const set = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title || !form.teamId || !form.assigneeId || !form.deadline || !form.priority) {
      return toast.error('Please fill in all required fields');
    }
    setLoading(true);
    try {
      // 1. FIND THE REAL NAMES BASED ON THE SELECTED IDs
      const selectedTeam = teams.find(t => t.teamId === form.teamId);
      const teamName = selectedTeam ? (selectedTeam.teamName || selectedTeam.name) : 'Unknown Team';

      const selectedAssignee = filteredEmployees.find(u => 
        (u.userId || u.username || u.sub || u.email) === form.assigneeId
      );
      
      // Use the real name, or fallback to their email if name is missing
      const assigneeName = selectedAssignee 
        ? (selectedAssignee.name || selectedAssignee.email || 'Unknown User') 
        : 'Unknown User';
        
      // 1. Create the task first
      const taskRes = await api.post('/api/tasks', {
        title:       form.title,
        description: form.description,
        priority:    form.priority,
        deadline:    form.deadline,
        assigneeId:  form.assigneeId,
        assigneeName: assigneeName,
        teamId:      form.teamId,
        teamName:     teamName,
        projectId:   form.projectId || undefined,
      });
      const newTask = taskRes.data;

      // 2. Upload image if provided
      if (imageFile) {
        const formData = new FormData();
        formData.append('image', imageFile);
        await api.post(`/api/upload/${newTask.taskId}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }

      toast.success('Task created!');
      onCreate(newTask);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };





  const inputCls = 'w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition bg-white';
  const labelCls = 'block text-sm font-medium text-gray-700 mb-1.5';

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Create Task</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">×</button>
          </div>
        </div>

        {loadingData ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent" />
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
            {/* Title */}
            <div>
              <label className={labelCls}>Title <span className="text-red-400">*</span></label>
              <input value={form.title} onChange={set('title')} placeholder="Task title" required className={inputCls} />
            </div>

            {/* Description */}
            <div>
              <label className={labelCls}>Description</label>
              <textarea value={form.description} onChange={set('description')} rows={3}
                placeholder="What needs to be done?" className={`${inputCls} resize-none`} />
            </div>

            {/* Priority + Deadline */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Priority <span className="text-red-400">*</span></label>
                <select value={form.priority} onChange={set('priority')} className={inputCls}>
                  {PRIORITIES.map((p) => <option key={p}>{p}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Deadline <span className="text-red-400">*</span></label>
                <input type="date" value={form.deadline} onChange={set('deadline')}
                  min={new Date().toISOString().split('T')[0]} className={inputCls} />
              </div>
            </div>

            {/* Team */}
            <div>
              <label className={labelCls}>Team <span className="text-red-400">*</span></label>
              <select value={form.teamId} onChange={(e) => handleTeamChange(e.target.value)} className={inputCls}>
                <option value="">Select a team</option>
                {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.teamName}</option>)}
              </select>
            </div>

              {/* Assignee (filtered by team) */}
              <div>
                <label className={labelCls}>Assignee <span className="text-red-400">*</span></label>
                <select 
                  value={form.assigneeId} 
                  onChange={set('assigneeId')} 
                  className={inputCls}
                  disabled={!form.teamId}
                >
                  <option value="">{form.teamId ? 'Select assignee' : 'Select a team first'}</option>
                  {filteredEmployees.map((u) => {
                    // Ensure we are grabbing the UUID. 
                    // Depending on your backend, it might be u.userId, u.username, or u.sub
                    const systemId = u.userId || u.username || u.sub;
                    const displayName = u.name || u.email;
                    
                    return (
                      <option key={systemId} value={systemId}>
                        {displayName}
                      </option>
                    );
                  })}
                </select>
              </div>

            {/* Project (optional) */}
            {projects.length > 0 && (
              <div>
                <label className={labelCls}>Project (optional)</label>
                <select value={form.projectId} onChange={set('projectId')} className={inputCls}>
                  <option value="">No project</option>
                  {projects.map((p) => <option key={p.projectId} value={p.projectId}>{p.name}</option>)}
                </select>
              </div>
            )}

            {/* Image upload */}
            <div>
              <label className={labelCls}>Image attachment (optional)</label>
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 transition-colors cursor-pointer"
                onClick={() => document.getElementById('task-img-input').click()}>
                {imageFile ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                    <span>📎</span>
                    <span>{imageFile.name}</span>
                    <button type="button" onClick={(e) => { e.stopPropagation(); setImageFile(null); }}
                      className="text-red-400 hover:text-red-600 ml-1">✕</button>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Click to attach an image</p>
                )}
              </div>
              <input id="task-img-input" type="file" accept="image/*"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="hidden" />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                {loading ? 'Creating...' : 'Create task'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}