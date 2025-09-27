import React, { useState } from 'react';
import { API_BASE_URL } from '../config';

const AddDevice = ({ onClose, onDeviceAdded }) => {
  const [deviceData, setDeviceData] = useState({
    deviceId: '',
    deviceName: '',
    model: 'ESP8266-Switch'
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);

  const handleChange = (e) => {
    setDeviceData({
      ...deviceData,
      [e.target.name]: e.target.value
    });
  };

  const startQRScan = async () => {
    setScanning(true);
    setError('');

    try {
      // Check if browser supports camera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera not supported in this browser');
      }

      // Create video element for camera feed
      const video = document.createElement('video');
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d');

      // Get camera stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } // Use back camera
      });
      
      video.srcObject = stream;
      video.play();

      // Create scanning overlay
      const scannerDiv = document.createElement('div');
      scannerDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.8);
        z-index: 9999;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      `;

      video.style.cssText = `
        width: 80%;
        max-width: 400px;
        border: 2px solid #fff;
        border-radius: 8px;
      `;

      const instructions = document.createElement('div');
      instructions.innerHTML = `
        <p style="color: white; text-align: center; margin: 20px;">
          Point camera at QR code
        </p>
        <button id="cancelScan" style="
          background: #ff4444;
          color: white;
          border: none;
          padding: 10px 20px;
          border-radius: 5px;
          cursor: pointer;
        ">Cancel</button>
      `;

      scannerDiv.appendChild(video);
      scannerDiv.appendChild(instructions);
      document.body.appendChild(scannerDiv);

      // Cancel button functionality
      document.getElementById('cancelScan').onclick = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(scannerDiv);
        setScanning(false);
      };

      // QR Code scanning using jsQR library
      const loadJsQR = () => {
        return new Promise((resolve) => {
          if (window.jsQR) {
            resolve(window.jsQR);
            return;
          }
          
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
          script.onload = () => resolve(window.jsQR);
          document.head.appendChild(script);
        });
      };

      const jsQR = await loadJsQR();

      // Scanning loop
      const scanFrame = () => {
        if (video.videoWidth === 0 || video.videoHeight === 0) {
          requestAnimationFrame(scanFrame);
          return;
        }

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height);

        if (code) {
          // QR code detected
          stream.getTracks().forEach(track => track.stop());
          document.body.removeChild(scannerDiv);
          
          // Extract device ID from URL
          const url = code.data;
          const deviceIdMatch = url.match(/[?&]id=([^&]+)/);
          
          if (deviceIdMatch) {
            const scannedDeviceId = deviceIdMatch[1];
            setDeviceData({
              ...deviceData,
              deviceId: scannedDeviceId,
              deviceName: `Smart Switch ${scannedDeviceId.slice(-4)}`
            });
            setScanning(false);
          } else {
            setError('Invalid QR code - no device ID found');
            setScanning(false);
          }
        } else {
          requestAnimationFrame(scanFrame);
        }
      };

      video.onloadedmetadata = () => {
        scanFrame();
      };

    } catch (error) {
      console.error('QR scanning error:', error);
      setError('Camera access failed: ' + error.message);
      setScanning(false);
    }
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

        {error && <div className="error" style={{color: 'red', padding: '10px'}}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Device ID:</label>
            <div className="device-id-input">
              <input
                type="text"
                name="deviceId"
                placeholder="ESP8266_XXXXXXXX"
                value={deviceData.deviceId}
                onChange={handleChange}
                required
              />
              <button 
                type="button" 
                className="qr-btn"
                onClick={startQRScan}
                disabled={scanning}
              >
                {scanning ? '📷 Scanning...' : '📱 Scan QR'}
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
              <option value="ESP8266-Switch">ESP8266-Switch</option>
              <option value="ESP8266-Switch-Pro">ESP8266-Switch-Pro</option>
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose}>Cancel</button>
            <button type="submit" disabled={loading || scanning}>
              {loading ? 'Adding...' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDevice;