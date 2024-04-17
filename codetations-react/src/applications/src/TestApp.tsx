import ColorPicker from './ColorPicker'
import FPAnalyzer from './FPAnalyzer'
import { API_KEY } from './config'; // Make sure you have a config.ts file next to this that exports your Gemini API_KEY

function Main() {
  return (<div>
    <h1>Test App</h1>
    <ColorPicker value={{
      "document": "test original document #0000ff",
      "start": 23,
      "end": 31,
      "tool": "colorPicker",
      "metadata": {},
      "original": {
        "document": "test original document #0000FF",
        "start": 23,
        "end": 31
      }
    }} setValue={() => undefined} utils={{ getText: () => '#0000ff', setText: (v: string) => console.log('Got value', v) }} />
    
    <FPAnalyzer apiKey={API_KEY}/>
    
  </div>)
}

export default Main