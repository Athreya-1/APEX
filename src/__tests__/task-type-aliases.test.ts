import {
  resolveTaskTypeFromText,
  resolveTaskTypeMatch,
  COURSE_LIKE_TASK_TYPES,
  aliasesForTaskType,
} from '@/lib/tasks/task-type-aliases'

describe('task-type-aliases', () => {
  describe('resolveTaskTypeFromText', () => {
    const cases: Array<[string, string]> = [
      // Exam
      ['midterm next week', 'exam'],
      ['study for the final', 'exam'],
      ['chem test friday', 'exam'],
      ['comprehensive final prep', 'exam'],

      // Quiz
      ['pop quiz wednesday', 'quiz'],
      ['clicker questions', 'quiz'],

      // Lab
      ['213 lab 5 due thu', 'lab'],
      ['pre-lab writeup', 'lab'],
      ['complete the experiment', 'lab'],
      ['lab report due mon', 'writeup'],

      // Pset / homework
      ['213 hw 4', 'pset'],
      ['homework 3 due tomorrow', 'pset'],
      ['problem set 7', 'pset'],
      ['p-set 2', 'pset'],
      ['assignment 4', 'pset'],
      ['worksheet ch 3', 'pset'],
      ['exercise set 1', 'pset'],
      ['assn 5', 'pset'],

      // Reading
      ['read chapter 4', 'reading'],
      ['reading assignment pp 12-30', 'reading'],
      ['skim article for class', 'reading'],
      ['annotate textbook section 2', 'reading'],

      // Project
      ['final project milestone 2', 'project'],
      ['capstone deliverable', 'project'],
      ['group project sync', 'project'],
      ['hackathon submission', 'project'],

      // Writeup
      ['writeup for lab', 'writeup'],
      ['essay draft', 'writeup'],
      ['research paper outline', 'writeup'],
      ['discussion post due', 'writeup'],
      ['readme updates', 'writeup'],
      ['submit paper tomorrow', 'writeup'],

      // Review
      ['review slides before exam', 'review'],
      ['practice exam problems', 'review'],
      ['study guide for midterm', 'review'],
      ['cram for test', 'review'],
      ['flashcards for vocab', 'review'],
      ['recitation prep', 'review'],

      // Other
      ['email professor', 'other'],
      ['buy groceries', 'other'],
      ['office hours', 'other'],
    ]

    it.each(cases)('"%s" → %s', (input, expected) => {
      expect(resolveTaskTypeFromText(input)).toBe(expected)
    })
  })

  it('prefers lab report as writeup over lab', () => {
    expect(resolveTaskTypeFromText('finish lab report')).toBe('writeup')
  })

  it('prefers final project as project over exam final', () => {
    expect(resolveTaskTypeFromText('work on final project')).toBe('project')
  })

  it('prefers practice exam as review over exam', () => {
    expect(resolveTaskTypeFromText('do practice exam')).toBe('review')
  })

  it('marks course-like types', () => {
    expect(COURSE_LIKE_TASK_TYPES.has('lab')).toBe(true)
    expect(COURSE_LIKE_TASK_TYPES.has('pset')).toBe(true)
    expect(COURSE_LIKE_TASK_TYPES.has('writeup')).toBe(false)
  })

  it('exports aliases per type', () => {
    const psetAliases = aliasesForTaskType('pset')
    expect(psetAliases.some((a) => a.includes('homework') || a.includes('hw'))).toBe(true)
  })

  it('returns match metadata', () => {
    const m = resolveTaskTypeMatch('problem set 3')
    expect(m?.type).toBe('pset')
    expect(m?.matchedText.toLowerCase()).toContain('problem')
  })
})
