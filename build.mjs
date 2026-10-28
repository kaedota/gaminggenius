import {cp,mkdir} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const path of ['index.html','styles.css','app.js','ranking.js','results-tool.html','results-tool.js','assets','data'])await cp(path,`dist/${path}`,{recursive:true});
console.log('Static preview prepared in dist/');
