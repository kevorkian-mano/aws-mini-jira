import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import KanbanBoard from '../components/KanbanBoard';
import TaskDetailModal from '../components/TaskDetailModal'; // 1. IMPORT YOUR MODAL
import api from '../config/api';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // 2. ADD STATE FOR THE MODAL
  const [selectedTask, setSelectedTask] = useState(null); 

  useEffect(() => {
    if (user) fetchMyTasks();
  }, [user]);

  const fetchMyTasks = async () => {
    setLoading(true);
    try {
      const res = await api.get('/api/tasks');
      const currentUserId = user.userId || user.username || user.sub;
      const myTasks = (res.data || []).filter(task => task.assigneeId === currentUserId);
      setTasks(myTasks);
    } catch (error) {
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (taskId, newStatus) => {
    setTasks((prev) => prev.map(t => t.taskId === taskId ? { ...t, status: newStatus } : t));
    try {
      await api.put(`/api/tasks/${taskId}`, { status: newStatus });
    } catch (error) {
      toast.error('Failed to update task status');
      fetchMyTasks(); 
    }
  };

  // 3. OPEN THE MODAL WHEN A CARD IS CLICKED
  const handleCardClick = (task) => {
    setSelectedTask(task);
  };

  // 4. HANDLE UPDATES FROM THE MODAL (e.g., status changed inside the modal)
  const handleTaskUpdate = (updatedTask) => {
    setTasks((prev) => prev.map(t => t.taskId === updatedTask.taskId ? updatedTask : t));
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Navbar />
      <div className="flex-1 p-6">
        <h1 className="text-2xl font-bold mb-6">My Tasks</h1>
        
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-4 border-blue-600 border-t-transparent"></div>
          </div>
        ) : (
          <KanbanBoard 
            tasks={tasks} 
            onStatusChange={handleStatusChange} 
            onCardClick={handleCardClick} 
          />
        )}
      </div>

      {/* 5. RENDER THE MODAL IF A TASK IS SELECTED */}
      {selectedTask && (
        <TaskDetailModal
          task={selectedTask}
          onClose={() => setSelectedTask(null)}
          onUpdate={handleTaskUpdate}
          // Optional: Employees usually shouldn't delete tasks, so you can leave onDelete out here, 
          // but include it in the ManagerDashboard version!
        />
      )}
    </div>
  );
}