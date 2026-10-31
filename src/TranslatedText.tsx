import katex from 'katex';
import { memo } from 'react';
import 'katex/dist/katex.min.css';
const options={throwOnError:true,trust:false,strict:'error' as const,maxExpand:1000,output:'htmlAndMathml' as const};
// Ordinary text stays React-escaped. KaTeX exposes selectable text and MathML.
function TranslatedText({text}:{text:string}){
  const parts=text.split(/(?<!\\)(\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\n])+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g);
  return <>{parts.map((part,i)=>{
    const dollar=part.startsWith('$')&&part.endsWith('$'),tex=part.startsWith('\\(')&&part.endsWith('\\)')||part.startsWith('\\[')&&part.endsWith('\\]');
    if((!dollar&&!tex)||part.length<3)return <span data-prose-text="true" key={i}>{part.replace(/\\\$/g,'$')}</span>;
    const display=part.startsWith('$$')||part.startsWith('\\['),n=dollar&&!display?1:2,math=part.slice(n,-n);
    try{return <span key={i} className={`rp-inline-math ${display?'rp-display-math':''}`} dangerouslySetInnerHTML={{__html:katex.renderToString(math,{...options,displayMode:display})}}/>;}
    catch{return <span key={i} className="rp-math-unverified" title="公式未能重排，请右键定位原文核对">{part}</span>;}
  })}</>;
}
export const MathFormula=memo(function MathFormula({latex,number}:{latex:string;number?:string}){
  try{return <div className="rp-equation-line"><div className="rp-equation-expression" dangerouslySetInnerHTML={{__html:katex.renderToString(latex,{...options,displayMode:true})}}/>{number&&<span className="rp-equation-number">({number})</span>}</div>;}
  catch{return <div className="rp-math-unverified" role="status">公式排版失败，请右键定位原文核对。<code>{latex}</code></div>;}
});
export default memo(TranslatedText);
