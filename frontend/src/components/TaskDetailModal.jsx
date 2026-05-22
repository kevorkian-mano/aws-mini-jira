import { useState, useEffect, useCallback, useRef } from 'react';
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

const STATUSES = ['To Do', 'In Progress', 'In Review', 'Done'];
const PRIORITY_STYLE = {
  High:   'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
  Low:    'bg-green-100 text-green-700',
};

export default function TaskDetailModal({ task, onClose, onUpdate, onDelete }) {
  const { role } = useAuth();
  const [comments, setComments]       = useState([]);
  const auditLog = task.auditLog || [];
  const [newComment, setNewComment]   = useState('');
  const [imageUrl, setImageUrl]       = useState(null);
  const [loadingComments, setLoadingComments] = useState(true);
  const [posting, setPosting]         = useState(false);
  const [imageLoading, setImageLoading] = useState(false);
  const [tab, setTab]                 = useState('comments'); // 'comments' | 'audit'
  const [deleting, setDeleting]       = useState(false);
  const fileRef                       = useRef();

  const formatName = (identifier) => {
    if (!identifier) return 'System';
    if (identifier.includes('-') && identifier.length > 30) return 'Unknown User';
    if (identifier.includes('@')) {
      const namePart = identifier.split('@')[0];
      return namePart.split(/[._-]/)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
    }
    return identifier;
  };

  const fetchComments = useCallback(async () => {
    setLoadingComments(true);
    try {
      const res = await api.get(`/api/comments/${task.taskId}`);
      setComments(res.data || []);
    } catch { setComments([]); } finally { setLoadingComments(false); }
  }, [task.taskId]);

  const fetchImageUrl = useCallback(async () => {
    try {
      const res = await api.get(`/api/upload/${task.taskId}/url`);
      setImageUrl(res.data?.url || null);
    } catch { setImageUrl(null); }
  }, [task.taskId]);

  useEffect(() => {
    fetchComments();
    fetchImageUrl();
  }, [fetchComments, fetchImageUrl]);

  const handleStatusChange = async (newStatus) => {
    try {
      const res = await api.put(`/api/tasks/${task.taskId}`, { status: newStatus });
      onUpdate({ ...task, ...res.data });
      toast.success(`Status → ${newStatus}`);
    } catch (err) { toast.error(err.message); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    setPosting(true);
    try {
      const res = await api.post('/api/comments', {
        taskId: task.taskId,
        content: newComment.trim(),
      });
      setComments((prev) => [...prev, res.data]);
      setNewComment('');
    } catch (err) { toast.error(err.message); } finally { setPosting(false); }
  };

  const handleImageUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageLoading(true);
    try {
      const formData = new FormData();
      formData.append('image', file);
      await api.post(`/api/upload/${task.taskId}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      await fetchImageUrl();
      toast.success('Image uploaded');
    } catch (err) { toast.error(err.message); } finally { setImageLoading(false); }
  };

  const handleImageDelete = async () => {
    try {
      await api.delete(`/api/upload/${task.taskId}`);
      setImageUrl(null);
      toast.success('Image removed');
    } catch (err) { toast.error(err.message); }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm('Delete this task? This cannot be undone.')) return;
    setDeleting(true);
    try {
      await api.delete(`/api/tasks/${task.taskId}`);
      onDelete(task.taskId);
      toast.success('Task deleted');
    } catch (err) { toast.error(err.message); } finally { setDeleting(false); }
  };

  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'Done';

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">

        {/* Header */}
        <div className="sticky top-0 bg-white px-6 pt-6 pb-4 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-start justify-between gap-4">
            <h2 className="text-xl font-bold text-gray-900 leading-tight flex-1">{task.title}</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none mt-0.5">×</button>
          </div>
          {/* Status pills */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {STATUSES.map((s) => (
              <button key={s} onClick={() => handleStatusChange(s)}
                className={`text-xs px-3 py-1 rounded-full font-medium transition-all
                  ${task.status === s ? 'bg-blue-600 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Image */}
          {imageLoading ? (
            <div className="w-full h-36 bg-gray-100 animate-pulse rounded-xl" />
          ) : imageUrl ? (
            <div className="relative">
              <img src={imageUrl} alt="attachment" className="w-full max-h-56 object-cover rounded-xl" />
              <div className="absolute top-2 right-2 flex gap-2">
                <button onClick={() => fileRef.current?.click()}
                  className="bg-white/90 hover:bg-white text-gray-700 text-xs px-2.5 py-1 rounded-lg shadow font-medium">
                  Replace
                </button>
                <button onClick={handleImageDelete}
                  className="bg-red-500/90 hover:bg-red-600 text-white text-xs px-2.5 py-1 rounded-lg shadow font-medium">
                  Remove
                </button>
              </div>
            </div>
          ) : null}

          {/* Upload button when no image */}
          {!imageUrl && !imageLoading && (
            <button onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
              📎 Attach an image
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

          {/* Description */}
          {task.description && (
            <p className="text-gray-600 text-sm leading-relaxed">{task.description}</p>
          )}

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Priority', value: <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_STYLE[task.priority]}`}>{task.priority}</span> },
              { label: 'Status',   value: <span className="text-sm text-gray-800 font-medium">{task.status}</span> },
              { label: 'Team',     value: <span className="text-sm text-gray-800">{task.teamName || task.teamId}</span> },
              { label: 'Assignee', value: <span className="text-sm text-gray-800">{task.assigneeName || task.assigneeId}</span> },
              { label: 'Deadline', value: <span className={`text-sm font-medium ${isOverdue ? 'text-red-500' : 'text-gray-800'}`}>{task.deadline ? new Date(task.deadline).toLocaleDateString('en-GB') : '—'}{isOverdue ? ' ⚠' : ''}</span> },
              { label: 'Created',  value: <span className="text-sm text-gray-800">{task.createdAt ? new Date(task.createdAt).toLocaleDateString('en-GB') : '—'}</span> },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-1">{label}</p>
                {value}
              </div>
            ))}
          </div>

          {/* Tab switcher */}
          <div className="flex border-b border-gray-100">
            {['comments', 'audit'].map((t) => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-4 py-2 text-sm font-medium capitalize transition-colors border-b-2 -mb-px
                  ${tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
                {t === 'comments' ? `Comments (${comments.length})` : 'Audit log'}
              </button>
            ))}
          </div>

          {/* Comments tab */}
          {tab === 'comments' && (
            <div className="space-y-3">
              {loadingComments ? (
                <div className="space-y-2">
                  {[1, 2].map((i) => <div key={i} className="h-14 bg-gray-100 animate-pulse rounded-xl" />)}
                </div>
              ) : comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No comments yet. Be the first!</p>
              ) : (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {comments.map((c) => (
                    <div key={c.commentId || c.createdAt} className="bg-gray-50 rounded-xl p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <div className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                          {c.authorEmail?.[0]?.toUpperCase()}
                        </div>
                        <span className="text-xs text-gray-500 font-medium">{c.authorEmail}</span>
                        <span className="text-xs text-gray-300 ml-auto">
                          {c.createdAt ? new Date(c.createdAt).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' }) : ''}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 pl-8">{c.content}</p>
                    </div>
                  ))}
                </div>
              )}
              {/* Add comment */}
              <div className="flex gap-2 pt-1">
                <input
                  value={newComment} onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleAddComment()}
                  placeholder="Write a comment... (Enter to send)"
                  className="flex-1 text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                />
                <button onClick={handleAddComment} disabled={posting || !newComment.trim()}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-colors">
                  {posting ? '...' : 'Post'}
                </button>
              </div>
            </div>
          )}

          {/* Audit log tab */}
          {tab === 'audit' && (
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {auditLog.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No status changes recorded yet.</p>
              ) : auditLog.map((log, i) => (
                <div key={i} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 text-sm">
                  
                  {/* WHEN: The timestamp */}
                  <div className="text-gray-400 text-xs whitespace-nowrap">
                    {log.at ? new Date(log.at).toLocaleString('en-GB', { 
                      day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' 
                    }) : 'Unknown time'}
                  </div>
                  
                  {/* WHAT: The action taken */}
                  <div className="flex items-center gap-1.5 flex-1">
                    <span className="text-gray-700 text-sm font-medium capitalize">
                      {log.action}
                    </span>
                  </div>
                  
                  {/* WHO: The person who did it */}
                  <div className="flex items-center gap-1.5 bg-white border border-gray-200 px-2 py-1 rounded-md">
                     <span className="text-gray-400 text-xs">By:</span>
                     <span className="text-gray-600 text-xs font-semibold">{formatName(log.by)}</span>
                  </div>
                  
                </div>
              ))}
            </div>
          )}

          {/* Delete (manager only) */}
          {role === 'manager' && (
            <div className="border-t border-gray-100 pt-4">
              <button onClick={handleDeleteTask} disabled={deleting}
                className="text-sm text-red-400 hover:text-red-600 transition-colors disabled:opacity-50">
                {deleting ? 'Deleting...' : '🗑 Delete this task'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}