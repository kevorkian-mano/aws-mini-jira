const PRIORITY = {
  High:   { cls: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  Medium: { cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  Low:    { cls: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

export default function TaskCard({ task, isDragging = false }) {
  if (!task) return null;
  const p = PRIORITY[task.priority] || PRIORITY.Medium;
  const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'Done';

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-3.5 select-none
      transition-shadow cursor-pointer
      ${isDragging ? 'shadow-2xl rotate-1 scale-105' : 'hover:shadow-md'}`}>

      {/* Thumbnail */}
      {task.imageUrl && (
        <img src={task.imageUrl} alt="attachment"
          className="w-full h-24 object-cover rounded-lg mb-2.5 bg-gray-100" />
      )}

      {/* Title */}
      <p className="text-sm font-semibold text-gray-900 line-clamp-2 mb-2">{task.title}</p>

      {/* Priority + Team */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${p.cls}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${p.dot}`} />
          {task.priority}
        </span>
        {task.teamName && (
          <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full font-medium">
            {task.teamName}
          </span>
        )}
      </div>

      {/* Assignee + Deadline */}
      <div className="flex items-center justify-between mt-1">
        {task.assigneeName ? (
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
              {task.assigneeName?.[0]?.toUpperCase()}
            </div>
            <span className="text-xs text-gray-500">{task.assigneeName}</span>
          </div>
        ) : <span />}

        {task.deadline && (
          <span className={`text-xs font-medium ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
            {isOverdue ? '⚠ ' : ''}{new Date(task.deadline).toLocaleDateString('en-GB', { day:'2-digit', month:'short' })}
          </span>
        )}
      </div>
    </div>
  );
}