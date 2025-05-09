# Live API Web Console Architecture

## Key Update: Phone Number in Bookings
- All appointment bookings now require a `phoneNumber` (string) field.
- The `Appointment` type includes `phoneNumber`.
- Phone numbers are displayed in all relevant UI components (calendar, lists, booking/cancellation results).
- System prompt instructs the AI to always collect and validate a phone number for every booking.

## Overview

The Live API Web Console is a React-based web application that provides a real-time interface for interacting with the Gemini API. The application enables:

- Bidirectional audio streaming
- Text-based conversation
- Video/screen capture capabilities
- Calendar visualization for demonstration purposes
- Function calling capabilities for appointment booking and management

## Directory Structure

```
├── public/            # Static assets
├── src/               # Application source code
│   ├── components/    # UI components
│   ├── contexts/      # React context providers
│   ├── hooks/         # Custom React hooks
│   ├── lib/           # Core utilities and client implementation
│   └── multimodal-live-types.ts  # Type definitions
├── data/              # Static data files
└── prompts/           # Prompt templates
```

## Core Components

### API Communication Layer

- **MultimodalLiveClient** (`src/lib/multimodal-live-client.ts`): Core client class that handles WebSocket communication with the Gemini API. It manages connection, message handling, and event emission.

- **LiveAPIContext** (`src/contexts/LiveAPIContext.tsx`): React context provider that makes the client accessible throughout the application.

- **useLiveAPI** (`src/hooks/use-live-api.ts`): Hook that manages connection state, configuration, and audio handling for the LiveAPI client.

### Audio Handling

- **AudioStreamer** (`src/lib/audio-streamer.ts`): Handles audio streaming and processing from the API to the user's speakers.

- **AudioRecorder** (`src/lib/audio-recorder.ts`): Captures audio from the user's microphone for streaming to the API.

- **Audio Worklets** (`src/lib/worklets/`): Web Audio API worklets for audio processing (e.g., volume metering).

### Video Handling

- **useWebcam** (`src/hooks/use-webcam.ts`): Hook for accessing and managing webcam streams.

- **useScreenCapture** (`src/hooks/use-screen-capture.ts`): Hook for capturing and managing screen sharing streams.

- **useMediaStreamMux** (`src/hooks/use-media-stream-mux.ts`): Utility hook for combining audio and video streams.

### UI Components

- **SidePanel** (`src/components/side-panel/SidePanel.tsx`): Main conversation interface with text input and message display.

- **ControlTray** (`src/components/control-tray/ControlTray.tsx`): UI controls for managing audio, video, and connection settings.

- **SimpleCalendar** (`src/components/simple-calendar/SimpleCalendar.tsx`): Interactive calendar showing weekly time slots and appointment details.

- **SalonReceptionist** (`src/components/salon-receptionist/SalonReceptionist.tsx`): Demonstration of function calling capabilities for a salon booking system, with appointment availability checks, booking, and cancellation.

- **Logger** (`src/components/logger/Logger.tsx`): Displays logs of API activity.

### State Management

- **Zustand Store** (`src/lib/store-logger.ts`): Manages logging state using Zustand.

- **React Context**: Used for providing access to the LiveAPI client throughout the app.

## Demo Features

### Salon Appointment System

The salon appointment system showcases Gemini's function calling capabilities with:

1. **Availability Checking**: Search for open time slots by date or across the week
2. **Appointment Booking**: Book appointments with customer name, date, time, and service
3. **Appointment Cancellation**: Cancel appointments using customer name, with disambiguation when needed

All functions include natural language processing for inputs like "today", "tomorrow", and day names.

## Data Flow

1. **Connection Initialization**:
   - LiveAPIProvider initializes the client with API key and URL
   - User connects via UI controls

2. **Audio/Video Streaming**:
   - User's audio/video is captured and streamed to the API
   - API responses are processed and output to the user

3. **Text Conversation**:
   - Text inputs are sent to the API via the client
   - Responses are displayed in the SidePanel

4. **Function Calling**:
   - AI recognizes when to invoke salon functions based on user requests
   - Function responses are processed and displayed in the UI
   - Calendar updates in real-time to reflect changes

## Type System

The application uses TypeScript throughout with comprehensive type definitions in `src/multimodal-live-types.ts` for:

- API request/response messages
- Client configuration
- Model responses
- Tool calls
- Appointment data structures

## Key Interactions

- **API Connection**: Managed through LiveAPIContext and the MultimodalLiveClient
- **Audio Processing**: Bidirectional streaming through AudioStreamer and AudioRecorder
- **UI Controls**: Managed via ControlTray component
- **Conversations**: Handled through SidePanel component
- **Appointment Management**: Handled via SalonReceptionist component with function calling

## Design Patterns

- **Event Emitter**: The client uses an event-based architecture for handling API messages
- **React Context**: For global state and service provision
- **Custom Hooks**: For encapsulating complex behavior
- **Type Guards**: For runtime type safety when handling API responses
- **Function Calling**: For structured interaction between the AI and the application
