import { openRenderer, loadProject } from './browser.mjs';
const R = await openRenderer(loadProject());
const r = await R.page.evaluate(async () => {
  const c = new OffscreenCanvas(800, 500); const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 213, 0, 450); g.addColorStop(0,'#ffffff'); g.addColorStop(0.5,'#00ff00'); g.addColorStop(1,'#0000ff');
  ctx.fillStyle = g; ctx.fillRect(0,0,100,500);
  ctx.font = '400 336px "Archivo Black"'; ctx.fillText('5.5', 200, 450);
  const px = (x,y) => Array.from(ctx.getImageData(x, y, 1, 1).data);
  const { stops } = {stops:1};
  return [px(50,300), px(50,420), px(300,300), px(300,420)];
});
console.log(JSON.stringify(r)); await R.close();
