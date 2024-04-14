import React, { useState } from 'react';
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createPrompt } from './prompt';

interface FormProps {
  apiKey: string;
}

const FormComponent: React.FC<FormProps> = ({ apiKey }) => {
  const [inputExpression, setInputExpression] = useState<string>('');
  const [result, setResult] = useState<string>('');

  const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputExpression(event.target.value);
  };

  const genAI = new GoogleGenerativeAI(apiKey);

  async function LLM_convert() {
    const model = genAI.getGenerativeModel({ model: "gemini-pro"});

    const prompt = createPrompt(inputExpression);

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    return text;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    let mathjs_result = 'sqrt(x^2 * log(x)) - sin(x) * 5cos(y)';

    try {
      mathjs_result = await LLM_convert();
    } catch (error) {
      console.error('Error:', error);
    }

    // Open Odyssey
    const expr = encodeURIComponent(mathjs_result);
    window.open(`https://herbie-fp.github.io/odyssey/?expr=${expr}`);
  };

  return (
    <div>
      <form onSubmit={handleSubmit}>
        <div>
          <label htmlFor="code">Enter your code:</label>
          <textarea
            id="code"
            value={inputExpression}
            onChange={handleChange}
            rows={10}
            cols={50}
          />
        </div>
        <button type="submit">Submit</button>
      </form>
      {result && (
        <div>
          <h2>Response:</h2>
          <p>{result}</p>
        </div>
      )}
    </div>
  );
};

export default FormComponent;
