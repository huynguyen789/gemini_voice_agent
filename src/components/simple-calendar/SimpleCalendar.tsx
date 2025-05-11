/**
 * Enhanced calendar component for salon appointment scheduling
 * Shows a weekly calendar with navigation controls and available/booked slots
 */
import React, { useState, useEffect } from "react";
import "./simple-calendar.scss";

// Types for our calendar data
export type Appointment = {
  id: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerName: string;
  service: string;
  phoneNumber: string; // Customer phone number
  technician?: string; // Optional technician name
};

// Types for our enhanced calendar state
export type CalendarState = {
  currentDate: string; // YYYY-MM-DD of selected date
  weekStartDate: Date; // Date object of the week's start (Monday)
};

// Get dates for a specific week (Monday-Sunday) based on starting Monday
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

// Format date to a readable string (MM/DD/YYYY)
const formatDateString = (date: Date): string => {
  const month = date.toLocaleString('default', { month: 'long' });
  const day = date.getDate();
  const year = date.getFullYear();
  
  return `${month} ${day}, ${year}`;
};

// Format date string in YYYY-MM-DD format to human-readable format
const formatDate = (dateString: string): string => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric' 
  });
};

// Available time slots (9AM to 5PM)
const timeSlots = [
  "09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"
];

// Default appointments (pre-populated for demo)
const defaultAppointments: Appointment[] = [
  { id: 1, date: getWeekDates(getMondayOfCurrentWeek())[0].date, time: "10:00", customerName: "Sarah Johnson", service: "Gel Manicure", phoneNumber: "(555) 123-4567" },
  { id: 2, date: getWeekDates(getMondayOfCurrentWeek())[2].date, time: "14:00", customerName: "Mike Roberts", service: "Deluxe Pedicure", phoneNumber: "(555) 234-5678" },
  { id: 3, date: getWeekDates(getMondayOfCurrentWeek())[4].date, time: "11:00", customerName: "Emma Davis", service: "Gel X Extensions", phoneNumber: "(555) 345-6789" },
  { id: 4, date: getWeekDates(getMondayOfCurrentWeek())[5].date, time: "15:00", customerName: "David Wilson", service: "Russian Manicure", phoneNumber: "(555) 456-7890" },
  { id: 5, date: getWeekDates(getMondayOfCurrentWeek())[1].date, time: "13:00", customerName: "Olivia Smith", service: "Madison Valgari Luxurious Pedicure", phoneNumber: "(555) 567-8901" },
  { id: 6, date: getWeekDates(getMondayOfCurrentWeek())[3].date, time: "16:00", customerName: "Jennifer Lee", service: "Lash Lift & Tint", phoneNumber: "(555) 678-9012" },
  { id: 7, date: getWeekDates(getMondayOfCurrentWeek())[6].date, time: "12:00", customerName: "Alex Chen", service: "Brow Lamination", phoneNumber: "(555) 789-0123" },
];

// Props type for the component
interface SimpleCalendarProps {
  appointments?: Appointment[];
  highlightDate?: string | null;
}

