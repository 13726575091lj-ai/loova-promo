// Renders the soundtrack off the main thread for the preview UI.
import { renderAudio } from './audio.js';

self.onmessage = (e) => {
  const { id, project } = e.data;
  try {
    const a = renderAudio(project);
    self.postMessage({ id, sr: a.sr, L: a.mix[0], R: a.mix[1], cues: a.cues }, [a.mix[0].buffer, a.mix[1].buffer]);
  } catch (err) {
    self.postMessage({ id, error: String(err) });
  }
};
