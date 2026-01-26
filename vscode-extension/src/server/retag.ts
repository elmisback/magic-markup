import OpenAI from "openai";

// import dotenv from 'dotenv'

function normalizeStringAndMapPositions(str: string) {
  // Handle null or undefined input
  if (!str) {
    console.warn("Null or undefined string passed to normalizeStringAndMapPositions");
    return { normalized: "", positionMap: [0] };
  }

  try {
    let normalized = "";
    let positionMap = [];

    // Always start with position 0
    positionMap.push(0);

    // Normalize the string by collapsing whitespace and mapping positions
    let previousWasWhitespace = false;

    for (let i = 0; i < str.length; i++) {
      const isWhitespace = /\s/.test(str[i]);

      if (isWhitespace) {
        // Only add a single space for consecutive whitespace characters
        if (!previousWasWhitespace) {
          normalized += " ";
          positionMap.push(i);
          previousWasWhitespace = true;
        }
      } else {
        // Add non-whitespace character as is
        normalized += str[i];
        positionMap.push(i);
        previousWasWhitespace = false;
      }
    }

    // Ensure positionMap has at least one entry
    if (positionMap.length === 0) {
      positionMap.push(0);
    }

    return { normalized, positionMap };
  } catch (e) {
    console.error("Error in normalizeStringAndMapPositions:", e);
    return { normalized: "", positionMap: [0] };
  }
}

function findOriginalPositions(
  originalStr: string,
  matchStart: number,
  matchEnd: number,
  positionMap: number[]
) {
  try {
    // Validate inputs
    if (matchStart < 0 || matchEnd < matchStart ||
        matchStart >= positionMap.length || matchEnd >= positionMap.length) {
      throw new Error(`Invalid match positions: start=${matchStart}, end=${matchEnd}, mapLength=${positionMap.length}`);
    }

    // Carefully compute start position
    let originalStart;
    if (matchStart + 1 < positionMap.length) {
      originalStart = positionMap[matchStart + 1] - 1;
    } else {
      // Fall back to direct match if we're at the end of the position map
      originalStart = positionMap[matchStart];
    }

    // Validate originalStart
    if (originalStart < 0 || originalStart >= originalStr.length) {
      originalStart = Math.max(0, Math.min(originalStr.length - 1, positionMap[matchStart]));
    }

    // Carefully compute end position
    let originalEnd;
    if (matchEnd < positionMap.length) {
      originalEnd = positionMap[matchEnd];
      // Adjust end position based on whether it ends with whitespace
      if (originalEnd < originalStr.length && originalStr[originalEnd] !== " ") {
        originalEnd += 1;
      }
    } else {
      // Fall back to string length if we're beyond the position map
      originalEnd = originalStr.length;
    }

    // Validate originalEnd
    if (originalEnd <= originalStart || originalEnd > originalStr.length) {
      originalEnd = Math.min(originalStr.length, originalStart + 1);
    }

    return { originalStart, originalEnd };
  } catch (e) {
    console.error("Error in findOriginalPositions:", e);
    // Return safe defaults that won't crash the application
    return {
      originalStart: Math.max(0, Math.min(originalStr.length - 1, matchStart)),
      originalEnd: Math.min(originalStr.length, Math.max(matchStart + 1, matchEnd))
    };
  }
}

function findStartAndEndNormalized(largerString: string, substring: string, nthOccurence = 0) {
  // Add validation for inputs
  if (!largerString || !substring) {
    console.error("Invalid inputs to findStartAndEndNormalized:", { largerString: !!largerString, substring: !!substring });
    return { start: -1, end: -1 };
  }

  try {
    // Normalize and map positions
    const { normalized: normalizedLargerString, positionMap } =
      normalizeStringAndMapPositions(largerString);
    const { normalized: normalizedSubstring } = normalizeStringAndMapPositions(substring);

    // If either normalization resulted in empty strings, return not found
    if (!normalizedLargerString || !normalizedSubstring) {
      console.warn("Normalization resulted in empty strings");
      return { start: -1, end: -1 };
    }

    // Find the nth occurrence of the substring
    let matchStart = -1;
    let currentIndex = 0;
    let currentOccurrence = 0;

    // Handle case where nthOccurence is 0 (treat as first occurrence)
    const targetOccurrence = nthOccurence === 0 ? 1 : nthOccurence;

    while (currentOccurrence < targetOccurrence) {
      matchStart = normalizedLargerString.indexOf(normalizedSubstring, currentIndex);

      if (matchStart === -1) {
        // Not enough occurrences found
        console.warn(`Could not find occurrence ${targetOccurrence} of substring in text`);
        return { start: -1, end: -1 };
      }

      currentOccurrence++;
      if (currentOccurrence < targetOccurrence) {
        currentIndex = matchStart + 1;
      }
    }

    const matchEnd = matchStart + normalizedSubstring.length - 1;

    // Make sure we have valid indices before trying to find original positions
    if (matchStart >= 0 && matchEnd >= matchStart &&
        matchStart < positionMap.length && matchEnd < positionMap.length) {

      // Find original positions
      const { originalStart, originalEnd } = findOriginalPositions(
        largerString,
        matchStart,
        matchEnd,
        positionMap
      );

      return {
        start: originalStart,
        end: originalEnd,
      };
    } else {
      console.warn("Invalid match indices:", { matchStart, matchEnd, positionMapLength: positionMap.length });
      return { start: -1, end: -1 };
    }
  } catch (e) {
    console.error("Error in findStartAndEndNormalized:", e);
    return { start: -1, end: -1 };
  }
}

type CodeUpdate = {
  codeWithSnippetDelimited: string;
  updatedCodeWithSnippetDelimited: string;
  delimiter: string;
};

const prompt_breakdown11 = (t: CodeUpdate) => `Consider the following file:

<INPUT>
${t.codeWithSnippetDelimited
  .split("\n")
  .map((l, i) => i + 1 + ":" + l)
  .join("\n")}
</INPUT>

A specific segment of code has been marked with "${
  t.delimiter
}". The segment refers to ONLY THE TEXT BETWEEN THE "${t.delimiter}" marks:

<SEGMENT>
${t.codeWithSnippetDelimited.slice(
  t.codeWithSnippetDelimited.indexOf(t.delimiter) + 1,
  t.codeWithSnippetDelimited.lastIndexOf(t.delimiter)
)}
</SEGMENT>

Next, consider the following updated file:

<UPDATED>
${t.updatedCodeWithSnippetDelimited
  .replaceAll(t.delimiter, "")
  .split("\n")
  .map((l, i) => i + 1 + ":" + l)
  .join("\n")}
</UPDATED>

You are responsible for placing an identical annotation on this updated file. It is extremely important that you place the annotation in the correct place. Important metadata is attached to this segment.

Describe possible sections the specific segment could be said to be located in. It is possible the segment has not changed, or that it has been refactored. Pick the most correct choice. Remember to be detailed about the start and stop of the segment. If the segment has been updated, it may need to expand or shrink. BE CAREFUL TO INCLUDE NOTHING EXTRA. Then, provide the following numbered answers as a JSON object:

1) Print ONLY the text of the updated specific segment. You must print all of the text here.

2) State ONLY the line number in UPDATED that (1) starts on.

3) State ONLY the line number in UPDATED that (1) ends on.

4) (1) may occur multiple times in the section given by [(2),(3)]. Which number occurrence, as ONLY a 1-indexed number, is (1)?

The object must look like: {1: <code>, 2: <number>, 3: <number>, 4: <number>}

The answer to 1 should be a code string only, without markdown formatting or extra notes.`;

import vscode from 'vscode';

async function copilotPromptGPTForJSON(t: string) {
  const craftedPrompt = [
    vscode.LanguageModelChatMessage.User(
      'You are a helpful assistant designed to output JSON. ONLY output raw JSON. Do not emit markdown formatting.'
    ),
    vscode.LanguageModelChatMessage.User(t),
    vscode.LanguageModelChatMessage.User('Now respond with the JSON object only. ONLY output raw JSON. Do not emit markdown formatting.')
  ];

  try {
    console.log('Selecting model...');
    // Try to select the model with a timeout
    const modelSelection = await Promise.race([
      vscode.lm.selectChatModels({ vendor: 'copilot', family: 'gpt-4o' }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)) // 10 second timeout
    ]);

    // Check if model selection timed out or returned null/empty array
    if (!modelSelection || !Array.isArray(modelSelection) || modelSelection.length === 0) {
      console.error('Model selection failed or timed out');
      throw new Error('Failed to select language model: Timeout or no models available');
    }

    const [model] = modelSelection;
    console.log('Selected model:', model);

    // Create a cancellation token with a timeout
    const cts = new vscode.CancellationTokenSource();
    const timeoutMs = 30000; // 30 seconds
    const timeout = setTimeout(() => cts.cancel(), timeoutMs);

    try {
      const response = await model.sendRequest(craftedPrompt, {}, cts.token);
      console.log('Got response:', response);

      let fullResponse = '';
      for await (const chunk of response.text) {
        console.debug('Got chunk:', chunk);
        fullResponse += chunk;
      }

      // Clear the timeout since we got a response
      clearTimeout(timeout);

      if (!fullResponse || fullResponse.trim() === '') {
        throw new Error('Empty response from language model');
      }

      return fullResponse;
    } finally {
      clearTimeout(timeout);
      cts.dispose();
    }
  } catch (err) {
    // Making the chat request might fail because
    // - model does not exist
    // - user consent not given
    // - quota limits were exceeded
    // - timeout occurred

    let errorMessage = 'Language model request failed';

    if (err instanceof vscode.LanguageModelError) {
      console.error('Problem with extension LM api:', err.message, err.code, err.cause);
      errorMessage = `Language model error: ${err.message}`;

      if (err.cause instanceof Error) {
        if (err.cause.message.includes('off_topic')) {
          errorMessage = 'The model considers this request off-topic';
        }
      }
    } else if (err instanceof Error) {
      errorMessage = err.message;
    }

    console.error('Error in copilotPromptGPTForJSON:', errorMessage);
    throw new Error(errorMessage);
  }
}

