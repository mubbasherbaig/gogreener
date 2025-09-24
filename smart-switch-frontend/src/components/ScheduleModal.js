import React, { useState, useEffect } from 'react';

const ScheduleModal = ({ device, onClose, onSave }) => {
  const [schedules, setSchedules] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [loading, setLoading] = useState(false);
  const [newSchedule, setNewSchedule] = useState({
    name: '',
    time: '',
    action: 'turn_on',
    days: [],
    enabled: true,
    repeat_type: 'weekly' // daily, weekly, once
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
    try {
      // Mock data for now - replace with actual API call
      const mockSchedules = [
        {
          id: 1,
          name: 'Morning ON',
          time: '07:00',
          action: 'turn_on',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
          enabled: true,
          repeat_type: 'weekly'
        },
        {
          id: 2,
          name: 'Evening OFF',
          time: '22:00',
          action: 'turn_off',
          days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
          enabled: true,
          repeat_type: 'weekly'
        }
      ];
      
      // Simulate API delay
      setTimeout(() => {
        setSchedules(mockSchedules);
        setLoading(false);
      }, 300);
      
      // TODO: Replace with actual API call
      // const response = await fetch(`/api/devices/${device.id}/schedules`);
      // const data = await response.json();
      // setSchedules(data);
    } catch (error) {
      console.error('Error fetching schedules:', error);
      setLoading(false);
    }
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
    try {
      // TODO: Replace with actual API call
      const scheduleData = {
        ...newSchedule,
        id: editingSchedule ? editingSchedule.id : Date.now(),
        device_id: device.id
      };

      if (editingSchedule) {
        // Update existing schedule
        setSchedules(prev => prev.map(s => s.id === editingSchedule.id ? scheduleData : s));
      } else {
        // Add new schedule
        setSchedules(prev => [...prev, scheduleData]);
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
      
      if (onSave) {
        onSave(scheduleData);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error saving schedule:', error);
      setLoading(false);
      alert('Failed to save schedule. Please try again.');
    }
  };

  const handleEditSchedule = (schedule) => {
    setNewSchedule(schedule);
    setEditingSchedule(schedule);
    setShowAddForm(true);
  };

  const handleDeleteSchedule = async (scheduleId) => {
    if (!window.confirm('Delete this schedule?')) return;

    setLoading(true);
    try {
      // TODO: Replace with actual API call
      setSchedules(prev => prev.filter(s => s.id !== scheduleId));
      setLoading(false);
    } catch (error) {
      console.error('Error deleting schedule:', error);
      setLoading(false);
      alert('Failed to delete schedule. Please try again.');
    }
  };

  const handleToggleSchedule = async (scheduleId) => {
    try {
      // TODO: Replace with actual API call
      setSchedules(prev => prev.map(s => 
        s.id === scheduleId ? { ...s, enabled: !s.enabled } : s
      ));
    } catch (error) {
      console.error('Error toggling schedule:', error);
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

        <div className="schedule-content">
          {/* Existing Schedules */}
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
                        <label className="toggle-switch">
                          <input
                            type="checkbox"
                            checked={schedule.enabled}
                            onChange={() => handleToggleSchedule(schedule.id)}
                          />
                          <span className="toggle-slider"></span>
                        </label>
                        <button 
                          className="edit-btn"
                          onClick={() => handleEditSchedule(schedule)}
                        >
                          ✏️
                        </button>
                        <button 
                          className="delete-schedule-btn"
                          onClick={() => handleDeleteSchedule(schedule.id)}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Add/Edit Form */}
          {showAddForm && (
            <div className="add-schedule-form">
              <h4>{editingSchedule ? 'Edit Schedule' : 'Add New Schedule'}</h4>
              
              <div className="form-group">
                <label>Schedule Name:</label>
                <input
                  type="text"
                  placeholder="e.g., Morning Light"
                  value={newSchedule.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Time:</label>
                <input
                  type="time"
                  value={newSchedule.time}
                  onChange={(e) => handleInputChange('time', e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Action:</label>
                <select
                  value={newSchedule.action}
                  onChange={(e) => handleInputChange('action', e.target.value)}
                >
                  <option value="turn_on">Turn ON</option>
                  <option value="turn_off">Turn OFF</option>
                </select>
              </div>

              <div className="form-group">
                <label>Repeat Days:</label>
                <div className="days-selector">
                  {daysOfWeek.map(day => (
                    <button
                      key={day.key}
                      type="button"
                      className={`day-btn ${newSchedule.days.includes(day.key) ? 'selected' : ''}`}
                      onClick={() => handleDayToggle(day.key)}
                    >
                      {day.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-actions">
                <button 
                  type="button" 
                  className="cancel-btn"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingSchedule(null);
                  }}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="save-btn"
                  onClick={handleSaveSchedule}
                  disabled={loading}
                >
                  {loading ? 'Saving...' : editingSchedule ? 'Update' : 'Save'}
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