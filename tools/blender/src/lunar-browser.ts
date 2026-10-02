import {GLTFExporter} from 'three/examples/jsm/exporters/GLTFExporter.js';
import {buildHncPlayerExport} from './interchange';

// Dedicated fictional identities; country only satisfies the factory's palette
// lookup. Both colours are overridden and no national marks enter the film.
(globalThis as any).lunarExport = async () => {
  const out = [];
  for (const [n,id] of [[1,21],[2,22]]) {
    const assetId = `hnc-lunar-0${n}`;
    const b = buildHncPlayerExport({kind:'player',assetId,country:'TR',number:n,id,keeper:false,
      primary:'#eee9db',secondary:'#142238',tag:`LUNAR0${n}`});
    const glb = await new GLTFExporter().parseAsync(b.root,{binary:true,trs:true});
    const bytes = new Uint8Array(glb as ArrayBuffer);
    let raw='';
    for(let i=0;i<bytes.length;i+=32768) raw+=String.fromCharCode(...bytes.subarray(i,i+32768));
    out.push({assetId,expected:b.expected,params:b.params,glb:btoa(raw)});
  }
  return out;
};
