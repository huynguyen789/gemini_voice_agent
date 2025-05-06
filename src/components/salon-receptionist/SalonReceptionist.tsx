/**
 * Salon Receptionist component that implements function calling for the nail salon calendar
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import SimpleCalendar, { Appointment } from "../simple-calendar/SimpleCalendar";
import "./salon-receptionist.scss";

// Get the dates for this week (Monday-Sunday)
const getWeekDates = (): { date: string; label: string }[] => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday...
  
  // Calculate the Monday of this week
  const startDate = new Date(today);
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
  startDate.setDate(today.getDate() - daysSinceMonday);
  
  // Generate array of dates for the week
  const weekDates = [];
  for (let i = 0; i < 7; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    
    const formattedDate = date.toISOString().split('T')[0]; // YYYY-MM-DD
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = dayNames[date.getDay()];
    const monthDay = `${date.getMonth() + 1}/${date.getDate()}`;
    
    weekDates.push({
      date: formattedDate,
      label: `${dayName} (${monthDay})`
    });
  }
  
  return weekDates;
};

// Available time slots (9AM to 5PM)
const timeSlots = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

// Initial appointments (pre-populated for demo)
const initialAppointments: Appointment[] = [
  { id: 1, date: getWeekDates()[0].date, time: "10:00", customerName: "Sarah Johnson", service: "Gel Manicure" },
  { id: 2, date: getWeekDates()[2].date, time: "14:00", customerName: "Mike Roberts", service: "Deluxe Pedicure" },
  { id: 3, date: getWeekDates()[4].date, time: "11:00", customerName: "Emma Davis", service: "Gel X Extensions" },
  { id: 4, date: getWeekDates()[5].date, time: "15:00", customerName: "David Wilson", service: "Russian Manicure" },
  { id: 5, date: getWeekDates()[1].date, time: "13:00", customerName: "Olivia Smith", service: "Madison Valgari Luxurious Pedicure" },
  { id: 6, date: getWeekDates()[3].date, time: "16:00", customerName: "Jennifer Lee", service: "Lash Lift & Tint" },
  { id: 7, date: getWeekDates()[6].date, time: "12:00", customerName: "Alex Chen", service: "Brow Lamination" },
];

// Function declarations
const checkAvailabilityDeclaration: FunctionDeclaration = {
  name: "check_availability",
  description: "Checks for available appointment slots in the nail salon calendar",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: {
        type: SchemaType.STRING,
        description: "The date to check in YYYY-MM-DD format. If not provided, will return availability for the current week."
      },
      time: {
        type: SchemaType.STRING,
        description: "Optional. The specific time to check in HH:MM format (24-hour)."
      }
    },
    required: []
  }
};

// Helper functions for date handling
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

const isDayName = (input: string): boolean => {
  const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  return days.includes(input.toLowerCase());
};

const getDayNameToDate = (dayName: string): string => {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = new Date();
  const todayDayIndex = today.getDay(); // 0 for Sunday, 1 for Monday, etc.
  
  // Normalize the day name and find its index
  const targetDayIndex = days.findIndex(day => 
    day === dayName.toLowerCase()
  );
  
  if (targetDayIndex === -1) {
    // Invalid day name, return today's date
    return today.toISOString().split('T')[0];
  }
  
  // Calculate days to add to today to get to the target day
  let daysToAdd = targetDayIndex - todayDayIndex;
  
  // If the day has already passed this week, get next week's occurrence
  if (daysToAdd <= 0) {
    daysToAdd += 7;
  }
  
  // Create the new date by adding the required days
  const targetDate = new Date(today);
  targetDate.setDate(today.getDate() + daysToAdd);
  
  return targetDate.toISOString().split('T')[0];
};

// Format date for display (e.g., "Friday, May 10")
const formatDate = (dateString: string): string => {
  if (!dateString || dateString === '') return 'Unknown date';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (error) {
    return 'Invalid date format';
  }
};

function SalonReceptionistComponent() {
  const [appointments, setAppointments] = useState<Appointment[]>(initialAppointments);
  const [checkedDate, setCheckedDate] = useState<string | null>(null);
  const [lastAvailabilityCheck, setLastAvailabilityCheck] = useState<any | null>(null);
  
  const { client, setConfig } = useLiveAPIContext();
  
  // Utility function to check if a slot is booked
  const isSlotBooked = (date: string, time: string): boolean => {
    return appointments.some(app => app.date === date && app.time === time);
  };
  
  // Get all available slots for a specific date
  const getAvailableSlots = (date: string): string[] => {
    const bookedTimes = appointments
      .filter(app => app.date === date)
      .map(app => app.time);
    
    return timeSlots.filter(time => !bookedTimes.includes(time));
  };
  
  // Configure the model with our functions
  useEffect(() => {
    // Get today's date for system instructions
    const today = new Date();
    const formattedToday = today.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
    
    setConfig({
      model: "models/gemini-2.0-flash-exp",
      systemInstruction: {
        parts: [
          {
            text: `Today's date is ${formattedToday}. You are a helpful nail salon receptionist. Use the check_availability function when clients ask about available appointments. They may ask about specific dates, times, or use terms like "today", "tomorrow", or day names (e.g., "Wednesday"). When you receive function results, formulate a natural response based on the data - do not read out the raw data.`,
          },
        ],
      },
      tools: [
        { functionDeclarations: [checkAvailabilityDeclaration] },
      ],
    });
  }, [setConfig]);
  
  // Handle function calls
  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`Got tool call`, toolCall);
      
      const fc = toolCall.functionCalls.find(
        (fc) => fc.name === checkAvailabilityDeclaration.name
      );
      
      if (fc) {
        const args = fc.args as {
          date?: string;
          time?: string;
        };
        
        let response: any;
        
        // Process date input for special keywords and day names
        const dateToCheck = args.date ? processDateInput(args.date) : '';
        console.log(`Original date input: ${args.date}, Processed date: ${dateToCheck}`);
        
        // Case 1: Check specific date and time
        if (dateToCheck && args.time) {
          const time = args.time;
          const available = !isSlotBooked(dateToCheck, time);
          
          setCheckedDate(dateToCheck);
          
          response = {
            date: dateToCheck,
            time: time,
            available: available,
            message: available 
              ? `${time} on ${formatDate(dateToCheck)} is available for booking.` 
              : `Sorry, ${time} on ${formatDate(dateToCheck)} is already booked.`
          };
        }
        // Case 2: Check availability for a specific date
        else if (dateToCheck) {
          const availableSlots = getAvailableSlots(dateToCheck);
          
          setCheckedDate(dateToCheck);
          
          response = {
            date: dateToCheck,
            available_slots: availableSlots,
            message: availableSlots.length > 0
              ? `There are ${availableSlots.length} available slots on ${formatDate(dateToCheck)}: ${availableSlots.join(', ')}`
              : `Sorry, there are no available slots on ${formatDate(dateToCheck)}.`
          };
        }
        // Case 3: Check availability for the whole week
        else {
          const weekDates = getWeekDates();
          const weekAvailability: Record<string, string[]> = {};
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
        
        setLastAvailabilityCheck(response);
        
        // Send response back to the model
        client.sendToolResponse({
          functionResponses: [{
            response: response,
            id: fc.id,
          }],
        });
      }
    };
    
    client.on("toolcall", onToolCall);
    return () => {
      client.off("toolcall", onToolCall);
    };
  }, [client, appointments]);
  
  return (
    <div className="salon-receptionist">
      {lastAvailabilityCheck && (
        <div className="availability-results">
          <h3>Last Availability Check</h3>
          <div className="result-content">
            {lastAvailabilityCheck.date && (
              <p>Date: <strong>{formatDate(lastAvailabilityCheck.date)}</strong></p>
            )}
            {lastAvailabilityCheck.time && (
              <p>Time: <strong>{lastAvailabilityCheck.time}</strong></p>
            )}
            {lastAvailabilityCheck.available !== undefined && (
              <p>Available: <strong>{lastAvailabilityCheck.available ? 'Yes' : 'No'}</strong></p>
            )}
            {lastAvailabilityCheck.available_slots && (
              <div>
                <p>Available slots:</p>
                <ul className="slots-list">
                  {lastAvailabilityCheck.available_slots.map((slot: string) => (
                    <li key={slot}>{slot}</li>
                  ))}
                </ul>
              </div>
            )}
            {lastAvailabilityCheck.week_of && (
              <div>
                <p>Week of {formatDate(lastAvailabilityCheck.week_of)}</p>
                <div className="weekly-availability">
                  {Object.entries(lastAvailabilityCheck.availability).map(([date, slots]) => (
                    <div key={date} className="day-availability">
                      <p>{formatDate(date)}: {(slots as string[]).length} slots available</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="result-message">{lastAvailabilityCheck.message}</p>
          </div>
        </div>
      )}
      
      <SimpleCalendar appointments={appointments} highlightDate={checkedDate} />
    </div>
  );
}

export const SalonReceptionist = SalonReceptionistComponent; 