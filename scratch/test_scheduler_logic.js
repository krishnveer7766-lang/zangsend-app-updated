// test_scheduler_logic.js
// Verification of the new daily limit scheduling logic

function parseTimeString(timeStr) {
  const match = (timeStr || "").match(/(\d+):(\d+)(?:\s*(am|pm))?/i);
  if (!match) return { hour: 9, minute: 0 };
  
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const ampm = match[3]?.toLowerCase();
  
  if (ampm === 'pm' && hour < 12) {
    hour += 12;
  } else if (ampm === 'am' && hour === 12) {
    hour = 0;
  }
  
  return { 
    hour: isNaN(hour) ? 9 : hour, 
    minute: isNaN(minute) ? 0 : minute 
  };
}

function getLocalDateString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function distributeEmails(
  contacts,
  senders,
  workingHours,
  maxPerDayPerSender = 45,
  existingScheduledCounts = {}
) {
  if (senders.length === 0 || contacts.length === 0) return [];

  const results = [];
  const { hour: startHour, minute: startMin } = parseTimeString(workingHours?.start);
  const { hour: endHour, minute: endMin } = parseTimeString(workingHours?.end);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;

  // Calculate working Window Ms supporting overnight (midnight crossing) windows
  const workingWindowMs = endMinutes > startMinutes 
    ? (endMinutes - startMinutes) * 60 * 1000 
    : ((endMinutes + 24 * 60) - startMinutes) * 60 * 1000;
  
  const MIN_GAP_MS = 4 * 60 * 1000; // 4 minutes gap minimum
  const totalCapacityPerDay = senders.length * maxPerDayPerSender;

  const now = new Date();
  const MIN_START_DELAY_MS = 3 * 60 * 1000; // Minimum 3 minutes ahead hamesha

  // Track state for each sender
  const senderStates = senders.map(s => {
    const initialCounts = { ...(existingScheduledCounts[s.id] || {}) };
    return {
      id: s.id,
      nextTime: now.getTime() + MIN_START_DELAY_MS,
      sentPerDay: initialCounts
    };
  });

  // Enforce a global minimum gap across all emails, regardless of sender.
  let globalNextAllowedTime = now.getTime() + MIN_START_DELAY_MS;

  // Distribute contacts to senders
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const senderIdx = i % senders.length;
    const state = senderStates[senderIdx];

    let targetTime = Math.max(state.nextTime, globalNextAllowedTime);
    let valid = false;
    let safetyCounter = 0;

    while (!valid) {
      if (++safetyCounter > 500) {
        valid = true;
        break;
      }
      const d = new Date(targetTime);
      const currentMin = d.getHours() * 60 + d.getMinutes();

      let inWindow = false;
      if (endMinutes > startMinutes) {
        inWindow = currentMin >= startMinutes && currentMin < endMinutes;
      } else {
        inWindow = currentMin >= startMinutes || currentMin < endMinutes;
      }

      if (!inWindow) {
        // If not in window, advance to the next starting time
        if (endMinutes > startMinutes) {
          if (currentMin >= endMinutes) {
            d.setDate(d.getDate() + 1);
          }
        } else {
          // Midnight crossing window
          if (currentMin >= endMinutes && currentMin < startMinutes) {
            // Keep on the same day, just move to startMinutes
          } else {
            d.setDate(d.getDate() + 1);
          }
        }
        d.setHours(startHour, startMin, 0, 0);
        targetTime = d.getTime();
      } else {
        // We are in window. Now check the daily limit for this specific day
        const dateStr = getLocalDateString(d);
        const currentSentOnDay = state.sentPerDay[dateStr] || 0;

        if (currentSentOnDay >= maxPerDayPerSender) {
          // Daily limit reached: Move to start of tomorrow
          d.setDate(d.getDate() + 1);
          d.setHours(startHour, startMin, 0, 0);
          targetTime = d.getTime();
        } else {
          valid = true;
        }
      }
    }

    // Proportional gap calculation on a per-day basis
    const dayIdx = Math.floor(i / totalCapacityPerDay);
    const emailsThisDay = Math.min(contacts.length - dayIdx * totalCapacityPerDay, totalCapacityPerDay);
    
    // Proportional interval: spread the emails evenly across the working hours window
    let dayGapMs = emailsThisDay > 1 ? (workingWindowMs / (emailsThisDay - 1)) : workingWindowMs;

    // Proactive Optimization: if it is the first day (dayIdx === 0) and we are scheduling mid-day,
    // calculate a tighter gap to fit as many emails as possible today (up to the limit)
    if (dayIdx === 0) {
      const dNow = new Date();
      const currentMin = dNow.getHours() * 60 + dNow.getMinutes();
      
      let isMidDay = false;
      if (endMinutes > startMinutes) {
        isMidDay = currentMin > startMinutes && currentMin < endMinutes;
      } else {
        isMidDay = currentMin > startMinutes || currentMin < endMinutes;
      }

      if (isMidDay) {
        let remainingWindowMs = 0;
        if (endMinutes > startMinutes) {
          remainingWindowMs = (endMinutes - currentMin) * 60 * 1000;
        } else {
          // Midnight crossing
          if (currentMin > startMinutes) {
            remainingWindowMs = ((endMinutes + 24 * 60) - currentMin) * 60 * 1000;
          } else {
            remainingWindowMs = (endMinutes - currentMin) * 60 * 1000;
          }
        }
        dayGapMs = emailsThisDay > 1 ? (remainingWindowMs / emailsThisDay) : remainingWindowMs;
      }
    }
    
    // Apply primary condition: minimum 4 minutes gap
    const gapMs = Math.max(dayGapMs, MIN_GAP_MS);

    results.push({
      contactId: contact.id,
      scheduled_send_at: new Date(targetTime).toISOString(),
      sender_id: state.id
    });

    const finalDateStr = getLocalDateString(new Date(targetTime));
    state.sentPerDay[finalDateStr] = (state.sentPerDay[finalDateStr] || 0) + 1;

    state.nextTime = targetTime + gapMs;
    globalNextAllowedTime = targetTime + gapMs;
  }

  return results;
}

