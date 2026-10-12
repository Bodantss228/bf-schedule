export type Mode = "group" | "teacher";
export type Entity = { id: string; name: string };
export type LessonType = "lecture" | "practice" | "lab" | "other";
export type Lesson = {
  id: string;
  date: string;
  dayOfWeek: number;
  lessonNumber: number;
  timeStart: string;
  timeEnd: string;
  subject: string;
  lessonType: LessonType;
  sourceType: string;
  classroom: string;
  teacherId: string | null;
  groupId: string;
  updatedAt: string;
};
export type Coverage = {
  groupId: string;
  from: string;
  to: string;
  updatedAt: string;
};
export type Snapshot = {
  groups: Entity[];
  teachers: Entity[];
  lessons: Lesson[];
  coverage: Coverage[];
};
export type Schedule = {
  lessons: (Lesson & { teacher: string; group: string })[];
  updatedAt: string | null;
  covered: boolean;
  stale: boolean;
};
