import React, { useState, useEffect, useRef } from 'react';
import DeviceCard from './DeviceCard';
import AddDevice from './AddDevice';
import DeviceChart from './DeviceChart';
import { WS_BASE_URL } from '../config';
import { API_BASE_URL } from '../config';

const Dashboard = () => {
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef(null);

  useEffect(() => {
    fetchDevices();
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const wsUrl = WS_BASE_URL;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
      
      // Send user authentication
      ws.send(JSON.stringify({
        type: 'user_connect',
        token: token
      }));
    };

    ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
      
        if (message.type === 'device_status') {
          // Update device online status
          setDevices(prev =>
            prev.map(device =>
              device.id === message.deviceId
                ? { ...device, is_online: message.isOnline }
                : device
            )
          );
        } else if (message.type === 'device_update') {
          // Update device data in real-time
          setDevices(prev =>
            prev.map(device =>
              device.id === message.deviceId
                ? {
                    ...device,
                    switch_state: message.data.switch_state,
                    current_reading: message.data.current_reading,
                    voltage: message.data.voltage,
                    is_online: true,
                  }
                : device
            )
          );
        }
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setConnected(false);
    };
  };

  const fetchDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const uniqueDevices = data.filter((device, index, arr) => 
          arr.findIndex(d => d.id === device.id) === index
        );
        setDevices(uniqueDevices);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
    setLoading(false);
  };

  const controlDevice = async (deviceId, action, value) => {
    // Optimistic update - show change immediately
    setDevices(prev => prev.map(device => 
      device.id === deviceId 
        ? { ...device, switch_state: action === 'switch' ? value : device.switch_state }
        : device
    ));

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, value })
      });
      
      const result = await response.json();
      console.log('Command sent:', result);
      
    } catch (error) {
      console.error('Error controlling device:', error);
      // Revert optimistic update on error
      fetchDevices();
    }
  };

  const deleteDevice = async (deviceId) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${deviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        fetchDevices();
      } else {
        alert('Failed to delete device');
      }
    } catch (error) {
      console.error('Error deleting device:', error);
      alert('Error deleting device');
    }
  };

  if (loading) {
    return <div className="loading">Loading devices...</div>;
  }

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h2>My Devices</h2>
        <div className="dashboard-controls">
          <div className={`connection-status ${connected ? 'connected' : 'disconnected'}`}>
            {connected ? '🟢 Live' : '🔴 Offline'}
          </div>
          <button 
            className="add-device-btn"
            onClick={() => setShowAddDevice(true)}
          >
            Add Device
          </button>
        </div>
      </div>

      {devices.length === 0 ? (
        <div className="no-devices">
          <h3>No devices found</h3>
          <p>Add your first smart switch to get started</p>
        </div>
      ) : (
        <div className="devices-grid">
          {devices.map(device => (
            <DeviceCard 
              key={device.id}
              device={device}
              onControl={controlDevice}
              onViewChart={() => setSelectedDevice(device)}
              onDelete={deleteDevice}
            />
          ))}
        </div>
      )}

      {showAddDevice && (
        <AddDevice 
          onClose={() => setShowAddDevice(false)}
          onDeviceAdded={fetchDevices}
        />
      )}

      {selectedDevice && (
        <DeviceChart 
          device={selectedDevice}
          onClose={() => setSelectedDevice(null)}
        />
      )}
    </div>
  );
};

export default Dashboard;