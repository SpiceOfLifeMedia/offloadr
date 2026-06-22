export interface Prompt {
  id: string;
  question: string;
  order: number;
}

export interface Program {
  id: string;
  title: string;
  description: string;
  estimatedMinutes: number;
  prompts: Prompt[];
}

export const PROGRAMS: Program[] = [
  {
    id: "get-to-know-you",
    title: "Get To Know You",
    description: "Introduce yourself to your class in six short answers.",
    estimatedMinutes: 3,
    prompts: [
      { id: "gtky-1", question: "What is your name?", order: 0 },
      { id: "gtky-2", question: "What are your hobbies?", order: 1 },
      { id: "gtky-3", question: "What is your favourite subject?", order: 2 },
      { id: "gtky-4", question: "What is your goal this year?", order: 3 },
      { id: "gtky-5", question: "Tell us something interesting about yourself.", order: 4 },
      { id: "gtky-6", question: "Anything else you want to share?", order: 5 },
    ],
  },
  {
    id: "book-review",
    title: "Book Review",
    description: "Share your thoughts on a book you have been reading.",
    estimatedMinutes: 4,
    prompts: [
      { id: "br-1", question: "What is the title and who wrote it?", order: 0 },
      { id: "br-2", question: "What is the book about?", order: 1 },
      { id: "br-3", question: "Who is your favourite character and why?", order: 2 },
      { id: "br-4", question: "What was the best part of the story?", order: 3 },
      { id: "br-5", question: "Would you recommend it? Why?", order: 4 },
    ],
  },
  {
    id: "news-report",
    title: "News Report",
    description: "Deliver a short news bulletin on a topic of your choice.",
    estimatedMinutes: 5,
    prompts: [
      { id: "nr-1", question: "What is the headline today?", order: 0 },
      { id: "nr-2", question: "What happened and where?", order: 1 },
      { id: "nr-3", question: "Who is involved?", order: 2 },
      { id: "nr-4", question: "Why does this matter?", order: 3 },
      { id: "nr-5", question: "What happens next?", order: 4 },
    ],
  },
  {
    id: "science-reflection",
    title: "Science Reflection",
    description: "Walk through an experiment or discovery you explored.",
    estimatedMinutes: 4,
    prompts: [
      { id: "sr-1", question: "What were you investigating?", order: 0 },
      { id: "sr-2", question: "What did you predict would happen?", order: 1 },
      { id: "sr-3", question: "What actually happened?", order: 2 },
      { id: "sr-4", question: "What did you learn from it?", order: 3 },
      { id: "sr-5", question: "What would you do differently next time?", order: 4 },
    ],
  },
  {
    id: "excursion-recap",
    title: "Excursion Recap",
    description: "Recap a class trip or excursion in your own words.",
    estimatedMinutes: 4,
    prompts: [
      { id: "er-1", question: "Where did you go?", order: 0 },
      { id: "er-2", question: "What was the first thing you noticed?", order: 1 },
      { id: "er-3", question: "What was the highlight for you?", order: 2 },
      { id: "er-4", question: "What did you learn?", order: 3 },
      { id: "er-5", question: "Would you go back? Why?", order: 4 },
    ],
  },
  {
    id: "oral-presentation",
    title: "Oral Presentation",
    description: "Present your topic clearly and confidently on camera.",
    estimatedMinutes: 6,
    prompts: [
      { id: "op-1", question: "Introduce your topic.", order: 0 },
      { id: "op-2", question: "What is your first main point?", order: 1 },
      { id: "op-3", question: "What is your second main point?", order: 2 },
      { id: "op-4", question: "What is your third main point?", order: 3 },
      { id: "op-5", question: "Summarise what you covered.", order: 4 },
      { id: "op-6", question: "Any questions you want to leave the audience with?", order: 5 },
    ],
  },
  {
    id: "pntv-segment",
    title: "PNTV Segment",
    description: "Film your own segment for the school broadcast.",
    estimatedMinutes: 5,
    prompts: [
      { id: "pn-1", question: "Welcome viewers and introduce yourself.", order: 0 },
      { id: "pn-2", question: "What is your segment about today?", order: 1 },
      { id: "pn-3", question: "Share your main story or feature.", order: 2 },
      { id: "pn-4", question: "Any shoutouts or announcements?", order: 3 },
      { id: "pn-5", question: "Sign off and wrap up.", order: 4 },
    ],
  },
  {
    id: "create-your-own",
    title: "Create Your Own Program",
    description: "Build a custom program with your own questions.",
    estimatedMinutes: 5,
    prompts: [
      { id: "cyo-1", question: "Introduce yourself and your topic.", order: 0 },
      { id: "cyo-2", question: "Share your first point.", order: 1 },
      { id: "cyo-3", question: "Share your second point.", order: 2 },
      { id: "cyo-4", question: "Share your third point.", order: 3 },
      { id: "cyo-5", question: "Wrap up and sign off.", order: 4 },
    ],
  },
];

export function getProgramById(id: string): Program | undefined {
  return PROGRAMS.find((p) => p.id === id);
}
