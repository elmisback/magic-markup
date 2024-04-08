import React from 'react'
import ColorPicker from './ColorPicker'

function Main() {
  return (<div>
    <h1>Test App</h1>
    <ColorPicker value={ {
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
    }} setValue={ () => undefined} />
    <p>Test app for testing the framework</p>
  </div>)
}

export default Main