# Function Calling Implementation Guide

## Overview

This document provides instructions on how to implement function calling in the Gemini Live API Web Console. Function calling allows the Gemini AI model to invoke specific functions defined in your application to perform actions or retrieve information.

## Architecture

The function calling implementation consists of three main parts:

1. **Function Declaration**: A JSON schema that defines the function name, description, parameters, and their types
2. **Tool Call Listener**: Event handler that executes when the model calls the function
3. **Response Mechanism**: Logic to send results back to the model

## Implementation Steps

### 1. Create a New Component

Create a new component in the `src/components/` directory:

```typescript
// src/components/my-feature/MyFeature.tsx
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";

function MyFeatureComponent() {
  const { client, setConfig } = useLiveAPIContext();
  
  // Component state and logic goes here
  
  return (
    <div className="my-feature">
      {/* Component UI */}
    </div>
  );
}

export const MyFeature = MyFeatureComponent;
```

### 2. Define Function Declaration

Define your function using the `FunctionDeclaration` type:

```typescript
const myFunctionDeclaration: FunctionDeclaration = {
  name: "my_function_name",
  description: "Description of what this function does",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      // Define your parameters here
      paramName: {
        type: SchemaType.STRING, // Or NUMBER, BOOLEAN, etc.
        description: "Description of this parameter",
      },
      // Add more parameters as needed
    },
    required: ["paramName"], // List required parameters
  },
};
```

### 3. Configure the Model

Register your function with the model using the `setConfig` method:

```typescript
useEffect(() => {
  setConfig({
    model: "models/gemini-2.0-flash-exp",
    systemInstruction: {
      parts: [
        {
          text: 'System instructions that tell the model when to use your function. When you receive function results, formulate a natural response based on the data - do not read out the raw data.',
        },
      ],
    },
    tools: [
      { functionDeclarations: [myFunctionDeclaration] },
      // Add more tools if needed
    ],
  });
}, [setConfig]);
```

### 4. Set Up the Tool Call Listener

Implement a listener for function calls:

```typescript
useEffect(() => {
  const onToolCall = (toolCall: ToolCall) => {
    console.log(`Got tool call`, toolCall);
    const fc = toolCall.functionCalls.find(
      (fc) => fc.name === myFunctionDeclaration.name
    );
  
    if (fc) {
      // Extract arguments
      const args = fc.args;
  
      // Execute your function logic
      const result = myFunctionImplementation(args);
  
      // Send response back to the model
      client.sendToolResponse({
        functionResponses: [{
          response: result,
          id: fc.id,
        }],
      });
    }
  };
  
  client.on("toolcall", onToolCall);
  return () => {
    client.off("toolcall", onToolCall);
  };
}, [client]);
```

### 5. Add the Component to App.tsx

Import and use your component in the App:

```typescript
import { MyFeature } from "./components/my-feature/MyFeature";

// Inside the App component's return statement:
<div className="main-app-area">
  <MyFeature />
  {/* Other components */}
</div>
```

## Manager Communication Implementation

The manager communication feature allows the AI to escalate special requests to a manager and incorporate responses into the conversation.

### ManagerMessage Type

Define the type for storing manager messages:

```typescript
type ManagerMessage = {
  id: string;
  clientRequest: string;
  reason: string;
  priority: 'normal' | 'urgent';
  timestamp: number;
  response?: string;
  responseTimestamp?: number;
  status: 'pending' | 'responded';
};
```

### Function Declaration for Manager Escalation

```typescript
const sendMessageToManagerDeclaration: FunctionDeclaration = {
  name: "send_message_to_manager",
  description: "Sends a message to the salon manager for special requests, discounts, or to handle complaints",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      client_request: {
        type: SchemaType.STRING,
        description: "The client's original request or question that needs manager attention"
      },
      reason: {
        type: SchemaType.STRING,
        description: "Reason for escalating this to the manager (e.g., discount request, complaint, special accommodation)"
      },
      priority: {
        type: SchemaType.STRING,
        description: "The urgency level of the request",
        enum: ["normal", "urgent"]
      }
    },
    required: ["client_request", "reason"]
  }
};
```

### Managing State for Manager Messages

```typescript
// Inside your component:
const [managerMessages, setManagerMessages] = useState<ManagerMessage[]>([]);
const [showManagerInbox, setShowManagerInbox] = useState<boolean>(false);
const [lastManagerMessage, setLastManagerMessage] = useState<ManagerMessage | null>(null);
```

