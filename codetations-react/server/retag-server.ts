// expose an express server endpoint
import express from 'express'
import retagUpdate from './retag.js'

const serverRetagEndpoint = async (req: express.Request, res: express.Response) => {
  console.log('Retagging document')
  const { codeWithSnippetDelimited, updatedCodeWithoutDelimiters, delimiter, APIKey } = req.body
  
  const out = await retagUpdate(codeWithSnippetDelimited, updatedCodeWithoutDelimiters, delimiter, APIKey)

  res.json(out)
}

const app = express()
app.use(express.json())


// permit CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept')
  next()
})

app.post('/retag', serverRetagEndpoint)

app.listen(3004, () => {
  console.log('Server listening on port 3004')
})