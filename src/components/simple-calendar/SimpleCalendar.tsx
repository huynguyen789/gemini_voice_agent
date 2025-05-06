/**
 * Simple calendar component for salon appointment scheduling
 * Shows a one-week calendar with available and booked slots
 */
import React, { useState } from "react";
import "./simple-calendar.scss";

// Types for our calendar data
export type Appointment = {
  id: number;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  customerName: string;
  service: string;
};

// Get the dates for this week (Monday-Sunday)
const getWeekDates = (): { date: string, label: string }[] => {
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

// Default appointments (pre-populated for demo)
const defaultAppointments: Appointment[] = [
  { id: 1, date: getWeekDates()[0].date, time: "10:00", customerName: "Sarah Johnson", service: "Gel Manicure" },
  { id: 2, date: getWeekDates()[2].date, time: "14:00", customerName: "Mike Roberts", service: "Deluxe Pedicure" },
  { id: 3, date: getWeekDates()[4].date, time: "11:00", customerName: "Emma Davis", service: "Gel X Extensions" },
  { id: 4, date: getWeekDates()[5].date, time: "15:00", customerName: "David Wilson", service: "Russian Manicure" },
  { id: 5, date: getWeekDates()[1].date, time: "13:00", customerName: "Olivia Smith", service: "Madison Valgari Luxurious Pedicure" },
  { id: 6, date: getWeekDates()[3].date, time: "16:00", customerName: "Jennifer Lee", service: "Lash Lift & Tint" },
  { id: 7, date: getWeekDates()[6].date, time: "12:00", customerName: "Alex Chen", service: "Brow Lamination" },
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
  
  const weekDates = getWeekDates();
  
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
  
  // Render the calendar
  return (
    <div className="simple-calendar">
      <h2>Nail Salon Weekly Calendar</h2>
      
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
        <h3>All Appointments</h3>
        {appointments.length === 0 ? (
          <p>No appointments scheduled.</p>
        ) : (
          <ul>
            {appointments.map((appointment) => (
              <li key={appointment.id} className="appointment-item">
                <div className="appointment-date">{appointment.date} at {appointment.time}</div>
                <div className="appointment-customer">{appointment.customerName}</div>
                <div className="appointment-service">{appointment.service}</div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default SimpleCalendar;