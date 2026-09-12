import { SCHOOL_CHAPTER } from './chapter-data';
import { readChapter, saveChapter } from '../shared/preferences';
export type SchoolMemory = {
  version: 1;
  afterSchool: boolean;
  chapterComplete: boolean;
  midAutumn: boolean;
};
export function readSchoolMemory(): SchoolMemory {
  const empty: SchoolMemory = {
    version: 1,
    afterSchool: false,
    chapterComplete: false,
    midAutumn: false,
  };
  try {
    const p: unknown = readChapter('school', SCHOOL_CHAPTER.storageKey);
    if (
      typeof p !== 'object' ||
      p === null ||
      !('version' in p) ||
      p.version !== 1
    )
      return empty;
    return {
      version: 1,
      afterSchool: 'afterSchool' in p && p.afterSchool === true,
      chapterComplete: 'chapterComplete' in p && p.chapterComplete === true,
      midAutumn: 'midAutumn' in p && p.midAutumn === true,
    };
  } catch {
    return empty;
  }
}
export function saveSchoolMemory(memory: SchoolMemory) {
  try {
    return saveChapter('school', memory, memory.chapterComplete);
  } catch {
    return false;
  }
}
