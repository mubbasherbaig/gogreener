import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const ScheduleModal = ({ device, onClose, onSave }) => {
  const [schedules, setSchedules] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    time: '',
    action: 'turn_on',
    days: [],
    enabled: true,
    repeat_type: 'weekly'
  });

  const daysOfWeek = [
    { key: 'monday', label: 'Mon' },
    { key: 'tuesday', label: 'Tue' },
    { key: 'wednesday', label: 'Wed' },
    { key: 'thursday', label: 'Thu' },
    { key: 'friday', label: 'Fri' },
    { key: 'saturday', label: 'Sat' },
    { key: 'sunday', label: 'Sun' }
  ];

  useEffect(() => {
    fetchSchedules();
  }, [device.id]);

  const fetchSchedules = async () => {
    setLoading(true);
    setError('');
    setSchedules([]); // Clear schedules to prevent duplicates
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/schedules`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        const formattedSchedules = data.map(schedule => ({
          ...schedule,
          time: `${schedule.hour.toString().padStart(2, '0')}:${schedule.minute.toString().padStart(2, '0')}`,
          days: Array.isArray(schedule.days) ? schedule.days : JSON.parse(schedule.days || '[]')
        }));
        setSchedules(formattedSchedules);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to fetch schedules');
        console.error('Error fetching schedules:', errorData);
      }
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setError('Network error. Please try again.');
    }
    setLoading(false);
  };

  const handleInputChange = (field, value) => {
    setNewSchedule(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleDayToggle = (dayKey) => {
    setNewSchedule(prev => ({
      ...prev,
      days: prev.days.includes(dayKey)
        ? prev.days.filter(d => d !== dayKey)
        : [...prev.days, dayKey]
    }));
  };

  const handleSaveSchedule = async () => {
    if (!newSchedule.name.trim() || !newSchedule.time || newSchedule.days.length === 0) {
      alert('Please fill in all required fields and select at least one day.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const scheduleData = {
        name: newSchedule.name,
        time: newSchedule.time,
        action: newSchedule.action,
        days: newSchedule.days,
        enabled: newSchedule.enabled,
        repeat_type: newSchedule.repeat_type
      };

      if (editingSchedule) {
        const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/schedules/${editingSchedule.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(scheduleData)
        });

        if (response.ok) {
          const updatedSchedule = await response.json();
          setSchedules(prev => prev.map(s => 
            s.id === editingSchedule.id 
              ? { ...updatedSchedule, time: newSchedule.time, days: newSchedule.days }
              : s
          ));
          console.log('Schedule updated successfully');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update schedule');
        }
      } else {
        const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/schedules`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(scheduleData)
        });

        if (response.ok) {
          const newScheduleData = await response.json();
          setSchedules(prev => [...prev, { 
            ...newScheduleData, 
            time: newSchedule.time, 
            days: newSchedule.days 
          }]);
          console.log('Schedule created successfully');
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to create schedule');
        }
      }

      // Reset form
      setNewSchedule({
        name: '',
        time: '',
        action: 'turn_on',
        days: [],
        enabled: true,
        repeat_type: 'weekly'
      });
      setShowAddForm(false);
      setEditingSchedule(null);

      // Call onSave with device.id and scheduleData
      if (onSave) {
        onSave(device.id, scheduleData);
      }

    } catch (error) {
      console.error('Error saving schedule:', error);
      setError(error.message);
      alert('Failed to save schedule: ' + error.message);
    }
    setLoading(false);
  };

  const handleEditSchedule = (schedule) => {
    setNewSchedule({
      name: schedule.name,
      time: schedule.time,
      action: schedule.action,
      days: schedule.days,
      enabled: schedule.enabled,
      repeat_type: schedule.repeat_type || 'weekly'
    });
    setEditingSchedule(schedule);
    setShowAddForm(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Delete this schedule?')) return;

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/schedules/${scheduleId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        setSchedules(prev => prev.filter(s => s.id !== scheduleId));
        console.log('Schedule deleted successfully');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to delete schedule');
      }
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setError(error.message);
      alert('Failed to delete schedule: ' + error.message);
    }
    setLoading(false);
  };

  const handleToggleSchedule = async (scheduleId) => {
    const schedule = schedules.find(s => s.id === scheduleId);
    if (!schedule) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/schedules/${scheduleId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: schedule.name,
          time: schedule.time,
          action: schedule.action,
          days: schedule.days,
          enabled: !schedule.enabled,
          repeat_type: schedule.repeat_type
        })
      });

      if (response.ok) {
        setSchedules(prev => prev.map(s => 
          s.id === scheduleId ? { ...s, enabled: !s.enabled } : s
        ));
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to toggle schedule');
      }
    } catch (error) {
      console.error('Error toggling schedule:', error);
      alert('Failed to toggle schedule: ' + error.message);
    }
  };

  const formatDays = (days) => {
    if (days.length === 7) return 'Every day';
    if (days.length === 5 && !days.includes('saturday') && !days.includes('sunday')) {
      return 'Weekdays';
    }
    if (days.length === 2 && days.includes('saturday') && days.includes('sunday')) {
      return 'Weekends';
    }
    return daysOfWeek.filter(d => days.includes(d.key)).map(d => d.label).join(', ');
  };

  const formatTime = (time) => {
    const [hours, minutes] = time.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  return (
    <div className="modal-overlay">
      <div className="schedule-modal">
        <div className="modal-header">
          <h3>Schedules for {device.name}</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && (
          <div className="error-message" style={{ 
            background: '#fee', 
            color: '#c33', 
            padding: '10px', 
            margin: '10px 20px',
            borderRadius: '4px',
            border: '1px solid #fcc'
          }}>
            {error}
          </div>
        )}

        <div className="schedule-content">
          <div className="schedules-section">
            <div className="section-header">
              <h4>Current Schedules</h4>
              <button 
                className="add-schedule-btn"
                onClick={() => {
                  setShowAddForm(true);
                  setEditingSchedule(null);
                  setNewSchedule({
                    name: '',
                    time: '',
                    action: 'turn_on',
                    days: [],
                    enabled: true,
                    repeat_type: 'weekly'
                  });
                }}
                disabled={loading}
              >
                + Add Schedule
              </button>
            </div>

            {loading && <div className="loading">Loading schedules...</div>}

            {!loading && schedules.length === 0 && (
              <div className="no-schedules">
                <p>No schedules set for this device.</p>
              </div>
            )}

            {!loading && schedules.length > 0 && (
              <div className="schedules-list">
                {schedules.map(schedule => (
                  <div key={schedule.id} className={`schedule-item ${!schedule.enabled ? 'disabled' : ''}`}>
                    <div className="schedule-info">
                      <div className="schedule-main">
                        <h5>{schedule.name}</h5>
                        <p className="schedule-time">{formatTime(schedule.time)}</p>
                        <p className="schedule-action">
                          {schedule.action === 'turn_on' ? '🟢 Turn ON' : '🔴 Turn OFF'}
                        </p>
                        <p className="schedule-days">{formatDays(schedule.days)}</p>
                      </div>
                      <div className="schedule-controls">
                        <button 
                          className="toggle-btn"
                          onClick={() => handleToggleSchedule(schedule.id)}
                          disabled={loading}
                        >
                          {schedule.enabled ? 'Disable' : 'Enable'}
                        </button>
                        <button 
                          className="edit-btn"
                          onClick={() => handleEditSchedule(schedule)}
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button 
                          className="delete-btn"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {showAddForm && (
            <div className="add-schedule-section">
              <h4>{editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}</h4>
              
              <div className="form-group">
                <label>Schedule Name</label>
                <input
                  type="text"
                  value={newSchedule.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Enter schedule name"
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Time</label>
                <input
                  type="time"
                  value={newSchedule.time}
                  onChange={(e) => handleInputChange('time', e.target.value)}
                  disabled={loading}
                />
              </div>

              <div className="form-group">
                <label>Action</label>
                <select 
                  value={newSchedule.action} 
                  onChange={(e) => handleInputChange('action', e.target.value)}
                  disabled={loading}
                >
                  <option value="turn_on">Turn ON</option>
                  <option value="turn_off">Turn OFF</option>
                </select>
              </div>

              <div className="form-group">
                <label>Days</label>
                <div className="days-selector">
                  {daysOfWeek.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      className={`day-btn ${newSchedule.days.includes(day.key) ? 'selected' : ''}`}
                      onClick={() => handleDayToggle(day.key)}
                      disabled={loading}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button 
                  className="save-btn" 
                  onClick={handleSaveSchedule}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : (editingSchedule ? 'Update Schedule' : 'Add Schedule')}
                </button>
                <button 
                  className="cancel-btn" 
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingSchedule(null);
                    setNewSchedule({
                      name: '',
                      time: '',
                      action: 'turn_on',
                      days: [],
                      enabled: true,
                      repeat_type: 'weekly'
                    });
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScheduleModal;