import { useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, useDroppable, useDraggable,
} from '@dnd-kit/core';
import TaskCard from './TaskCard';

const COLUMNS = [
  { id: 'To Do',      label: 'To Do',       color: 'border-gray-300',  header: 'bg-gray-100 text-gray-600' },
  { id: 'In Progress',label: 'In Progress',  color: 'border-blue-300',  header: 'bg-blue-100 text-blue-700' },
  { id: 'In Review',  label: 'In Review',   color: 'border-amber-300', header: 'bg-amber-100 text-amber-700' },
  { id: 'Done',       label: 'Done',        color: 'border-green-300', header: 'bg-green-100 text-green-700' },
];

function DroppableColumn({ col, tasks, onCardClick, activeId }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });
  return (
    <div className="flex flex-col w-64 flex-shrink-0">
      {/* Column header */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-t-xl ${col.header}`}>
        <span className="text-sm font-semibold">{col.label}</span>
        <span className="text-xs bg-white bg-opacity-60 px-2 py-0.5 rounded-full font-medium">
          {tasks.length}
        </span>
      </div>
      {/* Droppable area */}
      <div
        ref={setNodeRef}
        className={`flex-1 min-h-48 p-2 rounded-b-xl border-2 transition-colors space-y-2
          ${col.color} ${isOver ? 'bg-blue-50 border-blue-400' : 'bg-gray-50'}`}
      >
        {tasks.length === 0 && !isOver && (
          <p className="text-xs text-gray-400 text-center pt-6">No tasks</p>
        )}
        {tasks.map((task) => (
          <DraggableCard
            key={task.taskId}
            task={task}
            onCardClick={onCardClick}
            isActive={activeId === task.taskId}
          />
        ))}
      </div>
    </div>
  );
}

function DraggableCard({ task, onCardClick, isActive }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.taskId });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 999 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        // Only fire click if not dragging
        if (!isDragging) onCardClick(task);
      }}
      className={isDragging ? 'opacity-40' : ''}
    >
      <TaskCard task={task} />
    </div>
  );
}

export default function KanbanBoard({ tasks = [], onStatusChange, onCardClick }) {
  const [activeId, setActiveId] = useState(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const handleDragStart = ({ active }) => setActiveId(active.id);

  const handleDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) {
      const task = tasks.find((t) => t.taskId === active.id);
      const newStatus = over.id; // column droppable id = status name
      if (task && COLUMNS.find((c) => c.id === newStatus) && task.status !== newStatus) {
        onStatusChange(active.id, newStatus);
      }
    }
    setActiveId(null);
  };

  const handleDragCancel = () => setActiveId(null);

  const activeTask = tasks.find((t) => t.taskId === activeId);

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => (
          <DroppableColumn
            key={col.id}
            col={col}
            tasks={tasks.filter((t) => t.status === col.id)}
            onCardClick={onCardClick}
            activeId={activeId}
          />
        ))}
      </div>

      {/* Floating card while dragging */}
      <DragOverlay dropAnimation={null}>
        {activeTask ? <TaskCard task={activeTask} isDragging /> : null}
      </DragOverlay>
    </DndContext>
  );
}