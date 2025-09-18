import React, { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';

const AdminPanel = () => {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAllDevices();
    // Refresh every 30 seconds
    const interval = setInterval(fetchAllDevices, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchAllDevices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/devices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        setDevices(data);
      }
    } catch (error) {
      console.error('Error fetching devices:', error);
    }
    setLoading(false);
  };

  const controlDevice = async (deviceId, action, value) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/admin/devices/${deviceId}/control`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ action, value })
      });
      
      if (response.ok) {
        setTimeout(fetchAllDevices, 1000);
      }
    } catch (error) {
      console.error('Error controlling device:', error);
    }
  };

  if (loading) {
    return <div className="loading">Loading admin panel...</div>;
  }

  return (
    <div className="admin-panel">
      <div className="admin-header">
        <h2>Admin Panel - All Devices</h2>
        <div className="stats">
          <span>Total Devices: {devices.length}</span>
          <span>Online: {devices.filter(d => d.is_online).length}</span>
        </div>
      </div>

      <div className="admin-devices-table">
        <table>
          <thead>
            <tr>
              <th>Device ID</th>
              <th>Name</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Switch</th>
              <th>Current (A)</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {devices.map(device => (
              <tr key={device.id}>
                <td>{device.id}</td>
                <td>{device.name}</td>
                <td>{device.username}</td>
                <td>
                  <span className={`status ${device.is_online ? 'online' : 'offline'}`}>
                    {device.is_online ? 'Online' : 'Offline'}
                  </span>
                </td>
                <td>
                  <span className={`switch-status ${device.switch_state ? 'on' : 'off'}`}>
                    {device.switch_state ? 'ON' : 'OFF'}
                  </span>
                </td>
                <td>{(device.current_reading || 0).toFixed(2)}</td>
                <td>
                  {device.last_seen ? new Date(device.last_seen).toLocaleString() : 'Never'}
                </td>
                <td>
                  <div className="admin-actions">
                    <button 
                      className="control-btn"
                      onClick={() => controlDevice(device.id, 'switch', !device.switch_state)}
                      disabled={!device.is_online}
                    >
                      {device.switch_state ? 'Turn OFF' : 'Turn ON'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {devices.length === 0 && (
        <div className="no-devices">
          <h3>No devices registered yet</h3>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;