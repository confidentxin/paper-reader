// Same KaTeX version validates in the main process and renders in the reader.
let katex;
try { katex=require('./vendor/katex.cjs'); } catch(error) { if(error.code!=='MODULE_NOT_FOUND')throw error;katex=require('katex'); }
function validateLatex(latex,display=false){
  if(typeof latex!=='string'||!latex.trim()||latex.length>20000)throw new Error('公式缺少 LaTeX 或内容过长。');
  if(/\\(?:href|url|includegraphics|html\w*|def|gdef|edef|xdef|newcommand|renewcommand|providecommand|global|require)\b/.test(latex)||/<\/?[a-z]/i.test(latex))throw new Error('公式包含不允许的命令。');
  try{katex.renderToString(latex,{throwOnError:true,trust:false,strict:'error',maxExpand:1000,displayMode:display,output:'htmlAndMathml'});}catch(e){throw new Error('公式 LaTeX 无法排版：'+e.message.slice(0,220));}
  return latex.trim();
}
// Dollar and conventional TeX delimiters. Escaped dollar amounts remain text.
function mathParts(text){
  const pattern=/(?<!\\)(\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\n])+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;
  return [...text.matchAll(pattern)].map(m=>{const s=m[0],display=s.startsWith('$$')||s.startsWith('\\['),n=s.startsWith('$')&&!display?1:2;return {latex:s.slice(n,-n),display};});
}
function withoutMath(text){return text.replace(/(?<!\\)(\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\n])+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g,'');}
function validateInline(text){
  for(const part of mathParts(text))validateLatex(part.latex,part.display);
  const rest=withoutMath(text);
  if(/\\[()[\]]|\\(?:frac|sqrt|sum|prod|begin|end)\b|(?<!\\)\$(?:\\[A-Za-z]+|[A-Za-z]\b)/.test(rest))throw new Error('公式分隔符缺失或不匹配，请使用完整的数学分隔符。');
}
module.exports={validateLatex,validateInline,mathParts,withoutMath};
