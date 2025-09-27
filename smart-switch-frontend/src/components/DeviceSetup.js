import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const DeviceSetup = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deviceId = searchParams.get('id');
  const [setupState, setSetupState] = useState('start');
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!deviceId) {
      setSetupState('error');
      return;
    }
    
    detectNetworkState();
  }, [deviceId]);

  const detectNetworkState = async () => {
    try {
      // Check if connected to ESP hotspot
      const espResponse = await fetch('http://192.168.4.1/', { 
        mode: 'no-cors', 
        signal: AbortSignal.timeout(3000) 
      });
      setSetupState('hotspot_connected');
    } catch {
      // Check if device already registered
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const response = await fetch(`${API_BASE_URL}/api/devices/check/${deviceId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (response.ok) {
            setSetupState('completed');
            return;
          }
        } catch {}
      }
      
      // Check setup progress
      const progress = localStorage.getItem(`setup_${deviceId}`);
      if (progress === 'wifi_configured') {
        setSetupState('ready_to_register');
      } else {
        setSetupState('start');
      }
    }
  };

  const registerDevice = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceId,
          deviceName,
          model: 'ESP8266-Switch'
        })
      });

      if (response.ok) {
        localStorage.removeItem(`setup_${deviceId}`);
        setSetupState('completed');
      } else {
        alert('Registration failed');
      }
    } catch (error) {
      alert('Network error');
    }
    setLoading(false);
  };

  if (setupState === 'error') {
    return <div className="setup-container">Invalid QR Code</div>;
  }

  return (
    <div className="setup-container">
      {setupState === 'start' && (
        <div>
          <h2>Setup Your Smart Switch</h2>
          <p>Device ID: <strong>{deviceId}</strong></p>
          <div className="setup-step">
            <h3>Connect to Device Hotspot</h3>
            <p>1. Go to WiFi settings</p>
            <p>2. Connect to: <strong>ESP8266_Setup_{deviceId.slice(-6)}</strong></p>
            <p>3. Password: <strong>12345678</strong></p>
            <p>4. Scan QR code again</p>
          </div>
        </div>
      )}

      {setupState === 'hotspot_connected' && (
        <div>
          <h2>Redirecting to Device Setup...</h2>
          <p>Opening device configuration page...</p>
          {window.location.href = 'http://192.168.4.1/'}
        </div>
      )}

      {setupState === 'ready_to_register' && (
        <div>
          <h2>Register Your Device</h2>
          <input
            type="text"
            placeholder="Device Name"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            required
          />
          <button onClick={registerDevice} disabled={loading || !deviceName}>
            {loading ? 'Registering...' : 'Register Device'}
          </button>
        </div>
      )}

      {setupState === 'completed' && (
        <div>
          <h2>Setup Complete!</h2>
          <button onClick={() => navigate('/')}>Go to Dashboard</button>
        </div>
      )}
    </div>
  );
};

export default DeviceSetup;