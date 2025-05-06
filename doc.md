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

## Best Practices

1. **Clear Function Names**: Use descriptive, lowercase, snake_case function names
2. **Detailed Descriptions**: Provide detailed descriptions for functions and parameters
3. **Appropriate Instructions**: Include clear system instructions about when to use the function
4. **Error Handling**: Implement error handling in your function logic
5. **Cleanup Listeners**: Always clean up event listeners in the `useEffect` return function
6. **UI Feedback**: Provide visual feedback in the UI when functions are called
7. **Guide Result Handling**: Explicitly instruct the model on how to handle function results

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
4. **User-Friendly Responses**: Format dates in natural language for display (e.g., "Monday, July 8")
5. **Logging**: Add console logs during date processing for easier debugging

### Example Prompts

Users can now ask questions like:
- "Do you have any availability today at 2pm?"
- "What times are free tomorrow?"
- "Is Tuesday at 10am available?"
- "Show me slots for next Wednesday"
