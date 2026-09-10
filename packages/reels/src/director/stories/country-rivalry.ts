import type { TemplateInput } from '../../reel/types';
import { compileCountryRivalry } from '../../reel/compile';

export function countryRivalryStory(input: TemplateInput) {
  return compileCountryRivalry(input);
}
