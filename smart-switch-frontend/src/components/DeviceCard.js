import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const DeviceCard = ({ device, onControl, onViewChart, onDelete, onSchedules }) => {
  const isOnline = device.is_online;
  const switchState = device.switch_state;
  const currentReading = parseFloat(device.current_reading) || 0;
  const [nextSchedule, setNextSchedule] = useState(null);

  useEffect(() => {
    fetchNextSchedule();
  }, [device.id]);

  const fetchNextSchedule = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/next-schedule`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setNextSchedule(data.message ? null : data);
      } else {
        setNextSchedule(null);
      }
    } catch (error) {
      console.error(`Error fetching next schedule for ${device.id}:`, error);
      setNextSchedule(null);
    }
  };

  const handleToggle = () => {
    onControl(device.id, 'switch', !switchState);
  };

  const handleDelete = () => {
    if (window.confirm(`Delete device "${device.name}"? This cannot be undone.`)) {
      onDelete(device.id);
    }
  };

  const handleSchedules = () => {
    onSchedules(device);
  };

  return (
    <div className={`device-card ${isOnline ? 'online' : 'offline'}`}>
      <div className="device-header">
        <h3>{device.name}</h3>
        <div className="device-actions">
          <div className={`status ${isOnline ? 'online' : 'offline'}`}>
            {isOnline ? 'Online' : 'Offline'}
          </div>
          <button className="delete-btn" onClick={handleDelete} title="Delete Device">
            🗑️
          </button>
        </div>
      </div>
      
      <div className="device-info">
        <p><strong>Model:</strong> {device.model}</p>
        <p><strong>Device ID:</strong> {device.id}</p>
        <p><strong>Current:</strong> {currentReading.toFixed(2)} A</p>
        <p><strong>Last Seen:</strong> {device.last_seen ? new Date(device.last_seen).toLocaleTimeString() : 'Never'}</p>
        {nextSchedule ? (
          <p><strong>Next Schedule:</strong> The device will {nextSchedule.action} {nextSchedule.displayDay.toLowerCase()} at {nextSchedule.time}</p>
        ) : (
          <p><strong>Next Schedule:</strong> No upcoming schedules</p>
        )}
      </div>

      <div className="device-controls">
        <div className="switch-control">
          <label className="switch">
            <input 
              type="checkbox" 
              checked={switchState || false}
              onChange={handleToggle}
              disabled={!isOnline}
            />
            <span className="slider"></span>
          </label>
        </div>
        
        <div className="control-buttons">
          <button 
            className="chart-btn"
            onClick={() => onViewChart(device)}
          >
            Chart
          </button>
          
          <button 
            className="schedule-btn"
            onClick={handleSchedules}
            title="Set Schedules"
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceCard;