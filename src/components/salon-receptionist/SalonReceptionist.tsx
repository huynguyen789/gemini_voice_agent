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

// Book appointment function declaration
const bookAppointmentDeclaration: FunctionDeclaration = {
  name: "book_appointment",
  description: "Books an appointment in the nail salon calendar",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      date: {
        type: SchemaType.STRING,
        description: "The date to book in YYYY-MM-DD format."
      },
      time: {
        type: SchemaType.STRING,
        description: "The time to book in HH:MM format (24-hour)."
      },
      customerName: {
        type: SchemaType.STRING,
        description: "Name of the customer making the appointment."
      },
      service: {
        type: SchemaType.STRING,
        description: "The service the customer is booking (e.g., Gel Manicure, Pedicure, etc.)."
      }
    },
    required: ["date", "time", "customerName", "service"]
  }
};

// Cancel appointment function declaration
const cancelAppointmentDeclaration: FunctionDeclaration = {
  name: "cancel_appointment",
  description: "Cancels an existing appointment in the nail salon calendar",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      customer_name: {
        type: SchemaType.STRING,
        description: "Name of the customer whose appointment should be cancelled."
      },
      date: {
        type: SchemaType.STRING,
        description: "Optional. The date of the appointment in YYYY-MM-DD format to help identify the correct appointment."
      },
      time: {
        type: SchemaType.STRING,
        description: "Optional. The time of the appointment in HH:MM format to help identify the correct appointment."
      }
    },
    required: ["customer_name"]
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
  const [lastBookingResult, setLastBookingResult] = useState<any | null>(null);
  const [lastCancellationResult, setLastCancellationResult] = useState<any | null>(null);
  
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
            text: `Today's date is ${formattedToday}. You are a helpful nail salon receptionist. Use the check_availability function when clients ask about available appointments, book_appointment function when they want to book an appointment, and cancel_appointment function when they want to cancel an existing appointment. Clients may ask about specific dates, times, or use terms like "today", "tomorrow", or day names (e.g., "Wednesday"). When you receive function results, formulate a natural response based on the data - do not read out the raw data.`,
          },
        ],
      },
      tools: [
        { functionDeclarations: [checkAvailabilityDeclaration, bookAppointmentDeclaration, cancelAppointmentDeclaration] },
      ],
    });
  }, [setConfig]);
  
  // Handle function calls
  useEffect(() => {
    const onToolCall = (toolCall: ToolCall) => {
      console.log(`Got tool call`, toolCall);
      
      const checkAvailabilityCall = toolCall.functionCalls.find(
        (fc) => fc.name === checkAvailabilityDeclaration.name
      );
      
      const bookAppointmentCall = toolCall.functionCalls.find(
        (fc) => fc.name === bookAppointmentDeclaration.name
      );
      
      const cancelAppointmentCall = toolCall.functionCalls.find(
        (fc) => fc.name === cancelAppointmentDeclaration.name
      );
      
      if (checkAvailabilityCall) {
        const args = checkAvailabilityCall.args as {
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
            id: checkAvailabilityCall.id,
          }],
        });
      } else if (bookAppointmentCall) {
        const args = bookAppointmentCall.args as {
          date: string;
          time: string;
          customerName: string;
          service: string;
        };
        
        let response: any;
        
        // Process date input for special keywords and day names
        const dateToBook = processDateInput(args.date);
        
        // Check if the slot is available
        const isAvailable = !isSlotBooked(dateToBook, args.time);
        
        if (isAvailable) {
          // Create a new appointment
          const newAppointment: Appointment = {
            id: Math.max(0, ...appointments.map(a => a.id)) + 1, // Generate a new unique ID
            date: dateToBook,
            time: args.time,
            customerName: args.customerName,
            service: args.service
          };
          
          // Add the appointment to the list
          setAppointments(prevAppointments => [...prevAppointments, newAppointment]);
          
          setCheckedDate(dateToBook);
          
          // Create success response
          response = {
            success: true,
            appointment: newAppointment,
            message: `Successfully booked an appointment for ${args.customerName} on ${formatDate(dateToBook)} at ${args.time} for ${args.service}.`
          };
        } else {
          // Create error response
          response = {
            success: false,
            message: `Sorry, the slot at ${args.time} on ${formatDate(dateToBook)} is already booked.`
          };
        }
        
        setLastBookingResult(response);
        
        // Send response back to the model
        client.sendToolResponse({
          functionResponses: [{
            response: response,
            id: bookAppointmentCall.id,
          }],
        });
      } else if (cancelAppointmentCall) {
        const args = cancelAppointmentCall.args as {
          customer_name: string;
          date?: string;
          time?: string;
        };
        
        let response: any;
        
        // Process date input if provided
        const dateToCancel = args.date ? processDateInput(args.date) : undefined;
        
        // Find the appointment(s) by customer name
        let appointmentsToCancel = appointments.filter(app => 
          app.customerName.toLowerCase().includes(args.customer_name.toLowerCase())
        );
        
        // Further filter by date if provided
        if (dateToCancel) {
          appointmentsToCancel = appointmentsToCancel.filter(app => app.date === dateToCancel);
        }
        
        // Further filter by time if provided
        if (args.time) {
          appointmentsToCancel = appointmentsToCancel.filter(app => app.time === args.time);
        }
        
        if (appointmentsToCancel.length === 0) {
          // No appointments found
          response = {
            success: false,
            message: `Sorry, no appointments found for ${args.customer_name}${dateToCancel ? ` on ${formatDate(dateToCancel)}` : ''}${args.time ? ` at ${args.time}` : ''}.`
          };
        } else if (appointmentsToCancel.length > 1 && !dateToCancel && !args.time) {
          // Multiple appointments found without date/time specified
          response = {
            success: false,
            multiple_appointments: true,
            customer_name: args.customer_name,
            appointments: appointmentsToCancel.map(app => ({
              date: app.date,
              formatted_date: formatDate(app.date),
              time: app.time,
              service: app.service
            })),
            message: `${args.customer_name} has multiple appointments. Please specify a date or time to identify which one to cancel.`
          };
        } else {
          // Cancel the appointment (first one if multiple match the filters)
          const appointmentToCancel = appointmentsToCancel[0];
          
          // Remove the appointment
          setAppointments(prevAppointments => 
            prevAppointments.filter(app => app.id !== appointmentToCancel.id)
          );
          
          setCheckedDate(appointmentToCancel.date);
          
          // Create success response
          response = {
            success: true,
            cancelled_appointment: appointmentToCancel,
            message: `Successfully cancelled the appointment for ${appointmentToCancel.customerName} on ${formatDate(appointmentToCancel.date)} at ${appointmentToCancel.time} for ${appointmentToCancel.service}.`
          };
        }
        
        // Reset other results to show cancellation result
        setLastAvailabilityCheck(null);
        setLastBookingResult(null);
        setLastCancellationResult(response);
        
        // Send response back to the model
        client.sendToolResponse({
          functionResponses: [{
            response: response,
            id: cancelAppointmentCall.id,
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
      {lastAvailabilityCheck && !lastBookingResult && !lastCancellationResult && (
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
      
      {lastBookingResult && !lastCancellationResult && (
        <div className={`booking-results ${lastBookingResult.success ? 'success' : 'error'}`}>
          <h3>Booking Result</h3>
          <div className="result-content">
            <p className="result-message">{lastBookingResult.message}</p>
            {lastBookingResult.success && lastBookingResult.appointment && (
              <div className="appointment-details">
                <p>Customer: <strong>{lastBookingResult.appointment.customerName}</strong></p>
                <p>Date: <strong>{formatDate(lastBookingResult.appointment.date)}</strong></p>
                <p>Time: <strong>{lastBookingResult.appointment.time}</strong></p>
                <p>Service: <strong>{lastBookingResult.appointment.service}</strong></p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {lastCancellationResult && (
        <div className={`cancellation-results ${lastCancellationResult.success ? 'success' : 'error'}`}>
          <h3>Cancellation Result</h3>
          <div className="result-content">
            <p className="result-message">{lastCancellationResult.message}</p>
            {lastCancellationResult.success && lastCancellationResult.cancelled_appointment && (
              <div className="cancelled-appointment-details">
                <p>Cancelled appointment details:</p>
                <p>Customer: <strong>{lastCancellationResult.cancelled_appointment.customerName}</strong></p>
                <p>Date: <strong>{formatDate(lastCancellationResult.cancelled_appointment.date)}</strong></p>
                <p>Time: <strong>{lastCancellationResult.cancelled_appointment.time}</strong></p>
                <p>Service: <strong>{lastCancellationResult.cancelled_appointment.service}</strong></p>
              </div>
            )}
            {lastCancellationResult.multiple_appointments && lastCancellationResult.appointments && (
              <div className="multiple-appointments">
                <p>Please specify which appointment to cancel:</p>
                <ul>
                  {lastCancellationResult.appointments.map((app: any, index: number) => (
                    <li key={index}>
                      <p>{app.formatted_date} at {app.time} - {app.service}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      <SimpleCalendar appointments={appointments} highlightDate={checkedDate} />
    </div>
  );
}

export const SalonReceptionist = SalonReceptionistComponent; 