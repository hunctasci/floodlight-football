import { compileTemplate } from '../reel/compile';
import type { ReelSpec, TemplateInput } from '../reel/types';
import { compileShotPlan } from '../reel/compile';
import type { ShotPlan } from '../reel/types';

/**
 * StoryCompiler: semantic TemplateInput -> ReelSpec -> ShotPlan.
 * The single creative entry point for agents.
 */
export function compileStory(input: TemplateInput): { spec: ReelSpec; plan: ShotPlan } {
  const spec = compileTemplate(input);
  const plan = compileShotPlan(spec);
  return { spec, plan };
}