export function SimpleCalendar({ 
  appointments = defaultAppointments,
  highlightDate = null 
}: SimpleCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [weekStartDate, setWeekStartDate] = useState<Date>(getMondayOfCurrentWeek());
  const [weekDates, setWeekDates] = useState<{ date: string, label: string }[]>(getWeekDates(getMondayOfCurrentWeek()));
  const [showAllAppointments, setShowAllAppointments] = useState(false);
  
  // Update week dates when weekStartDate changes
  useEffect(() => {
    setWeekDates(getWeekDates(weekStartDate));
  }, [weekStartDate]);
  
  // Navigation functions
  const goToPreviousWeek = () => {
    const newStartDate = new Date(weekStartDate);
    newStartDate.setDate(weekStartDate.getDate() - 7);
    setWeekStartDate(newStartDate);
  };
  
  const goToNextWeek = () => {
    const newStartDate = new Date(weekStartDate);
    newStartDate.setDate(weekStartDate.getDate() + 7);
    setWeekStartDate(newStartDate);
  };
  
  const goToCurrentWeek = () => {
    setWeekStartDate(getMondayOfCurrentWeek());
  };
  
  // Month navigation functions
  const goToPreviousMonth = () => {
    const newStartDate = new Date(weekStartDate);
    newStartDate.setMonth(newStartDate.getMonth() - 1);
    setWeekStartDate(getMondayOfWeek(newStartDate));
  };
  
  const goToNextMonth = () => {
    const newStartDate = new Date(weekStartDate);
    newStartDate.setMonth(newStartDate.getMonth() + 1);
    setWeekStartDate(getMondayOfWeek(newStartDate));
  };
  
  // Helper to get Monday of any week
  const getMondayOfWeek = (date: Date): Date => {
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(date);
    monday.setDate(diff);
    monday.setHours(0, 0, 0, 0); // Reset hours to beginning of the day
    return monday;
  };
  
  // Check if a slot is booked
  const isSlotBooked = (date: string, time: string): Appointment | undefined => {
    return appointments.find(app => app.date === date && app.time === time);
  };
  
  // Get all available slots for a specific date
  const getAvailableSlots = (date: string): string[] => {
    const bookedTimes = appointments
      .filter(app => app.date === date)
      .map(app => app.time);
    
    return timeSlots.filter(time => !bookedTimes.includes(time));
  };
  
  // Get all appointments for a specific date
  const getAppointmentsForDate = (date: string): Appointment[] => {
    return appointments.filter(app => app.date === date);
  };
  
  // Handle slot click
  const handleSlotClick = (date: string, time: string) => {
    setSelectedDate(date);
    setSelectedTime(time);
  };
  
  // Generate week label (e.g., "May 1 - May 7, 2023")
  const getWeekLabel = (): string => {
    const weekStart = new Date(weekStartDate);
    const weekEnd = new Date(weekStartDate);
    weekEnd.setDate(weekStart.getDate() + 6);
    
    const startMonth = weekStart.toLocaleString('default', { month: 'short' });
    const endMonth = weekEnd.toLocaleString('default', { month: 'short' });
    
    const startDay = weekStart.getDate();
    const endDay = weekEnd.getDate();
    
    const year = weekStart.getFullYear();
    const endYear = weekEnd.getFullYear();
    
    if (year === endYear) {
      if (startMonth === endMonth) {
        return `${startMonth} ${startDay} - ${endDay}, ${year}`;
      } else {
        return `${startMonth} ${startDay} - ${endMonth} ${endDay}, ${year}`;
      }
    } else {
      return `${startMonth} ${startDay}, ${year} - ${endMonth} ${endDay}, ${endYear}`;
    }
  };
  
  // Check if the displayed week is the current week
  const isCurrentWeek = (): boolean => {
    const currentMonday = getMondayOfCurrentWeek();
    return (
      currentMonday.getFullYear() === weekStartDate.getFullYear() &&
      currentMonday.getMonth() === weekStartDate.getMonth() &&
      currentMonday.getDate() === weekStartDate.getDate()
    );
  };
  
  // Render the calendar
  return (
    <div className="simple-calendar">
      <div className="calendar-header">
        <h2>Nail Salon Calendar</h2>
        <div className="calendar-navigation">
          <button onClick={goToPreviousMonth} className="nav-button month-nav">
            &laquo; Previous Month
          </button>
          <button onClick={goToPreviousWeek} className="nav-button">
            &laquo; Previous Week
          </button>
          <button onClick={goToCurrentWeek} className="nav-button today-button" disabled={isCurrentWeek()}>
            Current Week
          </button>
          <button onClick={goToNextWeek} className="nav-button">
            Next Week &raquo;
          </button>
          <button onClick={goToNextMonth} className="nav-button month-nav">
            Next Month &raquo;
          </button>
        </div>
        <div className="week-label">{getWeekLabel()}</div>
      </div>
      
      <div className="calendar-grid">
        <div className="grid-header">
          <div className="time-column">Time</div>
          {weekDates.map((day, index) => (
            <div key={index} className={`day-column ${day.date === highlightDate ? 'highlighted' : ''}`}>
              {day.label}
            </div>
          ))}
        </div>
        
        <div className="grid-body">
          {timeSlots.map((time) => (
            <div key={time} className="time-row">
              <div className="time-slot">{time}</div>
              
              {weekDates.map((day) => {
                const appointment = isSlotBooked(day.date, time);
                const isHighlighted = day.date === highlightDate;
                
                return (
                  <div 
                    key={`${day.date}-${time}`} 
                    className={`calendar-slot ${appointment ? 'booked' : 'available'} ${isHighlighted ? 'highlighted' : ''}`}
                    onClick={() => handleSlotClick(day.date, time)}
                  >
                    {appointment ? (
                      <div className="appointment-info">
                        <div className="customer">{appointment.customerName}</div>
                        <div className="service">{appointment.service}</div>
                        <div className="phone">{appointment.phoneNumber}</div>
                        {appointment.technician && (
                          <div className="technician">with {appointment.technician}</div>
                        )}
                      </div>
                    ) : (
                      <div className="available-text">Available</div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      
      {selectedDate && selectedTime && (
        <div className="selected-slot-info">
          <h3>Selected Time Slot</h3>
          <p>Date: {selectedDate}</p>
          <p>Time: {selectedTime}</p>
          {isSlotBooked(selectedDate, selectedTime) ? (
            <div className="booked-info">
              <p>This slot is already booked.</p>
            </div>
          ) : (
            <div className="available-info">
              <p>This slot is available for booking.</p>
            </div>
          )}
        </div>
      )}
      
      <div className="appointments-list">
        <h3>All Appointments ({appointments.length})</h3>
        {appointments.length === 0 ? (
          <p>No appointments scheduled.</p>
        ) : (
          <>
            <div className="filter-controls">
              <label>
                <input 
                  type="checkbox" 
                  checked={showAllAppointments} 
                  onChange={() => setShowAllAppointments(!showAllAppointments)}
                />
                Show all appointments
              </label>
            </div>
            <ul>
              {appointments
                .filter(appointment => showAllAppointments || weekDates.some(day => day.date === appointment.date))
                .map((appointment) => (
                  <li key={appointment.id} className="appointment-item">
                    <div className="appointment-customer">{appointment.customerName}</div>
                    <div className="appointment-date">{formatDate(appointment.date)} at {appointment.time}</div>
                    <div className="appointment-service">{appointment.service}</div>
                    <div className="appointment-phone">📱 {appointment.phoneNumber}</div>
                    {appointment.technician && (
                      <div className="appointment-technician">Technician: {appointment.technician}</div>
                    )}
                  </li>
                ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export default SimpleCalendar;