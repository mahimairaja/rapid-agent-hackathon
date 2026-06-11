// Human phrasing for Maya's live tool activity, keyed by backend tool name.
export const TOOL_LABELS: Record<string, { running: string; done: string }> = {
  find_patient: { running: "Verifying it's you", done: 'Verified your identity' },
  get_my_plan: { running: 'Opening your recovery plan', done: 'Opened your recovery plan' },
  get_medications: { running: 'Checking your medications', done: 'Checked your medications' },
  get_next_dose: { running: 'Checking your next dose', done: 'Checked your next dose' },
  answer_recovery_question: {
    running: 'Searching your care plan',
    done: 'Searched your care plan',
  },
  triage_symptom: { running: 'Running a symptom check', done: 'Symptom check complete' },
  list_follow_up_slots: {
    running: 'Finding open appointment times',
    done: 'Found open appointment times',
  },
  book_follow_up_slot: { running: 'Booking your follow-up', done: 'Booked your follow-up' },
  reschedule_follow_up: {
    running: 'Rescheduling your follow-up',
    done: 'Rescheduled your follow-up',
  },
  get_follow_up_booking: { running: 'Checking your booking', done: 'Checked your booking' },
  flag_pharmacist: { running: 'Flagging your pharmacist', done: 'Flagged your pharmacist' },
  recovery_trends: {
    running: 'Looking at your check-in trends',
    done: 'Reviewed your check-ins',
  },
}

export function toolLabel(tool: string, status: 'running' | 'done'): string {
  return TOOL_LABELS[tool]?.[status] ?? (status === 'running' ? 'Working on it' : 'Done')
}
