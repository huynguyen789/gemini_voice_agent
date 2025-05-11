/**
 * Salon Receptionist component that implements function calling for the nail salon calendar
 */
import { type FunctionDeclaration, SchemaType } from "@google/generative-ai";
import { useEffect, useState } from "react";
import { useLiveAPIContext } from "../../contexts/LiveAPIContext";
import { ToolCall } from "../../multimodal-live-types";
import SimpleCalendar, { Appointment, CalendarState } from "../simple-calendar/SimpleCalendar";
import "./salon-receptionist.scss";

// Manager message type definition
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

// Get the dates for a specific week (Monday-Sunday)
const getWeekDates = (startDate: Date): { date: string, label: string }[] => {
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

// Calculate the Monday of the current week
const getMondayOfCurrentWeek = (): Date => {
  const today = new Date();
  const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday...
  
  const startDate = new Date(today);
  const daysSinceMonday = currentDay === 0 ? 6 : currentDay - 1;
  startDate.setDate(today.getDate() - daysSinceMonday);
  
  // Reset hours to beginning of the day to avoid time issues
  startDate.setHours(0, 0, 0, 0);
  
  return startDate;
};

// Initial appointments (pre-populated for demo)
const initialAppointments: Appointment[] = [
  { id: 1, date: getWeekDates(getMondayOfCurrentWeek())[0].date, time: "10:00", customerName: "Sarah Johnson", service: "Gel Manicure", phoneNumber: "(555) 123-4567" },
  { id: 2, date: getWeekDates(getMondayOfCurrentWeek())[2].date, time: "14:00", customerName: "Mike Roberts", service: "Deluxe Pedicure", phoneNumber: "(555) 234-5678" },
  { id: 3, date: getWeekDates(getMondayOfCurrentWeek())[4].date, time: "11:00", customerName: "Emma Davis", service: "Gel X Extensions", phoneNumber: "(555) 345-6789" },
  { id: 4, date: getWeekDates(getMondayOfCurrentWeek())[5].date, time: "15:00", customerName: "David Wilson", service: "Russian Manicure", phoneNumber: "(555) 456-7890" },
  { id: 5, date: getWeekDates(getMondayOfCurrentWeek())[1].date, time: "13:00", customerName: "Olivia Smith", service: "Madison Valgari Luxurious Pedicure", phoneNumber: "(555) 567-8901" },
  { id: 6, date: getWeekDates(getMondayOfCurrentWeek())[3].date, time: "16:00", customerName: "Jennifer Lee", service: "Lash Lift & Tint", phoneNumber: "(555) 678-9012" },
  { id: 7, date: getWeekDates(getMondayOfCurrentWeek())[6].date, time: "12:00", customerName: "Alex Chen", service: "Brow Lamination", phoneNumber: "(555) 789-0123" },
];

// Modified function declaration for check_availability to support week ranges
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
      phoneNumber: {
        type: SchemaType.STRING,
        description: "Customer's phone number (required for booking confirmation and reminders)."
      },
      service: {
        type: SchemaType.STRING,
        description: "The service the customer is booking (e.g., Gel Manicure, Pedicure, etc.)."
      },
      technician: {
        type: SchemaType.STRING,
        description: "Optional. The preferred technician for the service. Available technicians: Hana, Zoey, Camila, Caylie, Cammy, Steve."
      }
    },
    required: ["date", "time", "customerName", "phoneNumber", "service"]
  }
};

// Cancel appointment function declaration
const cancelAppointmentDeclaration: FunctionDeclaration = {
  name: "cancel_appointment",
  description: "Cancels an existing appointment in the nail salon calendar using phone number as primary identifier",
  parameters: {
    type: SchemaType.OBJECT,
    properties: {
      phone_number: {
        type: SchemaType.STRING,
        description: "Phone number of the customer whose appointment should be cancelled (primary identifier)."
      },
      customer_name: {
        type: SchemaType.STRING,
        description: "Optional. Name of the customer whose appointment should be cancelled, used for confirmation."
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
    required: ["phone_number"]
  }
};

// Send message to manager function declaration
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

// Edit appointment function declaration
const editAppointmentDeclaration: FunctionDeclaration = {
  name: "edit_appointment",
  description: "Edits an existing appointment using phone number as primary identifier",
  parameters: {
    type: SchemaType.OBJECT,
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
      },
      customer_name: {
        type: SchemaType.STRING,
        description: "Customer name for confirmation (optional)"
      }
    },
    required: ["phone_number", "original_date", "original_time"]
  }
};

