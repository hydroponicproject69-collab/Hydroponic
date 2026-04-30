document.addEventListener('DOMContentLoaded', () => {
  const splashScreen = document.getElementById('splashScreen');
  if (splashScreen) {
    setTimeout(() => {
      splashScreen.classList.add('hidden');
    }, 2000); // Wait for the loading animation to complete
  }
});

const socketServer = window.location.origin;
const connectionStatus = document.getElementById('connectionStatus');
const warningBanner = document.getElementById('warningBanner');
const overviewConnection = document.getElementById('overviewConnection');
const overviewHealth = document.getElementById('overviewHealth');
const lastUpdate = document.getElementById('lastUpdate');
const temperatureValue = document.getElementById('temperatureValue');
const humidityValue = document.getElementById('humidityValue');
const waterTempValue = document.getElementById('waterTempValue');
const phValue = document.getElementById('phValue');
const tdsValue = document.getElementById('tdsValue');
const waterLevelValue = document.getElementById('waterLevelValue');
const sunlightValue = document.getElementById('sunlightValue');
const pumpStatus = document.getElementById('pumpStatus');
const lightStatus = document.getElementById('lightStatus');
const mistStatus = document.getElementById('mistStatus');
const shedStatus = document.getElementById('shedStatus');
const temperatureRangeLabel = document.getElementById('temperatureRangeLabel');
const humidityRangeLabel = document.getElementById('humidityRangeLabel');
const waterTempLabel = document.getElementById('waterTempLabel');
const phLabel = document.getElementById('phLabel');
const tdsLabel = document.getElementById('tdsLabel');
const waterLevelLabel = document.getElementById('waterLevelLabel');
const sunlightLabel = document.getElementById('sunlightLabel');
const saveSettingsButton = document.getElementById('saveSettingsButton');
const settingsMessage = document.getElementById('settingsMessage');
const exportCsvBtn = document.getElementById('exportCsvBtn');
const clearHistoryBtn = document.getElementById('clearHistoryBtn');
const wipeProtocolBtn = document.getElementById('wipeProtocolBtn');
const tempUnitControl = document.getElementById('tempUnitControl');
const refreshIntervalControl = document.getElementById('refreshIntervalControl');
const glowToggle = document.getElementById('glowToggle');
const navItems = Array.from(document.querySelectorAll('.nav-item'));
const thresholdFields = {
  thresholdTempMin: 18,
  thresholdTempMax: 30,
  thresholdPhMin: 5.0,
  thresholdPhMax: 7.0,
  thresholdEcMin: 1.2,
  thresholdEcMax: 2.5,
  thresholdHumidityMin: 40,
  thresholdHumidityMax: 85,
};

const currentDisplaySettings = {
  tempUnit: localStorage.getItem('tempUnit') || 'C',
  refreshInterval: parseInt(localStorage.getItem('refreshInterval')) || 2,
  glowEnabled: localStorage.getItem('glowEnabled') !== 'false',
};
let lastTelemetryTime = 0;

const telemetryHistory = {
  labels: [],
  temperature: [],
  waterLevel: [],
};

function setConnection(connected) {
  connectionStatus.classList.toggle('connected', connected);
  connectionStatus.querySelector('.status-text').textContent = connected ? 'Connected' : 'Disconnected';
  warningBanner.classList.toggle('hidden', connected);
  overviewConnection.textContent = connected ? 'Online' : 'Offline';
}

