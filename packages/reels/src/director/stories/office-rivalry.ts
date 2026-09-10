import type { TemplateInput } from '../../reel/types';
import { compileOfficeRivalry } from '../../reel/compile';

export function officeRivalryStory(input: TemplateInput) {
  return compileOfficeRivalry(input);
}
