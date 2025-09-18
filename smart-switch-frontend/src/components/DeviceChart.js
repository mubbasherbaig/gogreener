import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { API_BASE_URL } from '../config';

const DeviceChart = ({ device, onClose }) => {
  const [telemetryData, setTelemetryData] = useState([]);
  const [timeRange, setTimeRange] = useState('24');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTelemetry();
  }, [device.id, timeRange]);

  const fetchTelemetry = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${API_BASE_URL}/api/devices/${device.id}/telemetry?hours=${timeRange}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        const formattedData = data.map(item => ({
          time: new Date(item.timestamp).toLocaleTimeString(),
          current: item.current_reading,
          voltage: item.voltage,
          state: item.switch_state ? 1 : 0
        }));
        setTelemetryData(formattedData.reverse());
      }
    } catch (error) {
      console.error('Error fetching telemetry:', error);
    }
    setLoading(false);
  };

  return (
    <div className="modal-overlay">
      <div className="chart-modal">
        <div className="modal-header">
          <h3>{device.name} - Telemetry Data</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <div className="chart-controls">
          <label>Time Range:</label>
          <select value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
            <option value="1">Last Hour</option>
            <option value="6">Last 6 Hours</option>
            <option value="24">Last 24 Hours</option>
            <option value="168">Last Week</option>
          </select>
        </div>

        {loading ? (
          <div className="loading">Loading chart data...</div>
        ) : (
          <div className="chart-container">
            <h4>Current Reading (A)</h4>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={telemetryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="current" 
                  stroke="#2196F3" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>

            <h4>Switch State</h4>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={telemetryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 1]} />
                <Tooltip />
                <Line 
                  type="stepAfter" 
                  dataKey="state" 
                  stroke="#4CAF50" 
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};

export default DeviceChart;