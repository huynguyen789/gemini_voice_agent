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