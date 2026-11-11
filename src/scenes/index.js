import open from './open.js';
import open3 from './open3.js';
import intro from './intro.js';
import title from './title.js';
import slot from './slot.js';
import slot3 from './slot3.js';
import drag from './drag.js';
import flagdrop from './flagdrop.js';
import localize from './localize.js';
import layers from './layers.js';
import layers3 from './layers3.js';
import brand from './brand.js';
import portfolio from './portfolio.js';

/** scene type -> module { draw(ctx,S), cues(scene,project,dur), holds(scene,project,dur) } */
export const SCENES = { open, open3, intro, title, slot, slot3, drag, flagdrop, localize, layers, layers3, brand, ...portfolio };
