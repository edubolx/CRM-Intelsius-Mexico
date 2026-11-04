import {readFile} from 'node:fs/promises';
import {transformWithEsbuild} from 'vite';
import React from 'react';
const cache=new Map();
async function moduleURL(url) {
  if(cache.has(url.href)) return cache.get(url.href);
  let source=await readFile(url,'utf8');
  source=source.replace(/import ['"][^'"]+\.css['"];?/g,'');
  for(const match of [...source.matchAll(/from ['"]([^'"]+\.jsx)['"]/g)]) {
    source=source.replace(match[0],`from '${await moduleURL(new URL(match[1],url))}'`);
  }
  source=source.replace(/from ['"]([^'"]+\.js)['"]/g,(_,p)=>`from '${new URL(p,url).href}'`);
  const {code}=await transformWithEsbuild(source,url.pathname,{loader:'jsx',jsxFactory:'React.createElement',jsxFragment:'React.Fragment'});
  const data=`data:text/javascript;base64,${Buffer.from(`import React from '${import.meta.resolve('react')}';\n${code}`).toString('base64')}`;
  cache.set(url.href,data);return data;
}
export async function loadJsx(relative) {return import(await moduleURL(new URL(`../../src/${relative}`,import.meta.url)));}
export function nodes(tree) {const all=[];function visit(el){if(!React.isValidElement(el))return;all.push(el);React.Children.forEach(el.props.children,visit);}visit(tree);return all;}
