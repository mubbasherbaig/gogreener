import React, { useState, useEffect, useRef } from 'react';
import { WS_BASE_URL } from '../config';
import { API_BASE_URL } from '../config';

const DeviceCard = ({ device, onControl, onViewChart, onDelete, onSchedules }) => {
  const isOnline = device.is_online;
  const switchState = device.switch_state;
  const currentReading = parseFloat(device.current_reading) || 0;
  const [nextSchedule, setNextSchedule] = useState(null);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchNextSchedule();
    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [device.id]);

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token || wsRef.current) return;

    const wsUrl = `${WS_BASE_URL}/?token=${token}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('DeviceCard WebSocket connected for device:', device.id);
      ws.send(JSON.stringify({ type: 'user_connect', token }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'schedule_update' && message.deviceId === device.id) {
        console.log('Schedule updated, refetching next schedule for:', device.id);
        fetchNextSchedule();
      }
    };

    ws.onclose = () => {
      console.log('DeviceCard WebSocket disconnected for device:', device.id);
    };

    ws.onerror = (error) => {
      console.error('DeviceCard WebSocket error:', error);
    };
  };

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
        console.log('Next schedule data:', data); // Debug log
        setNextSchedule(data.message ? null : data);
      } else {
        setNextSchedule(null);
        console.error('Failed to fetch next schedule:', await response.json());
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
          <p><strong>Next Schedule:</strong> The device will {nextSchedule.action} {nextSchedule.displayDay ? nextSchedule.displayDay.toLowerCase() : 'today'} at {nextSchedule.time}</p>
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
            disabled={!isOnline}
            title={isOnline ? "Set Schedules" : "Device must be online to add schedules"}
          >
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeviceCard;