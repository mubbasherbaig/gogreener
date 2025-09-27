import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';

const SetupGuide = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const deviceId = searchParams.get('id');
  const [step, setStep] = useState(1);
  const [deviceName, setDeviceName] = useState('');
  const [loading, setLoading] = useState(false);

  const registerDevice = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        alert('Please login first');
        navigate('/login');
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/devices/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          deviceId,
          deviceName: deviceName || `Switch ${deviceId.slice(-4)}`,
          model: 'ESP8266-Switch'
        })
      });

      if (response.ok) {
        alert('Device registered successfully!');
        navigate('/');
      } else {
        const error = await response.json();
        alert('Registration failed: ' + error.error);
      }
    } catch (error) {
      alert('Network error: ' + error.message);
    }
    setLoading(false);
  };

  if (!deviceId) {
    return <div className="setup-container">Invalid QR Code</div>;
  }

  return (
    <div className="setup-container" style={{padding: '20px', maxWidth: '500px', margin: '0 auto'}}>
      <h2>Device Setup Guide</h2>
      <p>Device ID: <strong>{deviceId}</strong></p>

      {step === 1 && (
        <div>
          <h3>Step 1: Connect to Device WiFi</h3>
          <ol>
            <li>Go to your phone's WiFi settings</li>
            <li>Connect to: <strong>ESP8266_Setup_{deviceId.slice(-6)}</strong></li>
            <li>Password: <strong>12345678</strong></li>
            <li>Open browser and go to: <strong>192.168.4.1</strong></li>
            <li>Enter your home WiFi credentials</li>
          </ol>
          <button onClick={() => setStep(2)}>Done - Next Step</button>
        </div>
      )}

      {step === 2 && (
        <div>
          <h3>Step 2: Register Device</h3>
          <p>After configuring WiFi, register your device:</p>
          <input
            type="text"
            placeholder="Device Name (optional)"
            value={deviceName}
            onChange={(e) => setDeviceName(e.target.value)}
            style={{width: '100%', padding: '10px', margin: '10px 0'}}
          />
          <button onClick={registerDevice} disabled={loading} style={{width: '100%', padding: '10px'}}>
            {loading ? 'Registering...' : 'Register Device'}
          </button>
          <button onClick={() => setStep(1)} style={{marginTop: '10px'}}>Back</button>
        </div>
      )}
    </div>
  );
};

export default SetupGuide;