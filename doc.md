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
          text: 'System instructions that tell the model when to use your function',
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
            text: 'You can help the user get the current date and time. When they ask for the current time or date, use the "get_current_datetime" function.',
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

## Common Issues

- **Function Not Being Called**: Check your system instructions and make sure they clearly indicate when the function should be used
- **Parameter Type Mismatch**: Ensure parameter types in the declaration match what your implementation expects
- **Missing Response**: Always send a response back to the model using `client.sendToolResponse`
- **Multiple Functions**: When implementing multiple functions, make sure each has a unique name
