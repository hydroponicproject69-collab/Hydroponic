document.addEventListener('DOMContentLoaded', () => {
  const splashScreen = document.getElementById('splashScreen');
  if (splashScreen) {
    setTimeout(() => {
      splashScreen.classList.add('hidden');
    }, 2000); // Wait for the loading animation to complete
  }
});

// ==================== BACKEND CONFIG ====================
const BACKEND_URL = 'https://hydroponic-ibf4.onrender.com';
const socketServer = BACKEND_URL;

// ==================== GLOBAL DOM ELEMENTS ====================
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

// ==================== SOCKET CONNECTION (SINGLE) ====================
let socket = null;

function connectSocket() {
  if (typeof io !== 'function') {
    overviewConnection.textContent = 'No Socket.IO';
    warningBanner.classList.remove('hidden');
    return;
  }

  // Create ONE connection
  socket = io(socketServer, {
    transports: ['websocket'],
    reconnectionAttempts: 5,
  });

  socket.on('connect', () => setConnection(true));
  socket.on('disconnect', () => setConnection(false));
  socket.on('connect_error', () => setConnection(false));

  // The server emits 'newSensorData' with the exact payload we need
  socket.on('newSensorData', (data) => {
    if (!data) return;
    setConnection(true);

    // Map server keys to the format updateTelemetry() expects
    const mappedData = {
      temperature: Number(data.airTemperature),
      humidity: Number(data.humidity),
      waterTemperature: Number(data.waterTemperature),
      ph: Number(data.ph),
      tds: Number(data.tds),
      waterLevel: Number(data.waterLevel),
      sunlight: Number(data.sunlight),
      pumpRelay: Boolean(data.pump),
      lightRelay: Boolean(data.light),
      mistRelay: Boolean(data.mist),
      shedRelay: Boolean(data.shed),
      timestamp: data.timestamp || new Date().toISOString(),
    };

    updateTelemetry(mappedData);
  });
}

// ==================== UI HELPERS ====================
function setConnection(connected) {
  if (connectionStatus) {
    connectionStatus.classList.toggle('connected', connected);
    const statusText = connectionStatus.querySelector('.status-text');
    if (statusText) statusText.textContent = connected ? 'Connected' : 'Disconnected';
  }
  if (warningBanner) warningBanner.classList.toggle('hidden', connected);
  if (overviewConnection) overviewConnection.textContent = connected ? 'Online' : 'Offline';
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
  } catch {
    return 'Unknown';
  }
}

function clampHistory(array, length = 24) {
  return array.slice(-length);
}

function updateRangeLabels() {
  if (temperatureRangeLabel) temperatureRangeLabel.textContent = 'Stable environment';
  if (humidityRangeLabel) humidityRangeLabel.textContent = 'Target: 45–75%';
  if (waterTempLabel) waterTempLabel.textContent = 'Optimal 18–24°C';
  if (phLabel) phLabel.textContent = 'Target 5.8–6.5';
  if (tdsLabel) tdsLabel.textContent = 'Target 600–1200 ppm';
  if (waterLevelLabel) waterLevelLabel.textContent = 'Tank capacity';
  if (sunlightLabel) sunlightLabel.textContent = 'Ambient light';
}

function updateRobotHealth(telemetry) {
  const values = [
    telemetry.temperature,
    telemetry.humidity,
    telemetry.waterTemperature,
    telemetry.ph,
    telemetry.tds,
    telemetry.waterLevel,
    telemetry.sunlight,
  ];
  const valid = values.filter(v => typeof v === 'number' && !isNaN(v));
  const score = valid.length ? Math.round((valid.length / values.length) * 100) : 0;
  if (overviewHealth) overviewHealth.textContent = `${score}%`;
}

