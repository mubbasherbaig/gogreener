import React, { useState, useEffect, useRef } from 'react';
import DeviceCard from './DeviceCard';
import AddDevice from './AddDevice';
import DeviceChart from './DeviceChart';
import ScheduleModal from './ScheduleModal';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const Dashboard = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [scheduleDevice, setScheduleDevice] = useState(null); // New state for schedule modal
  const ws = useRef(null);

  useEffect(() => {
    fetchDevices();
    connectWebSocket();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    const token = localStorage.getItem('token');
    const wsUrl = `${API_BASE_URL.replace('http', 'ws')}/ws?token=${token}`;
    
    ws.current = new WebSocket(wsUrl);
    
    ws.current.onopen = () => {
      console.log('WebSocket connected');
      setConnected(true);
    };
    
    ws.current.onclose = () => {
      console.log('WebSocket disconnected');
      setConnected(false);
      // Reconnect after 3 seconds
      setTimeout(connectWebSocket, 3000);
    };
    
    ws.current.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      
      if (data.type === 'device_update') {
        setDevices(prevDevices => 
          prevDevices.map(device => 
            device.id === data.device_id 
              ? { ...device, ...data.data }
              : device
          )
        );
      }
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
        setDevices(data);
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    } finally {
      setLoading(false);
    }
  };

  const controlDevice = async (deviceId, action, value) => {
    // Optimistic update
    setDevices(prevDevices => 
      prevDevices.map(device => 
        device.id === deviceId 
          ? { ...device, switch_state: action === 'switch' ? value : device.switch_state }
          : device
      )
    );

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

  // Handle opening schedule modal
  const handleSchedules = (device) => {
    setScheduleDevice(device);
  };

  // Handle closing schedule modal
  const handleCloseScheduleModal = () => {
    setScheduleDevice(null);
  };

  // Handle saving schedule
  const handleSaveSchedule = (scheduleData) => {
    console.log('Schedule saved:', scheduleData);
    // Here you can add logic to update the device with schedule info if needed
    // For example, you might want to show a schedule indicator on the device card
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
              onSchedules={handleSchedules} // Pass the new handler
            />
          ))}
        </div>
      )}

      {/* Existing Modals */}
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

      {/* New Schedule Modal */}
      {scheduleDevice && (
        <ScheduleModal 
          device={scheduleDevice}
          onClose={handleCloseScheduleModal}
          onSave={handleSaveSchedule}
        />
      )}
    </div>
  );
};

export default Dashboard;