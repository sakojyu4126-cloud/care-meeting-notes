export interface Attendee {
  id: string;
  name: string;
  affiliation: string;
}

export interface MeetingMinutes {
  reportDate: string; // YYYY-MM-DD
  officeName: string;
  reporterName: string;
  clientName: string;
  careLevel: string;
  location: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  attendees: Attendee[];
  discussedItems: string;
  discussionContent: string;
  conclusion: string;
  remainingIssues: string;
  nextMeeting: string;
  homeCareAgency?: string;
}

export interface GenerationResponse {
  discussedItems: string;
  discussionContent: string;
  conclusion: string;
  remainingIssues: string;
  nextMeeting: string;
  suggestedClientName?: string;
  suggestedCareLevel?: string;
  suggestedDate?: string;
  suggestedLocation?: string;
  fallbackUsed?: boolean;
  apiFallbackUsed?: boolean;
}
