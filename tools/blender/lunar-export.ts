import {build} from 'esbuild';
import {chromium} from 'playwright';
import {writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const dest='social/shorts/first-touch-on-the-moon/assets';
const code=await build({entryPoints:['tools/blender/src/lunar-browser.ts'],bundle:true,format:'iife',platform:'browser',write:false});
const browser=await chromium.launch({headless:true});
try {
  const page=await browser.newPage();
  await page.setContent('<html><body></body></html>');
  await page.addScriptTag({content:code.outputFiles[0].text});
  const assets=await page.evaluate(()=>(globalThis as any).lunarExport());
  const records=assets.map((a:any)=>{
    const bytes=Buffer.from(a.glb,'base64');
    writeFileSync(`${dest}/${a.assetId}.glb`,bytes);
    return {assetId:a.assetId,expected:a.expected,params:a.params,sha256:createHash('sha256').update(bytes).digest('hex')};
  });
  writeFileSync(`${dest}/cast-manifest.json`,JSON.stringify({assets:records},null,2)+'\n');
  console.log(records.map((a:any)=>a.assetId));
} finally {await browser.close();}
