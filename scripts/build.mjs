import {build} from 'esbuild';
import {rm} from 'node:fs/promises';

await rm('dist',{recursive:true,force:true});
await Promise.all([
 build({entryPoints:['server/index.js'],bundle:true,format:'esm',platform:'browser',target:'es2023',outfile:'dist/server/index.js',loader:{'.html':'text','.css':'text','.woff2':'binary','.webp':'binary','.svg':'text','.png':'binary','.webmanifest':'text'},plugins:[{
  name:'folio-browser-entry',
  setup(plugin){
   plugin.onResolve({filter:/^folio-browser:/},()=>({path:'public/auth.js',namespace:'folio-browser'}));
   plugin.onLoad({filter:/.*/,namespace:'folio-browser'},async()=>{
    const result=await build({entryPoints:['public/auth.js'],bundle:true,write:false,format:'iife',target:'es2022',minify:true});
    return {contents:result.outputFiles[0].text,loader:'text'};
   });
   plugin.onLoad({filter:/\/public\/(app|investments)\.js$/},async({path})=>{
    const {readFile}=await import('node:fs/promises');
    return {contents:await readFile(path,'utf8'),loader:'text'};
   });
  }
 }],legalComments:'eof'})
]);
