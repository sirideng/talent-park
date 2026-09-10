import { SCHOOL_CHAPTER } from './chapter-data';
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
    const p: unknown = JSON.parse(
      localStorage.getItem(SCHOOL_CHAPTER.storageKey) ?? 'null',
    );
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
    localStorage.setItem(SCHOOL_CHAPTER.storageKey, JSON.stringify(memory));
    return true;
  } catch {
    return false;
  }
}
