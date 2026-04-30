#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// --- WiFi configuration ---
const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Set this to your backend URL, including protocol and port if needed.
// Example for local testing: http://192.168.1.100:3000
// Example for deployed backend: https://my-hydro-backend.onrender.com
const char* backendUrl = "http://YOUR_BACKEND_URL/data";
const char* controlStatusUrl = "http://YOUR_BACKEND_URL/api/control/status";

const char* deviceId = "esp32-001";
const unsigned long sendIntervalMs = 3000;
const unsigned long controlCheckIntervalMs = 1000;
const unsigned long reconnectIntervalMs = 5000;

unsigned long lastSendMs = 0;
unsigned long lastControlCheckMs = 0;
unsigned long lastReconnectAttemptMs = 0;

// --- GPIO Pins for relays (adjust based on your setup) ---
const int pumpPin = 16;   // GPIO16 - Pump relay
const int lightPin = 17;  // GPIO17 - Light relay
const int mistPin = 18;   // GPIO18 - Mist relay
const int shedPin = 19;   // GPIO19 - Shed servo relay

// Store current relay states
struct RelayStates {
  int pump = 0;
  int light = 0;
  int mist = 0;
  int shed = 0;
} relayStates;

void setupRelayPins() {
  pinMode(pumpPin, OUTPUT);
  pinMode(lightPin, OUTPUT);
  pinMode(mistPin, OUTPUT);
  pinMode(shedPin, OUTPUT);
  
  digitalWrite(pumpPin, LOW);
  digitalWrite(lightPin, LOW);
  digitalWrite(mistPin, LOW);
  digitalWrite(shedPin, LOW);
  
  Serial.println("Relay pins initialized.");
}

void setRelay(const char* device, int state) {
  int pin = -1;
  
  if (strcmp(device, "pump") == 0) {
    pin = pumpPin;
    relayStates.pump = state;
  } else if (strcmp(device, "light") == 0) {
    pin = lightPin;
    relayStates.light = state;
  } else if (strcmp(device, "mist") == 0) {
    pin = mistPin;
    relayStates.mist = state;
  } else if (strcmp(device, "shed") == 0) {
    pin = shedPin;
    relayStates.shed = state;
  }
  
  if (pin != -1) {
    digitalWrite(pin, state ? HIGH : LOW);
    Serial.print("Set ");
    Serial.print(device);
    Serial.print(" to ");
    Serial.println(state ? "ON" : "OFF");
  }
}

void connectToWiFi() {
  if (WiFi.status() == WL_CONNECTED) {
    return;
  }

  Serial.print("Connecting to WiFi");
  WiFi.begin(ssid, password);
  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < 10000) {
    delay(500);
    Serial.print(".");
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\nWiFi connected.");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\nWiFi connection failed. Will retry in background.");
  }
}

float randomTemperature() {
  return random(220, 351) / 10.0; // 22.0 - 35.0
}

int randomHumidity() {
  return random(40, 81); // 40 - 80
}

float randomWaterTemp() {
  return random(180, 240) / 10.0; // 18.0 - 24.0
}

float randomPh() {
  return random(58, 66) / 10.0; // 5.8 - 6.6
}

int randomTds() {
  return random(600, 1200); // 600 - 1200 ppm
}

int randomWaterLevel() {
  return random(30, 101); // 30 - 100%
}

int randomSunlight() {
  return random(20, 101); // 20 - 100%
}

void sendSensorData() {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("Not connected to WiFi. Skipping send.");
    return;
  }

  HTTPClient http;
  http.begin(backendUrl);
  http.addHeader("Content-Type", "application/json");

  float temperature = randomTemperature();
  int humidity = randomHumidity();
  float waterTemperature = randomWaterTemp();
  float ph = randomPh();
  int tds = randomTds();
  int waterLevel = randomWaterLevel();
  int sunlight = randomSunlight();

  StaticJsonDocument<300> payload;
  payload["temperature"] = temperature;
  payload["humidity"] = humidity;
  payload["waterTemperature"] = waterTemperature;
  payload["ph"] = ph;
  payload["tds"] = tds;
  payload["waterLevel"] = waterLevel;
  payload["sunlight"] = sunlight;
  payload["pumpRelay"] = relayStates.pump;
  payload["lightRelay"] = relayStates.light;
  payload["mistRelay"] = relayStates.mist;
  payload["shedRelay"] = relayStates.shed;
  payload["deviceId"] = deviceId;
  payload["timestamp"] = millis();

  String body;
  serializeJson(payload, body);

  Serial.println("Sending payload:");
  Serial.println(body);

  int httpResponseCode = http.POST(body);

  if (httpResponseCode > 0) {
    Serial.print("HTTP Response code: ");
    Serial.println(httpResponseCode);
  } else {
    Serial.print("Error sending data: ");
    Serial.println(http.errorToString(httpResponseCode));
  }

  http.end();
}

void checkControlCommands() {
  if (WiFi.status() != WL_CONNECTED) {
    return;
  }

  HTTPClient http;
  http.begin(controlStatusUrl);
  
  int httpResponseCode = http.GET();
  
  if (httpResponseCode == 200) {
    String payload = http.getString();
    DynamicJsonDocument doc(512);
    deserializeJson(doc, payload);
    
    JsonObject commands = doc["commands"];
    if (!commands.isNull()) {
      if (commands.containsKey("pump")) {
        setRelay("pump", commands["pump"].as<int>());
      }
      if (commands.containsKey("light")) {
        setRelay("light", commands["light"].as<int>());
      }
      if (commands.containsKey("mist")) {
        setRelay("mist", commands["mist"].as<int>());
      }
      if (commands.containsKey("shed")) {
        setRelay("shed", commands["shed"].as<int>());
      }
    }
  } else if (httpResponseCode != -1) {
    Serial.print("Error checking controls: ");
    Serial.println(httpResponseCode);
  }
  
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(100);
  Serial.println("Smart Hydroponic Monitor ESP32 Sender");
  setupRelayPins();
  connectToWiFi();
}

void loop() {
  unsigned long now = millis();

  if (WiFi.status() != WL_CONNECTED && now - lastReconnectAttemptMs >= reconnectIntervalMs) {
    lastReconnectAttemptMs = now;
    connectToWiFi();
  }

  if (now - lastSendMs >= sendIntervalMs) {
    lastSendMs = now;
    sendSensorData();
  }

  if (now - lastControlCheckMs >= controlCheckIntervalMs) {
    lastControlCheckMs = now;
    checkControlCommands();
  }
}
