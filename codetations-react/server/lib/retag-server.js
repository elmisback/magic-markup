var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import express from 'express';
import retagUpdate from './retag.js';
const serverRetagEndpoint = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    console.log('Retagging document');
    const { codeWithSnippetDelimited, updatedCodeWithoutDelimiters, delimiter } = req.body;
    const out = yield retagUpdate(codeWithSnippetDelimited, updatedCodeWithoutDelimiters, delimiter);
    res.json(out);
});
const app = express();
app.use(express.json());
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});
app.post('/retag', serverRetagEndpoint);
app.listen(3004, () => {
    console.log('Server listening on port 3004');
});
//# sourceMappingURL=retag-server.js.map