function formatTimestamp(timestamp) {
  try {
    const date = new Date(timestamp);
    if (isNaN(date)) return 'Invalid time';
    return date.toLocaleString(undefined, {
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch (error) {
    return 'Unknown';
  }
}

function clampHistory(array, length = 24) {
  return array.slice(-length);
}

function updateRangeLabels() {
  temperatureRangeLabel.textContent = 'Stable environment';
  humidityRangeLabel.textContent = 'Target: 45–75%';
  waterTempLabel.textContent = 'Optimal 18–24°C';
  phLabel.textContent = 'Target 5.8–6.5';
  tdsLabel.textContent = 'Target 600–1200 ppm';
  waterLevelLabel.textContent = 'Tank capacity';
  sunlightLabel.textContent = 'Ambient light';
}

function updateRobotHealth(telemetry) {
  const values = [telemetry.temperature, telemetry.humidity, telemetry.waterTemperature, telemetry.ph, telemetry.tds, telemetry.waterLevel, telemetry.sunlight];
  const valid = values.filter((value) => typeof value === 'number' && !Number.isNaN(value));
  const score = valid.length ? Math.round((valid.length / values.length) * 100) : 0;
  overviewHealth.textContent = `${score}%`;
}

function updateControlState(element, value) {
  const state = value ? 'ON' : 'OFF';
  element.textContent = state;
  element.classList.toggle('off', !value);
  
  const card = element.closest('.control-card');
  if (card) {
    card.classList.toggle('device-on', value);
    const btnOn = card.querySelector('.btn[data-state="1"]');
    const btnOff = card.querySelector('.btn[data-state="0"]');
    if (btnOn) btnOn.classList.toggle('active', value);
    if (btnOff) btnOff.classList.toggle('active', !value);
  }
}

function updateTelemetry(data) {
  const now = Date.now();
  if (now - lastTelemetryTime < currentDisplaySettings.refreshInterval * 1000) {
    return;
  }
  lastTelemetryTime = now;

  const telemetry = {
    temperature: Number(data.temperature),
    humidity: Number(data.humidity),
    waterTemperature: Number(data.waterTemperature),
    ph: Number(data.ph),
    tds: Number(data.tds),
    waterLevel: Number(data.waterLevel),
    sunlight: Number(data.sunlight),
    pumpRelay: Boolean(Number(data.pumpRelay)),
    lightRelay: Boolean(Number(data.lightRelay)),
    mistRelay: Boolean(Number(data.mistRelay)),
    shedRelay: Boolean(Number(data.shedRelay)),
    timestamp: data.timestamp || Date.now(),
  };

  let displayAirTemp = telemetry.temperature;
  let displayWaterTemp = telemetry.waterTemperature;

  if (currentDisplaySettings.tempUnit === 'F') {
    displayAirTemp = (displayAirTemp * 9 / 5) + 32;
    displayWaterTemp = (displayWaterTemp * 9 / 5) + 32;
  }

  temperatureValue.textContent = Number.isNaN(displayAirTemp) ? '--' : displayAirTemp.toFixed(1);
  humidityValue.textContent = Number.isNaN(telemetry.humidity) ? '--' : telemetry.humidity.toFixed(1);
  waterTempValue.textContent = Number.isNaN(displayWaterTemp) ? '--' : displayWaterTemp.toFixed(1);
  phValue.textContent = Number.isNaN(telemetry.ph) ? '--' : telemetry.ph.toFixed(2);
  tdsValue.textContent = Number.isNaN(telemetry.tds) ? '--' : String(Math.round(telemetry.tds));
  waterLevelValue.textContent = Number.isNaN(telemetry.waterLevel) ? '--' : String(Math.round(telemetry.waterLevel));
  sunlightValue.textContent = Number.isNaN(telemetry.sunlight) ? '--' : String(Math.round(telemetry.sunlight));

  updateControlState(pumpStatus, telemetry.pumpRelay);
  updateControlState(lightStatus, telemetry.lightRelay);
  updateControlState(mistStatus, telemetry.mistRelay);
  updateControlState(shedStatus, telemetry.shedRelay);

  lastUpdate.textContent = formatTimestamp(telemetry.timestamp);
  updateRobotHealth(telemetry);
  updateRangeLabels();
  pushTelemetryHistory(telemetry);
}

function pushTelemetryHistory({ timestamp, temperature, waterLevel }) {
  const label = formatTimestamp(timestamp);
  telemetryHistory.labels.push(label);
  telemetryHistory.temperature.push(Number.isNaN(temperature) ? 0 : temperature);
  telemetryHistory.waterLevel.push(Number.isNaN(waterLevel) ? 0 : waterLevel);
  telemetryHistory.labels = clampHistory(telemetryHistory.labels);
  telemetryHistory.temperature = clampHistory(telemetryHistory.temperature);
  telemetryHistory.waterLevel = clampHistory(telemetryHistory.waterLevel);
  refreshCharts();
}

function buildChart(context, label, color, unit) {
  return new Chart(context, {
    type: 'line',
    data: {
      labels: telemetryHistory.labels,
      datasets: [{
        label,
        data: label === 'Air Temperature' ? telemetryHistory.temperature : telemetryHistory.waterLevel,
        borderColor: color,
        backgroundColor: color.replace('1)', '0.14)'),
        tension: 0.35,
        pointRadius: 2,
        borderWidth: 2,
        fill: true,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${context.formattedValue} ${unit}`,
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#9bacd9' } },
        y: { ticks: { color: '#9bacd9' }, grid: { color: 'rgba(255,255,255,0.08)' } },
      },
    },
  });
}

const temperatureChart = buildChart(document.getElementById('temperatureChart'), 'Air Temperature', 'rgba(77, 139, 255, 1)', '°C');
const waterLevelChart = buildChart(document.getElementById('waterLevelChart'), 'Water Level', 'rgba(71, 217, 187, 1)', '%');

function refreshCharts() {
  temperatureChart.data.labels = telemetryHistory.labels;
  temperatureChart.data.datasets[0].data = telemetryHistory.temperature;
  waterLevelChart.data.labels = telemetryHistory.labels;
  waterLevelChart.data.datasets[0].data = telemetryHistory.waterLevel;
  temperatureChart.update();
  waterLevelChart.update();
}

function loadThresholds() {
  Object.keys(thresholdFields).forEach((key) => {
    const value = localStorage.getItem(key);
    const input = document.getElementById(key);
    if (input) {
      input.value = value !== null ? value : thresholdFields[key];
    }
  });
}

function saveThresholds() {
  Object.keys(thresholdFields).forEach((key) => {
    const input = document.getElementById(key);
    if (!input) return;
    localStorage.setItem(key, input.value || thresholdFields[key]);
  });
  settingsMessage.classList.remove('hidden');
  setTimeout(() => settingsMessage.classList.add('hidden'), 2600);
}

function handleControlButtons() {
  const buttons = document.querySelectorAll('.control-buttons .btn');
  buttons.forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const device = button.getAttribute('data-device');
      const state = parseInt(button.getAttribute('data-state'), 10);
      
      // Optimistic UI update
      const card = button.closest('.control-card');
      if (card) {
        card.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
        button.classList.add('active');
        card.classList.toggle('device-on', state === 1);
      }

      try {
        const response = await fetch(`${socketServer}/api/control`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ device, state }),
        });
        
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        console.log(`${device} ${state ? 'ON' : 'OFF'}:`, result);
      } catch (error) {
        console.error(`Failed to control ${device}:`, error);
        alert(`Failed to control ${device}. Check console for details.`);
      }
    });
  });
}

function handleNavigation() {
  navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = item.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);
      
      if (!targetSection) return;
      
      // Update nav active state
      navItems.forEach((nav) => nav.classList.remove('active'));
      item.classList.add('active');
      
      // Hide all sections and show the target
      document.querySelectorAll('.page-section').forEach((section) => {
        section.classList.remove('active');
      });
      targetSection.classList.add('active');
    });
  });
}

function handleSettingsTabs() {
  const tabBtns = document.querySelectorAll('.settings-tabs .tab-btn');
  const tabPanes = document.querySelectorAll('.settings-tab-pane');

  tabBtns.forEach((btn) => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = btn.getAttribute('data-target');
      
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabPanes.forEach((p) => p.classList.add('hidden'));
      
      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.remove('hidden');
    });
  });
}

function handleDataManagement() {
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (telemetryHistory.labels.length === 0) {
        alert('No data to export yet.');
        return;
      }
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "Timestamp,Air Temperature (°C),Water Level (%)\n";
      
      for (let i = 0; i < telemetryHistory.labels.length; i++) {
        const time = telemetryHistory.labels[i];
        const temp = telemetryHistory.temperature[i];
        const wl = telemetryHistory.waterLevel[i];
        csvContent += `"${time}",${temp},${wl}\n`;
      }
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `sensor_log_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear the chart history for this session?')) {
        telemetryHistory.labels = [];
        telemetryHistory.temperature = [];
        telemetryHistory.waterLevel = [];
        refreshCharts();
      }
    });
  }

  if (wipeProtocolBtn) {
    wipeProtocolBtn.addEventListener('click', () => {
      if (confirm('WARNING: This will reset all threshold settings and clear local session data. Continue?')) {
        localStorage.clear();
        telemetryHistory.labels = [];
        telemetryHistory.temperature = [];
        telemetryHistory.waterLevel = [];
        refreshCharts();
        loadThresholds();
        saveThresholds();
        alert('Wipe protocol completed. System reset to defaults.');
      }
    });
  }
}

function handleDisplaySettings() {
  if (tempUnitControl) {
    const btns = tempUnitControl.querySelectorAll('.segment-btn');
    btns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-val') === currentDisplaySettings.tempUnit);
      b.addEventListener('click', () => {
        btns.forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        currentDisplaySettings.tempUnit = b.getAttribute('data-val');
        localStorage.setItem('tempUnit', currentDisplaySettings.tempUnit);
        document.querySelectorAll('.temp-unit-label').forEach(el => el.textContent = '°' + currentDisplaySettings.tempUnit);
      });
    });
    document.querySelectorAll('.temp-unit-label').forEach(el => el.textContent = '°' + currentDisplaySettings.tempUnit);
  }

  if (refreshIntervalControl) {
    const btns = refreshIntervalControl.querySelectorAll('.segment-btn');
    btns.forEach(b => {
      b.classList.toggle('active', parseInt(b.getAttribute('data-val')) === currentDisplaySettings.refreshInterval);
      b.addEventListener('click', () => {
        btns.forEach(btn => btn.classList.remove('active'));
        b.classList.add('active');
        currentDisplaySettings.refreshInterval = parseInt(b.getAttribute('data-val'));
        localStorage.setItem('refreshInterval', currentDisplaySettings.refreshInterval);
      });
    });
  }

  if (glowToggle) {
    glowToggle.checked = currentDisplaySettings.glowEnabled;
    document.body.classList.toggle('glow-enabled', currentDisplaySettings.glowEnabled);
    glowToggle.addEventListener('change', () => {
      currentDisplaySettings.glowEnabled = glowToggle.checked;
      localStorage.setItem('glowEnabled', currentDisplaySettings.glowEnabled);
      document.body.classList.toggle('glow-enabled', currentDisplaySettings.glowEnabled);
    });
  }
}

function connectSocket() {
  if (typeof io !== 'function') {
    overviewConnection.textContent = 'No Socket.IO';
    warningBanner.classList.remove('hidden');
    return;
  }

  const socket = io(socketServer, {
    transports: ['websocket'],
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => setConnection(true));
  socket.on('disconnect', () => setConnection(false));
  socket.on('connect_error', () => setConnection(false));
  socket.on('telemetry', (payload) => {
    if (!payload) return;
    setConnection(true);
    updateTelemetry(payload);
  });
  socket.on('message', (message) => {
    try {
      const payload = typeof message === 'string' ? JSON.parse(message) : message;
      updateTelemetry(payload);
    } catch (error) {
      console.debug('Ignored invalid telemetry payload', error);
    }
  });
}

function handleCameraStream() {
  const connectCamBtn = document.getElementById('connectCamBtn');
  const screenshotBtn = document.getElementById('screenshotBtn');
  const esp32CamStream = document.getElementById('esp32CamStream');
  const camStatusBadge = document.getElementById('camStatusBadge');

  if (!connectCamBtn) return;

  let isStreamActive = false;
  
  connectCamBtn.addEventListener('click', () => {
    if (!isStreamActive) {
      isStreamActive = true;
      connectCamBtn.textContent = 'Stop Camera';
      connectCamBtn.style.backgroundColor = '#ff4848'; // Red color for stop
      camStatusBadge.className = 'status-badge warning';
      camStatusBadge.innerHTML = 'Connecting... <span class="dot warning"></span>';
      
      // Attempt to load stream from the backend server
      esp32CamStream.crossOrigin = "anonymous";
      esp32CamStream.src = `${socketServer}/api/camera-stream`;
      esp32CamStream.style.display = 'block';
    } else {
      isStreamActive = false;
      connectCamBtn.textContent = 'Initialize Camera';
      connectCamBtn.style.backgroundColor = ''; // Revert to default
      esp32CamStream.src = '';
      camStatusBadge.className = 'status-badge danger';
      camStatusBadge.innerHTML = 'Disconnected <span class="dot danger"></span>';
    }
  });

  esp32CamStream.onerror = () => {
    if (isStreamActive) {
      camStatusBadge.className = 'status-badge danger';
      camStatusBadge.innerHTML = 'Signal Lost <span class="dot danger"></span>';
    }
  };
  
  esp32CamStream.onload = () => {
    if (isStreamActive) {
      camStatusBadge.className = 'status-badge success';
      camStatusBadge.innerHTML = 'Live Feed <span class="dot success"></span>';
    }
  };

  if (screenshotBtn) {
    screenshotBtn.addEventListener('click', () => {
      if (!isStreamActive || !esp32CamStream.src) {
        alert('Please initialize the camera stream first.');
        return;
      }
      
      try {
        const canvas = document.createElement('canvas');
        canvas.width = esp32CamStream.naturalWidth || 640;
        canvas.height = esp32CamStream.naturalHeight || 480;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(esp32CamStream, 0, 0, canvas.width, canvas.height);
        
        const dataUrl = canvas.toDataURL('image/jpeg');
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `hydroponic-vision-${new Date().getTime()}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      } catch (e) {
        console.error('Screenshot failed:', e);
        alert('Failed to capture screenshot. The stream might be cross-origin protected or currently unavailable.');
      }
    });
  }
}

function initTimers() {
  const clockDate = document.getElementById('liveClockDate');
  const clockTime = document.getElementById('liveClockTime');
  const sessionUptime = document.getElementById('sessionUptime');
  
  const startTime = Date.now();

  function update() {
    const now = new Date();
    if (clockDate && clockTime) {
      clockDate.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
      clockTime.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    
    if (sessionUptime) {
      const diffMs = now.getTime() - startTime;
      const totalSeconds = Math.floor(diffMs / 1000);
      const h = Math.floor(totalSeconds / 3600);
      const m = Math.floor((totalSeconds % 3600) / 60);
      const s = totalSeconds % 60;
      
      let uptimeStr = '';
      if (h > 0) uptimeStr += `${h}h `;
      uptimeStr += `${m}m ${s.toString().padStart(2, '0')}s`;
      sessionUptime.textContent = uptimeStr;
    }
  }

  update();
  setInterval(update, 1000);
}

saveSettingsButton.addEventListener('click', saveThresholds);
loadThresholds();
handleNavigation();
handleSettingsTabs();
handleDisplaySettings();
handleDataManagement();
handleControlButtons();
handleCameraStream();
initTimers();
connectSocket();
