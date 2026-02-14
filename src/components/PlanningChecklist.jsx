import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001'

const CATEGORIES = ['Venue', 'Vendors', 'Attire & Beauty', 'Decor', 'Timeline', 'Guests', 'Other']

export default function PlanningChecklist({ weddingId, userId, compact = false, isAdmin = false }) {
  const [tasks, setTasks] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newTask, setNewTask] = useState({ text: '', category: 'Other', dueDate: '' })
  const [saving, setSaving] = useState(false)
  const [filterCategory, setFilterCategory] = useState('all')
  const [showCompleted, setShowCompleted] = useState(false)

  useEffect(() => {
    if (weddingId) {
      loadChecklist()
    }
  }, [weddingId])

  const loadChecklist = async () => {
    try {
      const response = await fetch(`${API_URL}/api/checklist/${weddingId}`)
      const data = await response.json()

      if (data.tasks && data.tasks.length === 0) {
        // Initialize default checklist if empty
        const initResponse = await fetch(`${API_URL}/api/checklist/initialize/${weddingId}`, {
          method: 'POST'
        })
        const initData = await initResponse.json()
        setTasks(initData.tasks || [])
      } else {
        setTasks(data.tasks || [])
      }
    } catch (error) {
      console.error('Error loading checklist:', error)
    }
    setLoading(false)
  }

  const handleToggle = async (taskId, currentCompleted) => {
    try {
      const response = await fetch(`${API_URL}/api/checklist/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          isCompleted: !currentCompleted,
          completedBy: userId,
          completedVia: 'manual'
        })
      })
      const data = await response.json()
      if (data.task) {
        setTasks(tasks.map(t => t.id === taskId ? data.task : t))
      }
    } catch (error) {
      console.error('Error toggling task:', error)
    }
  }

  const handleAddTask = async (e) => {
    e.preventDefault()
    if (!newTask.text.trim()) return

    setSaving(true)
    try {
      const response = await fetch(`${API_URL}/api/checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weddingId,
          taskText: newTask.text.trim(),
          category: newTask.category,
          dueDate: newTask.dueDate || null
        })
      })
      const data = await response.json()
      if (data.task) {
        setTasks([...tasks, data.task])
        setNewTask({ text: '', category: 'Other', dueDate: '' })
        setShowAddForm(false)
      }
    } catch (error) {
      console.error('Error adding task:', error)
    }
    setSaving(false)
  }

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return

    try {
      const response = await fetch(`${API_URL}/api/checklist/${taskId}`, {
        method: 'DELETE'
      })
      const data = await response.json()
      if (data.success) {
        setTasks(tasks.filter(t => t.id !== taskId))
      } else if (data.error) {
        alert(data.error)
      }
    } catch (error) {
      console.error('Error deleting task:', error)
    }
  }

  const completedCount = tasks.filter(t => t.is_completed).length
  const totalCount = tasks.length
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0

  // Filter tasks
  const filteredTasks = tasks.filter(t => {
    if (!showCompleted && t.is_completed) return false
    if (filterCategory !== 'all' && t.category !== filterCategory) return false
    return true
  })

  // Group by category for non-compact view
  const tasksByCategory = {}
  filteredTasks.forEach(task => {
    const cat = task.category || 'Other'
    if (!tasksByCategory[cat]) tasksByCategory[cat] = []
    tasksByCategory[cat].push(task)
  })

  if (loading) {
    return <div className="text-sage-400 text-center py-4">Loading checklist...</div>
  }

  // Compact view (for sidebar preview)
  if (compact) {
    const incompleteTasks = tasks.filter(t => !t.is_completed).slice(0, 5)

    return (
      <div className="space-y-3">
        {/* Progress Bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-1">
            <span className="text-sage-600">{completedCount} of {totalCount} complete</span>
            <span className="text-sage-500">{progressPercent}%</span>
          </div>
          <div className="h-2 bg-cream-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-sage-500 transition-all duration-500"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Quick Task List */}
        <div className="space-y-1">
          {incompleteTasks.length === 0 ? (
            <p className="text-sage-400 text-sm text-center py-2">All tasks complete!</p>
          ) : (
            incompleteTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-2 py-1"
              >
                <button
                  onClick={() => handleToggle(task.id, task.is_completed)}
                  className="w-4 h-4 rounded border border-cream-300 hover:border-sage-400 flex-shrink-0"
                />
                <span className="text-sage-700 text-sm truncate">{task.task_text}</span>
              </div>
            ))
          )}
        </div>
      </div>
    )
  }

  // Full view
  return (
    <div className="space-y-4">
      {/* Header with Progress */}
      <div className="bg-sage-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-medium text-sage-700">Progress</h3>
          <span className="text-2xl font-bold text-sage-600">{progressPercent}%</span>
        </div>
        <div className="h-3 bg-cream-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-sage-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-sage-500 text-sm mt-2">
          {completedCount} of {totalCount} tasks completed
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="px-3 py-1 border border-cream-300 rounded-lg text-sm"
        >
          <option value="all">All Categories</option>
          {CATEGORIES.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-sage-600">
          <input
            type="checkbox"
            checked={showCompleted}
            onChange={(e) => setShowCompleted(e.target.checked)}
            className="rounded border-cream-300"
          />
          Show completed
        </label>
        {!showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            className="ml-auto text-sm px-3 py-1 bg-sage-100 text-sage-700 rounded-lg hover:bg-sage-200"
          >
            + Add Task
          </button>
        )}
      </div>

      {/* Add Task Form */}
      {showAddForm && (
        <form onSubmit={handleAddTask} className="bg-cream-50 rounded-lg p-4 space-y-3 border border-cream-200">
          <div>
            <input
              type="text"
              value={newTask.text}
              onChange={(e) => setNewTask({ ...newTask, text: e.target.value })}
              placeholder="What needs to be done?"
              className="w-full px-3 py-2 border border-cream-300 rounded-lg text-sm"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <select
              value={newTask.category}
              onChange={(e) => setNewTask({ ...newTask, category: e.target.value })}
              className="px-3 py-2 border border-cream-300 rounded-lg text-sm"
            >
              {CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <input
              type="date"
              value={newTask.dueDate}
              onChange={(e) => setNewTask({ ...newTask, dueDate: e.target.value })}
              className="px-3 py-2 border border-cream-300 rounded-lg text-sm"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !newTask.text.trim()}
              className="px-4 py-2 bg-sage-600 text-white rounded-lg text-sm hover:bg-sage-700 disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add Task'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setNewTask({ text: '', category: 'Other', dueDate: '' })
              }}
              className="px-4 py-2 text-sage-600 text-sm"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Task List by Category */}
      <div className="space-y-4">
        {Object.keys(tasksByCategory).length === 0 ? (
          <p className="text-sage-400 text-sm text-center py-8">
            {showCompleted ? 'No tasks in this category' : 'All tasks in this category are complete!'}
          </p>
        ) : (
          Object.entries(tasksByCategory).map(([category, categoryTasks]) => (
            <div key={category}>
              <h4 className="text-xs font-semibold text-sage-500 uppercase tracking-wide mb-2">
                {category}
              </h4>
              <div className="space-y-1">
                {categoryTasks.map(task => (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3 p-2 rounded-lg hover:bg-cream-50 group ${
                      task.is_completed ? 'opacity-60' : ''
                    }`}
                  >
                    <button
                      onClick={() => handleToggle(task.id, task.is_completed)}
                      className={`w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition ${
                        task.is_completed
                          ? 'bg-sage-500 border-sage-500 text-white'
                          : 'border-cream-300 hover:border-sage-400'
                      }`}
                    >
                      {task.is_completed && (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                    <span className={`flex-1 text-sm ${task.is_completed ? 'line-through text-sage-400' : 'text-sage-700'}`}>
                      {task.task_text}
                    </span>
                    {task.due_date && (
                      <span className="text-xs text-sage-400">
                        {new Date(task.due_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </span>
                    )}
                    {task.completed_via === 'sage' && (
                      <span className="text-xs bg-sage-100 text-sage-600 px-2 py-0.5 rounded">via Sage</span>
                    )}
                    {task.is_custom && (
                      <button
                        onClick={() => handleDeleteTask(task.id)}
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
