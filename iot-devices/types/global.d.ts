import type { MqttClient } from 'mqtt';

declare global {
    var MQTT_CLIENT: MqttClient;
}

export {};