function updateControlState(element, value) {
  if (!element) return;
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

function updateTelemetry(telemetry) {
  const now = Date.now();
  if (now - lastTelemetryTime < currentDisplaySettings.refreshInterval * 1000) {
    return;
  }
  lastTelemetryTime = now;

  let displayAirTemp = telemetry.temperature;
  let displayWaterTemp = telemetry.waterTemperature;

  if (currentDisplaySettings.tempUnit === 'F') {
    displayAirTemp = (displayAirTemp * 9) / 5 + 32;
    displayWaterTemp = (displayWaterTemp * 9) / 5 + 32;
  }

  if (temperatureValue) temperatureValue.textContent = isNaN(displayAirTemp) ? '--' : displayAirTemp.toFixed(1);
  if (humidityValue) humidityValue.textContent = isNaN(telemetry.humidity) ? '--' : telemetry.humidity.toFixed(1);
  if (waterTempValue) waterTempValue.textContent = isNaN(displayWaterTemp) ? '--' : displayWaterTemp.toFixed(1);
  if (phValue) phValue.textContent = isNaN(telemetry.ph) ? '--' : telemetry.ph.toFixed(2);
  if (tdsValue) tdsValue.textContent = isNaN(telemetry.tds) ? '--' : String(Math.round(telemetry.tds));
  if (waterLevelValue) waterLevelValue.textContent = isNaN(telemetry.waterLevel) ? '--' : String(Math.round(telemetry.waterLevel));
  if (sunlightValue) sunlightValue.textContent = isNaN(telemetry.sunlight) ? '--' : String(Math.round(telemetry.sunlight));

  updateControlState(pumpStatus, telemetry.pumpRelay);
  updateControlState(lightStatus, telemetry.lightRelay);
  updateControlState(mistStatus, telemetry.mistRelay);
  updateControlState(shedStatus, telemetry.shedRelay);

  if (lastUpdate) lastUpdate.textContent = formatTimestamp(telemetry.timestamp);
  updateRobotHealth(telemetry);
  updateRangeLabels();
  pushTelemetryHistory(telemetry);
}

function pushTelemetryHistory({ timestamp, temperature, waterLevel }) {
  const label = formatTimestamp(timestamp);
  telemetryHistory.labels.push(label);
  telemetryHistory.temperature.push(isNaN(temperature) ? 0 : temperature);
  telemetryHistory.waterLevel.push(isNaN(waterLevel) ? 0 : waterLevel);
  telemetryHistory.labels = clampHistory(telemetryHistory.labels);
  telemetryHistory.temperature = clampHistory(telemetryHistory.temperature);
  telemetryHistory.waterLevel = clampHistory(telemetryHistory.waterLevel);
  refreshCharts();
}

// ==================== CHARTS ====================
function buildChart(context, label, color, unit) {
  return new Chart(context, {
    type: 'line',
    data: {
      labels: telemetryHistory.labels,
      datasets: [
        {
          label,
          data: label === 'Air Temperature' ? telemetryHistory.temperature : telemetryHistory.waterLevel,
          borderColor: color,
          backgroundColor: color.replace('1)', '0.14)'),
          tension: 0.35,
          pointRadius: 2,
          borderWidth: 2,
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { maxTicksLimit: 6, color: '#9bacd9' } },
        y: { ticks: { color: '#9bacd9' }, grid: { color: 'rgba(255,255,255,0.08)' } },
      },
    },
  });
}

const temperatureChartCtx = document.getElementById('temperatureChart');
const waterLevelChartCtx = document.getElementById('waterLevelChart');
let temperatureChart, waterLevelChart;

if (temperatureChartCtx && waterLevelChartCtx) {
  temperatureChart = buildChart(temperatureChartCtx, 'Air Temperature', 'rgba(77, 139, 255, 1)', '°C');
  waterLevelChart = buildChart(waterLevelChartCtx, 'Water Level', 'rgba(71, 217, 187, 1)', '%');
}

function refreshCharts() {
  if (temperatureChart) {
    temperatureChart.data.labels = telemetryHistory.labels;
    temperatureChart.data.datasets[0].data = telemetryHistory.temperature;
    temperatureChart.update();
  }
  if (waterLevelChart) {
    waterLevelChart.data.labels = telemetryHistory.labels;
    waterLevelChart.data.datasets[0].data = telemetryHistory.waterLevel;
    waterLevelChart.update();
  }
}

// ==================== THRESHOLDS ====================
function loadThresholds() {
  Object.keys(thresholdFields).forEach((key) => {
    const value = localStorage.getItem(key);
    const input = document.getElementById(key);
    if (input) input.value = value !== null ? value : thresholdFields[key];
  });
}

function saveThresholds() {
  Object.keys(thresholdFields).forEach((key) => {
    const input = document.getElementById(key);
    if (!input) return;
    localStorage.setItem(key, input.value || thresholdFields[key]);
  });
  if (settingsMessage) {
    settingsMessage.classList.remove('hidden');
    setTimeout(() => settingsMessage.classList.add('hidden'), 2600);
  }
}

// ==================== CONTROL BUTTONS ====================
function handleControlButtons() {
  document.querySelectorAll('.control-buttons .btn').forEach((button) => {
    button.addEventListener('click', async (event) => {
      event.preventDefault();
      const device = button.getAttribute('data-device');
      const state = parseInt(button.getAttribute('data-state'), 10);

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
      } catch (error) {
        console.error(`Control failed:`, error);
        alert(`Failed to control ${device}. Check console.`);
      }
    });
  });
}

// ==================== NAVIGATION ====================
function handleNavigation() {
  navItems.forEach((item) => {
    item.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = item.getAttribute('href').substring(1);
      const targetSection = document.getElementById(targetId);
      if (!targetSection) return;

      navItems.forEach(n => n.classList.remove('active'));
      item.classList.add('active');
      document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
      targetSection.classList.add('active');
    });
  });
}

