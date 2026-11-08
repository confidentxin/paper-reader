import type {ReactNode} from 'react';
import TranslatedText from './TranslatedText';

// A deliberately small Markdown subset. All text remains React-escaped;
// HTML, images and links are never interpreted. Math uses the existing safe renderer.
function inline(text:string):ReactNode[] {
 const parts=text.split(/(\$\$[\s\S]+?\$\$|\$(?:\\.|[^$\n])+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\]|`[^`\n]+`|\*\*[^*\n]+\*\*|__[^_\n]+__|\*[^*\n]+\*)/g);
 return parts.map((part,i)=>{
  if(part.startsWith('`')&&part.endsWith('`'))return <code key={i}>{part.slice(1,-1)}</code>;
  if((part.startsWith('**')&&part.endsWith('**'))||(part.startsWith('__')&&part.endsWith('__')))return <strong key={i}><TranslatedText text={part.slice(2,-2)}/></strong>;
  if(part.startsWith('*')&&part.endsWith('*'))return <em key={i}><TranslatedText text={part.slice(1,-1)}/></em>;
  return <TranslatedText key={i} text={part}/>;
 });
}
export default function ChatMessage({text}:{text:string}){
 const lines=text.replace(/\r\n?/g,'\n').split('\n'),nodes:ReactNode[]=[];let i=0;
 while(i<lines.length){
  if(!lines[i].trim()){i++;continue;}
  const key=i,fence=lines[i].match(/^\s*```(.*)$/);
  if(fence){const code:string[]=[];i++;while(i<lines.length&&!/^\s*```\s*$/.test(lines[i]))code.push(lines[i++]);if(i<lines.length)i++;nodes.push(<pre key={key}><code>{code.join('\n')}</code></pre>);continue;}
  const heading=lines[i].match(/^#{1,6}\s+(.+)$/);
  if(heading){nodes.push(<p className="rp-chat-heading" key={key}>{inline(heading[1])}</p>);i++;continue;}
  const list=lines[i].match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);
  if(list){const ordered=!!list[2],items:ReactNode[]=[];while(i<lines.length){const m=lines[i].match(/^\s*(?:([-+*])|(\d+)[.)])\s+(.+)$/);if(!m||!!m[2]!==ordered)break;items.push(<li key={i}>{inline(m[3])}</li>);i++;}nodes.push(ordered?<ol key={key} start={Number(list[2])}>{items}</ol>:<ul key={key}>{items}</ul>);continue;}
  const paragraph:string[]=[];let mathOpen=false;
  while(i<lines.length){const line=lines[i];if(!mathOpen&&(!line.trim()||paragraph.length&&/^\s*(?:#{1,6}\s|```|[-+*]\s|\d+[.)]\s)/.test(line)))break;paragraph.push(line);for(const token of line.match(/(?<!\\)\$\$|\\\[|\\\]/g)||[])if(token==='$$')mathOpen=!mathOpen;else mathOpen=token==='\\[';i++;}
  nodes.push(<p key={key}>{inline(paragraph.join('\n'))}</p>);
 }
 return <>{nodes}</>;
}
