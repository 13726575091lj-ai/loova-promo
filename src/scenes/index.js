import open from './open.js';
import intro from './intro.js';
import title from './title.js';
import slot from './slot.js';
import localize from './localize.js';
import layers from './layers.js';
import brand from './brand.js';

/** scene type -> module { draw(ctx,S), cues(scene,project,dur), holds(scene,project,dur) } */
export const SCENES = { open, intro, title, slot, localize, layers, brand };
