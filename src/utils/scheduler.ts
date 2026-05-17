export interface SchedulingResult {
  contactId: string;
  scheduled_send_at: string;
  sender_id: string;
}

export function distributeEmails(
  contacts: any[],
  senders: any[],
  workingHours: { start: string; end: string },
  maxPerDayPerSender = 45
): SchedulingResult[] {
  if (senders.length === 0 || contacts.length === 0) return [];

  const results: SchedulingResult[] = [];
  const [startHour, startMin] = workingHours.start.split(':').map(Number);
  const [endHour, endMin] = workingHours.end.split(':').map(Number);

  const startMinutes = startHour * 60 + startMin;
  const endMinutes = endHour * 60 + endMin;
  const workingWindowMs = (endMinutes - startMinutes) * 60 * 1000;
  
  const MIN_GAP_MS = 4 * 60 * 1000; // 4 minutes gap minimum
  const totalCapacityPerDay = senders.length * maxPerDayPerSender;

  // We'll calculate a target start time. If current time is before start, use today's start.
  // If current time is after end, use tomorrow's start.
  // Otherwise, use current time.
  const now = new Date();
  
  const MIN_START_DELAY_MS = 3 * 60 * 1000; // Minimum 3 minutes ahead hamesha

  // Track state for each sender
  const senderStates = senders.map(s => ({
    id: s.id,
    nextTime: now.getTime() + MIN_START_DELAY_MS,
    sentToday: 0
  }));

  // Enforce a global minimum gap across all emails, regardless of sender.
  let globalNextAllowedTime = now.getTime() + MIN_START_DELAY_MS;

  // Distribute contacts to senders
  for (let i = 0; i < contacts.length; i++) {
    const contact = contacts[i];
    const senderIdx = i % senders.length;
    const state = senderStates[senderIdx];

    let targetTime = Math.max(state.nextTime, globalNextAllowedTime);
    let valid = false;

    while (!valid) {
      const d = new Date(targetTime);
      const currentTimeMinutes = d.getHours() * 60 + d.getMinutes();

      if (currentTimeMinutes < startMinutes) {
        // Too early: Move to start of today
        d.setHours(startHour, startMin, 0, 0);
        targetTime = d.getTime();
      } else if (currentTimeMinutes >= endMinutes - 1) { // -1 min buffer
        // Too late: Move to start of tomorrow
        d.setDate(d.getDate() + 1);
        d.setHours(startHour, startMin, 0, 0);
        targetTime = d.getTime();
        state.sentToday = 0; // New day, reset count
      } else if (state.sentToday >= maxPerDayPerSender) {
        // Daily limit reached: Move to start of tomorrow
        d.setDate(d.getDate() + 1);
        d.setHours(startHour, startMin, 0, 0);
        targetTime = d.getTime();
        state.sentToday = 0;
      } else {
        // Within working hours and under limit
        valid = true;
      }
    }

    // Proportional gap calculation on a per-day basis
    const dayIdx = Math.floor(i / totalCapacityPerDay);
    const emailsThisDay = Math.min(contacts.length - dayIdx * totalCapacityPerDay, totalCapacityPerDay);
    
    // Proportional interval: spread the emails evenly across the working hours window
    const dayGapMs = emailsThisDay > 1 ? (workingWindowMs / (emailsThisDay - 1)) : workingWindowMs;
    
    // Apply primary condition: minimum 4 minutes gap
    const gapMs = Math.max(dayGapMs, MIN_GAP_MS);

    results.push({
      contactId: contact.id,
      scheduled_send_at: new Date(targetTime).toISOString(),
      sender_id: state.id
    });

    state.nextTime = targetTime + gapMs;
    globalNextAllowedTime = targetTime + gapMs;
    state.sentToday++;
  }

  return results;
}
