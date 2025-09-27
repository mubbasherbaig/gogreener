import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

const AddDevice = ({ onClose, onDeviceAdded }) => {
  const [deviceData, setDeviceData] = useState({
    deviceId: '',
    deviceName: '',
    model: 'ESP32-Switch'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setDeviceData({
      ...deviceData,
      [e.target.name]: e.target.value
    });
  };

  const simulateQRScan = () => {
    // Open camera for QR scanning or redirect to setup page
    const deviceId = 'ESP8266_' + Math.random().toString(36).substring(2, 10).toUpperCase();
    window.open(`/device-setup?id=${deviceId}`, '_blank');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(deviceData)
      });

      const data = await response.json();

      if (response.ok) {
        onDeviceAdded();
        onClose();
      } else {
        setError(data.error || 'Failed to register device');
      }
    } catch (error) {
      setError('Network error. Please try again.');
    }
    
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="modal">
        <div className="modal-header">
          <h3>Add New Device</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Device ID:</label>
            <div className="device-id-input">
              <input
                type="text"
                name="deviceId"
                placeholder="ESP32_XXXXXXXX"
                value={deviceData.deviceId}
                onChange={handleChange}
                required
              />
              <button 
                type="button" 
                className="qr-btn"
                onClick={simulateQRScan}
              >
                📱 Scan QR
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>Device Name:</label>
            <input
              type="text"
              name="deviceName"
              placeholder="Living Room Switch"
              value={deviceData.deviceName}
              onChange={handleChange}
              required
            />
          </div>

          <div className="form-group">
            <label>Model:</label>
            <select
              name="model"
              value={deviceData.model}
              onChange={handleChange}
            >
              <option value="ESP32-Switch">ESP32-Switch</option>
              <option value="ESP32-Switch-Pro">ESP32-Switch-Pro</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading}>
              {loading ? 'Adding...' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};



export default AddDevice;