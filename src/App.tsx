import { useState } from 'react';
import Prototype from './Prototype';
import DesktopApp from './DesktopApp';
import './desktop.css';
export default function App() {
  const [demo, setDemo] = useState(false);
  return demo ? <><button className="rp-exit-demo" onClick={() => setDemo(false)}>退出示例 · 返回真实文献库</button><Prototype /></> : <DesktopApp onDemo={() => setDemo(true)} />;
}