// Setup test inputs
const senders = [{ id: 'sender-1', email: 'test@gmail.com' }];
const workingHours = { start: '09:00', end: '18:00' };

// Create 100 dummy contacts for Run 1
const contactsRun1 = Array.from({ length: 100 }, (_, index) => ({ id: `contact-${index + 1}` }));

console.log("=== RUN 1: Scheduling 100 emails (0 pre-existing) ===");
const run1Results = distributeEmails(contactsRun1, senders, workingHours, 45);

// Count scheduled emails per day for Run 1
const run1Counts = {};
run1Results.forEach(r => {
  const dStr = getLocalDateString(new Date(r.scheduled_send_at));
  run1Counts[dStr] = (run1Counts[dStr] || 0) + 1;
});
console.log("Run 1 Counts per Day:", run1Counts);

// Setup pre-existing counts from Run 1 for Run 2
const existingScheduledCounts = {
  'sender-1': { ...run1Counts }
};

// Create another 100 dummy contacts for Run 2
const contactsRun2 = Array.from({ length: 100 }, (_, index) => ({ id: `contact-${index + 101}` }));

console.log("\n=== RUN 2: Scheduling another 100 emails (with Run 1 counts as pre-existing) ===");
const run2Results = distributeEmails(contactsRun2, senders, workingHours, 45, existingScheduledCounts);

// Count scheduled emails per day for Run 2
const run2Counts = {};
run2Results.forEach(r => {
  const dStr = getLocalDateString(new Date(r.scheduled_send_at));
  run2Counts[dStr] = (run2Counts[dStr] || 0) + 1;
});
console.log("Run 2 Counts per Day:", run2Counts);

console.log("\n=== Combining counts to verify overall total ===");
const combinedCounts = {};
Object.keys(run1Counts).forEach(day => {
  combinedCounts[day] = (combinedCounts[day] || 0) + run1Counts[day];
});
Object.keys(run2Counts).forEach(day => {
  combinedCounts[day] = (combinedCounts[day] || 0) + run2Counts[day];
});
console.log("Combined Total Counts per Day:", combinedCounts);