### System Instructions for AI

Include guidance for the AI on when to escalate to a manager in the system instructions:

```typescript
systemInstruction: {
  parts: [
    {
      text: `
      // Existing instructions...
      
      MANAGER COMMUNICATION:
      - Use the send_message_to_manager function to escalate special requests to the salon manager.
      - Always escalate to the manager in these situations:
        * Discount requests over 20%
        * Special accommodations outside normal policies
        * Client complaints or concerns about previous services
        * Requests for services not listed in the service menu
        * Payment issues or disputes
      - When sending a message to the manager, be detailed about the client request and reason for escalation.
      - If the manager has responded to a previous message, incorporate their guidance into your response to the client.
      
      // Other instructions...
      `,
    },
  ],
},
```

### Tool Call Handler for Manager Communication

```typescript
const sendMessageToManagerCall = toolCall.functionCalls.find(
  (fc) => fc.name === sendMessageToManagerDeclaration.name
);

if (sendMessageToManagerCall) {
  const args = sendMessageToManagerCall.args as {
    client_request: string;
    reason: string;
    priority?: string;
  };
  
  // Create a new manager message
  const newMessage: ManagerMessage = {
    id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
    clientRequest: args.client_request,
    reason: args.reason,
    priority: (args.priority === 'urgent') ? 'urgent' : 'normal',
    timestamp: Date.now(),
    status: 'pending'
  };
  
  // Add to manager messages list
  setManagerMessages(prevMessages => [...prevMessages, newMessage]);
  
  // Set as last message for UI display
  setLastManagerMessage(newMessage);
  
  // Send response back to the model
  client.sendToolResponse({
    functionResponses: [{
      response: {
        success: true,
        message_id: newMessage.id,
        status: 'sent',
        message: `I've sent your request to the manager regarding: ${args.reason}. The manager will review your request${newMessage.priority === 'urgent' ? ' as soon as possible' : ' shortly'}.`
      },
      id: sendMessageToManagerCall.id,
    }],
  });
}
```

### Manager Response UI

Create a UI for the manager to view and respond to messages:

```tsx
{showManagerInbox && (
  <div className="manager-inbox">
    <h3>Manager Inbox</h3>
    {managerMessages.length === 0 ? (
      <p>No messages from salon receptionist.</p>
    ) : (
      <div className="message-list">
        {managerMessages.map((message) => (
          <div 
            key={message.id} 
            className={`message-item ${message.status} ${message.priority}`}
          >
            {/* Message details */}
            {message.status === 'pending' ? (
              <div className="response-form">
                <textarea 
                  placeholder="Type your response here..."
                  id={`response-${message.id}`}
                  rows={3}
                />
                <button 
                  onClick={() => {
                    const responseText = (document.getElementById(`response-${message.id}`) as HTMLTextAreaElement)?.value;
                    if (responseText) {
                      // Update message with response
                      setManagerMessages(messages => 
                        messages.map(msg => 
                          msg.id === message.id 
                            ? {
                                ...msg,
                                response: responseText,
                                responseTimestamp: Date.now(),
                                status: 'responded'
                              }
                            : msg
                        )
                      );
                      
                      // Send response to AI
                      client.send([{ 
                        text: `MANAGER RESPONSE for request ID ${message.id}: ${responseText}`
                      }]);
                    }
                  }}
                >
                  Send Response
                </button>
              </div>
            ) : (
              <div className="response-display">
                {/* Show response */}
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>
)}
```

## Preventing Raw Function Results in Audio Responses

- **Result Structure**: Structure your function results to be easily processed by the model. Include a `message` field with a natural language description that the model can incorporate into its response.

#### Best Practices:

- Include clear instructions in your system prompt about handling function results
- Structure function results to include natural language descriptions
- For complex data like appointment availability, include a pre-formatted `message` field
- Keep testing the responses to ensure the model is presenting the information naturally

## Implementation Example: Salon Appointment Availability

### The `check_availability` Function

This function allows the AI to check appointment availability in a salon calendar. It demonstrates how to implement a flexible function that handles different query types.

#### Function Declaration

```typescript
const checkAvailabilityDeclaration: FunctionDeclaration = {
  name: "check_availability",
  description: "Checks for available appointment slots in the nail salon calendar",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: {
        type: SchemaType.STRING,
        description: "The date to check - can be in YYYY-MM-DD format, a day name (Monday, Tuesday, etc), or keywords like 'today' or 'tomorrow'. If not provided, will return availability for the current week."
      },
      time: {
        type: SchemaType.STRING,
        description: "Optional. The specific time to check in HH:MM format (24-hour)."
      }
    },
    required: []
  }
};
```

#### Implementation Logic

The function handles three different query types:

1. **Specific date and time check**

   ```typescript
   // When both date and time are provided
   if (args.date && args.time) {
     const available = !isSlotBooked(date, time);

     response = {
       date: date,
       time: time,
       available: available,
       message: available 
         ? `${time} on ${formatDate(date)} is available for booking.` 
         : `Sorry, ${time} on ${formatDate(date)} is already booked.`
     };
   }
   ```
2. **All available slots for a date**

   ```typescript
   // When only date is provided
   else if (args.date) {
     const availableSlots = getAvailableSlots(date);

     response = {
       date: date,
       available_slots: availableSlots,
       message: availableSlots.length > 0
         ? `There are ${availableSlots.length} available slots on ${formatDate(date)}: ${availableSlots.join(', ')}`
         : `Sorry, there are no available slots on ${formatDate(date)}.`
     };
   }
   ```
3. **Weekly availability overview**

   ```typescript
   // When no specific date is provided
   else {
     const weekDates = getWeekDates();
     const weekAvailability = {};
     let totalAvailableSlots = 0;

     weekDates.forEach(day => {
       const availableSlots = getAvailableSlots(day.date);
       weekAvailability[day.date] = availableSlots;
       totalAvailableSlots += availableSlots.length;
     });

     response = {
       week_of: weekDates[0].date,
       availability: weekAvailability,
       message: `There are ${totalAvailableSlots} available slots this week.`
     };
   }
   ```

#### Using the Function

The AI can be prompted to check availability in various ways:

- "Do you have any availability this Thursday at 2pm?"
- "What times are available next Tuesday?"
- "Show me your availability for this week"

#### Extending the Function

To extend this function, you might:

1. Add a `service` parameter to filter slots by required duration
2. Include staff availability for specific services
3. Add a booking confirmation flow after checking availability
4. Implement recurring appointment checks

## Example: Current Date and Time Function

Here's a complete example of a function that returns the current date and time:

```typescript
/**
 * DateTime component that provides a function to get the current date and time
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import "./date-time.scss";

// Define the function declaration
const getCurrentDateTimeDeclaration: FunctionDeclaration = {
  name: "get_current_datetime",
  description: "Returns the current date and time.",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {},
    required: [],
  },
};

function DateTimeComponent() {
  const [dateTime, setDateTime] = useState<string | null>(null);
  const { client, setConfig } = useLiveAPIContext();

  useEffect(() => {
    // Configure the model with our date time function
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      systemInstruction: {
        parts: [
          {
            text: 'You can help the user get the current date and time. When they ask for the current time or date, use the "get_current_datetime" function. When you receive the function results, provide a natural response - do not read out the raw data.',
          },
        ],
      },
      tools: [
        { functionDeclarations: [getCurrentDateTimeDeclaration] },
      ],
    });
  }, [setConfig]);

  useEffect(() => {
    // Handle function calls
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`Got tool call`, toolCall);
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === getCurrentDateTimeDeclaration.name
      );
  
      if (fc) {
        // Get current date and time
        const now = new Date();
        const formattedDateTime = now.toLocaleString();
    
        // Update the state
        setDateTime(formattedDateTime);
    
        // Send response back to the model
        client.sendToolResponse({
          functionResponses: [{
            response: { 
              current_datetime: formattedDateTime,
              timestamp: now.getTime(),
              message: `The current date and time is ${formattedDateTime}.`
            },
            id: fc.id,
          }],
        });
      }
    };
  
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client]);

  return (
    <div className="date-time-component">
      <h2>Current Date & Time Function</h2>
      {dateTime ? (
        <div className="current-time">
          <p>Last requested date/time: <strong>{dateTime}</strong></p>
        </div>
      ) : (
        <p>Ask the AI for the current date and time</p>
      )}
    </div>
  );
}

export const DateTime = DateTimeComponent;
```

## Enhanced Calendar System

The expanded calendar system supports multi-week navigation and improved appointment management:

### Key Features

1. **Advanced Navigation Controls**
   - Week-based navigation (Previous Week, Current Week, Next Week)
   - Month-based navigation (Previous Month, Next Month)
   - Current week auto-detection and highlighting

2. **Enhanced Date Processing**
   - Support for natural language date inputs:
     - Day names ("Monday", "Tuesday", etc.)
     - Relative dates ("today", "tomorrow")
     - Future periods ("next week", "in two weeks")
   - Specific day targeting ("next week's Monday")

3. **Improved Appointment Visibility**
   - Filter toggle between current week and all appointments
   - Week label showing current date range in view
   - Highlighted appointments for better visibility

### Implementation Approach

The calendar system uses a stateful approach to manage the currently viewed time period:

```typescript
// Types for enhanced calendar state
export type CalendarState = {
  currentDate: string; // YYYY-MM-DD of selected date
  weekStartDate: Date; // Date object of the week's start (Monday)
};

// State management
const [weekStartDate, setWeekStartDate] = useState<Date>(getMondayOfCurrentWeek());
const [weekDates, setWeekDates] = useState<{ date: string, label: string }[]>(getWeekDates(getMondayOfCurrentWeek()));
const [showAllAppointments, setShowAllAppointments] = useState(false);
```

### Function Call Integration

The `check_availability` function has been enhanced to support expanded date queries:

```typescript
const checkAvailabilityDeclaration: FunctionDeclaration = {
  name: "check_availability",
  description: "Checks for available appointment slots in the nail salon calendar",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: {
        type: SchemaType.STRING,
        description: "The date to check - can be in YYYY-MM-DD format, a day name (Monday, Tuesday, etc), or keywords like 'today', 'tomorrow', 'next week', 'in two weeks'. If not provided, will return availability for the current week."
      },
      time: {
        type: SchemaType.STRING,
        description: "Optional. The specific time to check in HH:MM format (24-hour)."
      }
    },
    required: []
  }
};
```

This function now handles three query types:
1. Specific date and time check
2. All available slots for a specific date
3. Weekly availability overview for any week (current, next, or specified period)

### Date Processing Logic

The advanced date processing supports sophisticated date identification:

```typescript
// Example of parsing "next week Tuesday"
if (lowerDateInput.includes('next week')) {
  const dayMatch = lowerDateInput.match(/next week('s)?\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
  if (dayMatch && dayMatch[2]) {
    const targetDay = dayMatch[2].toLowerCase();
    return getDayNameDateNextWeek(targetDay);
  }
}
```

### UI Improvements

The calendar UI has been enhanced with:
- Week date range label
- Color-coded navigation buttons
- Appointment filtering controls
- Improved styling for better readability
- Responsive grid layouts for appointment lists

## Best Practices

1. **State Management**: Maintain a clear state model for your calendar (current view, selected dates, etc.)
2. **Date Standardization**: Normalize all date inputs to a consistent format (YYYY-MM-DD) internally
3. **Navigation Helper Functions**: Create reusable functions for date navigation and manipulation
4. **UI Feedback**: Provide clear visual indicators for the current date range and selected appointments
5. **Filter Options**: Allow users to control how appointments are displayed
6. **Performance**: Implement filtering to limit the number of appointments rendered at once

## Common Issues

- **Function Not Being Called**: Check your system instructions and make sure they clearly indicate when the function should be used
- **Parameter Type Mismatch**: Ensure parameter types in the declaration match what your implementation expects
- **Missing Response**: Always send a response back to the model using `client.sendToolResponse`
- **Multiple Functions**: When implementing multiple functions, make sure each has a unique name
- **Raw Results Read Aloud**: If the model is reading out raw function results, add explicit instructions in your system prompt and include a natural language `message` field in your responses

## Enhanced Date Handling for check_availability

### Date Input Processing

The `check_availability` function supports various date input formats:

1. **YYYY-MM-DD format**: Standard date format (e.g., "2024-07-10")
2. **Day names**: Days of the week (e.g., "Monday", "Tuesday", "Wednesday")
3. **Keywords**: Special terms like "today" and "tomorrow"

### Implementation Steps

1. **Update Function Description**:
   ```typescript
   const checkAvailabilityDeclaration: FunctionDeclaration = {
     // ... existing code ...
     parameters: {
       type: SchemaType.OBJECT,
       properties: {
         date: {
           type: SchemaType.STRING,
           description: "The date to check - can be in YYYY-MM-DD format, a day name (Monday, Tuesday, etc), or keywords like 'today' or 'tomorrow'. If not provided, will return availability for the current week."
         },
         // ... other parameters ...
       }
     }
   };
   ```

2. **Add Date Processing Functions**:
   ```typescript
   // Process date input (handles keywords and day names)
   const processDateInput = (dateInput: string): string => {
     if (!dateInput) return '';
     
     const today = new Date();
     const tomorrow = new Date(today);
     tomorrow.setDate(today.getDate() + 1);
     
     // Handle special keywords
     switch (dateInput.toLowerCase()) {
       case 'today':
         return today.toISOString().split('T')[0]; // YYYY-MM-DD
       case 'tomorrow':
         return tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
       default:
         // Check if it's a day name
         if (isDayName(dateInput)) {
           return getDayNameToDate(dateInput);
         }
         // Assume it's already in YYYY-MM-DD format
         return dateInput;
     }
   };
   
   // Check if input is a day name
   const isDayName = (input: string): boolean => {
     const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
     return days.includes(input.toLowerCase());
   };
   
   // Convert day name to next occurrence date
   const getDayNameToDate = (dayName: string): string => {
     const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
     const today = new Date();
     const todayDayIndex = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
     
     // Find day index and calculate days to add
     const targetDayIndex = days.findIndex(day => day === dayName.toLowerCase());
     let daysToAdd = targetDayIndex - todayDayIndex;
     
     // If day has passed this week, get next week's occurrence
     if (daysToAdd <= 0) daysToAdd += 7;
     
     // Create new date
     const targetDate = new Date(today);
     targetDate.setDate(today.getDate() + daysToAdd);
     
     return targetDate.toISOString().split('T')[0];
   };
   ```

3. **Include Today's Date in System Instructions**:
   ```typescript
   // Get today's date for system instructions
   const today = new Date();
   const formattedToday = today.toLocaleDateString('en-US', { 
     weekday: 'long', 
     year: 'numeric', 
     month: 'long', 
     day: 'numeric' 
   });
   
   setConfig({
     // ... existing config ...
     systemInstruction: {
       parts: [
         {
           text: `Today's date is ${formattedToday}. You are a helpful nail salon receptionist. Use the check_availability function when clients ask about available appointments. They may ask about specific dates, times, or use terms like "today", "tomorrow", or day names (e.g., "Wednesday"). When you receive function results, formulate a natural response based on the data.`,
         },
       ],
     },
     // ... rest of config ...
   });
   ```

4. **Process Date in Function Handler**:
   ```typescript
   // Inside the function call handler
   const dateToCheck = args.date ? processDateInput(args.date) : '';
   ```

### Best Practices

1. **Date Format Consistency**: Always convert different date inputs to YYYY-MM-DD format internally
2. **Context Awareness**: Include today's date in system instructions for better AI context
3. **Error Handling**: Add safeguards for invalid date formats
4. **User-Friendly Responses**: Format dates in natural language for display (e.g., "Monday, June 10")
5. **Logging**: Add console logs during date processing for easier debugging

### Example Prompts

Users can now ask questions like:
- "Do you have any availability today at 2pm?"
- "What times are free tomorrow?"
- "Is Tuesday at 10am available?"
- "Show me slots for next Wednesday"

# Salon Receptionist Demo Documentation

## Overview

The Salon Receptionist demo showcases Gemini's ability to use function calling for a practical application. It simulates a nail salon's appointment system where users can:

1. Check availability of time slots
2. Book new appointments with preferred technicians
3. Cancel existing appointments

The demo includes comprehensive salon information including services, pricing, technician specialties, and policies.

## Component Structure

The demo is built with two main components:

1. **SalonReceptionist** (`src/components/salon-receptionist/SalonReceptionist.tsx`)
   - Implements function declarations and handlers
   - Manages appointment state
   - Displays availability and booking results
   - Contains detailed salon information in system instructions

2. **SimpleCalendar** (`src/components/simple-calendar/SimpleCalendar.tsx`)
   - Visualizes weekly appointments in calendar format
   - Shows available and booked time slots
   - Highlights dates and provides appointment details
   - Displays technician assignments

## Function Capabilities

### 1. Check Availability (`check_availability`)

Checks for open appointment slots with flexible date/time inputs:

```typescript
// Example usage
"Are there any appointments available tomorrow?"
"What times are open on Friday?" 
"Is 2pm available on Thursday?"
```

Parameters:
- `date` (optional): Date to check in YYYY-MM-DD format or natural language ("today", "tomorrow", day names)
- `time` (optional): Specific time to check in HH:MM format

Returns:
- Available slots for specific date/time or across the week
- Formatted messages about availability status

### 2. Book Appointment (`book_appointment`)

Creates new appointments in the calendar:

```typescript
// Example usage
"Book an appointment for Maria on Thursday at 11am for a gel manicure"
"I'd like to schedule a pedicure for John tomorrow at 3pm with Cammy"
```

Parameters:
- `date`: Date for the appointment
- `time`: Time slot in HH:MM format
- `customerName`: Name of the customer
- `phoneNumber`: Customer's phone number (required)
- `service`: Service being booked
- `technician` (optional): Preferred technician for the service

Returns:
- Success/failure status
- Details of the booked appointment
- Error message if slot is unavailable

### 3. Cancel Appointment (`cancel_appointment`)

Cancels existing appointments by customer name:

```typescript
// Example usage
"Cancel Sarah's appointment"
"I need to cancel Mike's appointment on Wednesday"
```

Parameters:
- `customer_name`: Name of the customer
- `date` (optional): Date of the appointment to disambiguate
- `time` (optional): Time of the appointment to disambiguate

Returns:
- Success/failure status
- Details of the cancelled appointment
- List of appointments if multiple found

## Implementation Details

### Date Processing

The component includes helper functions to handle natural language date inputs:

- `processDateInput()`: Converts "today", "tomorrow", or day names to YYYY-MM-DD format
- `formatDate()`: Converts dates to human-readable format (e.g., "Monday, June 10")

### Appointment Storage

Appointments are stored in React state with the following structure:

```typescript
type Appointment = {
  id: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerName: string;
  phoneNumber: string;
  service: string;
  technician?: string; // Optional preferred technician
};
```

### Salon Information

The system instructions include comprehensive details about the salon:

- Complete service menu with prices
- Technician information and specialties
- Salon policies and operating hours
- Special offerings and add-on services

This information allows the AI to provide accurate responses about services, make appropriate technician recommendations, and handle specific requests.

### UI Feedback

The component provides visual feedback for each action:
- Green success indicators for successful bookings
- Red error indicators for failed operations
- Yellow/amber indicators for cancellations
- List views for multiple appointment scenarios

## Conversation Flow

1. User asks about availability, booking, cancellation, or salon information
2. Gemini recognizes the intent and calls the appropriate function or provides information
3. For function calls, the function executes and returns structured data
4. Gemini formulates natural language response based on function results or system knowledge
5. UI updates to reflect changes and provide visual feedback

## Integration

The SalonReceptionist component integrates with the LiveAPI context for function calling:

```typescript
const { client, setConfig } = useLiveAPIContext();

// Configure function declarations and system instructions
useEffect(() => {
  setConfig({
    tools: [
      { functionDeclarations: [
          checkAvailabilityDeclaration, 
          bookAppointmentDeclaration, 
          cancelAppointmentDeclaration
        ] 
      },
    ],
    systemInstruction: {
      parts: [
        {
          text: `Today's date is ${formattedToday}. 
          
You are a receptionist from Madison Valgari Nails Salon...
// Detailed salon information, services, and policies
...
`
        }
      ]
    }
  });
}, []);
```

## Key Update: Phone Number as Primary Identifier for Appointment Management

The salon appointment system now uses phone numbers as the primary identifier for booking and cancelling appointments:

### Phone Number Handling Implementation

1. **Normalized Phone Number Matching**:
   - All phone numbers are normalized by removing non-digit characters (`(`, `)`, `-`, spaces)
   - System performs two-stage matching:
     * Exact matching on normalized numbers
     * Fallback to partial matching using last 7 digits if no exact match found

2. **Function Declaration Update**:
   ```typescript
   const cancelAppointmentDeclaration: FunctionDeclaration = {
     name: "cancel_appointment",
     description: "Cancels an existing appointment using phone number as primary identifier",
     parameters: {
       properties: {
         phone_number: {
           type: SchemaType.STRING,
           description: "Phone number of the customer (primary identifier)."
         },
         customer_name: {
           type: SchemaType.STRING,
           description: "Optional. Name of the customer for confirmation."
         },
         // Other parameters...
       },
       required: ["phone_number"]
     }
   };
   ```

3. **Match Type Tracking**:
   - System tracks whether matches are found through exact or partial matching
   - Provides clear feedback in the response when partial matching is used

4. **System Instructions**:
   The AI prompt now emphasizes phone number usage:
   ```
   IMPORTANT: When booking or canceling appointments, always use phone numbers 
   as the primary identifier. Phone numbers are more unique than names and help 
   prevent confusion between customers with similar names.

   CANCELLATION PROCESS:
   1. Always ask for the customer's phone number first
   2. Use the phone number with cancel_appointment function
   3. If multiple appointments are found for the same phone number, 
      collect date/time to identify the correct one
   ```

This implementation ensures the system can handle different phone number formats (e.g., "555-123-4567", "(555) 123-4567", "5551234567") and still identify the correct appointment, reducing errors caused by duplicate or similar customer names.

## Example: Book Appointment Declaration
```typescript
const bookAppointmentDeclaration: FunctionDeclaration = {
  name: "book_appointment",
  description: "Books an appointment in the nail salon calendar",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: { type: SchemaType.STRING, description: "Date in YYYY-MM-DD format." },
      time: { type: SchemaType.STRING, description: "Time in HH:MM format." },
      customerName: { type: SchemaType.STRING, description: "Customer name." },
      phoneNumber: { type: SchemaType.STRING, description: "Customer's phone number (required)." },
      service: { type: SchemaType.STRING, description: "Service name." },
      technician: { type: SchemaType.STRING, description: "Preferred technician (optional)." }
    },
    required: ["date", "time", "customerName", "phoneNumber", "service"]
  }
};
```

## Example: Appointment Type
```typescript
type Appointment = {
  id: number;
  date: string;
  time: string;
  customerName: string;
  phoneNumber: string;
  service: string;
  technician?: string;
};
```

## UI/UX
- Phone numbers are shown in appointment details, calendar slots, and lists in a compact, readable format.
- System prompt instructs the AI to always ask for and validate a phone number when booking.

## Summary
- Phone number is now a required part of the booking flow, stored and displayed throughout the app for confirmations and reminders.

## Key Update: Appointment Editing Functionality

The salon appointment system now supports appointment editing, allowing clients to modify their existing appointments:

### Edit Appointment Implementation

1. **Function Declaration**:
   ```typescript
   const editAppointmentDeclaration: FunctionDeclaration = {
     name: "edit_appointment",
     description: "Edits an existing appointment using phone number as primary identifier",
     parameters: {
       properties: {
         phone_number: {
           type: SchemaType.STRING,
           description: "Phone number of the customer (primary identifier)"
         },
         original_date: {
           type: SchemaType.STRING,
           description: "Original date of the appointment (YYYY-MM-DD format)"
         },
         original_time: {
           type: SchemaType.STRING,
           description: "Original time of the appointment (HH:MM format)"
         },
         new_date: {
           type: SchemaType.STRING,
           description: "New date for the appointment (optional)"
         },
         new_time: {
           type: SchemaType.STRING,
           description: "New time for the appointment (optional)"
         },
         new_service: {
           type: SchemaType.STRING,
           description: "New service for the appointment (optional)"
         },
         new_technician: {
           type: SchemaType.STRING,
           description: "New technician for the appointment (optional)"
         }
       },
       required: ["phone_number", "original_date", "original_time"]
     }
   };
   ```

2. **Key Features**:
   - Uses phone number as primary identifier to locate appointments
   - Provides specific parameters for original appointment details
   - Only requires parameters for fields that need to be changed
   - Validates availability of new time slots before making changes
   - Returns both original and updated appointment details

3. **System Instructions**:
   ```
   APPOINTMENT EDITING PROCESS:
   - When clients want to change an existing appointment, use the edit_appointment function.
   - Always identify the appointment using the phone number first.
   - Confirm which specific appointment to edit using original date and time.
   - Clearly specify only the aspects of the appointment that need changing.
   - Verify the new time slot is available before making changes.
   - After editing, summarize the changes made to confirm with the client.
   ```

4. **Enhanced UI**:
   - Side-by-side comparison of original and updated appointment details
   - Clear visual highlighting of changed fields
   - Summary of specific changes made
   - Consistent styling with other appointment operations

This implementation ensures seamless modification of appointments while maintaining the integrity of the booking system and preserving the phone number as the primary identifier.
