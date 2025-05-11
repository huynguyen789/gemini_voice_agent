# Manager Communication Feature Implementation Plan

## Overview
This feature will allow the AI salon receptionist to escalate specific client requests to a manager and receive responses back. The manager can review these requests in a dedicated UI component and provide guidance, which the AI will then use to respond to the client.

## Core Functionality
- [ ] Add function calling for AI to send messages to manager
- [ ] Create UI for manager to view messages and respond
- [ ] Implement mechanism to send manager responses back to AI
- [ ] Update system instructions for AI to handle manager interactions

## Implementation Checklist

### 1. Function Declaration & System Instructions
- [ ] Create `send_message_to_manager` function declaration
  - Parameters: `client_request`, `reason`, `priority` (optional)
- [ ] Update system instructions in `SalonReceptionist` component
  - Add guidelines for when to escalate (discounts >20%, special requests, complaints)
  - Include instructions for handling manager responses

### 2. State Management
- [ ] Add state for manager messages in `SalonReceptionist` component
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
- [ ] Implement functions for:
  - [ ] Adding new manager messages
  - [ ] Updating messages with manager responses
  - [ ] Tracking message status

### 3. UI Components
- [ ] Create `ManagerInbox` component
  - [ ] Message list display with status indicators
  - [ ] Response input fields for each message
  - [ ] Send response buttons
- [ ] Integrate `ManagerInbox` into existing UI
  - [ ] Add as collapsible panel or tab near calendar
  - [ ] Implement notification badge for new messages

### 4. Event Handling
- [ ] Set up listener for `send_message_to_manager` function calls
- [ ] Implement handler to store messages in state
- [ ] Create mechanism to send manager responses back to AI
  - [ ] Use `client.sendToolResponse` or direct message
  - [ ] Format response with reference to original request ID

### 5. Testing
- [ ] Test AI recognition of escalation scenarios
- [ ] Verify message storage and display in UI
- [ ] Confirm manager response mechanism
- [ ] Validate AI understanding and use of manager responses

### 6. UI/UX Refinement
- [ ] Add styling using Tailwind CSS
- [ ] Implement animations/notifications for new messages
- [ ] Ensure responsive design for different screen sizes
- [ ] Add color coding for message priority

### 7. Documentation
- [ ] Update system instructions documentation
- [ ] Add comments to new code
- [ ] Document message flow between AI, manager, and client

## Future Enhancements (Post-MVP)
- [ ] External notifications (SMS/email)
- [ ] Threaded conversations for follow-up questions
- [ ] Manager response templates for common scenarios
- [ ] Analytics on escalated requests

## Implementation Notes
- Keep UI clean and intuitive
- Ensure clear message status tracking
- Maintain responsive design principles
- Follow existing styling conventions
- Use unique IDs to link requests and responses 