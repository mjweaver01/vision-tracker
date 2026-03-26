# Vision Tracker

A browser-based object detection app that identifies objects in a camera stream using ML. Displays live camera feed with bounding boxes and captures snapshots when objects are detected.

## Tech Stack

- **Backend**: Bun (HTTP server)
- **Frontend**: React, Tailwind CSS v4 (via bun-plugin-tailwind)
- **Video**: Browser WebRTC / getUserMedia API
- **Object detection**: MediaPipe Object Detector (EfficientDet-Lite0) for real-time object identification

## Requirements

- **Browser**: Modern browser with camera support (Chrome, Firefox, Safari, Edge)
- **HTTPS or localhost**: Camera access requires a secure context (localhost works for development)

## Project Setup

```bash
bun install
```

## Development

Run the Bun server (serves API and client with hot reload):

```bash
bun run dev
```

- **Server**: http://localhost:3000 (API + React app)

## Production

Build and start the server:

```bash
bun run build
bun run start
```

The build bundles the server and client. The server runs on port 3000.

## Configuration

- **Confidence threshold**: Minimum confidence (0-100%) for object detection to trigger a snapshot.
- **Object types**: Leave empty to detect all objects, or select specific types (person, car, dog, etc.).
- **Detection FPS**: How many frames per second to run object detection (1-30).
- **Capture interval**: Cooldown between snapshots in milliseconds.

Config is persisted in `config.json` and can be changed via the web UI.

## API

| Endpoint              | Method | Description                                          |
| --------------------- | ------ | ---------------------------------------------------- |
| `/api/config`         | GET    | Get current config                                   |
| `/api/config`         | POST   | Update config                                        |
| `/api/recordings`     | GET    | List snapshot metadata                               |
| `/api/recordings/:id` | GET    | Download a snapshot (JPEG)                           |
| `/api/recordings`     | POST   | Upload snapshot (multipart: image, detections)       |
