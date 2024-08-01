import OpenAI from "openai";

// import dotenv from 'dotenv'

function normalizeStringAndMapPositions(str: string) {
  let normalized = "";
  let positionMap = [];
  let originalPosition = 0;

  for (let i = 0; i < str.length; i++) {
    if (str[i].match(/\s/) && (i === 0 || str[i - 1].match(/\s/))) {
      // Skip multiple whitespaces
      continue;
    }
    // Add character to normalized string and map its position
    normalized += str[i].match(/\s/) ? " " : str[i];
    positionMap.push(originalPosition);
    originalPosition = i + 1;
  }

  return { normalized, positionMap };
}

function findOriginalPositions(
  originalStr: string,
  matchStart: number,
  matchEnd: number,
  positionMap: number[]
) {
  // Adjust the positions based on the position map
  const originalStart = positionMap[matchStart + 1] - 1;
  const originalEnd = positionMap[matchEnd] + (originalStr[positionMap[matchEnd]] === " " ? 0 : 1);

  return { originalStart, originalEnd };
}

function findStartAndEndNormalized(largerString: string, substring: string, nthOccurence = 0) {
  // Normalize and map positions
  const { normalized: normalizedLargerString, positionMap } =
    normalizeStringAndMapPositions(largerString);
  const { normalized: normalizedSubstring } = normalizeStringAndMapPositions(substring);

  // Assume we found the match in the normalized strings (example positions)
  let matchStart = normalizedLargerString.indexOf(normalizedSubstring);
  let matchEnd = matchStart + normalizedSubstring.length - 1;

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

const retagUpdate = async (
  codeWithSnippetDelimited: string,
  updatedCodeWithoutDelimiters: string,
  delimiter: string,
  apiKey: string
) => {
  console.log(codeWithSnippetDelimited, updatedCodeWithoutDelimiters, delimiter);
  // const gptOut = await getFirstChoice(await getChatCompletion(
  //   'gpt-4-turbo-preview',
  //   [{role: 'user',
  //     content: prompt_breakdown9({codeWithSnippetDelimited,
  //                                 updatedCodeWithSnippetDelimited: updatedCodeWithoutDelimiters,
  //                                 delimiter})}]))
  // console.log(gptOut)

  // Initialize OpenAI object
  const openai = new OpenAI({
    apiKey: apiKey,
  });

  let gptOut = "";
  try {
    const gptOutCompletion = await openai.chat.completions.create({
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant designed to output JSON.",
        },
        {
          role: "user",
          content: prompt_breakdown11({
            codeWithSnippetDelimited,
            updatedCodeWithSnippetDelimited: updatedCodeWithoutDelimiters,
            delimiter,
          }),
        },
      ],
      model: "gpt-4-turbo",
      response_format: { type: "json_object" },
    });
    console.log(gptOutCompletion);

    gptOut = gptOutCompletion.choices[0]?.message.content || "";
    console.log(gptOut);
  } catch (e) {
    return { error: e, errorType: "model" };
  }
  let gptRetaggingJSON;
  try {
    gptRetaggingJSON = JSON.parse(gptOut);
    console.log(gptRetaggingJSON);
  } catch (e) {
    // (This should never happen based on the OpenAI documentation.)
    return { error: e, errorType: "JSON parse", gptOut };
  }
  // console.log(completion.choices[0].message.content);
  /* Unhandled issues:
   * the response may be incorrect; could check across several tries to mitigate
   * the response may be correct but there may be multiple correct responses; disambiguation needed
   * the response may have an unreadable format, leading to failure in the next part
   */

  // const gptRetaggingJSONString = (await askMX([
  //       { role: 'system',
  //         content: 'You are a text parser designed to output JSON.'},
  //       { role: 'user',
  //         content: retagPromptGPT(gptOut)}
  //   ])).trim() // sometimes Mixtral puts a space in front of the response...
  // console.log(gptRetaggingJSONString)
  // const gptRetaggingJSON = JSON.parse(gptRetaggingJSONString)
  /* Unhandled issues:
   * the response may be incorrect given the input
   * failure to parse
   */

  type UpdateParameters = {
    code: string;
    snippet: string;
    lineStart: number;
    lineEnd: number;
    nthOccurrence: number;
    delimiterStart: string;
    delimiterEnd: string;
  };

  const computeUpdatedCodeWithSnippetRetagged = ({
    code,
    snippet,
    lineStart,
    lineEnd,
    nthOccurrence,
    delimiterStart,
    delimiterEnd,
  }: UpdateParameters) => {
    // Note lineStart and lineEnd are 1-indexed.
    /* We expand the search by one line if it fails on the identified segment to handle off-by-one issues. */
    /* NOTE expanded search was introduced after the initial evaluation.
    /* Unhandled issues:
      * any non-whitespace typos in the output (even e.g. missing comments) will cause a failure to match
      * potentially allowing the model to place the delimiter interactively 
        would guarantee placement in the "intended" location,
        but this is slow
    */

    let sectionString = code
      .split("\n")
      .slice(lineStart - 1, lineEnd)
      .join("\n");
    let lenUpToSection = code
      .split("\n")
      .slice(0, lineStart - 1)
      .map((s) => s + "\n")
      .join("").length;
    let snippetIdxInSection = findStartAndEndNormalized(sectionString, snippet, nthOccurrence);
    if (snippetIdxInSection.start === -1) {
      lineStart = Math.max(0, lineStart - 1);
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
    }
    // const sectionString = code.split('\n').slice(lineStart - 1, lineEnd).join('\n')
    // const lenUpToSection = code.split('\n').slice(0, lineStart - 1).map(s=>s + '\n').join('').length
    // const snippetIdxInSection = findStartAndEndNormalized(sectionString, snippet, nthOccurrence)
    const leftIdx = lenUpToSection + snippetIdxInSection.start;
    const rightIdx = leftIdx + snippetIdxInSection.end - snippetIdxInSection.start;
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
  try {
    const out = computeUpdatedCodeWithSnippetRetagged({
      code: updatedCodeWithoutDelimiters,
      snippet: gptRetaggingJSON[1],
      lineStart: gptRetaggingJSON[2],
      lineEnd: gptRetaggingJSON[3],
      nthOccurrence: gptRetaggingJSON[4],
      delimiterStart: delimiter,
      delimiterEnd: delimiter,
    });

    console.log(out);

    return { gptRetaggingJSON, out };
  } catch (e) {
    return {
      error: e,
      errorType: "snippet matching",
      gptOut,
      gptRetaggingJSON,
    };
  }
};

export default retagUpdate;