// ==================== SETTINGS TABS ====================
function handleSettingsTabs() {
  const tabBtns = document.querySelectorAll('.settings-tabs .tab-btn');
  const tabPanes = document.querySelectorAll('.settings-tab-pane');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      const targetId = btn.getAttribute('data-target');
      tabBtns.forEach(b => b.classList.remove('active'));
      tabPanes.forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      const targetPane = document.getElementById(targetId);
      if (targetPane) targetPane.classList.remove('hidden');
    });
  });
}

// ==================== DATA MANAGEMENT ====================
function handleDataManagement() {
  if (exportCsvBtn) {
    exportCsvBtn.addEventListener('click', () => {
      if (!telemetryHistory.labels.length) { alert('No data to export.'); return; }
      let csv = "data:text/csv;charset=utf-8,Timestamp,Air Temperature (°C),Water Level (%)\n";
      for (let i = 0; i < telemetryHistory.labels.length; i++) {
        csv += `"${telemetryHistory.labels[i]}",${telemetryHistory.temperature[i]},${telemetryHistory.waterLevel[i]}\n`;
      }
      const link = document.createElement('a');
      link.href = encodeURI(csv);
      link.download = `sensor_log_${new Date().toISOString().slice(0,10)}.csv`;
      link.click();
    });
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener('click', () => {
      if (confirm('Clear chart history?')) {
        telemetryHistory.labels = [];
        telemetryHistory.temperature = [];
        telemetryHistory.waterLevel = [];
        refreshCharts();
      }
    });
  }

  if (wipeProtocolBtn) {
    wipeProtocolBtn.addEventListener('click', () => {
      if (confirm('Wipe all settings and data?')) {
        localStorage.clear();
        telemetryHistory.labels = [];
        telemetryHistory.temperature = [];
        telemetryHistory.waterLevel = [];
        refreshCharts();
        loadThresholds();
        saveThresholds();
        alert('System reset.');
      }
    });
  }
}

// ==================== DISPLAY SETTINGS ====================
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

// ==================== CAMERA STREAM ====================
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
      connectCamBtn.style.backgroundColor = '#ff4848';
      if (camStatusBadge) camStatusBadge.innerHTML = 'Connecting... <span class="dot warning"></span>';
      esp32CamStream.src = `${socketServer}/api/camera-stream`;
      esp32CamStream.style.display = 'block';
    } else {
      isStreamActive = false;
      connectCamBtn.textContent = 'Initialize Camera';
      connectCamBtn.style.backgroundColor = '';
      esp32CamStream.src = '';
      if (camStatusBadge) camStatusBadge.innerHTML = 'Disconnected <span class="dot danger"></span>';
    }
  });

  esp32CamStream.onerror = () => {
    if (isStreamActive && camStatusBadge) camStatusBadge.innerHTML = 'Signal Lost <span class="dot danger"></span>';
  };
  esp32CamStream.onload = () => {
    if (isStreamActive && camStatusBadge) camStatusBadge.innerHTML = 'Live Feed <span class="dot success"></span>';
  };

  if (screenshotBtn) {
    screenshotBtn.addEventListener('click', () => {
      if (!isStreamActive || !esp32CamStream.src) { alert('Start the camera first.'); return; }
      try {
        const canvas = document.createElement('canvas');
        canvas.width = esp32CamStream.naturalWidth || 640;
        canvas.height = esp32CamStream.naturalHeight || 480;
        canvas.getContext('2d').drawImage(esp32CamStream, 0, 0);
        const a = document.createElement('a');
        a.href = canvas.toDataURL('image/jpeg');
        a.download = `hydroponic-vision-${Date.now()}.jpg`;
        a.click();
      } catch (e) {
        alert('Screenshot failed.');
      }
    });
  }
}

// ==================== LIVE CLOCK & UPTIME ====================
function initTimers() {
  const clockDate = document.getElementById('liveClockDate');
  const clockTime = document.getElementById('liveClockTime');
  const sessionUptime = document.getElementById('sessionUptime');
  const startTime = Date.now();

  function update() {
    const now = new Date();
    if (clockDate) clockDate.textContent = now.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
    if (clockTime) clockTime.textContent = now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    if (sessionUptime) {
      const diffMs = now.getTime() - startTime;
      const h = Math.floor(diffMs / 3600000);
      const m = Math.floor((diffMs % 3600000) / 60000);
      const s = Math.floor((diffMs % 60000) / 1000);
      sessionUptime.textContent = `${h ? h + 'h ' : ''}${m}m ${s.toString().padStart(2, '0')}s`;
    }
  }
  update();
  setInterval(update, 1000);
}

// ==================== INITIALIZATION ====================
// DOM-free initializations
loadThresholds();
handleNavigation();
handleSettingsTabs();
handleDisplaySettings();
handleDataManagement();
handleControlButtons();
handleCameraStream();
initTimers();
connectSocket();   // Single socket connection – no duplicates

// Attach save button
if (saveSettingsButton) {
  saveSettingsButton.addEventListener('click', saveThresholds);
}