// Helper functions for date handling
const processDateInput = (dateInput: string): string => {
  if (!dateInput) return '';
  
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  
  // Handle special keywords
  const lowerDateInput = dateInput.toLowerCase();
  
  if (lowerDateInput === 'today') {
    return today.toISOString().split('T')[0]; // YYYY-MM-DD
  } else if (lowerDateInput === 'tomorrow') {
    return tomorrow.toISOString().split('T')[0]; // YYYY-MM-DD
  } else if (lowerDateInput.includes('next week')) {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    // If a specific day is mentioned, find that day next week
    const dayMatch = lowerDateInput.match(/next week('s)?\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
    if (dayMatch && dayMatch[2]) {
      const targetDay = dayMatch[2].toLowerCase();
      return getDayNameDateNextWeek(targetDay);
    }
    
    // Otherwise return the same day next week
    return nextWeek.toISOString().split('T')[0];
  } else if (lowerDateInput.includes('in two weeks') || lowerDateInput.includes('in 2 weeks')) {
    const twoWeeks = new Date(today);
    twoWeeks.setDate(today.getDate() + 14);
    return twoWeeks.toISOString().split('T')[0];
  } else if (isDayName(lowerDateInput)) {
    return getDayNameToDate(lowerDateInput);
  }
  
  // Assume it's already in YYYY-MM-DD format
  return dateInput;
};

// Helper function to normalize phone numbers by removing non-digit characters
const normalizePhoneNumber = (phoneNumber: string): string => {
  return phoneNumber.replace(/\D/g, '');
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

// Get specific day in next week
const getDayNameDateNextWeek = (dayName: string): string => {
  const days = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
  const today = new Date();
  
  // Find day index
  const targetDayIndex = days.findIndex(day => day === dayName.toLowerCase());
  
  // Calculate days to add to get to next week's occurrence of that day
  const todayDayIndex = today.getDay();
  let daysToAdd = 7 + (targetDayIndex - todayDayIndex);
  
  // Adjust if we're already on that day
  if (daysToAdd === 7) daysToAdd = 14;
  
  // Create new date
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
  const [lastEditResult, setLastEditResult] = useState<any | null>(null);
  const [managerMessages, setManagerMessages] = useState<ManagerMessage[]>([]);
  const [showManagerInbox, setShowManagerInbox] = useState<boolean>(false);
  const [lastManagerMessage, setLastManagerMessage] = useState<ManagerMessage | null>(null);
  
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
  
  // Get the Monday of a week containing the specified date
  const getMondayOfWeek = (date: Date): Date => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0); // Reset hours to beginning of the day
    return monday;
  };
  
  // Calculate week of a date for week-based availability checks
  const getWeekOfDate = (dateStr: string): Date => {
    const date = new Date(dateStr);
    return getMondayOfWeek(date);
  };
  
  // Update the availability function to handle week-based queries
  const getAvailableSlotsForWeek = (weekStartDate: Date): Record<string, string[]> => {
    const weekAvailability: Record<string, string[]> = {};
    
    // Get all dates for the week
    const weekDates = getWeekDates(weekStartDate);
    
    // Calculate available slots for each day in the week
    weekDates.forEach(day => {
      const availableSlots = getAvailableSlots(day.date);
      weekAvailability[day.date] = availableSlots;
    });
    
    return weekAvailability;
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
            text: `Today's date is ${formattedToday}. 
            
You are a receptionist from Madison Valgari Nails Salon. Your task is helping answer clients' questions and booking appointments.


GENERAL RULES:
- Always use the check_availability function before asking more details about the appointment.
BOOKING:
- MAKE SURE TO CALL THE book_appointment function to book the appointment!
- If client ask for 2 services, input them in the same api call, not 2 separate ones.

- Use the check_availability function when clients ask about available appointments, 
book_appointment function when they want to book an appointment, 
cancel_appointment function when they want to cancel an existing appointment. 

MANAGER COMMUNICATION:
- Use the send_message_to_manager function to escalate special requests to the salon manager.
- Nicely ask client for a moment while checking with the manager.
- Always escalate to the manager in these situations:
  * Discount requests over 20%
  * Special accommodations outside normal policies
  * Client complaints or concerns about previous services
  * Requests for services not listed in the service menu
  * Payment issues or disputes
- When sending a message to the manager, be detailed about the client request and reason for escalation.
- If the manager has responded to a previous message, incorporate their guidance into your response to the client.

IMPORTANT: When booking or canceling appointments, always use phone numbers as the primary identifier. Phone numbers are more unique than names and help prevent confusion between customers with the same or similar names. Always collect a phone number when booking and ask for a phone number first when canceling appointments.

BOOKING PROCESS:
1. Always collect customer's full phone number before booking
2. Make sure to collect customer name, service, date and time
3. Verify the phone number format
4. Then use the book_appointment function

CANCELLATION PROCESS:
1. Always ask for the customer's phone number first
2. Use the phone number with cancel_appointment function
3. If multiple appointments are found for the same phone number, collect date/time to identify the correct one

APPOINTMENT EDITING PROCESS:
- When clients want to change an existing appointment, use the edit_appointment function.
- Always identify the appointment using the phone number first.
- Confirm which specific appointment to edit using original date and time.
- Clearly specify only the aspects of the appointment that need changing (date, time, service, or technician).
- Verify the new time slot is available before making changes.
- After editing, summarize the changes made to confirm with the client.

BOOKING REQUIREMENTS:
- Always ask for and collect the client's phone number when booking an appointment. This is required for booking confirmations and appointment reminders.
- A valid phone number should be in the format (XXX) XXX-XXXX, XXX-XXX-XXXX, or without formatting.
- If a client doesn't provide a phone number initially, kindly ask for it before completing the booking.

Clients may ask about specific dates, times, or use terms like "today", "tomorrow", or day names (e.g., "Wednesday"). When you receive function results, formulate a natural response based on the data - do not read out the raw data.

If the client doesn't have any nails currently, recommend Gel X as a simple, healthy option.

If a client asks something you're not sure about, state that you need to check with the manager.


SALON INFORMATION:
- Salon Name: Madison Valgari Nail Salon
- Address: 650 Royal Palm Beach Blvd Suite 5, Royal Palm Beach, FL 33411
- Phone Number: (561) 425-5508
- Email: madisonvalgarisalon@gmail.com
- Hours: Monday–Saturday 9:30AM-6:30PM, Sunday 10:00AM-4:00PM

TECHNICIAN INFO:
- Hana, Zoey, Camila, Caylie, Cammy, Steve are our technicians
- Only Zoey can do eyelash services
- Zoey only does nails, eyelash, and wax (no pedicure) - specializes in designs but isn't taking new clients
- Steve cannot do wax or eyelashes, but can do everything else
- Cammy only does pedicure services
- Hana doesn't do acrylic, but can do everything else
- For designs, recommend Caylie or Camila

TECHNICIAN SCHEDULES (OFF DAYS):
- Monday: Steve
- Tuesday: Hana, Steve
- Wednesday: Steve
- Thursday: Zoey
- Friday: All technicians available
- Saturday: All technicians available 
- Sunday: All technicians available

POLICIES:
- 24-hour notice required for cancellations
- 10-minute grace period for late arrivals
- $25 deposit required for lash services, brow laminations, and lash lifts
- Children under 8 not receiving services are not allowed in service areas
- A deposit of $25 is required for lash services (full sets), brow laminations, and lash lifts
- Deposits are non-refundable but applied to the total service cost
- Modifications to appointments must be made within 48 hours to receive the deposit
- If there are two no-shows, a $25 deposit is required for the next appointment
- No refunds or redos after the client leaves the facility
- Gratuity can be placed on cards or via payment apps (Venmo, CashApp, Zelle)

DETAILED SERVICE MENU:

NAIL SERVICES:
- Manicures:
  * Manicure: $25 (Includes nails trimming, shaping, cuticle grooming, buffing, and polish of your choice)
  * Gel Manicure: $38 (Includes nails trimming, shaping, cuticle grooming, buffing, and polish of your choice)
    - French: +$7
    - Gel mani with soak-off: $40
  * Sugar Scrub & Massage (Add-on): $20
  * BIAB Manicure: $60+ (Builder in a Bottle - strengthening gel overlay)
  * Russian Manicure: $90+ (Dry manicure technique with precise cuticle work)

- Pedicures:
  * Spa Pedicure: $35 (Includes foot soaking, nails trimming, shaping, cuticle removing, foot massage, and polish of choice)
  * Gel Pedicure: $50
  * Deluxe Pedicure/Men Pedi: $45 (Extended spa pedicure with scented foot soaking, sugar scrub, cooling mask, hot towel wrap, foot massage)
    - Gel Polish: +$15
  * Hot Stone Pedicure: $55 (Extended deluxe pedicure with scented foot soaking, sugar scrub, hot towel wrap, cooling mask, extra massage using earth stone)
    - Gel Polish: +$15
  * Paraffin Pedicure: $55 (Deluxe pedicure plus warm paraffin wax dip)
    - Gel Polish: +$15
  * Madison Valgari Luxurious Pedicure: $65 (Includes fresh orange slices for exfoliation, paraffin dip, hot stone massage, and a FREE collagen-rich lotion gift)
    - Gel Polish: +$15
    - Scent Options: PEARLS/ROSE/LAVENDER/ORANGE
    - Complimentary glass of house wine

- Gel Dip/Nexgen:
  * Gel Dip/Nexgen: $45+ (Safer and healthier alternative to acrylics)
    - +$5 shape
    - +$7 french
    - $5 removal

- Gel X: $60 (Soft gel polish extension system using full cover tip & LED curing)

- Hybrid Gel: $65 (Durable and long-lasting gel extension system)
  * Refill: $55+ (Recommended every 2-3 weeks)

- Acrylics:
  * Full Set Acrylic Short: $55+
  * Fill in Acrylic Short: $50
  * Full Set Ombre (2 colors) Short: $65+
  * Pink & White Powder Acrylic: $75
  * Shape (Excludes square): $5
  * Length: $5/ $10/ $15/ $20

- Extra Services:
  * Acrylic Soak - Off Only: $25
  * Gel X/ Nexgen/ Gel Polish Soak-Off Only: $15
  * Polish Change: Reg $20/ Gel $30

- Kid Menu:
  * Mini Mani & Pedi (w.Reg Polish): $50
  * Mini Mani & Pedi (w.Gel Polish): $70

WAXING & THREADING:
- Waxing:
  * Eyebrows: $14
  * Upper Lips: $8
  * Chin: $10
  * Side Burn: $12
  * Full Face: $40
  * Under Arm: $20
  * Half Arm: $25
  * Full Arm: $40
  * Half Legs: $35
  * Full Legs: $60
  * Check/Back: $50
  * Toes: $10
  * Wax & Tint Combo: $35

- Threading:
  * Eyebrows: $18
  * Upper Lips: $10
  * Chin: $10
  * Full Face: $50

LASHES & BROWS:
- Brow Lamination: $75 (Includes waxing and tinting)
- Lash Lift & Tint: $85
- Combo Brow Lami & Lash Lift: $140
- For Lash Extensions: Please see full menu for detailed pricing

FACIALS:
- Facial: $70 (One-hour treatment including exfoliating, cleansing, extraction, massage, hydrating mask, and sunscreen)

`,
          },
        ],
      },
      tools: [
        { functionDeclarations: [checkAvailabilityDeclaration, bookAppointmentDeclaration, cancelAppointmentDeclaration, sendMessageToManagerDeclaration, editAppointmentDeclaration] },
      ],
    });
  }, [setConfig]);
  
  // Update the tool call handler for enhanced availability checking
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
      
      const sendMessageToManagerCall = toolCall.functionCalls.find(
        (fc) => fc.name === sendMessageToManagerDeclaration.name
      );
      
      const editAppointmentCall = toolCall.functionCalls.find(
        (fc) => fc.name === editAppointmentDeclaration.name
      );
      
      if (checkAvailabilityCall) {
        const args = checkAvailabilityCall.args as {
          date?: string;
          time?: string;
        };
        
        let response: any;
        
        // Process date input for special keywords and day names
        let dateToCheck = '';
        let weekMode = false;
        let weekStartDate: Date | null = null;
        
        if (args.date) {
          const lowerDateInput = args.date.toLowerCase();
          
          // Check if it's a week-based query
          if (lowerDateInput.includes('next week') || lowerDateInput.includes('in two weeks') || lowerDateInput.includes('in 2 weeks')) {
            weekMode = true;
            
            if (lowerDateInput.includes('next week')) {
              const today = new Date();
              const nextWeek = new Date(today);
              nextWeek.setDate(today.getDate() + 7);
              weekStartDate = getMondayOfWeek(nextWeek);
              
              // If a specific day is mentioned, process that day
              const dayMatch = lowerDateInput.match(/next week('s)?\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i);
              if (dayMatch && dayMatch[2]) {
                weekMode = false;
                dateToCheck = getDayNameDateNextWeek(dayMatch[2].toLowerCase());
              }
            } else if (lowerDateInput.includes('in two weeks') || lowerDateInput.includes('in 2 weeks')) {
              const today = new Date();
              const twoWeeks = new Date(today);
              twoWeeks.setDate(today.getDate() + 14);
              weekStartDate = getMondayOfWeek(twoWeeks);
            }
          } else {
            // Process regular date
            dateToCheck = processDateInput(args.date);
            
            // If no specific time is requested, we'll show the whole week containing this date
            if (!args.time) {
              weekMode = true;
              weekStartDate = getWeekOfDate(dateToCheck);
            }
          }
        } else {
          // No date specified, show current week
          weekMode = true;
          const today = new Date();
          weekStartDate = getMondayOfWeek(today);
        }
        
        // Case 1: Check specific date and time
        if (!weekMode && dateToCheck && args.time) {
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
        // Case 2: Check all available slots for a specific date
        else if (!weekMode && dateToCheck) {
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
        // Case 3: Check weekly availability
        else if (weekMode && weekStartDate) {
          const weekAvailability = getAvailableSlotsForWeek(weekStartDate);
          
          // Count total available slots
          let totalAvailableSlots = 0;
          Object.values(weekAvailability).forEach(slots => {
            totalAvailableSlots += slots.length;
          });
          
          // Format week label for response
          const weekEnd = new Date(weekStartDate);
          weekEnd.setDate(weekStartDate.getDate() + 6);
          
          const formatShortDate = (date: Date) => {
            return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
          };
          
          const weekLabel = `${formatShortDate(weekStartDate)} - ${formatShortDate(weekEnd)}`;
          
          response = {
            week_of: weekStartDate.toISOString().split('T')[0],
            week_label: weekLabel,
            availability: weekAvailability,
            message: totalAvailableSlots > 0
              ? `There are ${totalAvailableSlots} available slots for the week of ${weekLabel}.`
              : `Sorry, there are no available slots for the week of ${weekLabel}.`
          };
          
          // Set checked date to Monday of the week for highlighting
          setCheckedDate(weekStartDate.toISOString().split('T')[0]);
        }
        
        setLastAvailabilityCheck(response);
        setLastBookingResult(null);
        setLastCancellationResult(null);
        setLastManagerMessage(null);
        
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
          phoneNumber: string;
          service: string;
          technician?: string;
        };
        
        let response: any;
        
        // Process date input for special keywords and day names
        const dateToBook = processDateInput(args.date);
        
        // Check if the slot is available
        const isAvailable = !isSlotBooked(dateToBook, args.time);
        
        if (isAvailable) {
          // Normalize phone number while preserving the original format for display
          const inputPhoneNumber = args.phoneNumber;
          
          // Create a new appointment
          const newAppointment: Appointment = {
            id: Math.max(0, ...appointments.map(a => a.id)) + 1, // Generate a new unique ID
            date: dateToBook,
            time: args.time,
            customerName: args.customerName,
            phoneNumber: inputPhoneNumber, // Keep the original formatted number for display
            service: args.service,
            technician: args.technician || undefined
          };
          
          // Add the appointment to the list
          setAppointments(prevAppointments => [...prevAppointments, newAppointment]);
          
          setCheckedDate(dateToBook);
          
          // Create success response
          response = {
            success: true,
            appointment: newAppointment,
            message: `Successfully booked an appointment for ${args.customerName} on ${formatDate(dateToBook)} at ${args.time} for ${args.service}${args.technician ? ` with ${args.technician}` : ''}. Confirmation details will be sent to ${inputPhoneNumber}.`
          };
        } else {
          // Create error response
          response = {
            success: false,
            message: `Sorry, the slot at ${args.time} on ${formatDate(dateToBook)} is already booked.`
          };
        }
        
        setLastBookingResult(response);
        setLastManagerMessage(null);
        
        // Send response back to the model
        client.sendToolResponse({
          functionResponses: [{
            response: response,
            id: bookAppointmentCall.id,
          }],
        });
      } else if (cancelAppointmentCall) {
        const args = cancelAppointmentCall.args as {
          phone_number: string;
          customer_name?: string;
          date?: string;
          time?: string;
        };
        
        console.log("=== CANCEL APPOINTMENT REQUEST ===");
        console.log("Phone:", args.phone_number);
        console.log("Name:", args.customer_name || "Not specified");
        console.log("Date:", args.date || "Not specified");
        console.log("Time:", args.time || "Not specified");
        console.log("Current appointments:", appointments.map(a => ({
          id: a.id,
          name: a.customerName,
          phone: a.phoneNumber,
          normalizedPhone: normalizePhoneNumber(a.phoneNumber),
          date: a.date,
          time: a.time
        })));
        
        let response: any;
        
        // Process date input if provided
        const dateToCancel = args.date ? processDateInput(args.date) : undefined;
        console.log("Processed date for cancellation:", dateToCancel);
        
        // Find the appointment(s) by phone number
        const normalizedSearchPhone = normalizePhoneNumber(args.phone_number);
        console.log(`Searching for phone: ${args.phone_number}, normalized: ${normalizedSearchPhone}`);

        // After the phone number matching, add a flag to track the match type
        let matchType = "exact";

        // Try exact matching first
        let appointmentsToCancel = appointments.filter(app => {
          const normalizedAppPhone = normalizePhoneNumber(app.phoneNumber);
          console.log(`Comparing with: ${app.phoneNumber}, normalized: ${normalizedAppPhone}`);
          return normalizedAppPhone === normalizedSearchPhone;
        });

        // If no results with exact match, try partial matching (last 7 digits)
        if (appointmentsToCancel.length === 0 && normalizedSearchPhone.length >= 7) {
          console.log("No exact matches, trying partial matching with last digits");
          const lastDigits = normalizedSearchPhone.slice(-7); // Get last 7 digits
          appointmentsToCancel = appointments.filter(app => {
            const normalizedAppPhone = normalizePhoneNumber(app.phoneNumber);
            return normalizedAppPhone.endsWith(lastDigits);
          });
          
          if (appointmentsToCancel.length > 0) {
            matchType = "partial";
          }
        }
        
        // Further filter by customer name if provided
        if (args.customer_name && args.customer_name.trim() !== '') {
          appointmentsToCancel = appointmentsToCancel.filter(app => 
            app.customerName.toLowerCase().includes(args.customer_name!.toLowerCase())
          );
        }
        
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
          const customerNamePart = args.customer_name ? ` for ${args.customer_name}` : '';
          const datePart = dateToCancel ? ` on ${formatDate(dateToCancel)}` : '';
          const timePart = args.time ? ` at ${args.time}` : '';
          const normalizedPart = ` (normalized: ${normalizedSearchPhone})`;
          
          response = {
            success: false,
            message: `Sorry, no appointments found for phone number ${args.phone_number}${normalizedPart}${customerNamePart}${datePart}${timePart}.`
          };
        } else if (appointmentsToCancel.length > 1 && !dateToCancel && !args.time) {
          // Multiple appointments found without date/time specified
          response = {
            success: false,
            multiple_appointments: true,
            phone_number: args.phone_number,
            customer_name: args.customer_name || 'Customer',
            appointments: appointmentsToCancel.map(app => ({
              date: app.date,
              formatted_date: formatDate(app.date),
              time: app.time,
              service: app.service,
              phoneNumber: app.phoneNumber,
              customerName: app.customerName,
              technician: app.technician
            })),
            message: `Found multiple appointments for phone number ${args.phone_number}. Please specify a date or time to identify which one to cancel.`
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
          let phoneNoteMsg = '';
          if (matchType === "partial") {
            phoneNoteMsg = ` Note: Phone format differed from stored format (${appointmentToCancel.phoneNumber}).`;
          }
          
          response = {
            success: true,
            cancelled_appointment: appointmentToCancel,
            match_type: matchType,
            message: `Successfully cancelled the appointment for ${appointmentToCancel.customerName} (${appointmentToCancel.phoneNumber}) on ${formatDate(appointmentToCancel.date)} at ${appointmentToCancel.time} for ${appointmentToCancel.service}${appointmentToCancel.technician ? ` with ${appointmentToCancel.technician}` : ''}.${phoneNoteMsg}`
          };
        }
        
        // Reset other results to show cancellation result
        setLastAvailabilityCheck(null);
        setLastBookingResult(null);
        setLastCancellationResult(response);
        setLastManagerMessage(null);
        
        // Send response back to the model
        client.sendToolResponse({
          functionResponses: [{
            response: response,
            id: cancelAppointmentCall.id,
          }],
        });
      } else if (sendMessageToManagerCall) {
        const args = sendMessageToManagerCall.args as {
          client_request: string;
          reason: string;
          priority?: string;
        };
        
        // Create a new manager message
        const newMessage: ManagerMessage = {
          id: `msg_${Date.now()}_${Math.floor(Math.random() * 1000)}`, // Generate a unique ID
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
      } else if (editAppointmentCall) {
        const args = editAppointmentCall.args as {
          phone_number: string;
          original_date: string;
          original_time: string;
          new_date?: string;
          new_time?: string;
          new_service?: string;
          new_technician?: string;
          customer_name?: string;
        };
        
        console.log("=== EDIT APPOINTMENT REQUEST ===");
        console.log("Phone:", args.phone_number);
        console.log("Original Date:", args.original_date);
        console.log("Original Time:", args.original_time);
        console.log("New Date:", args.new_date || "Not specified");
        console.log("New Time:", args.new_time || "Not specified");
        console.log("New Service:", args.new_service || "Not specified");
        console.log("New Technician:", args.new_technician || "Not specified");
        console.log("Customer Name:", args.customer_name || "Not specified");
        
        let response: any;
        
        // Normalize phone number for better matching
        const normalizedSearchPhone = normalizePhoneNumber(args.phone_number);
        
        // Find the appointment to edit
        const appointmentToEdit = appointments.find(app => 
          normalizePhoneNumber(app.phoneNumber) === normalizedSearchPhone &&
          app.date === args.original_date &&
          app.time === args.original_time
        );
        
        if (!appointmentToEdit) {
          response = {
            success: false,
            message: `Sorry, no appointment found for phone number ${args.phone_number} on ${formatDate(args.original_date)} at ${args.original_time}.`
          };
        } else {
          // Check if there are actually any changes to make
          const newDate = args.new_date || appointmentToEdit.date;
          const newTime = args.new_time || appointmentToEdit.time;
          const newService = args.new_service || appointmentToEdit.service;
          const newTechnician = args.new_technician || appointmentToEdit.technician;
          
          const hasChanges = 
            newDate !== appointmentToEdit.date || 
            newTime !== appointmentToEdit.time || 
            newService !== appointmentToEdit.service || 
            newTechnician !== appointmentToEdit.technician;
          
          if (!hasChanges) {
            response = {
              success: false,
              message: "No changes were specified for the appointment."
            };
          } else {
            // Check if the new time slot is available (only if date or time is changing)
            const isNewTimeSlot = newDate !== appointmentToEdit.date || newTime !== appointmentToEdit.time;
            let isSlotAvailable = true;
            
            if (isNewTimeSlot) {
              isSlotAvailable = !appointments.some(app => 
                app.id !== appointmentToEdit.id && // Skip checking against the current appointment
                app.date === newDate && 
                app.time === newTime
              );
            }
            
            if (isNewTimeSlot && !isSlotAvailable) {
              response = {
                success: false,
                message: `Sorry, the requested time slot on ${formatDate(newDate)} at ${newTime} is already booked.`
              };
            } else {
              // Create a changes summary for the response
              const changes = [];
              if (newDate !== appointmentToEdit.date) changes.push(`date from ${formatDate(appointmentToEdit.date)} to ${formatDate(newDate)}`);
              if (newTime !== appointmentToEdit.time) changes.push(`time from ${appointmentToEdit.time} to ${newTime}`);
              if (newService !== appointmentToEdit.service) changes.push(`service from ${appointmentToEdit.service} to ${newService}`);
              if (newTechnician !== appointmentToEdit.technician) {
                const oldTech = appointmentToEdit.technician || "no specific technician";
                const newTech = newTechnician || "no specific technician";
                changes.push(`technician from ${oldTech} to ${newTech}`);
              }
              
              // Update the appointment
              const updatedAppointment: Appointment = {
                ...appointmentToEdit,
                date: newDate,
                time: newTime,
                service: newService,
                technician: newTechnician
              };
              
              // Update the appointments list
              setAppointments(prevAppointments => 
                prevAppointments.map(app => 
                  app.id === appointmentToEdit.id ? updatedAppointment : app
                )
              );
              
              setCheckedDate(updatedAppointment.date);
              
              // Create success response
              response = {
                success: true,
                original_appointment: {
                  date: appointmentToEdit.date,
                  time: appointmentToEdit.time,
                  service: appointmentToEdit.service,
                  technician: appointmentToEdit.technician,
                  customerName: appointmentToEdit.customerName,
                  phoneNumber: appointmentToEdit.phoneNumber
                },
                updated_appointment: updatedAppointment,
                changes_summary: changes.join(", "),
                message: `Successfully updated the appointment for ${updatedAppointment.customerName}. Changed ${changes.join(", ")}.`
              };
            }
          }
        }
        
        // Update state to show the edit result
        setLastAvailabilityCheck(null);
        setLastBookingResult(null);
        setLastCancellationResult(null);
        setLastEditResult(response);
        setLastManagerMessage(null);
        
        // Send response back to the model
        client.sendToolResponse({
          functionResponses: [{
            response: response,
            id: editAppointmentCall.id,
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
      {lastManagerMessage && (
        <div className={`manager-message-sent ${lastManagerMessage.priority === 'urgent' ? 'urgent' : 'normal'}`}>
          <h3>Message sent to Manager</h3>
          <div className="result-content">
            <p><strong>Request:</strong> {lastManagerMessage.clientRequest}</p>
            <p><strong>Reason:</strong> {lastManagerMessage.reason}</p>
            <p><strong>Priority:</strong> {lastManagerMessage.priority}</p>
            <p className="result-message">
              Message sent to manager. {lastManagerMessage.priority === 'urgent' ? 'They will respond as soon as possible.' : 'They will review it shortly.'}
            </p>
          </div>
        </div>
      )}
      
      <div className="manager-controls">
        <button 
          className={`toggle-manager-inbox ${showManagerInbox ? 'active' : ''} ${managerMessages.filter(msg => msg.status === 'pending').length > 0 ? 'has-pending' : ''}`}
          onClick={() => setShowManagerInbox(!showManagerInbox)}
        >
          Manager Inbox 
          {managerMessages.filter(msg => msg.status === 'pending').length > 0 && 
            <span className="pending-badge">{managerMessages.filter(msg => msg.status === 'pending').length}</span>
          }
        </button>
      </div>
      
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
                  <div className="message-header">
                    <span className="timestamp">
                      {new Date(message.timestamp).toLocaleString()}
                    </span>
                    <span className={`status ${message.status}`}>
                      {message.status}
                    </span>
                    <span className={`priority ${message.priority}`}>
                      {message.priority}
                    </span>
                  </div>
                  <div className="message-content">
                    <p><strong>Client Request:</strong> {message.clientRequest}</p>
                    <p><strong>Reason:</strong> {message.reason}</p>
                  </div>
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
                            // Update the message with the response
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
                            
                            // Notify the AI through a message that there is a manager response
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
                      <p><strong>Manager Response:</strong></p>
                      <p className="response-text">{message.response}</p>
                      <p className="response-timestamp">
                        {message.responseTimestamp ? 
                          new Date(message.responseTimestamp).toLocaleString() : ''}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      
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
            {lastAvailabilityCheck.week_label && (
              <div>
                <p>Week of {lastAvailabilityCheck.week_label}</p>
                <div className="weekly-availability">
                  {Object.entries(lastAvailabilityCheck.availability).map(([date, slots]) => (
                    <div key={date} className="day-availability">
                      <p>{formatDate(date)}: {(slots as string[]).length} slots available</p>
                      {(slots as string[]).length > 0 && (
                        <ul className="mini-slots-list">
                          {(slots as string[]).map(slot => (
                            <li key={`${date}-${slot}`}>{slot}</li>
                          ))}
                        </ul>
                      )}
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
                <p>Phone: <strong>📱 {lastBookingResult.appointment.phoneNumber}</strong></p>
                <p>Date: <strong>{formatDate(lastBookingResult.appointment.date)}</strong></p>
                <p>Time: <strong>{lastBookingResult.appointment.time}</strong></p>
                <p>Service: <strong>{lastBookingResult.appointment.service}</strong></p>
                {lastBookingResult.appointment.technician && (
                  <p>Technician: <strong>{lastBookingResult.appointment.technician}</strong></p>
                )}
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
                <p>Phone: <strong>📱 {lastCancellationResult.cancelled_appointment.phoneNumber}</strong></p>
                <p>Date: <strong>{formatDate(lastCancellationResult.cancelled_appointment.date)}</strong></p>
                <p>Time: <strong>{lastCancellationResult.cancelled_appointment.time}</strong></p>
                <p>Service: <strong>{lastCancellationResult.cancelled_appointment.service}</strong></p>
                {lastCancellationResult.cancelled_appointment.technician && (
                  <p>Technician: <strong>{lastCancellationResult.cancelled_appointment.technician}</strong></p>
                )}
              </div>
            )}
            {lastCancellationResult.multiple_appointments && lastCancellationResult.appointments && (
              <div className="multiple-appointments">
                <p>Please specify which appointment to cancel:</p>
                <ul>
                  {lastCancellationResult.appointments.map((app: any, index: number) => (
                    <li key={index}>
                      <p>{app.formatted_date} at {app.time} - {app.service}</p>
                      <p>📱 {app.phoneNumber}</p>
                      {app.technician && <p>Technician: {app.technician}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      {lastEditResult && (
        <div className={`edit-results ${lastEditResult.success ? 'success' : 'error'}`}>
          <h3>Appointment Edit Result</h3>
          <div className="result-content">
            <p className="result-message">{lastEditResult.message}</p>
            
            {lastEditResult.success && lastEditResult.updated_appointment && (
              <>
                <div className="appointment-comparison">
                  <div className="original-appointment">
                    <h4>Original Appointment</h4>
                    <p>Customer: <strong>{lastEditResult.original_appointment.customerName}</strong></p>
                    <p>Phone: <strong>📱 {lastEditResult.original_appointment.phoneNumber}</strong></p>
                    <p>Date: <strong>{formatDate(lastEditResult.original_appointment.date)}</strong></p>
                    <p>Time: <strong>{lastEditResult.original_appointment.time}</strong></p>
                    <p>Service: <strong>{lastEditResult.original_appointment.service}</strong></p>
                    {lastEditResult.original_appointment.technician && (
                      <p>Technician: <strong>{lastEditResult.original_appointment.technician}</strong></p>
                    )}
                  </div>
                  
                  <div className="arrow">→</div>
                  
                  <div className="updated-appointment">
                    <h4>Updated Appointment</h4>
                    <p>Customer: <strong>{lastEditResult.updated_appointment.customerName}</strong></p>
                    <p>Phone: <strong>📱 {lastEditResult.updated_appointment.phoneNumber}</strong></p>
                    <p>Date: <strong>{formatDate(lastEditResult.updated_appointment.date)}</strong></p>
                    <p>Time: <strong>{lastEditResult.updated_appointment.time}</strong></p>
                    <p>Service: <strong>{lastEditResult.updated_appointment.service}</strong></p>
                    {lastEditResult.updated_appointment.technician && (
                      <p>Technician: <strong>{lastEditResult.updated_appointment.technician}</strong></p>
                    )}
                  </div>
                </div>
                
                <div className="changes-summary">
                  <p><strong>Changes Made:</strong> {lastEditResult.changes_summary}</p>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      <SimpleCalendar appointments={appointments} highlightDate={checkedDate} />
    </div>
  );
}

export const SalonReceptionist = SalonReceptionistComponent; 