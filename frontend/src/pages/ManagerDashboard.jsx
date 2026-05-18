import { useState, useEffect } from 'react';
import api from '../config/api';
import toast from 'react-hot-toast';
import Navbar from '../components/Navbar';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailModal from '../components/TaskDetailModal';
import CreateTaskModal from '../components/CreateTaskModal';
import ProjectsTab from '../components/ProjectsTab';
import { TeamsTab, UsersTab } from '../components/TeamAndUserTabs';
import LoadingSpinner from '../components/LoadingSpinner';

const TABS = [
  { id: 'tasks',    label: 'All Tasks' },
  { id: 'projects', label: 'Projects' },
  { id: 'teams',    label: 'Teams' },
  { id: 'users',    label: 'Users' },
];

export default function ManagerDashboard() {
  const [activeTab, setActiveTab]       = useState('tasks');
  const [tasks, setTasks]               = useState([]);
  const [teams, setTeams]               = useState([]);
  const [loading, setLoading]           = useState(true);
  const [selectedTask, setSelectedTask] = useState(null);
  const [showCreate, setShowCreate]     = useState(false);
  // Filters
  const [teamFilter, setTeamFilter]       = useState('');
  const [statusFilter, setStatusFilter]   = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  useEffect(() => { fetchTasks(); fetchTeams(); }, []);

  const fetchTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/tasks');
      setTasks(res.data || []);
    } catch (err) { toast.error(err.message); }
    finally { setLoading(false); }
  };

  const fetchTeams = async () => {
    try {
      const res = await api.get('/api/teams');
      setTeams(res.data || []);
    } catch {}
  };

  // Apply filters locally
  const filteredTasks = tasks.filter((t) => {
    if (teamFilter     && t.teamId   !== teamFilter)     return false;
    if (statusFilter   && t.status   !== statusFilter)   return false;
    if (priorityFilter && t.priority !== priorityFilter) return false;
    return true;
  });

  const handleStatusChange = async (taskId, newStatus) => {
    // Optimistic update
    setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus });
      toast.success(`Moved to "${newStatus}"`);
    } catch (err) {
      setTasks((prev) => prev.map((t) => t.taskId === taskId ? { ...t, status: tasks.find(x => x.taskId === taskId)?.status || t.status } : t));
      toast.error(err.message);
    }
  };

  const handleTaskUpdate = (updated) => {
    setTasks((prev) => prev.map((t) => t.taskId === updated.taskId ? updated : t));
    setSelectedTask(updated);
  };

  const handleTaskDelete = (taskId) => {
    setTasks((prev) => prev.filter((t) => t.taskId !== taskId));
    setSelectedTask(null);
  };

  const handleTaskCreated = (newTask) => {
    setTasks((prev) => [newTask, ...prev]);
    setShowCreate(false);
  };

  // Per-team stats when a team is selected
  const teamStats = teamFilter ? {
    total:      filteredTasks.length,
    done:       filteredTasks.filter((t) => t.status === 'Done').length,
    inProgress: filteredTasks.filter((t) => t.status === 'In Progress').length,
    overdue:    filteredTasks.filter((t) => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Done').length,
  } : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-52 flex-shrink-0 bg-white border-r border-gray-200 py-4">
          <nav className="space-y-1 px-3">
            {TABS.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
                  ${activeTab === tab.id
                    ? 'bg-blue-50 text-blue-700 font-semibold'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}>
                {tab.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="flex-1 overflow-y-auto p-6">
          {/* ── TASKS TAB ── */}
          {activeTab === 'tasks' && (
            <div>
              {/* Top bar */}
              <div className="flex flex-wrap items-center gap-3 mb-5">
                <h1 className="text-xl font-bold text-gray-900 mr-2">All Tasks</h1>

                {/* Filters */}
                <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Teams</option>
                  {teams.map((t) => <option key={t.teamId} value={t.teamId}>{t.teamName}</option>)}
                </select>

                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Statuses</option>
                  {['To Do', 'In Progress', 'In Review', 'Done'].map((s) => <option key={s}>{s}</option>)}
                </select>

                <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-200 rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">All Priorities</option>
                  {['Low', 'Medium', 'High'].map((p) => <option key={p}>{p}</option>)}
                </select>

                {(teamFilter || statusFilter || priorityFilter) && (
                  <button onClick={() => { setTeamFilter(''); setStatusFilter(''); setPriorityFilter(''); }}
                    className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 px-3 py-2 rounded-xl transition-colors">
                    Clear filters
                  </button>
                )}

                <div className="ml-auto">
                  <button onClick={() => setShowCreate(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex items-center gap-1.5">
                    <span>+</span> Create Task
                  </button>
                </div>
              </div>

              {/* Per-team stats when filtered */}
              {teamStats && (
                <div className="grid grid-cols-4 gap-3 mb-5">
                  {[
                    { label: 'Total',       value: teamStats.total,      color: 'bg-blue-50 text-blue-700' },
                    { label: 'Done',        value: teamStats.done,       color: 'bg-green-50 text-green-700' },
                    { label: 'In Progress', value: teamStats.inProgress, color: 'bg-amber-50 text-amber-700' },
                    { label: 'Overdue',     value: teamStats.overdue,    color: 'bg-red-50 text-red-700' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`rounded-xl p-3 ${color}`}>
                      <p className="text-2xl font-bold">{value}</p>
                      <p className="text-xs font-medium mt-0.5">{label}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Kanban board */}
              {loading ? (
                <LoadingSpinner message="Loading tasks..." />
              ) : filteredTasks.length === 0 && (teamFilter || statusFilter || priorityFilter) ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="text-5xl mb-3"></div>
                  <p className="font-medium">No tasks match your filters</p>
                  <button onClick={() => { setTeamFilter(''); setStatusFilter(''); setPriorityFilter(''); }}
                    className="mt-2 text-sm text-blue-500 hover:underline">Clear filters</button>
                </div>
              ) : loading === false && tasks.length === 0 ? (
                <div className="text-center py-20 text-gray-400">
                  <div className="text-5xl mb-3"></div>
                  <p className="font-medium">No tasks yet</p>
                  <p className="text-sm mt-1">Create your first task to get started</p>
                </div>
              ) : (
                <KanbanBoard
                  tasks={filteredTasks}
                  onStatusChange={handleStatusChange}
                  onCardClick={(task) => setSelectedTask(task)}
                />
              )}
            </div>
          )}

          {/* ── PROJECTS TAB ── */}
          {activeTab === 'projects' && <ProjectsTab />}

          {/* ── TEAMS TAB ── */}
          {activeTab === 'teams' && <TeamsTab />}

          {/* ── USERS TAB ── */}
          {activeTab === 'users' && <UsersTab />}
        </main>
      </div>

      {/* Task detail modal */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          onDelete={handleTaskDelete}
        />
      )}

      {/* Create task modal */}
      {showCreate && (
        <CreateTaskModal
          onClose={() => setShowCreate(false)}
          onCreate={handleTaskCreated}
        />
      )}
    </div>
  );
}