const retagUpdate = async (
  codeWithSnippetDelimited: string,
  updatedCodeWithoutDelimiters: string,
  delimiter: string
) => {
  // Validate inputs
  if (!codeWithSnippetDelimited || !updatedCodeWithoutDelimiters || !delimiter) {
    return {
      error: new Error("Missing required parameters for retagging"),
      errorType: "validation"
    };
  }

  console.log("Retagging with delimiter:", delimiter);
  console.log("Original code length:", codeWithSnippetDelimited.length);
  console.log("Updated code length:", updatedCodeWithoutDelimiters.length);

  // Check if delimiter exists in the input code
  if (!codeWithSnippetDelimited.includes(delimiter)) {
    return {
      error: new Error("Delimiter not found in input code"),
      errorType: "validation"
    };
  }

  let gptOut = "";
  try {
    // Create the prompt for the language model
    const promptText = prompt_breakdown11({
      codeWithSnippetDelimited,
      updatedCodeWithSnippetDelimited: updatedCodeWithoutDelimiters,
      delimiter,
    });

    // Get response from language model
    gptOut = await copilotPromptGPTForJSON(promptText) || '';
    console.log("LM Response:", gptOut.substring(0, 200) + (gptOut.length > 200 ? "..." : ""));

    // Check if response is empty
    if (!gptOut || gptOut.trim() === '') {
      return {
        error: new Error("Empty response from language model"),
        errorType: "model",
        prompt: promptText
      };
    }
  } catch (e) {
    console.error("Error getting response from language model:", e);
    return {
      error: e instanceof Error ? e : new Error(String(e)),
      errorType: "model"
    };
  }

  // Parse the JSON response
  let gptRetaggingJSON;
  try {
    gptRetaggingJSON = JSON.parse(gptOut);
    console.log("Parsed JSON:", gptRetaggingJSON);

    // Validate the expected JSON structure
    if (!gptRetaggingJSON ||
        typeof gptRetaggingJSON !== 'object' ||
        !gptRetaggingJSON[1] ||
        !gptRetaggingJSON[2] ||
        !gptRetaggingJSON[3] ||
        !gptRetaggingJSON[4]) {
      return {
        error: new Error("Invalid JSON structure in model response"),
        errorType: "JSON validation",
        gptOut
      };
    }

    // Validate the types of JSON values
    if (typeof gptRetaggingJSON[1] !== 'string' ||
        typeof gptRetaggingJSON[2] !== 'number' ||
        typeof gptRetaggingJSON[3] !== 'number' ||
        typeof gptRetaggingJSON[4] !== 'number') {
      return {
        error: new Error("Invalid data types in model response"),
        errorType: "JSON validation",
        gptOut
      };
    }

    // Validate the ranges of line numbers
    const lineCount = updatedCodeWithoutDelimiters.split('\n').length;
    if (gptRetaggingJSON[2] < 1 ||
        gptRetaggingJSON[3] < gptRetaggingJSON[2] ||
        gptRetaggingJSON[2] > lineCount ||
        gptRetaggingJSON[3] > lineCount) {
      return {
        error: new Error(`Invalid line numbers: [${gptRetaggingJSON[2]}, ${gptRetaggingJSON[3]}], document has ${lineCount} lines`),
        errorType: "range validation",
        gptOut
      };
    }

  } catch (e) {
    console.error("Error parsing JSON from model response:", e);
    return {
      error: e instanceof Error ? e : new Error(String(e)),
      errorType: "JSON parse",
      gptOut
    };
  }

  // Helper type for the parameter structure
  type UpdateParameters = {
    code: string;
    snippet: string;
    lineStart: number;
    lineEnd: number;
    nthOccurrence: number;
    delimiterStart: string;
    delimiterEnd: string;
  };

  // Function to compute the new position of the annotation
  const computeUpdatedCodeWithSnippetRetagged = ({
    code,
    snippet,
    lineStart,
    lineEnd,
    nthOccurrence,
    delimiterStart,
    delimiterEnd,
  }: UpdateParameters) => {
    // Validate function inputs
    if (!code || !snippet || lineStart < 1 || lineEnd < lineStart) {
      throw new Error(`Invalid parameters: code=${!!code}, snippet=${!!snippet}, lineStart=${lineStart}, lineEnd=${lineEnd}`);
    }

    console.log(`Computing annotation position: lines ${lineStart}-${lineEnd}, occurrence #${nthOccurrence}`);
    console.log(`Snippet (first 50 chars): ${snippet.substring(0, 50)}${snippet.length > 50 ? "..." : ""}`);

    // Note lineStart and lineEnd are 1-indexed.
    // Get the section of code where we expect to find the snippet
    let sectionString = code
      .split("\n")
      .slice(lineStart - 1, lineEnd)
      .join("\n");

    let lenUpToSection = code
      .split("\n")
      .slice(0, lineStart - 1)
      .map((s) => s + "\n")
      .join("").length;

    // Try to find the snippet in the section
    let snippetIdxInSection = findStartAndEndNormalized(sectionString, snippet, nthOccurrence);

    // If not found, expand the search area by one line in each direction
    if (snippetIdxInSection.start === -1) {
      console.log("Snippet not found in initial section, expanding search area");
      lineStart = Math.max(1, lineStart - 1);
      lineEnd = Math.min(lineEnd + 1, code.split("\n").length);

      sectionString = code
        .split("\n")
        .slice(lineStart - 1, lineEnd)
        .join("\n");

      lenUpToSection = code
        .split("\n")
        .slice(0, lineStart - 1)
        .map((s) => s + "\n")
        .join("").length;

      snippetIdxInSection = findStartAndEndNormalized(sectionString, snippet, nthOccurrence);

      // If still not found, throw an error
      if (snippetIdxInSection.start === -1) {
        throw new Error(`Snippet not found in code section (lines ${lineStart}-${lineEnd})`);
      }
    }

    // Compute the absolute positions in the file
    const leftIdx = lenUpToSection + snippetIdxInSection.start;
    const rightIdx = leftIdx + snippetIdxInSection.end - snippetIdxInSection.start;

    // Validate the calculated indices
    if (leftIdx < 0 || rightIdx > code.length || leftIdx >= rightIdx) {
      throw new Error(`Invalid annotation indices: leftIdx=${leftIdx}, rightIdx=${rightIdx}, codeLength=${code.length}`);
    }

    console.log(`Found snippet at positions ${leftIdx}-${rightIdx}`);

    // Return the updated code with delimiters and the positions
    return {
      updatedCodeWithDelimiters:
        code.slice(0, leftIdx) +
        delimiterStart +
        code.slice(leftIdx, rightIdx) +
        delimiterEnd +
        code.slice(rightIdx, code.length),
      leftIdx,
      rightIdx,
    };
  };

  // Try to compute the new annotation position
  try {
    console.log("Attempting to compute updated annotation position");
    const out = computeUpdatedCodeWithSnippetRetagged({
      code: updatedCodeWithoutDelimiters,
      snippet: gptRetaggingJSON[1],
      lineStart: gptRetaggingJSON[2],
      lineEnd: gptRetaggingJSON[3],
      nthOccurrence: gptRetaggingJSON[4],
      delimiterStart: delimiter,
      delimiterEnd: delimiter,
    });

    console.log("Successfully retagged annotation at:", out.leftIdx, out.rightIdx);
    return { gptRetaggingJSON, out };
  } catch (e) {
    console.error("Error computing annotation position:", e);
    return {
      error: e instanceof Error ? e : new Error(String(e)),
      errorType: "snippet matching",
      gptOut,
      gptRetaggingJSON,
    };
  }
};

export default retagUpdate;
