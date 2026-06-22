import { z } from 'zod'

export const TaskTypeTagSchema = z.enum([
  'lab', 'pset', 'reading', 'project', 'writeup', 'quiz', 'review', 'exam', 'other',
])
export const CognitiveClassSchema = z.enum([
  'heavy_focus', 'light_admin', 'creative', 'physical', 'restorative',
])

export const ParsedTaskSchema = z.object({
  kind: z.literal('task'),
  title: z.string().min(1),
  courseCode: z.string().nullable(),
  taskType: TaskTypeTagSchema,
  dueDate: z.string().nullable(),
  doDate: z.string().nullable(),
  estimateHours: z.number().positive().nullable(),
  confidence: z.number().min(0).max(1),
  resolvedCourseId: z.string().optional(),
})

export const ClarificationSchema = z.object({
  kind: z.literal('clarify'),
  question: z.string().min(1),
  missingFields: z.array(z.string()),
  partial: ParsedTaskSchema.partial().optional(),
  courseCandidates: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
})

export const QuickAddResultSchema = z.discriminatedUnion('kind', [ParsedTaskSchema, ClarificationSchema])

export const DecomposedHabitSchema = z.object({
  title: z.string().min(1),
  mode: z.enum(['time_blocked', 'check_off']),
  durationMins: z.number().int().positive(),
  frequencyType: z.enum(['daily', 'weekly', 'custom']),
  frequencyTarget: z.number().int().positive(),
  cognitiveClass: CognitiveClassSchema,
  rationale: z.string(),
})
export const GoalDecompositionSchema = z.object({
  goalTitle: z.string().min(1),
  habits: z.array(DecomposedHabitSchema).min(1),
})

export const PlanExplanationSchema = z.object({
  summary: z.string().min(1),
  highlights: z.array(z.string()),
})

export const ReplanInstructionSchema = z.object({
  intent: z.enum(['move', 'resize', 'add', 'remove', 'swap', 'rebalance', 'unknown']),
  targetRef: z.string().nullable(),
  params: z.record(z.string(), z.union([z.string(), z.number()])),
  rawText: z.string(),
})

export type ParsedTask = z.infer<typeof ParsedTaskSchema>
export type Clarification = z.infer<typeof ClarificationSchema>
export type QuickAddResult = z.infer<typeof QuickAddResultSchema>
export type DecomposedHabit = z.infer<typeof DecomposedHabitSchema>
export type GoalDecomposition = z.infer<typeof GoalDecompositionSchema>
export type PlanExplanation = z.infer<typeof PlanExplanationSchema>
export type ReplanInstruction = z.infer<typeof ReplanInstructionSchema>
